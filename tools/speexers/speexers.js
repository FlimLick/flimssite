(() => {
  const $ = (id) => document.getElementById(id);

  const micStatus = $("micStatus");
  const micPreview = $("micPreview");
  const startMicBtn = $("startMic");
  const stopMicBtn = $("stopMic");

  const fileInput = $("fileInput");
  const processFileBtn = $("processFile");
  const filePreview = $("filePreview");
  const fileInfo = $("fileInfo");
  const downloadBtn = $("downloadFile");
  const modeMicBtn = $("modeMic");
  const modeFileBtn = $("modeFile");
  const micBox = $("micBox");
  const fileBox = $("fileBox");
  const sampleRateSelect = $("sampleRateSelect");
  const bitrateSelect = $("bitrateSelect");
  const channelSelect = $("channelSelect");
  const codecSelect = $("codecSelect");

  const supportsSAB = typeof SharedArrayBuffer !== "undefined" && (self.crossOriginIsolated || false);

  let micStream = null;
  let micRecorder = null;
  let micChunks = [];

  let ffmpeg = null;
  let ffmpegReady = false;

  function setMicStatus(text) {
    micStatus.textContent = text;
  }

  async function ensureFFmpeg() {
    if (!supportsSAB) throw new Error("SharedArrayBuffer unavailable (needs COOP/COEP)");
    if (ffmpegReady) return;
    const { createFFmpeg, fetchFile } = FFmpeg;
    ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();
    ffmpeg.fetchFile = fetchFile;
    ffmpegReady = true;
  }

  async function startMic() {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      await ensureFFmpeg();

      micRecorder = new MediaRecorder(micStream, { mimeType: "audio/webm" });
      micChunks = [];
      micRecorder.ondataavailable = (e) => { if (e.data && e.data.size) micChunks.push(e.data); };
      micRecorder.onstop = () => { /* no-op, handled in stopMic */ };
      micRecorder.start(1200);

      // kick off processing loop
      (async function processLoop() {
        while (micRecorder && micRecorder.state === "recording") {
          if (!useMicMSE) break;
          if (micChunks.length) {
            const blob = micChunks.shift();
            const res = await encodeBlobToEncoded(blob, null, `mic-${Date.now()}`);
            if (res && res.blob) {
              const arr = new Uint8Array(await res.blob.arrayBuffer());
              appendQueue.push(arr);
              scheduleAppend();
            }
          }
          await new Promise(r => setTimeout(r, 200));
        }
      })();

      micPreview.play().catch(() => {});

      setMicStatus("monitoring");
      startMicBtn.disabled = true;
      stopMicBtn.disabled = false;
    } catch (err) {
      console.error(err);
      setMicStatus("error");
    }
  }

  async function stopMic() {
    if (micRecorder) {
      micRecorder.stop();
      micRecorder = null;
    }
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    setMicStatus("encoding…");
    startMicBtn.disabled = false;
    stopMicBtn.disabled = true;
    const chunks = micChunks.slice();
    micChunks = [];
    micPreview.srcObject = null;
    if (chunks.length) {
      const res = await encodeBlobToEncoded(new Blob(chunks, { type: "audio/webm" }), micPreview, "mic");
      setMicStatus(res ? "idle" : "error");
    } else {
      setMicStatus("idle");
    }
  }

  function getUserSettings() {
    let rate = parseInt(sampleRateSelect?.value || "16000", 10) || 16000;
    const bandwidth = (bandwidthSelect?.value || "wide").trim();
    if (bandwidth === "wide") rate = 16000;
    else if (bandwidth === "narrow") rate = 8000;
    const bitrate = (bitrateSelect?.value || "16k").trim();
    const channels = parseInt(channelSelect?.value || "1", 10) || 1;
    const codec = (codecSelect?.value || "codec2").trim();
    return { rate, bitrate, channels, codec };
  }

  async function encodeBlobToEncoded(blob, audioEl, label) {
    // rely on environment to provide SharedArrayBuffer (user added workaround)
    try {
      await ensureFFmpeg();
      const base = label || "input";
      const inputName = `${base}.webm`;
      const settings = getUserSettings();
      const { rate, bitrate, channels, codec } = settings;
      const encChannels = codec === "codec2" ? 1 : channels;
      const c2Name = `${base}.c2`;
      const outputName = codec === "codec2" ? `${base}.wav` : `${base}.ogg`;
      ffmpeg.FS("writeFile", inputName, await ffmpeg.fetchFile(blob));
      let data;
      let mime = codec === "codec2" ? "audio/wav" : "audio/ogg";
      let finalName = outputName;
      try {
        if (codec === "codec2") {
          await ffmpeg.run("-i", inputName, "-ac", `${encChannels}`, "-ar", `${rate}`, "-acodec", "codec2", "-b:a", bitrate, "-f", "codec2", c2Name);
          await ffmpeg.run("-f", "codec2", "-ac", `${encChannels}`, "-ar", `${rate}`, "-i", c2Name, "-acodec", "pcm_s16le", outputName);
        } else {
          await ffmpeg.run("-i", inputName, "-ac", `${encChannels}`, "-ar", `${rate}`, "-acodec", "libopus", "-b:a", bitrate, outputName);
        }
        data = ffmpeg.FS("readFile", outputName);
      } catch (err) {
        console.error("Encode failed.", err);
        return null;
      }
      const blobOut = new Blob([data.buffer], { type: mime });
      const url = URL.createObjectURL(blobOut);
      if (audioEl) {
        audioEl.src = url;
        audioEl.play().catch(() => {});
      }
      return { blob: blobOut, url, isOpus: true, name: finalName, mime, codec };
    } catch (err) {
      console.error(err);
      setMicStatus("error");
      return null;
    } finally {
      try { ffmpeg.FS("unlink", inputName); } catch (_) {}
      try { ffmpeg.FS("unlink", c2Name); } catch (_) {}
      try { ffmpeg.FS("unlink", outputName); } catch (_) {}
    }
  }

  async function processFile() {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    processFileBtn.disabled = true;
    downloadBtn.disabled = true;
    fileInfo.textContent = "Processing…";
    try {
      const res = await encodeBlobToEncoded(file, filePreview, "file");
      if (res) {
        const ext = res.name.split(".").pop() || (res.codec === "codec2" ? "wav" : "ogg");
        const settings = getUserSettings();
        const label = res.codec === "codec2" ? "Codec2→WAV" : "Opus";
        const chLabel = res.codec === "codec2" ? 1 : settings.channels;
        fileInfo.textContent = `${file.name} → ${label} ${settings.rate / 1000}kHz ${chLabel}ch @ ${settings.bitrate}`;
        downloadBtn.disabled = false;
        downloadBtn.onclick = () => {
          const a = document.createElement("a");
          a.href = res.url;
          a.download = `${file.name.replace(/\.[^.]+$/, "") || "output"}-speexers.${ext}`;
          a.click();
        };
      } else {
        fileInfo.textContent = "Codec2 output not produced (check build).";
      }
    } catch (err) {
      console.error(err);
      fileInfo.textContent = "Failed to process file (Speex encoder missing?).";
    } finally {
      processFileBtn.disabled = false;
    }
  }

  startMicBtn.addEventListener("click", startMic);
  stopMicBtn.addEventListener("click", () => stopMic());
  processFileBtn.addEventListener("click", processFile);
  downloadBtn.addEventListener("click", (e) => e.preventDefault());

  function switchMode(mode) {
    const isMic = mode === "mic";
    if (isMic) {
      micBox.classList.remove("hide");
      fileBox.classList.add("hide");
      modeMicBtn.classList.add("is-active");
      modeFileBtn.classList.remove("is-active");
    } else {
      micBox.classList.add("hide");
      fileBox.classList.remove("hide");
      modeMicBtn.classList.remove("is-active");
      modeFileBtn.classList.add("is-active");
      stopMic(); // ensure mic stops when switching to file mode
    }
    // reset scroll to top of mode wrapper when switching
    document.querySelector(".mode-wrapper")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  modeMicBtn.addEventListener("click", () => switchMode("mic"));
  modeFileBtn.addEventListener("click", () => switchMode("file"));
  switchMode("mic");

  window.addEventListener("beforeunload", stopMic);
})();
