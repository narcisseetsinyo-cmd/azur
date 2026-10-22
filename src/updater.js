"use strict";
/*
 * Mises à jour d'Azur sans réinstaller.
 *
 * 1. Interface (Mac et Windows) : au démarrage puis toutes les 6 heures, Azur lit ui-manifest.json sur la
 *    version web (GitHub Pages). Si une interface plus récente existe et qu'elle est compatible avec ce
 *    logiciel, ses fichiers sont téléchargés, vérifiés (empreinte SHA-256) puis utilisés au redémarrage.
 *    En cas de problème au chargement, Azur revient automatiquement à l'interface intégrée.
 * 2. Logiciel complet (Windows) : electron-updater télécharge la nouvelle version depuis GitHub Releases et
 *    l'installe au redémarrage. Sur Mac, une signature Apple payante serait nécessaire : Azur indique
 *    seulement qu'une nouvelle version complète existe.
 */
const { app, net } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const UI_BASE = (process.env.AZUR_UI_URL || "https://narcisseetsinyo-cmd.github.io/azur/").replace(/\/?$/, "/");
const SHELL_VERSION = app.getVersion();
const BUNDLED_UI = path.join(__dirname, "renderer");
const uiRoot = () => path.join(app.getPath("userData"), "ui");
const stateFile = () => path.join(uiRoot(), "state.json");

function cmp(a, b) {
  const pa = String(a || "0").split(".").map(n => parseInt(n, 10) || 0), pb = String(b || "0").split(".").map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0) ? 1 : -1; }
  return 0;
}
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), "utf8")); } catch (e) { return {}; } }
function writeState(s) { fs.mkdirSync(uiRoot(), { recursive: true }); fs.writeFileSync(stateFile(), JSON.stringify(s, null, 1)); }
function bundledUiVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(BUNDLED_UI, "ui-manifest.json"), "utf8")).version; } catch (e) { return SHELL_VERSION; }
}

/** Dossier de l'interface à charger : la plus récente valide, sinon celle intégrée au logiciel. */
function uiDir() {
  const s = readState();
  if (s.current && !(s.bad || []).includes(s.current) && cmp(s.current, bundledUiVersion()) > 0) {
    const dir = path.join(uiRoot(), s.current);
    if (fs.existsSync(path.join(dir, "index.html"))) return { dir, version: s.current, updated: true };
  }
  return { dir: BUNDLED_UI, version: bundledUiVersion(), updated: false };
}
/** Appelé si l'interface téléchargée ne se charge pas : on la met de côté. */
function markBad(version) {
  const s = readState(); s.bad = [...new Set([...(s.bad || []), version])]; if (s.current === version) delete s.current; writeState(s);
}

