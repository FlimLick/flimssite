import * as Y from "./vendor/yjs.bundle.js";
import { WebrtcProvider } from "./vendor/y-webrtc.bundle.js";

const $ = (id) => document.getElementById(id);
const roomInput = $("roomCode");
const nameInput = $("displayName");
const joinBtn = $("joinRoomBtn");
const newBtn = $("newRoomBtn");
const roomStatus = $("roomStatus");
const logEl = $("log");
const messageInput = $("message");
const sendBtn = $("sendBtn");

const ROOM_KEY = "ywebrtc-room";
const NAME_KEY = "ywebrtc-name";

let provider = null;
let ydoc = null;
let messages = null;

const signaling = [
  "wss://signaling.yjs.dev",
  "wss://y-webrtc-signaling-eu.herokuapp.com",
  "wss://y-webrtc-signaling-us.herokuapp.com"
];

const randomRoom = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const nowTime = () => new Date().toLocaleTimeString();

const renderMessage = (msg) => {
  const line = document.createElement("div");
  line.className = "log-line";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = msg.time || nowTime();

  const name = document.createElement("div");
  name.className = "name";
  name.textContent = msg.name || "Anonymous";

  const body = document.createElement("div");
  body.textContent = msg.text || "";

  line.append(meta, name, body);
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
};

const clearLog = () => {
  logEl.innerHTML = "";
};

const bindMessages = () => {
  messages.observe((event) => {
    event.changes.delta.forEach((change) => {
      if (change.insert) {
        change.insert.forEach(renderMessage);
      }
    });
  });
};

const joinRoom = (room) => {
  if (!room) return;
  if (provider) provider.destroy();
  if (ydoc) ydoc.destroy();

  clearLog();

  ydoc = new Y.Doc();
  messages = ydoc.getArray("messages");
  provider = new WebrtcProvider(room, ydoc, { signaling });

  roomStatus.textContent = `Connected to ${room}`;
  localStorage.setItem(ROOM_KEY, room);

  messages.forEach(renderMessage);
  bindMessages();
};

const sendMessage = () => {
  if (!messages) return;
  const text = messageInput.value.trim();
  if (!text) return;
  const name = (nameInput.value || "Anonymous").trim();
  const msg = { name, text, time: nowTime() };
  messages.push([msg]);
  messageInput.value = "";
  messageInput.focus();
};

const savedRoom = localStorage.getItem(ROOM_KEY);
if (savedRoom) {
  roomInput.value = savedRoom;
  joinRoom(savedRoom);
}

const savedName = localStorage.getItem(NAME_KEY);
if (savedName) nameInput.value = savedName;

nameInput.addEventListener("blur", () => {
  localStorage.setItem(NAME_KEY, nameInput.value.trim());
});

joinBtn.addEventListener("click", () => {
  const room = roomInput.value.trim();
  if (!room) return;
  joinRoom(room);
});

newBtn.addEventListener("click", () => {
  const room = randomRoom();
  roomInput.value = room;
  joinRoom(room);
});

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    sendMessage();
  }
});
