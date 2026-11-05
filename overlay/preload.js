// Schmale Brücke zwischen den Fenstern und dem Hauptprozess.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mirage", {
  on: (channel, cb) => ipcRenderer.on(channel, (_e, data) => cb(data)),
  send: (channel, data) => ipcRenderer.send(channel, data),
  get: () => ipcRenderer.invoke("get"),
  invoke: (channel, data) => (["hueFind", "huePair", "hueGroups"].includes(channel) ? ipcRenderer.invoke(channel, data) : Promise.resolve(null)),
  platform: process.platform, // win32 | darwin | linux
});
