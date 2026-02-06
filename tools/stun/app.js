  const $ = id => document.getElementById(id);
  const logEl = $("log");
  const statusEl = $("statusChat") || $("status");
  const nameInput = $("name");
  const noteToggle = $("noteToggle");
  const howTo = $("howTo");
  const chatControls = $("chatControls");
  const setNameBtn = $("setNameBtn");
  const attachInput = $("attachInput");
  const attachBtn = $("attachBtn");
  const attachInfo = $("attachInfo");
  const debugToggle = $("debugToggle");
  const debugModal = $("debugModal");
  const debugContent = $("debugContent");
  const debugClose = $("debugClose");
  const ackNoteBtn = $("ackNoteBtn");
  const disclaimer = $("disclaimer");
  const roomInput = $("roomCode");
  const passwordInput = $("roomPassword");
  const joinRoomBtn = $("joinRoomBtn");
  const newRoomBtn = $("newRoomBtn");
  const hostBtn = $("hostBtn");
  const leaveBtn = $("leaveBtn");
  const roomStatus = $("roomStatus");
  const mqttStatus = $("mqttStatus");
  const stunStatus = $("stunStatus");
  const webrtcStatus = $("webrtcStatus");
  const NAME_KEY = "p2p-username";
  const ACK_KEY = "p2p-security-ack";
  const ROOM_KEY = "p2p-room";
  const MQTT_URL = "wss://broker.emqx.io:8084/mqtt";
  const TOPIC_PREFIX = "flims/p2pchat";
  const SIGNAL_CLIENT_ID = `flims-${Math.random().toString(36).slice(2, 10)}`;

  const firstNames = [
    "Crimson","Ruby","Scarlet","Garnet","Ember","Brick","Cinder","Maroon","Sienna","Copper",
    "Rust","Flare","Forge","Blaze","Ash","Coal","Char","Sable","Flint","Talon",
    "Onyx","Vermilion","Cardinal","Carmine","Sear","Molten","Beryl","Iron","Sparks","Kindle"
  ];
  const lastNames = [
    "Signal","Channel","Echo","Pulse","Relay","Circuit","Link","Wave","Beacon","Path",
    "Route","Stream","Trace","Line","Cable","Fiber","Tunnel","Bridge","Port","Socket",
    "Packet","Node","Hub","Mesh","Switch","Carrier","Span","Flow","Chord","Current"
  ];

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const randomName = () => `${pick(firstNames)} ${pick(lastNames)}`;
  const scrollToBottom = () => {
    if (!logEl) return;
    logEl.scrollTop = logEl.scrollHeight;
    requestAnimationFrame(() => { logEl.scrollTop = logEl.scrollHeight; });
  };
  let pc = null;
  let dc = null;
  let localCandidates = [];
  let pendingRemoteCandidates = [];
  let remoteDescriptionSet = false;
  const peers = new Map();
  let hostSignalId = "";
  let role = null;
  let localName = "You";
  let peerName = "Peer";
  let noteVisible = false;
  let fileIdCounter = 1;
  const pendingOutgoingFiles = {};
  const incomingTransfers = {};
  const outgoingTransfers = {};
  let memorySavedName = null;
  let pendingAttachment = null;
  let logClearedForConnect = false;
  let hasAcked = false;
  let mqttClient = null;
  let mqttReady = false;
  let activeRoom = "";
  let activeTopic = "";
  let connectNonce = 0;
  let activePassword = "";
  let joinAuthenticated = false;
  let activePeerId = "";
  let joinRetryTimer = null;
  const broadcastGroups = new Map();

  function loadSavedName() {
    try {
      const v = localStorage.getItem(NAME_KEY);
      if (v !== null) return v;
    } catch {}
    try {
      const v = sessionStorage.getItem(NAME_KEY);
      if (v !== null) return v;
    } catch {}
    if (memorySavedName !== null) return memorySavedName;
    return null;
  }
  function loadAck() {
    try {
      const v = localStorage.getItem(ACK_KEY);
      if (v === "1") return true;
    } catch {}
    return false;
  }

  function loadRoom() {
    try {
      const v = localStorage.getItem(ROOM_KEY);
      if (v) return v;
    } catch {}
    return "";
  }

  function saveRoom(value) {
    try { localStorage.setItem(ROOM_KEY, value); } catch {}
  }

  function updateRoomStatus(text) {
    if (roomStatus) roomStatus.textContent = text;
  }

  function setMqttStatus(text) {
    if (mqttStatus) mqttStatus.textContent = `MQTT: ${text}`;
  }

  function setStunStatus(text) {
    if (stunStatus) stunStatus.textContent = `STUN: ${text}`;
  }

  function setWebrtcStatus(text) {
    if (webrtcStatus) webrtcStatus.textContent = `WebRTC: ${text}`;
  }

  function generateRoomCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  async function deriveRoomKey(room, password) {
    const data = new TextEncoder().encode(`${room}:${password}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  async function hashValue(value) {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function createNonce() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  function closeSignal() {
    if (mqttClient) {
      mqttClient.end(true);
    }
    mqttClient = null;
    mqttReady = false;
    activeTopic = "";
    setMqttStatus("offline");
    clearJoinRetry();
  }

  function sendSignal(type, data, target) {
    if (!mqttReady || !activeRoom || !activeTopic) return;
    const payload = {
      t: type,
      room: activeRoom,
      from: localName,
      data,
      sender: SIGNAL_CLIENT_ID,
      ts: Date.now()
    };
    if (target) {
      payload.target = target;
    }
    if (data === undefined) {
      delete payload.data;
    }
    mqttClient.publish(activeTopic, JSON.stringify(payload));
  }

  function sendPacket(channel, payload) {
    if (!channel || channel.readyState !== "open") return false;
    channel.send(JSON.stringify(payload));
    return true;
  }

  function sendJoinSignal() {
    if (!mqttReady || !activeRoom || !activeTopic) return;
    mqttClient.publish(activeTopic, JSON.stringify({
      t: "join",
      room: activeRoom,
      from: localName,
      role,
      sender: SIGNAL_CLIENT_ID,
      ts: Date.now()
    }));
  }

  function clearJoinRetry() {
    if (joinRetryTimer) {
      clearInterval(joinRetryTimer);
      joinRetryTimer = null;
    }
  }

  function startJoinRetry() {
    clearJoinRetry();
    if (role !== "joiner") return;
    joinRetryTimer = setInterval(() => {
      if (role !== "joiner" || !mqttReady || !activeRoom) {
        clearJoinRetry();
        return;
      }
      sendJoinSignal();
    }, 2500);
  }

  async function connectSignal(room, password) {
    if (!room) return;
    if (!window.mqtt) {
      updateRoomStatus("Signaling unavailable");
      return;
    }
    if (!password) {
      updateRoomStatus("Password required");
      return;
    }
    activeRoom = room;
    saveRoom(room);
    updateRoomStatus(`Connecting to ${room}...`);
    closeSignal();
    setMqttStatus("connecting");
    const nonce = ++connectNonce;
    const roomKey = await deriveRoomKey(room, password);
    if (nonce !== connectNonce) return;
    activeTopic = `${TOPIC_PREFIX}/${roomKey}`;
    mqttClient = window.mqtt.connect(MQTT_URL, {
      clientId: SIGNAL_CLIENT_ID,
      clean: true,
      reconnectPeriod: 1500,
      connectTimeout: 4000
    });
    mqttClient.on("connect", () => {
      mqttClient.subscribe(activeTopic, (err) => {
        if (err) {
          mqttReady = false;
          updateRoomStatus("Signal error");
          setMqttStatus("error");
          return;
        }
        mqttReady = true;
        updateRoomStatus(`Connected to ${room}`);
        setMqttStatus("online");
        if (role === "caller") {
          setStatus("hosting");
          updateHostStatus();
        }
        sendJoinSignal();
        if (role === "joiner") {
          startJoinRetry();
        }
      });
    });
    mqttClient.on("reconnect", () => {
      mqttReady = false;
      setMqttStatus("reconnecting");
      updateRoomStatus("Reconnecting...");
    });
    mqttClient.on("close", () => {
      mqttReady = false;
      setMqttStatus("offline");
      updateRoomStatus("Disconnected");
    });
    mqttClient.on("error", () => {
      mqttReady = false;
      setMqttStatus("error");
      updateRoomStatus("Signal error");
    });
    mqttClient.on("message", async (_topic, payload) => {
      let msg;
      try {
        msg = JSON.parse(payload.toString());
      } catch {
        return;
      }
      if (msg.sender === SIGNAL_CLIENT_ID) return;
      const msgRoom = msg.room || msg.channel;
      if (msgRoom && activeRoom && msgRoom !== activeRoom) return;
      if (msg.target && msg.target !== SIGNAL_CLIENT_ID) return;
      const type = msg.t || msg.type;
      if (!type) return;
      const data = msg.data || msg.payload;
      if (type === "join") {
        if (role === "caller" && msg.role === "joiner") {
          handleJoinRequest(msg.sender, msg.from);
        }
        return;
      }
      if (type === "offer") {
        if (!data?.description) return;
        if (role !== "joiner") return;
        clearJoinRetry();
        hostSignalId = msg.sender || hostSignalId;
        await applyOfferFlow(data.description);
        return;
      }
      if (type === "answer") {
        if (!data?.description) return;
        if (role !== "caller") return;
        await applyHostAnswer(msg.sender, data.description);
        return;
      }
      if (type === "candidate") {
        if (!data?.candidate) return;
        if (role === "caller") {
          await handleHostCandidate(msg.sender, data.candidate);
        } else if (role === "joiner") {
          await handleRemoteCandidate(data.candidate);
        }
        return;
      }
      if (type === "leave") {
        if (role === "caller") {
          handlePeerLeave(msg.sender);
        } else if (role === "joiner") {
          handleHostLeave();
        }
      }
    });
  }

  function getConnectedPeerCount() {
    let count = 0;
    peers.forEach(peer => {
      if (peer.authenticated && peer.dc && peer.dc.readyState === "open") count += 1;
    });
    return count;
  }

  function updateHostStatus() {
    if (role !== "caller") return;
    const count = getConnectedPeerCount();
    if (activeRoom) {
      updateRoomStatus(`Hosting ${activeRoom} | ${count} online`);
    }
    $("sendBtn").disabled = count === 0;
    setWebrtcStatus(count > 0 ? `connected (${count})` : "hosting");
    if (count > 0) {
      setStatus("connected");
    } else if (mqttReady) {
      setStatus("hosting");
    }
  }

  function updateHostIceStatus() {
    if (role !== "caller") return;
    if (!peers.size) {
      setStunStatus("idle");
      return;
    }
    let connected = 0;
    let checking = 0;
    let failed = 0;
    peers.forEach(peer => {
      const state = peer.iceState || "new";
      if (state === "connected" || state === "completed") connected += 1;
      else if (state === "checking") checking += 1;
      else if (state === "failed") failed += 1;
    });
    if (failed) {
      setStunStatus("failed");
    } else if (checking) {
      setStunStatus("checking");
    } else if (connected) {
      setStunStatus(`connected (${connected})`);
    } else {
      setStunStatus("new");
    }
  }

  function broadcastToPeers(payload, excludeId = "") {
    const message = JSON.stringify(payload);
    peers.forEach(peer => {
      if (peer.id === excludeId) return;
      if (peer.authenticated && peer.dc && peer.dc.readyState === "open") {
        peer.dc.send(message);
      }
    });
  }

  function makeBroadcastId(senderId, id) {
    return `b|${senderId}|${id}`;
  }

  function parseBroadcastId(id) {
    if (typeof id !== "string" || !id.startsWith("b|")) return null;
    const parts = id.split("|");
    if (parts.length < 3) return null;
    return { senderId: parts[1], originalId: parts.slice(2).join("|") };
  }

  function getAttachmentTargets() {
    if (role === "caller") {
      const targets = [];
      peers.forEach(peer => {
        if (peer.authenticated && peer.dc && peer.dc.readyState === "open") {
          targets.push({ channel: peer.dc, name: peer.name || "Peer", peerId: peer.id });
        }
      });
      return targets;
    }
    if (role === "joiner") {
      if (!joinAuthenticated || !dc || dc.readyState !== "open") return [];
      return [{ channel: dc, name: peerName || "Host" }];
    }
    return [];
  }

  function clearPendingAttachmentUi() {
    pendingAttachment = null;
    $("msg").value = "";
    $("msg").readOnly = false;
    $("msg").placeholder = "Message";
    if (attachInfo) {
      attachInfo.classList.add("hide");
      attachInfo.textContent = "";
    }
    $("msg").classList.remove("hide");
  }

  function sendAuthChallenge(peer) {
    if (!peer || !peer.dc || peer.dc.readyState !== "open") return;
    peer.authNonce = createNonce();
    peer.authenticated = false;
    peer.dc.send(JSON.stringify({ t: "auth-challenge", v: peer.authNonce }));
    if (peer.authTimer) clearTimeout(peer.authTimer);
    peer.authTimer = setTimeout(() => {
      if (!peer.authenticated) {
        peer.dc.send(JSON.stringify({ t: "auth-fail" }));
        handlePeerLeave(peer.id);
      }
    }, 10000);
  }

  function handleJoinRequest(peerId, displayName) {
    if (!peerId || peers.has(peerId)) return;
    createHostPeer(peerId, displayName);
  }

  function attachHostChannel(peerId, channel) {
    const peer = peers.get(peerId);
    if (!peer) return;
    peer.dc = channel;
    channel.onopen = () => {
      updateHostStatus();
      sendAuthChallenge(peer);
    };
    channel.onmessage = event => handleHostMessage(peerId, event.data);
    channel.onclose = () => handlePeerLeave(peerId);
  }

  async function createHostPeer(peerId, displayName) {
    const pc = new RTCPeerConnection(rtcConfig);
    const peer = {
      id: peerId,
      name: displayName || "Peer",
      pc,
      dc: null,
      pendingCandidates: [],
      remoteDescriptionSet: false,
      authenticated: false,
      authNonce: "",
      authTimer: null,
      iceState: "new",
      announced: false
    };
    peers.set(peerId, peer);

    pc.onicecandidate = event => {
      if (!event.candidate) return;
      sendSignal("candidate", { candidate: event.candidate }, peerId);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        handlePeerLeave(peerId);
        return;
      }
      updateHostStatus();
    };

    pc.oniceconnectionstatechange = () => {
      peer.iceState = pc.iceConnectionState;
      updateHostIceStatus();
    };

    const channel = pc.createDataChannel("chat");
    attachHostChannel(peerId, channel);
    pc.ondatachannel = event => attachHostChannel(peerId, event.channel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal("offer", { description: pc.localDescription }, peerId);
    log({ kind: "info", text: `Offer sent to ${peer.name}` });
  }

  async function applyHostAnswer(peerId, description) {
    const peer = peers.get(peerId);
    if (!peer || !description) return;
    await peer.pc.setRemoteDescription(new RTCSessionDescription(description));
    peer.remoteDescriptionSet = true;
    await flushHostCandidates(peer);
  }

  async function handleHostCandidate(peerId, candidateData) {
    const peer = peers.get(peerId);
    if (!peer || !candidateData) return;
    const candidate = new RTCIceCandidate(candidateData);
    if (peer.remoteDescriptionSet) {
      try { await peer.pc.addIceCandidate(candidate); } catch {}
    } else {
      peer.pendingCandidates.push(candidate);
    }
  }

  async function flushHostCandidates(peer) {
    if (!peer.remoteDescriptionSet || !peer.pendingCandidates.length) return;
    const pending = [...peer.pendingCandidates];
    peer.pendingCandidates = [];
    for (const candidate of pending) {
      try { await peer.pc.addIceCandidate(candidate); } catch {}
    }
  }

  function handlePeerLeave(peerId) {
    const peer = peers.get(peerId);
    if (!peer) return;
    if (peer.authTimer) {
      clearTimeout(peer.authTimer);
    }
    if (peer.dc) peer.dc.close();
    if (peer.pc) peer.pc.close();
    peers.delete(peerId);
    if (activePeerId === peerId) activePeerId = "";
    updateHostStatus();
    updateHostIceStatus();
    if (peer.name) {
      log({ kind: "info", text: `${peer.name} disconnected` });
      broadcastToPeers({ t: "chat", n: "System", v: `${peer.name} left` }, peerId);
    }
  }

  function handleHostLeave() {
    log({ kind: "info", text: "Host disconnected." });
    reset({ preserveRole: false });
    updateRoomStatus("Disconnected");
  }

  function handleHostMessage(peerId, data) {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch {
      return;
    }
    const peer = peers.get(peerId);
    if (!peer) return;
    if (!peer.authenticated) {
      if (msg.t !== "auth-response") {
        return;
      }
      if (!activePassword || !peer.authNonce || !msg.v) {
        peer.dc.send(JSON.stringify({ t: "auth-fail" }));
        handlePeerLeave(peerId);
        return;
      }
      hashValue(`${activePassword}:${peer.authNonce}`).then(expected => {
        if (expected === msg.v) {
          peer.authenticated = true;
          if (peer.authTimer) clearTimeout(peer.authTimer);
          activePeerId = peerId;
          peer.dc.send(JSON.stringify({ t: "auth-ok" }));
          peer.dc.send(JSON.stringify({ t: "name", v: localName }));
          updateHostStatus();
          updateHostIceStatus();
        } else {
          peer.dc.send(JSON.stringify({ t: "auth-fail" }));
          handlePeerLeave(peerId);
        }
      }).catch(() => {
        peer.dc.send(JSON.stringify({ t: "auth-fail" }));
        handlePeerLeave(peerId);
      });
      return;
    }
    activePeerId = peerId;
    if (msg.t && msg.t.startsWith("file-")) {
      if (parseBroadcastId(msg.id)) {
        return;
      }
      if (msg.t === "file-request") {
        sendPacket(peer.dc, { t: "file-accept", id: msg.id });
        return;
      }
      if (msg.t === "file-send-start" || msg.t === "file-chunk" || msg.t === "file-cancel") {
        const broadcastId = makeBroadcastId(peerId, msg.id);
        broadcastToPeers(
          { ...msg, id: broadcastId, name: msg.name || peer.name || "Peer" },
          peerId
        );
      }
      handleFileMessage(msg, { fromName: msg.name || peer.name, channel: peer.dc });
      return;
    }
    if (msg.t === "name") {
      const nextName = (msg.v || "Peer").trim() || "Peer";
      peer.name = nextName;
      if (!peer.announced) {
        peer.announced = true;
        log({ kind: "info", text: `${nextName} joined the chat` });
        broadcastToPeers({ t: "chat", n: "System", v: `${nextName} joined` }, peerId);
      }
      return;
    }
    if (msg.t === "name-change") {
      const from = (msg.from || peer.name || "Peer").trim() || "Peer";
      const to = (msg.to || "Peer").trim() || "Peer";
      peer.name = to;
      log({ kind: "info", text: `${from} is now ${to}` });
      broadcastToPeers({ t: "chat", n: "System", v: `${from} is now ${to}` }, peerId);
      return;
    }
    if (msg.t === "chat") {
      const name = (msg.n || peer.name || "Peer").trim() || "Peer";
      log({ kind: "peer", text: msg.v || "", name });
      broadcastToPeers({ t: "chat", n: name, v: msg.v || "" }, peerId);
      return;
    }
  }

  function handleFileMessage(msg, { fromName = "Peer", channel } = {}) {
    if (!msg || !msg.t) return false;
    if (msg.t === "file-request") {
      if (!channel || channel.readyState !== "open") return true;
      const node = buildFileRequestNode({
        from: msg.name || fromName,
        fileName: msg.fileName,
        mime: msg.mime,
        size: msg.size,
        id: msg.id,
        channel
      });
      log({ kind: "peer", name: msg.name || fromName, node });
      return true;
    }
    if (msg.t === "file-send-start") {
      if (!channel || channel.readyState !== "open") return true;
      const mimeVal = msg.mime || guessMime({ name: msg.fileName });
      const send = payload => sendPacket(channel, payload);
      const prog = buildProgressNode({
        label: `Receiving ${msg.fileName} (${mimeVal})`,
        id: msg.id,
        onCancel: () => {
          send({ t: "file-cancel", id: msg.id });
          const t = incomingTransfers[msg.id];
          if (t) {
            const cancelMsg = document.createElement("span");
            cancelMsg.textContent = `Receive cancelled for ${t.fileName}`;
            if (t.progNode && t.progNode.parentElement) t.progNode.parentElement.replaceChild(cancelMsg, t.progNode);
            delete incomingTransfers[msg.id];
          }
        },
        showDetails: true
      });
      log({ kind: "peer", name: msg.name || fromName, node: prog.wrap });
      incomingTransfers[msg.id] = {
        name: msg.name || fromName,
        fileName: msg.fileName,
        mime: mimeVal,
        size: msg.size,
        expectedChunks: msg.chunks,
        receivedChunks: 0,
        bytesReceived: 0,
        buffers: [],
        bar: prog.bar,
        pct: prog.pct,
        details: prog.details,
        progNode: prog.wrap,
        lastProgressSent: 0,
        started: Date.now(),
        send,
        channel
      };
      return true;
    }
    if (msg.t === "file-chunk") {
      const t = incomingTransfers[msg.id];
      if (!t) return true;
      const data = uint8FromBase64(msg.data);
      t.buffers.push(data);
      t.receivedChunks += 1;
      t.bytesReceived = (t.bytesReceived || 0) + data.byteLength;
      const doneBySize = t.size ? t.bytesReceived / t.size : t.receivedChunks / t.expectedChunks;
      const done = Math.min(doneBySize || 0, 1);
      t.bar.style.width = `${Math.floor(done * 100)}%`;
      t.pct.textContent = `${Math.floor(done * 100)}%`;
      if (t.details) {
        const bytesReceived = t.bytesReceived;
        const totalBytes = t.size || t.bytesReceived;
        const mb = bytesReceived / (1024 * 1024);
        const totalMb = totalBytes / (1024 * 1024);
        const elapsed = Math.max((Date.now() - (t.started || Date.now())) / 1000, 0.001);
        const rateMb = mb / elapsed;
        const rateMbit = rateMb * 8;
        const remainingMb = Math.max(totalMb - mb, 0);
        const eta = rateMbit > 0 ? (remainingMb * 8) / rateMbit : 0;
        t.details.textContent = `${mb.toFixed(2)} / ${totalMb.toFixed(2)} MB - ${rateMbit.toFixed(2)} Mb/s - ETA ${eta.toFixed(1)}s`;
      }
      const now = Date.now();
      if (t.send && (now - t.lastProgressSent >= 500 || t.receivedChunks >= t.expectedChunks)) {
        t.send({ t: "file-progress", id: msg.id, pct: Math.floor(done * 100) });
        t.lastProgressSent = now;
      }
      if (t.receivedChunks >= t.expectedChunks) {
        const blob = new Blob(t.buffers, { type: t.mime });
        const url = URL.createObjectURL(blob);
        const isMedia = isMediaType(t.mime || "", t.fileName);
        const node = isMedia
          ? buildMediaPreview({
              fileName: t.fileName,
              mime: t.mime,
              url,
              revokeCb: () => URL.revokeObjectURL(url)
            })
          : buildFileNode({
              fileName: t.fileName,
              mime: t.mime,
              data: url,
              revokeCb: () => URL.revokeObjectURL(url)
            });
        if (t.progNode && t.progNode.parentElement) t.progNode.parentElement.replaceChild(node, t.progNode);
        else log({ kind: "peer", name: t.name, node });
        if (t.send) {
          t.send({ t: "file-received", id: msg.id, fileName: t.fileName, mime: t.mime });
        }
        delete incomingTransfers[msg.id];
      }
      return true;
    }
    if (msg.t === "file-accept") {
      const pending = pendingOutgoingFiles[msg.id];
      if (pending) {
        if (pending.groupId && pending.peerId) {
          updateBroadcastStatus(pending.groupId, pending.peerId, "accepted");
        }
        sendFileChunks(msg.id, pending);
      }
      return true;
    }
    if (msg.t === "file-decline") {
      if (pendingOutgoingFiles[msg.id]) {
        const pending = pendingOutgoingFiles[msg.id];
        if (pending.groupId && pending.peerId) {
          updateBroadcastStatus(pending.groupId, pending.peerId, "declined");
        }
        if (!pending.groupId && pending.previewNode) {
          replaceWithMessage(pending.previewNode, `Peer declined ${pending.file?.name || "file"}`);
        }
        delete pendingOutgoingFiles[msg.id];
        if (!pending.groupId) {
          log({ kind: "info", text: "Peer declined the file transfer" });
        }
      }
      return true;
    }
    if (msg.t === "file-cancel") {
      if (incomingTransfers[msg.id]) {
        const t = incomingTransfers[msg.id];
        if (t.progNode && t.progNode.parentElement) {
          replaceWithMessage(t.progNode, `Receive cancelled for ${t.fileName}`);
        }
        delete incomingTransfers[msg.id];
      }
      if (outgoingTransfers[msg.id]) {
        const t = outgoingTransfers[msg.id];
        if (t.groupId && t.peerId) {
          updateBroadcastStatus(t.groupId, t.peerId, "cancelled");
        }
        if (t.wrap && t.wrap.parentElement) {
          replaceWithMessage(t.wrap, `Send cancelled for ${pendingOutgoingFiles[msg.id]?.file?.name || "file"}`);
        }
        t.cancelled = true;
        delete outgoingTransfers[msg.id];
      }
      return true;
    }
    if (msg.t === "file-progress") {
      const out = outgoingTransfers[msg.id];
      if (out) {
        if (out.groupId && out.peerId) {
          updateBroadcastStatus(out.groupId, out.peerId, `sending ${msg.pct}%`);
          return true;
        }
        out.bar.style.width = `${msg.pct}%`;
        out.pct.textContent = `${msg.pct}%`;
        if (out.details) {
          const totalMb = out.size / (1024 * 1024);
          const doneMb = (totalMb * msg.pct) / 100;
          const elapsed = Math.max((Date.now() - out.started) / 1000, 0.001);
          const rateMb = doneMb / elapsed;
          const rateMbit = rateMb * 8;
          const remainingMb = Math.max(totalMb - doneMb, 0);
          const eta = rateMbit > 0 ? (remainingMb * 8) / rateMbit : 0;
          out.details.textContent = `${doneMb.toFixed(2)} / ${totalMb.toFixed(2)} MB - ${rateMbit.toFixed(2)} Mb/s - ETA ${eta.toFixed(1)}s`;
        }
      }
      return true;
    }
    if (msg.t === "file-received") {
      const out = outgoingTransfers[msg.id];
      if (out) {
        if (out.groupId && out.peerId) {
          updateBroadcastStatus(out.groupId, out.peerId, "received");
        }
        const isMedia = out.isMedia || isMediaType(msg.mime || "", msg.fileName || "");
        if (isMedia && out.wrap && out.wrap.parentElement) {
          const line = out.wrap.closest(".log-line");
          if (line) line.remove();
          else out.wrap.remove();
          if (out.previewNode) out.previewNode.style.opacity = "1";
        } else {
          replaceWithMessage(out.wrap, `Sent ${msg.fileName || "file"}`);
        }
        delete outgoingTransfers[msg.id];
      }
      return true;
    }
    return false;
  }

  function buildPendingFileNode({ fileName = "file", mime = "file", size = 0 }) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.style.width = "100%";
    const label = document.createElement("span");
    const sizeMb = (size / (1024 * 1024)).toFixed(2);
    label.textContent = `${fileName} (${mime}) - ${sizeMb} MB (waiting for accept)`;
    wrap.appendChild(label);
    return wrap;
  }

  function buildBroadcastStatusNode({ fileName = "file", mime = "file", size = 0, recipients = [], mediaNode = null }) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "6px";
    wrap.style.width = "100%";

    const sizeMb = size ? `${(size / (1024 * 1024)).toFixed(2)} MB` : "";
    const header = document.createElement("span");
    header.textContent = `Sending ${fileName} (${mime || "file"}) ${sizeMb ? `- ${sizeMb}` : ""}`;
    wrap.appendChild(header);

    if (mediaNode) {
      wrap.appendChild(mediaNode);
    }

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "4px";

    const statusMap = new Map();
    recipients.forEach(recipient => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";

      const name = document.createElement("span");
      name.textContent = recipient.name || "Peer";
      name.style.fontSize = "13px";

      const status = document.createElement("span");
      status.textContent = "waiting";
      status.style.fontSize = "12px";
      status.style.color = "var(--muted)";

      const spacer = document.createElement("span");
      spacer.style.flex = "1";

      row.append(name, spacer, status);
      list.appendChild(row);
      statusMap.set(recipient.peerId || recipient.name || "peer", status);
    });

    wrap.appendChild(list);
    return { wrap, statusMap };
  }

  function updateBroadcastStatus(groupId, peerId, text) {
    const group = broadcastGroups.get(groupId);
    if (!group) return;
    const statusEl = group.statusMap.get(peerId);
    if (statusEl) statusEl.textContent = text;
  }

  function persistName(v) {
    const val = (v || "").trim();
    memorySavedName = val;
    try { localStorage.setItem(NAME_KEY, val); } catch {}
    try { sessionStorage.setItem(NAME_KEY, val); } catch {}
  }

  function applyName({ announce = false, save = false, allowRandom = true } = {}) {
    const before = localName;
    let next = (nameInput.value || "").trim();
    let generatedRandom = false;
    if (!next && save) {
      persistName(""); // save blank as blank
    }
    if (!next && (allowRandom || save)) {
      next = randomName();
      nameInput.value = next;
      generatedRandom = true;
    }
    localName = next;
    if (save && !generatedRandom && localName) persistName(localName);
    if (announce && localName !== before) {
      if (role === "caller") {
        broadcastToPeers({ t: "name-change", from: before, to: localName });
      } else if (dc && dc.readyState === "open") {
        dc.send(JSON.stringify({ t: "name-change", from: before, to: localName }));
      }
      log({ kind: "info", text: `You changed name: ${before} -> ${localName}` });
      renameLogBadges("self", localName);
    }
  }
  function updateLocalName() {
    applyName({ announce: false, save: false });
  }
  {
    const saved = loadSavedName();
    if (saved !== null) {
      nameInput.value = saved;
    } else {
      nameInput.value = randomName();
    }
  }
  applyName({ announce: false, save: false });
  if (setNameBtn) {
    setNameBtn.addEventListener("click", () => {
      applyName({ announce: true, save: true, allowRandom: true });
    });
  }

  function getRoomCode() {
    const code = (roomInput?.value || "").trim().toUpperCase();
    if (roomInput && code) roomInput.value = code;
    return code;
  }

  function getRoomPassword() {
    const password = (passwordInput?.value || "").trim();
    return password;
  }

  function startHost() {
    let code = getRoomCode();
    if (!code) {
      code = generateRoomCode();
      if (roomInput) roomInput.value = code;
    }
    const password = getRoomPassword();
    if (!password) {
      updateRoomStatus("Password required");
      return;
    }
    activePassword = password;
    role = "caller";
    peers.forEach(peer => {
      if (peer.dc) peer.dc.close();
      if (peer.pc) peer.pc.close();
    });
    peers.clear();
    hostSignalId = "";
    reset({ preserveRole: true });
    setStatus("connecting");
    setWebrtcStatus("connecting");
    connectSignal(code, password);
    log({ kind: "info", text: `Hosting room ${code}` });
  }

  function startJoin() {
    const code = getRoomCode();
    if (!code) return;
    const password = getRoomPassword();
    if (!password) {
      updateRoomStatus("Password required");
      return;
    }
    activePassword = password;
    role = "joiner";
    hostSignalId = "";
    reset({ preserveRole: true });
    setStatus("connecting");
    setWebrtcStatus("connecting");
    connectSignal(code, password);
    log({ kind: "info", text: `Joining room ${code}` });
  }

  function disconnectSession() {
    connectNonce += 1;
    if (role === "caller") {
      peers.forEach(peer => {
        sendSignal("leave", undefined, peer.id);
        if (peer.dc) peer.dc.close();
        if (peer.pc) peer.pc.close();
      });
      peers.clear();
    } else if (role === "joiner" && hostSignalId) {
      sendSignal("leave", undefined, hostSignalId);
    } else {
      sendSignal("leave");
    }
    closeSignal();
    activeRoom = "";
    hostSignalId = "";
    activePassword = "";
    joinAuthenticated = false;
    reset({ preserveRole: false });
    updateRoomStatus("Disconnected");
  }

  if (roomInput) {
    const savedRoom = loadRoom();
    if (savedRoom) {
      roomInput.value = savedRoom;
    }
  }
  if (newRoomBtn) {
    newRoomBtn.addEventListener("click", () => {
      const code = generateRoomCode();
      if (roomInput) roomInput.value = code;
    });
  }
  if (hostBtn) {
    hostBtn.addEventListener("click", () => {
      startHost();
    });
  }
  if (joinRoomBtn) {
    joinRoomBtn.addEventListener("click", () => {
      startJoin();
    });
  }
  if (leaveBtn) {
    leaveBtn.addEventListener("click", () => {
      disconnectSession();
    });
  }

  function log({ kind = "info", text = "", name = "", node = null } = {}) {
    const line = document.createElement("div");
    line.className = `log-line ${kind}`;

    const head = document.createElement("div");
    head.className = "log-head";

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = new Date().toLocaleTimeString();

    const badge = document.createElement("span");
    badge.className = "log-badge";

    if (kind === "self") badge.textContent = name || localName;
    else if (kind === "peer") badge.textContent = name || peerName;

    const bodyEl = document.createElement("span");
    bodyEl.className = "log-body";
    if (node) bodyEl.appendChild(node);
    else bodyEl.textContent = text;

    if (!badge.textContent) badge.style.display = "none";

    head.append(time, badge);
    line.append(head, bodyEl);
    logEl.appendChild(line);
    scrollToBottom();
    return line;
  }
  function renameLogBadges(kind, newName) {
    if (!newName) return;
    logEl.querySelectorAll(`.log-line.${kind} .log-badge`).forEach(b => {
      b.textContent = newName;
    });
  }

  function replaceWithMessage(el, text) {
    if (!el) return;
    el.innerHTML = "";
    const msg = document.createElement("span");
    msg.style.color = "var(--muted)";
    msg.textContent = text;
    el.appendChild(msg);
  }

  const base64FromUint8 = u8 => {
    let s = "";
    for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
    return btoa(s);
  };
  const uint8FromBase64 = b64 => {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const guessMime = file => {
    if (file && file.type) return file.type;
    const name = (file && file.name) || "";
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    const map = {
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      wav: "audio/wav",
      ogg: "audio/ogg",
      flac: "audio/flac",
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp"
    };
    return map[ext] || "application/octet-stream";
  };
  const isMediaType = (mime = "", name = "") => {
    if (mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/")) return true;
    const ext = name.includes(".") ? name.split(".").pop().toLowerCase() : "";
    return ["png","jpg","jpeg","gif","bmp","webp","mp3","m4a","wav","ogg","flac","mp4","webm","mov"].includes(ext);
  };
  const extractIps = arr => {
    if (!Array.isArray(arr)) return [];
    const ips = new Set();
    arr.forEach(c => {
      const cand = c?.candidate || "";
      const match = cand.match(/\\b(?:(?:[0-9]{1,3}\\.){3}[0-9]{1,3})\\b/);
      if (match) ips.add(match[0]);
    });
    return Array.from(ips);
  };

  function buildFileNode({ fileName = "file", mime = "file", data = "", revokeCb = null }) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    wrap.style.width = "100%";
    wrap.style.position = "relative";

    const link = document.createElement("a");
    link.href = data;
    link.download = fileName;
    link.textContent = "Download";
    link.style.padding = "6px 10px";
    link.style.border = "1.5px solid var(--border)";
    link.style.background = "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(34,22,23,0.9))";
    link.style.color = "var(--ink)";
    link.style.borderRadius = "10px";
    link.style.boxShadow = "0 6px 14px rgba(0,0,0,0.35), inset 0 1px 0 var(--highlight), inset 0 -1px 3px rgba(0,0,0,0.4)";
    link.style.textDecoration = "none";
    link.style.fontSize = "12px";
    link.style.whiteSpace = "nowrap";
    link.target = "_blank";
    wrap.appendChild(link);

    const label = document.createElement("span");
    label.textContent = `${fileName} (${mime})`;
    wrap.appendChild(label);

    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    wrap.appendChild(spacer);

    if (mime.startsWith("image/") && data.startsWith("data:")) {
      const img = document.createElement("img");
      img.src = data;
      img.alt = fileName;
      img.className = "thumb";
      wrap.appendChild(img);
    }
    if (revokeCb) {
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.style.whiteSpace = "nowrap";
      del.style.position = "static";
      del.style.padding = "4px 8px";
      del.style.fontSize = "11px";
      del.style.borderRadius = "8px";
      del.style.border = "1.5px solid var(--border)";
      del.style.background = "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(26,18,20,0.9))";
      del.onclick = () => {
        revokeCb();
        link.removeAttribute("href");
        link.textContent = "[deleted]";
        del.disabled = true;
        del.textContent = "Deleted";
        del.style.display = "none";
        const line = del.closest(".log-line");
        if (line) line.classList.add("expired");
      };
      // move to header row when available
      setTimeout(() => {
        const head = wrap.closest(".log-line")?.querySelector(".log-head");
        if (head) head.appendChild(del);
        else wrap.appendChild(del);
      });
    }
    return wrap;
  }

  function buildMediaPreview({ fileName = "file", mime = "file", url = "", revokeCb = null }) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "8px";
    wrap.style.width = "100%";
    wrap.style.alignSelf = "flex-start";
    wrap.style.position = "relative";

    let media = null;
    const showTitle = mime.startsWith("audio/");
    if (showTitle) {
      const title = document.createElement("span");
      title.textContent = fileName ? `${fileName} (${mime})` : mime;
      title.style.alignSelf = "flex-start";
      wrap.appendChild(title);
    }
    if (mime.startsWith("image/")) {
      media = document.createElement("img");
      media.src = url;
      media.alt = fileName;
      media.style.display = "block";
      media.style.alignSelf = "flex-start";
      media.style.maxWidth = "320px";
      media.style.maxHeight = "260px";
      media.style.borderRadius = "10px";
      media.style.boxShadow = "0 8px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)";
      media.style.objectFit = "contain";
      media.addEventListener("load", scrollToBottom);
    } else if (mime.startsWith("audio/")) {
      media = document.createElement("audio");
      media.controls = true;
      media.src = url;
      media.style.width = "100%";
      media.addEventListener("loadedmetadata", scrollToBottom);
    } else if (mime.startsWith("video/")) {
      media = document.createElement("video");
      media.controls = true;
      media.src = url;
      media.style.display = "block";
      media.style.alignSelf = "flex-start";
      media.style.width = "320px";
      media.style.maxHeight = "240px";
      media.style.borderRadius = "10px";
      media.style.boxShadow = "0 8px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.25)";
      media.style.objectFit = "contain";
      media.addEventListener("loadedmetadata", scrollToBottom);
    }
    if (media) wrap.appendChild(media);

    if (revokeCb) {
      const del = document.createElement("button");
      del.textContent = "Delete";
      del.style.position = "static";
      del.style.whiteSpace = "nowrap";
      del.style.padding = "4px 8px";
      del.style.fontSize = "11px";
      del.style.borderRadius = "8px";
      del.style.border = "1.5px solid var(--border)";
      del.style.background = "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(26,18,20,0.9))";
      del.onclick = () => {
        revokeCb();
        if (media) media.removeAttribute("src");
        del.disabled = true;
        del.textContent = "Deleted";
        del.style.display = "none";
        const line = del.closest(".log-line");
        if (line) line.classList.add("expired");
      };
      setTimeout(() => {
        const head = wrap.closest(".log-line")?.querySelector(".log-head");
        if (head) head.appendChild(del);
        else wrap.appendChild(del);
      });
    }
    return wrap;
  }

  function buildFileRequestNode({ from = "Peer", fileName = "file", mime = "", size = 0, id, channel }) {
    const wrap = document.createElement("span");
    const kb = Math.round(size / 102.4) / 10;
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "8px";
    const label = document.createElement("span");
    label.textContent = `${from} wants to send ${fileName} (${mime || "file"}, ${kb} KB) `;
    const btn = document.createElement("button");
    btn.textContent = "Accept";
    btn.onclick = () => {
      if (!sendPacket(channel, { t: "file-accept", id })) return;
      const line = wrap.closest(".log-line");
      if (line) line.remove();
    };
    const decline = document.createElement("button");
    decline.textContent = "Decline";
    decline.onclick = () => {
      if (!sendPacket(channel, { t: "file-decline", id })) return;
      replaceWithMessage(wrap, `You declined ${fileName}`);
    };
    const spacer = document.createElement("span");
    spacer.style.flex = "1";
    wrap.append(label, spacer, btn, decline);
    return wrap;
  }

  function buildProgressNode({ label = "", id, onCancel = null, showDetails = false }) {
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.gap = "6px";

    const title = document.createElement("span");
    title.textContent = label;
    wrap.appendChild(title);

    const row = document.createElement("div");
    row.className = "progress-row";

    const barWrap = document.createElement("div");
    barWrap.className = "bar-wrap";
    barWrap.style.width = "100%";
    barWrap.style.height = "12px";
    barWrap.style.background = "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(30,20,21,0.9))";
    barWrap.style.borderRadius = "999px";
    barWrap.style.border = "1px solid var(--border)";
    barWrap.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.25)";
    const bar = document.createElement("div");
    bar.style.height = "100%";
    bar.style.width = "0%";
    bar.style.borderRadius = "999px";
    bar.style.background = "linear-gradient(90deg, #ff6b6b, #ff3b3b)";
    bar.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 3px rgba(0,0,0,0.35)";
    barWrap.appendChild(bar);

    const pct = document.createElement("span");
    pct.style.fontSize = "12px";
    pct.style.color = "var(--muted)";
    pct.textContent = "0%";

    row.append(barWrap, pct);

    const details = document.createElement("span");
    details.style.fontSize = "12px";
    details.style.color = "var(--muted)";
    details.textContent = "";

    if (onCancel) {
      const cancel = document.createElement("button");
      cancel.textContent = "Cancel";
      cancel.style.whiteSpace = "nowrap";
      cancel.onclick = () => onCancel({ wrap, bar, pct, cancel, barWrap, row });
      row.appendChild(cancel);
    }

    wrap.append(row);
    if (showDetails) wrap.appendChild(details);

    return { wrap, bar, pct, details, barWrap, row };
  }
  function setStatus(s) {
    if (s === "connected" && !logClearedForConnect) {
      logEl.innerHTML = "";
      logClearedForConnect = true;
    } else if (s !== "connected") {
      logClearedForConnect = false;
    }
    statusEl.textContent = s;
    statusEl.classList.toggle("connected", s === "connected");
    statusEl.classList.toggle("connecting", s === "connecting" || s === "hosting");
    const isConnected = s === "connected";
    const isBusy = s !== "idle" && s !== "disconnected";
    chatControls.classList.toggle("hide", !isConnected);
    if (attachBtn) attachBtn.disabled = !isConnected;
    if (attachInput) attachInput.disabled = !isConnected;
    if (hostBtn) hostBtn.disabled = isBusy;
    if (joinRoomBtn) joinRoomBtn.disabled = isBusy;
    if (newRoomBtn) newRoomBtn.disabled = isBusy;
    if (leaveBtn) leaveBtn.disabled = !isBusy;
    if (!isConnected && attachInfo) {
      attachInfo.classList.add("hide");
      attachInfo.textContent = "";
      $("msg").classList.remove("hide");
      $("msg").readOnly = false;
      pendingAttachment = null;
    }
  }

  /* ---------- WebRTC ---------- */
  const rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun.cloudflare.com:3478" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject"
      },
      {
        urls: "turn:turn.anyfirewall.com:443?transport=tcp",
        username: "webrtc",
        credential: "webrtc"
      }
    ]
  };

  function reset({ preserveRole = false } = {}) {
    if (dc) dc.close();
    if (pc) pc.close();
    pc = dc = null;
    localCandidates = [];
    pendingRemoteCandidates = [];
    remoteDescriptionSet = false;
    joinAuthenticated = false;
    activePeerId = "";
    if (!preserveRole) {
      role = null;
      hostSignalId = "";
      activePassword = "";
    }
    peerName = "Peer";
    updateLocalName();
    logClearedForConnect = false;
    $("sendBtn").disabled = true;
    setStatus("idle");
    setStunStatus("idle");
    setWebrtcStatus("idle");
  }

  function updateNote() {
    howTo.classList.toggle("hide", !noteVisible);
    noteToggle.textContent = noteVisible ? "Hide instructions" : "Show instructions";
  }
  function updateDisclaimer() {
    if (!disclaimer) return;
    disclaimer.classList.toggle("hide", hasAcked);
    if (ackNoteBtn) ackNoteBtn.classList.toggle("hide", hasAcked);
  }

  function fillDebug() {
    if (!debugContent) return;
    const status = statusEl.textContent || "unknown";
    const ips = extractIps(localCandidates);

    const summaryGrid = document.createElement("div");
    summaryGrid.className = "debug-grid";
    const summaryBox = document.createElement("div");
    summaryBox.className = "debug-box";
    const head = document.createElement("h4");
    head.textContent = "Session";
    summaryBox.appendChild(head);
    const addRow = (label, value) => {
      const line = document.createElement("div");
      line.className = "rowline";
      line.textContent = `${label}: ${value}`;
      summaryBox.appendChild(line);
    };
    addRow("Status", status);
    addRow("Role", role || "unset");
    addRow("Local name", localName);
    addRow("Peer name", peerName);
    addRow("Local candidates", localCandidates.length);
    if (ips.length) addRow("IP hints", ips.join(", "));
    summaryGrid.appendChild(summaryBox);

    const candBox = document.createElement("div");
    candBox.className = "debug-box";
    const candHead = document.createElement("h4");
    candHead.textContent = "Local candidates (raw)";
    candBox.appendChild(candHead);
    const candPre = document.createElement("pre");
    candPre.textContent = JSON.stringify(localCandidates, null, 2);
    candBox.appendChild(candPre);
    summaryGrid.appendChild(candBox);

    debugContent.innerHTML = "";
    debugContent.appendChild(summaryGrid);
  }

  function showDebug(open) {
    if (!debugModal) return;
    if (open) fillDebug();
    debugModal.classList.toggle("show", !!open);
  }

  function setRole(nextRole) {
    role = nextRole;
    reset({ preserveRole: true });
  }
  hasAcked = loadAck();
  noteVisible = false;
  updateDisclaimer();
  updateNote();
  setMqttStatus("offline");
  setStunStatus("idle");
  setWebrtcStatus("idle");
  if (debugToggle) debugToggle.onclick = () => showDebug(true);
  if (debugClose) debugClose.onclick = () => showDebug(false);
  if (debugModal) {
    debugModal.addEventListener("click", e => {
      if (e.target === debugModal) showDebug(false);
    });
  }
  noteToggle.onclick = () => {
    noteVisible = !noteVisible;
    updateNote();
  };
  if (ackNoteBtn) {
    ackNoteBtn.onclick = () => {
      hasAcked = true;
      try { localStorage.setItem(ACK_KEY, "1"); } catch {}
      updateDisclaimer();
    };
  }

  function ensurePC() {
    if (pc) return pc;
    pc = new RTCPeerConnection(rtcConfig);
    localCandidates = [];

    pc.onicecandidate = e => {
      if (!e.candidate) return;
      localCandidates.push(e.candidate.toJSON());
      if (hostSignalId) {
        sendSignal("candidate", { candidate: e.candidate }, hostSignalId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      setStunStatus(pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      setStatus(pc.connectionState);
      if (role === "joiner" && !joinAuthenticated && pc.connectionState === "connected") {
        setWebrtcStatus("authenticating");
      } else {
        setWebrtcStatus(pc.connectionState);
      }
      if (pc.connectionState === "connected") {
        if (role !== "joiner" || joinAuthenticated) {
          $("sendBtn").disabled = false;
        }
      }
    };

    pc.ondatachannel = e => {
      dc = e.channel;
      wireDC();
    };
    return pc;
  }

  function wireDC() {
    dc.onopen = () => {
      if (!logClearedForConnect) {
        logEl.innerHTML = "";
        logClearedForConnect = true;
      }
      updateLocalName();
      setStatus("connected");
      if (role === "joiner") {
        joinAuthenticated = false;
        $("sendBtn").disabled = true;
        setWebrtcStatus("authenticating");
      } else {
        $("sendBtn").disabled = false;
      }
      if (activeRoom) {
        updateRoomStatus(`Connected to ${activeRoom}`);
      }
    };
    dc.onmessage = e => handleMessage(e.data);
    dc.onclose = () => {
      log({ kind: "info", text: "DataChannel closed" });
      setStatus("disconnected");
      setWebrtcStatus("disconnected");
    };
  }

  function handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      if (msg.t === "auth-challenge") {
        joinAuthenticated = false;
        setWebrtcStatus("authenticating");
        if (!activePassword || !msg.v) return;
        hashValue(`${activePassword}:${msg.v}`).then(response => {
          if (dc && dc.readyState === "open") {
            dc.send(JSON.stringify({ t: "auth-response", v: response }));
          }
        }).catch(() => {});
        return;
      }
      if (msg.t === "auth-ok") {
        joinAuthenticated = true;
        setWebrtcStatus("connected");
        $("sendBtn").disabled = false;
        if (dc && dc.readyState === "open") {
          dc.send(JSON.stringify({ t: "name", v: localName }));
        }
        log({ kind: "info", text: "Authenticated with host." });
        return;
      }
      if (msg.t === "auth-fail") {
        joinAuthenticated = false;
        setWebrtcStatus("auth failed");
        log({ kind: "info", text: "Authentication failed. Disconnecting." });
        if (dc) dc.close();
        setStatus("disconnected");
        return;
      }
      if (role === "joiner" && !joinAuthenticated) {
        return;
      }
      if (msg.t === "name") {
        const incomingName = (msg.v || "Peer").trim() || "Peer";
        peerName = incomingName;
        log({ kind: "info", text: `Connected to ${peerName}` });
        renameLogBadges("peer", peerName);
        return;
      }
      if (msg.t === "name-change") {
        const from = (msg.from || peerName || "Peer").trim() || "Peer";
        const to = (msg.to || "Peer").trim() || "Peer";
        peerName = to;
        log({ kind: "info", text: `${from} is now ${to}` });
        renameLogBadges("peer", peerName);
        return;
      }
      if (msg.t === "chat") {
        peerName = (msg.n || peerName).trim() || peerName;
        log({ kind: "peer", text: msg.v || "", name: peerName });
        return;
      }
      if (msg.t && msg.t.startsWith("file-")) {
        handleFileMessage(msg, { fromName: msg.name || peerName, channel: dc });
        return;
      }
    } catch (err) {
      // Fallback for non-JSON payloads
    }
    log({ kind: "peer", text: data, name: peerName });
  }

  function waitForBuffer(dc, threshold = 256000) {
    return new Promise(resolve => {
      if (!dc) return resolve();
      const check = () => {
        if (!dc || dc.readyState !== "open" || dc.bufferedAmount <= threshold) {
          dc?.removeEventListener("bufferedamountlow", check);
          resolve();
        }
      };
      dc.addEventListener("bufferedamountlow", check);
      setTimeout(check, 100);
    });
  }

  /* ---------- Signaling flows ---------- */
  async function flushRemoteCandidates() {
    if (!pc || !remoteDescriptionSet || !pendingRemoteCandidates.length) return;
    const pending = [...pendingRemoteCandidates];
    pendingRemoteCandidates = [];
    for (const candidate of pending) {
      try { await pc.addIceCandidate(candidate); } catch {}
    }
  }

  async function handleRemoteCandidate(candidateData) {
    if (!candidateData) return;
    if (!pc) ensurePC();
    const candidate = new RTCIceCandidate(candidateData);
    if (remoteDescriptionSet) {
      try { await pc.addIceCandidate(candidate); } catch {}
    } else {
      pendingRemoteCandidates.push(candidate);
    }
  }

  async function applyOfferFlow(description) {
    if (!description) return;
    if (role !== "joiner") role = "joiner";
    reset({ preserveRole: true });
    setStatus("connecting");

    const pc = ensurePC();
    await pc.setRemoteDescription(new RTCSessionDescription(description));
    remoteDescriptionSet = true;
    await flushRemoteCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    if (hostSignalId) {
      sendSignal("answer", { description: pc.localDescription }, hostSignalId);
    }
    log({ kind: "info", text: "Answer sent" });
  }

  /* ---------- Chat ---------- */
  $("sendBtn").onclick = () => {
    if (pendingAttachment) {
      const targets = getAttachmentTargets();
      if (!targets.length) {
        log({ kind: "info", text: "No peer connected for file sharing." });
        return;
      }
      const f = pendingAttachment;
      const mime = guessMime(f);
      const isMedia = isMediaType(mime, f.name);
      const now = Date.now();
      const groupId = role === "caller" ? `group-${now}-${fileIdCounter++}` : "";
      let group = null;
      if (role === "caller") {
        let mediaNode = null;
        if (isMedia) {
          const url = URL.createObjectURL(f);
          mediaNode = buildMediaPreview({
            fileName: f.name,
            mime,
            url,
            revokeCb: () => URL.revokeObjectURL(url)
          });
        }
        group = buildBroadcastStatusNode({
          fileName: f.name,
          mime,
          size: f.size,
          recipients: targets,
          mediaNode
        });
        broadcastGroups.set(groupId, group);
        log({ kind: "self", name: localName, node: group.wrap });
      }

      targets.forEach((target, index) => {
        const peerId = target.peerId || `peer-${index}`;
        const id = `file-${now}-${fileIdCounter++}-${peerId}`;
        const send = payload => sendPacket(target.channel, payload);
        if (role === "caller" && groupId) {
          updateBroadcastStatus(groupId, peerId, isMedia ? "sending" : "waiting");
        }
        if (isMedia) {
          pendingOutgoingFiles[id] = {
            file: f,
            mime,
            previewNode: group ? group.wrap : null,
            replaceWithProgress: false,
            send,
            channel: target.channel,
            silent: role === "caller",
            groupId,
            peerId
          };
          sendFileChunks(id, pendingOutgoingFiles[id]);
        } else {
          const pendingNode = role === "caller" ? group.wrap : buildPendingFileNode({ fileName: f.name, mime, size: f.size });
          if (role !== "caller") {
            log({ kind: "self", name: localName, node: pendingNode });
          }
          pendingOutgoingFiles[id] = {
            file: f,
            mime,
            previewNode: pendingNode,
            send,
            channel: target.channel,
            silent: role === "caller",
            groupId,
            peerId
          };
          send({
            t: "file-request",
            id,
            name: localName,
            fileName: f.name,
            mime,
            size: f.size
          });
        }
      });
      clearPendingAttachmentUi();
      return;
    }
    const text = $("msg").value.trim();
    if (!text) return;
    updateLocalName();
    if (role === "caller") {
      broadcastToPeers({ t: "chat", v: text, n: localName });
      log({ kind: "self", text, name: localName });
    } else if (dc && dc.readyState === "open") {
      dc.send(JSON.stringify({ t: "chat", v: text, n: localName }));
      log({ kind: "self", text, name: localName });
    } else {
      return;
    }
    $("msg").value = "";
  };

  if (attachBtn && attachInput) {
    attachBtn.onclick = () => attachInput.click();
    attachInput.onchange = () => {
      const f = attachInput.files && attachInput.files[0];
      if (!f) return;
      pendingAttachment = f;
      const sizeMb = (f.size / (1024 * 1024)).toFixed(2);
      $("msg").value = "";
      $("msg").classList.add("hide");
      $("msg").readOnly = true;
      $("msg").placeholder = "Ready to send attachment";
      if (attachInfo) {
        attachInfo.textContent = `${f.name} - ${sizeMb} MB - ${f.type || guessMime(f)}`;
        attachInfo.classList.remove("hide");
      }
      attachInput.value = "";
    };
  }

  $("msg").addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("sendBtn").click();
    }
  });

  const CHUNK_SIZE = 64000;
  async function sendFileChunks(id, pending) {
    const file = pending.file;
    const isMedia = isMediaType(pending.mime || "", file.name);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;
    const MAX_BUFFER = 512000;
    const channel = pending.channel;
    const send = pending.send || (payload => sendPacket(channel, payload));
    const silent = !!pending.silent;
    if (!channel || channel.readyState !== "open") {
      if (pending.groupId && pending.peerId) {
        updateBroadcastStatus(pending.groupId, pending.peerId, "failed");
      }
      log({ kind: "info", text: "Send failed: connection closed" });
      delete pendingOutgoingFiles[id];
      return;
    }
    if (channel) channel.bufferedAmountLowThreshold = MAX_BUFFER / 2;
    let prog = null;
    if (!silent) {
      prog = buildProgressNode({
        label: `Sending ${file.name} (${pending.mime})`,
        id,
        onCancel: () => {
          send({ t: "file-cancel", id });
          if (outgoingTransfers[id] && outgoingTransfers[id].wrap) {
            replaceWithMessage(outgoingTransfers[id].wrap, `Send cancelled for ${file.name}`);
            outgoingTransfers[id].cancelled = true;
          }
        },
        showDetails: true
      });
      if (pending.previewNode && pending.replaceWithProgress !== false && pending.previewNode.parentElement) {
        pending.previewNode.parentElement.replaceChild(prog.wrap, pending.previewNode);
      } else {
        log({ kind: "self", name: localName, node: prog.wrap });
      }
    }
    outgoingTransfers[id] = {
      bar: prog ? prog.bar : null,
      pct: prog ? prog.pct : null,
      wrap: prog ? prog.wrap : null,
      cancelled: false,
      details: prog ? prog.details : null,
      size: file.size,
      started: Date.now(),
      mime: pending.mime,
      isMedia,
      previewNode: pending.previewNode,
      groupId: pending.groupId,
      peerId: pending.peerId
    };
    send({
      t: "file-send-start",
      id,
      name: localName,
      fileName: file.name,
      mime: pending.mime,
      size: file.size,
      chunks: totalChunks
    });
    let offset = 0;
    let seq = 0;
    while (offset < file.size) {
      if (outgoingTransfers[id] && outgoingTransfers[id].cancelled) {
        delete pendingOutgoingFiles[id];
        delete outgoingTransfers[id];
        return;
      }
      if (!channel || channel.readyState !== "open") {
        if (pending.groupId && pending.peerId) {
          updateBroadcastStatus(pending.groupId, pending.peerId, "failed");
        }
        if (prog) replaceWithMessage(prog.wrap, "Send failed: connection closed");
        delete pendingOutgoingFiles[id];
        delete outgoingTransfers[id];
        return;
      }
      if (channel.bufferedAmount > MAX_BUFFER) {
        await waitForBuffer(channel, MAX_BUFFER / 2);
      }
      const sliceBlob = file.slice(offset, offset + CHUNK_SIZE);
      const sliceBuffer = await sliceBlob.arrayBuffer();
      const slice = new Uint8Array(sliceBuffer);
      if (!send({
        t: "file-chunk",
        id,
        seq,
        data: base64FromUint8(slice)
      })) {
        if (pending.groupId && pending.peerId) {
          updateBroadcastStatus(pending.groupId, pending.peerId, "failed");
        }
        if (prog) replaceWithMessage(prog.wrap, "Send failed: connection closed");
        delete pendingOutgoingFiles[id];
        delete outgoingTransfers[id];
        return;
      }
      offset += slice.length;
      seq += 1;
    }
    prog.pct.textContent = "Waiting for receiver...";
    delete pendingOutgoingFiles[id];
  }


