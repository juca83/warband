// The launcher window's only door to the outside: a few named calls.
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("launcher", {
  state: () => ipcRenderer.invoke("state"),
  check: () => ipcRenderer.invoke("check"),
  update: () => ipcRenderer.invoke("update"),
  play: () => ipcRenderer.invoke("play"),
  setRepo: (repo) => ipcRenderer.invoke("setRepo", repo),
  openFolder: () => ipcRenderer.invoke("openFolder"),
  openPage: () => ipcRenderer.invoke("openPage"),
  onProgress: (fn) => ipcRenderer.on("progress", (e, d) => fn(d)),
});
