"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

// Fonctions propres au logiciel (le reste — comptes et données — passe par Firebase dans cloud.js)
contextBridge.exposeInMainWorld("azurNative", {
  file: { save: (name, text) => call("file:save", name, text) },
  app: { info: () => call("app:info") },
  onLocked: fn => ipcRenderer.on("auth:locked", () => fn()),
  legacy: {
    list: () => call("legacy:list"),
    load: (id, password) => call("legacy:load", id, password)
  }
});
