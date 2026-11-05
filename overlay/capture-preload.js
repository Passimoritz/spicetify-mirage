// Brücke für das versteckte Aufnahme-Fenster (Party auf dem Fernseher): nur Start/Stopp hinein, Videostücke heraus
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cast", {
  onStart: (fn) => ipcRenderer.on("castStart", (_e, o) => fn(o)),
  onStop: (fn) => ipcRenderer.on("castStop", () => fn()),
  chunk: (buf) => ipcRenderer.send("castChunk", buf),
  error: (msg) => ipcRenderer.send("castError", String(msg)),
});
