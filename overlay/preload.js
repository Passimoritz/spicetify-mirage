// Schmale Brücke zwischen den Fenstern und dem Hauptprozess.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mirage", {
  on: (channel, cb) => ipcRenderer.on(channel, (_e, data) => cb(data)),
  send: (channel, data) => ipcRenderer.send(channel, data),
  get: () => ipcRenderer.invoke("get"),
  platform: process.platform, // win32 | darwin | linux
});