async function fetchBuf(url) {
  const r = await net.fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} pour ${url}`);
  return Buffer.from(await r.arrayBuffer());
}
const sha = b => crypto.createHash("sha256").update(b).digest("hex");
const safeRel = p => typeof p === "string" && !p.includes("..") && !path.isAbsolute(p) && /^[\w@.\-/]+$/.test(p);

let status = { state: "idle", ui: null, shell: null, message: "" };
let notify = () => {};
let busy = false;

async function checkUi() {
  const manifest = JSON.parse((await fetchBuf(UI_BASE + "ui-manifest.json?t=" + Date.now())).toString("utf8"));
  if (!manifest || !manifest.version || !Array.isArray(manifest.files)) throw new Error("Manifeste invalide");
  const cur = uiDir();
  if (cmp(manifest.version, cur.version) <= 0) return { available: false, version: cur.version };
  if (manifest.minShell && cmp(SHELL_VERSION, manifest.minShell) < 0) return { available: false, needsShell: manifest.minShell, version: manifest.version };
  const s = readState();
  if ((s.bad || []).includes(manifest.version)) return { available: false, version: cur.version };
  if (s.ready === manifest.version) return { available: true, ready: true, version: manifest.version };
  // Téléchargement dans un dossier temporaire, en réutilisant les fichiers identiques de l'interface actuelle
  const tmp = path.join(uiRoot(), `.tmp-${manifest.version}-${Date.now()}`);
  fs.mkdirSync(tmp, { recursive: true });
  try {
    for (const f of manifest.files) {
      if (!safeRel(f.path) || !/^[0-9a-f]{64}$/.test(f.sha256 || "")) throw new Error("Fichier refusé dans le manifeste : " + f.path);
      const dest = path.join(tmp, f.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const local = path.join(cur.dir, f.path);
      if (fs.existsSync(local) && sha(fs.readFileSync(local)) === f.sha256) { fs.copyFileSync(local, dest); continue; }
      const buf = await fetchBuf(UI_BASE + f.path.split("/").map(encodeURIComponent).join("/") + "?v=" + manifest.version);
      if (sha(buf) !== f.sha256) throw new Error("Empreinte différente pour " + f.path);
      fs.writeFileSync(dest, buf);
    }
    if (!fs.existsSync(path.join(tmp, "index.html"))) throw new Error("index.html manquant");
    const final = path.join(uiRoot(), manifest.version);
    fs.rmSync(final, { recursive: true, force: true });
    fs.renameSync(tmp, final);
    writeState({ ...readState(), ready: manifest.version, current: manifest.version });
    // On ne garde que l'interface en cours d'utilisation et la nouvelle
    for (const d of fs.readdirSync(uiRoot())) {
      if (d === manifest.version || d === cur.version || d === "state.json") continue;
      fs.rmSync(path.join(uiRoot(), d), { recursive: true, force: true });
    }
    return { available: true, ready: true, version: manifest.version };
  } catch (e) {
    fs.rmSync(tmp, { recursive: true, force: true });
    throw e;
  }
}

let autoUpdater = null;
function setupShellUpdater() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try { ({ autoUpdater } = require("electron-updater")); } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("update-available", i => set({ shell: { state: "downloading", version: i.version } }));
  autoUpdater.on("download-progress", p => set({ shell: { state: "downloading", version: status.shell && status.shell.version, percent: Math.round(p.percent) } }));
  autoUpdater.on("update-downloaded", i => set({ shell: { state: "ready", version: i.version } }));
  autoUpdater.on("error", e => set({ shell: { state: "error", message: String(e && e.message || e).slice(0, 200) } }));
}
async function checkShellMac() {
  // Sur Mac : simple vérification de la dernière version publiée
  try {
    const r = await net.fetch("https://api.github.com/repos/narcisseetsinyo-cmd/azur/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return;
    const j = await r.json();
    const v = String(j.tag_name || "").replace(/^v/, "");
    if (v && cmp(v, SHELL_VERSION) > 0) set({ shell: { state: "manual", version: v, url: j.html_url } });
  } catch (e) { /* hors ligne */ }
}

function set(patch) { status = { ...status, ...patch }; notify(status); }

async function check(manual) {
  if (busy) return status; busy = true;
  set({ state: "checking", message: "" });
  try {
    const r = await checkUi();
    if (r.ready) set({ state: "ready", ui: r.version, message: `L'interface ${r.version} est prête.` });
    else if (r.needsShell) set({ state: "shell-needed", message: `La version ${r.version} demande d'abord la mise à jour du logiciel (${r.needsShell}).` });
    else set({ state: "uptodate", ui: null, message: "Azur est à jour." });
  } catch (e) {
    set({ state: manual ? "error" : "idle", message: manual ? "Impossible de vérifier les mises à jour. Vérifie ta connexion Internet." : "" });
  }
  try { if (autoUpdater) await autoUpdater.checkForUpdates(); else if (process.platform === "darwin" && app.isPackaged) await checkShellMac(); } catch (e) { /* hors ligne */ }
  busy = false;
  return status;
}

function start(onStatus) {
  notify = onStatus || (() => {});
  setupShellUpdater();
  setTimeout(() => check(false), 8000);
  setInterval(() => check(false), 6 * 60 * 60 * 1000);
}
function restart() {
  if (status.shell && status.shell.state === "ready" && autoUpdater) { autoUpdater.quitAndInstall(false, true); return; }
  app.relaunch(); app.exit(0);
}
const info = () => ({ shell: SHELL_VERSION, ui: uiDir().version, status });

module.exports = { uiDir, markBad, start, check, restart, info, cmp };
