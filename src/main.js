"use strict";
const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeTheme } = require("electron");
const path = require("path");
const fs = require("fs");
const store = require("./db");
const updater = require("./updater");
let ui = null; // interface chargée : { dir, version, updated }

let win = null;
let db = null;

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
  ui = updater.uiDir();
  loadUi();
  win.webContents.on("did-fail-load", (e, code, desc, url, isMain) => { if (isMain && ui && ui.updated) fallback("chargement impossible"); });
  win.webContents.on("render-process-gone", () => { if (ui && ui.updated) fallback("plantage"); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", e => e.preventDefault());
  win.on("closed", () => { win = null; });
}

let readyTimer = null;
function loadUi() {
  clearTimeout(readyTimer);
  win.loadFile(path.join(ui.dir, "index.html"));
  // Une interface téléchargée doit confirmer qu'elle démarre bien, sinon on revient à celle intégrée
  if (ui.updated) readyTimer = setTimeout(() => fallback("pas de réponse"), 20000);
}
function fallback(reason) {
  console.warn("Azur : retour à l'interface intégrée (" + reason + ")");
  updater.markBad(ui.version);
  ui = updater.uiDir();
  if (win) loadUi();
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac ? [{ label: "Azur", submenu: [
      { role: "about", label: "À propos d'Azur" }, { type: "separator" },
      { role: "hide", label: "Masquer Azur" }, { role: "hideOthers", label: "Masquer les autres" }, { role: "unhide", label: "Tout afficher" },
      { type: "separator" }, { role: "quit", label: "Quitter Azur" }] }] : []),
    { label: "Fichier", submenu: [
      { label: "Se déconnecter", accelerator: "CmdOrCtrl+Shift+L", click: () => { if (win) win.webContents.send("auth:locked"); } },
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
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (!win || event.sender !== win.webContents) return { ok: false, error: { code: "forbidden", message: "Accès refusé." } };
    try {
      return { ok: true, data: await fn(...args) };
    } catch (e) {
      return { ok: false, error: { code: e.code || "error", message: e.message || "Une erreur est survenue.", retryIn: e.retryIn || 0 } };
    }
  });
}

function registerIpc() {
  // Base locale de la version 1.0 : utilisée seulement pour importer les anciennes données
  const legacyDb = () => {
    if (!db) { const f = dbFile(); if (!fs.existsSync(f)) return null; db = store.open(f); }
    return db;
  };
  handle("legacy:list", () => { const d = legacyDb(); return d ? d.listAccounts() : []; });
  handle("legacy:load", (id, password) => {
    const d = legacyDb();
    if (!d) throw Object.assign(new Error("Aucune donnée de la version 1.0 sur cet ordinateur."), { code: "none" });
    d.login({ id, password });
    return d.loadState(id);
  });
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
  });
  handle("app:info", () => ({ version: app.getVersion(), ui: ui ? ui.version : app.getVersion(), platform: process.platform, dark: nativeTheme.shouldUseDarkColors }));
  handle("ui:ready", () => { clearTimeout(readyTimer); return true; });
  handle("updates:info", () => updater.info());
  handle("updates:check", () => updater.check(true));
  handle("updates:restart", () => { updater.restart(); return true; });
}

app.whenReady().then(() => {
  registerIpc();
  buildMenu();
  createWindow();
  updater.start(st => { if (win) win.webContents.send("updates:status", st); });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => { try { db && db.close(); } catch (e) { /* déjà fermée */ } });
