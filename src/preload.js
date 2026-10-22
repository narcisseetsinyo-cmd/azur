"use strict";
const { contextBridge, ipcRenderer } = require("electron");

const call = (ch, ...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld("azur", {
  auth: {
    list: () => call("auth:list"),
    session: () => call("auth:session"),
    register: p => call("auth:register", p),
    login: p => call("auth:login", p),
    reset: p => call("auth:reset", p),
    logout: () => call("auth:logout"),
    onLocked: fn => ipcRenderer.on("auth:locked", () => fn())
  },
  account: {
    changePassword: (oldPw, newPw) => call("account:changePassword", oldPw, newPw),
    newRecoveryCode: pw => call("account:newRecoveryCode", pw),
    rename: name => call("account:rename", name),
    remove: pw => call("account:delete", pw)
  },
  data: {
    load: () => call("data:load"),
    saveConfig: c => call("data:saveConfig", c),
    replaceMonth: (m, items) => call("data:replaceMonth", m, items),
    replaceAll: s => call("data:replaceAll", s)
  },
  file: { save: (name, text) => call("file:save", name, text) },
  app: { info: () => call("app:info"), showDb: () => call("app:showDb") }
});
