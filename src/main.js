"use strict";
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const store = require("./db");

let win = null;
let db = null;
let session = null; // { userId } — le compte connecté, connu seulement du processus principal

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

function dbFile() {
  const dir = app.getPath("userData");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "azur.sqlite");
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 840, minWidth: 380, minHeight: 600,
    title: "Azur",
    backgroundColor: "#050B1A",
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", e => e.preventDefault());
  win.on("closed", () => { win = null; session = null; });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ label: "Azur", submenu: [
      { role: "about", label: "À propos d'Azur" }, { type: "separator" },
      { role: "hide", label: "Masquer Azur" }, { role: "hideOthers", label: "Masquer les autres" }, { role: "unhide", label: "Tout afficher" },
      { type: "separator" }, { role: "quit", label: "Quitter Azur" }] }] : []),
    { label: "Fichier", submenu: [
      { label: "Se déconnecter", accelerator: "CmdOrCtrl+Shift+L", click: () => { session = null; if (win) win.webContents.send("auth:locked"); } },
      { type: "separator" },
      isMac ? { role: "close", label: "Fermer la fenêtre" } : { role: "quit", label: "Quitter" }] },
    { label: "Édition", submenu: [
      { role: "undo", label: "Annuler" }, { role: "redo", label: "Rétablir" }, { type: "separator" },
      { role: "cut", label: "Couper" }, { role: "copy", label: "Copier" }, { role: "paste", label: "Coller" }, { role: "selectAll", label: "Tout sélectionner" }] },
    { label: "Affichage", submenu: [
      { role: "resetZoom", label: "Taille réelle" }, { role: "zoomIn", label: "Agrandir" }, { role: "zoomOut", label: "Réduire" },
      { type: "separator" }, { role: "togglefullscreen", label: "Plein écran" },
      ...(app.isPackaged ? [] : [{ role: "toggleDevTools", label: "Outils de développement" }])] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ---------- Pont IPC : chaque appel renvoie { ok, data } ou { ok:false, error } ---------- */
function handle(channel, fn, needsAuth) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents) return { ok: false, error: { code: "forbidden", message: "Accès refusé." } };
    try {
      if (needsAuth && !session) return { ok: false, error: { code: "unauthenticated", message: "Connecte-toi d'abord." } };
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      return { ok: false, error: { code: e.code || "error", message: e.message || "Une erreur est survenue.", retryIn: e.retryIn || 0 } };
    }
  });
}

function registerIpc() {
  handle("auth:list", () => db.listAccounts());
  handle("auth:session", () => (session ? db.listAccounts().find(a => a.id === session.userId) || null : null));
  handle("auth:register", p => { const r = db.register(p || {}); session = { userId: r.user.id }; return r; });
  handle("auth:login", p => { const u = db.login(p || {}); session = { userId: u.id }; return u; });
  handle("auth:reset", p => { const r = db.resetPassword(p || {}); session = { userId: r.user.id }; return r; });
  handle("auth:logout", () => { session = null; return true; });
  handle("account:changePassword", (a, b) => db.changePassword(session.userId, a, b), true);
  handle("account:newRecoveryCode", pw => db.newRecoveryCode(session.userId, pw), true);
  handle("account:rename", n => db.rename(session.userId, n), true);
  handle("account:delete", pw => { db.deleteAccount(session.userId, pw); session = null; return true; }, true);
  handle("data:load", () => db.loadState(session.userId), true);
  handle("data:saveConfig", c => db.saveConfig(session.userId, c), true);
  handle("data:replaceMonth", (m, items) => db.replaceMonth(session.userId, m, items), true);
  handle("data:replaceAll", s => db.replaceAll(session.userId, s), true);
  handle("file:save", async (filename, text) => {
    const ext = path.extname(String(filename || "")).slice(1).toLowerCase();
    if (!["csv", "json"].includes(ext)) throw Object.assign(new Error("Format non pris en charge."), { code: "bad_ext" });
    const r = await dialog.showSaveDialog(win, {
      title: "Enregistrer le fichier",
      defaultPath: path.join(app.getPath("documents"), path.basename(filename)),
      filters: ext === "csv" ? [{ name: "Tableur CSV", extensions: ["csv"] }] : [{ name: "Sauvegarde Azur", extensions: ["json"] }]
    });
    if (r.canceled || !r.filePath) return { saved: false };
    await fs.promises.writeFile(r.filePath, String(text), "utf8");
    return { saved: true, path: r.filePath };
  }, true);
  handle("app:info", () => ({ version: app.getVersion(), dbFile: db.file, platform: process.platform, dark: nativeTheme.shouldUseDarkColors }));
  handle("app:showDb", () => { shell.showItemInFolder(db.file); return true; }, true);
}

app.whenReady().then(() => {
  db = store.open(dbFile());
  registerIpc();
  buildMenu();
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { session = null; if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { try { db && db.close(); } catch (e) { /* déjà fermée */ } });
