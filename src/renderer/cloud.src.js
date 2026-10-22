/*
 * Azur — comptes et données synchronisés (Firebase Auth + Firestore avec cache hors ligne).
 * Expose window.azur avec la même interface que la version 1.0, pour l'app et l'écran de connexion.
 * Compilé dans cloud.js par « npm run build:cloud ».
 */
import { initializeApp } from "firebase/app";
import {
  initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, connectAuthEmulator,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail,
  reauthenticateWithCredential, EmailAuthProvider, updatePassword, deleteUser
} from "firebase/auth";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  doc, collection, setDoc, deleteDoc, onSnapshot, writeBatch, getDocs, getDoc, serverTimestamp
} from "firebase/firestore";

const native = window.azurNative || null; // présent seulement dans le logiciel Windows / Mac
const config = window.AZUR_FIREBASE || null;
const ok = data => ({ ok: true, data });
const fail = (code, message, extra) => ({ ok: false, error: Object.assign({ code, message }, extra || {}) });

/* ---------- Identifiants ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_DOMAIN = "telephone.azur.app";
function normalize(kind, raw) {
  const v = String(raw || "").trim();
  if (kind === "email") {
    const e = v.toLowerCase();
    if (!EMAIL_RE.test(e)) throw { code: "invalid_email", message: "Cette adresse e-mail n'est pas valide." };
    return e;
  }
  if (kind === "phone") {
    let d = v.replace(/[^\d+]/g, "");
    if (d.startsWith("00")) d = "+" + d.slice(2);
    if (!d.startsWith("+")) d = "+228" + d.replace(/^0+/, "");
    if (!/^\+\d{8,15}$/.test(d)) throw { code: "invalid_phone", message: "Ce numéro de téléphone n'est pas valide." };
    return d;
  }
  throw { code: "invalid_kind", message: "Choisis une adresse Gmail ou un numéro de téléphone." };
}
const authEmail = (kind, ident) => (kind === "email" ? ident : `t${ident.slice(1)}@${PHONE_DOMAIN}`);
function checkPassword(p) {
  p = String(p || "");
  if (p.length < 8) throw { code: "weak_password", message: "Le mot de passe doit contenir au moins 8 caractères." };
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) throw { code: "weak_password", message: "Le mot de passe doit contenir au moins une lettre et un chiffre." };
}
function mask(kind, id) {
  if (kind === "email") { const [u, d] = id.split("@"); return (u.length <= 2 ? u[0] + "•" : u.slice(0, 2) + "•".repeat(Math.min(5, u.length - 2))) + "@" + d; }
  return id.slice(0, 4) + " •• •• " + id.slice(-4, -2) + " " + id.slice(-2);
}
function fbError(e, kind) {
  const c = (e && e.code) || "";
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return fail("bad_credentials", kind === "phone" ? "Numéro ou mot de passe incorrect." : "Adresse ou mot de passe incorrect.");
  if (/email-already-in-use/.test(c)) return fail("exists", kind === "phone" ? "Un compte existe déjà avec ce numéro." : "Un compte existe déjà avec cette adresse.");
  if (/too-many-requests/.test(c)) return fail("locked", "Trop d'essais. Réessaie dans quelques minutes.", { retryIn: 60 });
  if (/network-request-failed|unavailable/.test(c)) return fail("offline", "Pas de connexion Internet. Vérifie ta connexion et réessaie.");
  if (/weak-password/.test(c)) return fail("weak_password", "Ce mot de passe est trop faible.");
  if (/requires-recent-login/.test(c)) return fail("recent_login", "Par sécurité, reconnecte-toi puis recommence.");
  if (/operation-not-allowed/.test(c)) return fail("not_enabled", "La connexion par e-mail n'est pas activée dans Firebase.");
  if (e && e.code && e.message && !String(e.code).includes("/")) return fail(e.code, e.message);
  return fail("error", "Une erreur est survenue. Réessaie dans un instant.");
}

/* ---------- Comptes mémorisés sur cet appareil (pour la liste et la connexion hors ligne) ---------- */
const ACC_KEY = "azur:accounts:v2";
function readAccounts() { try { return JSON.parse(localStorage.getItem(ACC_KEY) || "[]"); } catch (e) { return []; } }
function writeAccounts(a) { try { localStorage.setItem(ACC_KEY, JSON.stringify(a)); } catch (e) { /* stockage indisponible */ } }
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
async function verifier(password, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/../g).map(h => parseInt(h, 16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, key, 256);
  return { salt: hex(salt), hash: hex(bits) };
}
async function remember(user, kind, ident, displayName, password) {
  const v = await verifier(password);
  const list = readAccounts().filter(a => a.uid !== user.uid);
  list.unshift({ uid: user.uid, kind, identifier: ident, email: user.email, displayName, masked: mask(kind, ident), salt: v.salt, hash: v.hash, lastLogin: Date.now() });
  writeAccounts(list.slice(0, 12));
}
const publicAccount = a => ({ id: a.uid, kind: a.kind, displayName: a.displayName, masked: a.masked, lastLogin: a.lastLogin });

/* ---------- Firebase ---------- */
let app = null, auth = null, db = null;
const emu = new URLSearchParams(location.search).get("emulator") || window.AZUR_EMULATOR || "";
if (config) {
  app = initializeApp(config);
  auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  if (emu) {
    const [host, aPort, fPort] = emu.split(":");
    connectAuthEmulator(auth, `http://${host}:${aPort || 9099}`, { disableWarnings: true });
    connectFirestoreEmulator(db, host, +(fPort || 8080));
  }
}
const authReady = auth ? auth.authStateReady() : Promise.resolve();

/* ---------- Session et données ---------- */
let session = null;                 // { uid, kind, identifier, displayName, masked }
let txMap = new Map(), cfg = null, unsubs = [];
let remoteCbs = [], statusCbs = [], lastEmit = "", status = { state: "offline", pending: false };
const online = () => navigator.onLine !== false;
function stateNow() {
  const tx = {};
  [...txMap.values()].sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.created || 0) - (b.created || 0))
    .forEach(t => { const m = String(t.date || "").slice(0, 7); if (m) (tx[m] = tx[m] || []).push(t); });
  return { config: cfg, tx };
}
function emit() {
  const s = stateNow(); const j = JSON.stringify(s);
  if (j === lastEmit) return; lastEmit = j;
  remoteCbs.forEach(cb => { try { cb(JSON.parse(j)); } catch (e) { /* écouteur en erreur */ } });
}
let meta = { tx: { fromCache: true, pending: false }, cfg: { fromCache: true, pending: false } };
function setStatus() {
  const pending = meta.tx.pending || meta.cfg.pending;
  const state = !online() ? "offline" : pending ? "pending" : (meta.tx.fromCache || meta.cfg.fromCache) ? "connecting" : "synced";
  if (state === status.state && pending === status.pending) return;
  status = { state, pending };
  statusCbs.forEach(cb => { try { cb(status); } catch (e) { /* écouteur en erreur */ } });
}
window.addEventListener("online", setStatus);
window.addEventListener("offline", setStatus);
const clean = o => JSON.parse(JSON.stringify(o));

function stopData() { unsubs.forEach(u => { try { u(); } catch (e) { /* déjà arrêté */ } }); unsubs = []; txMap = new Map(); cfg = null; lastEmit = ""; }
function startData(uid) {
  stopData();
  let gotTx = false, gotCfg = false, done;
  const ready = new Promise(r => (done = r));
  const check = () => { if (gotTx && gotCfg) done(); };
  unsubs.push(onSnapshot(collection(db, "users", uid, "tx"), { includeMetadataChanges: true }, snap => {
    snap.docChanges().forEach(ch => { if (ch.type === "removed") txMap.delete(ch.doc.id); else { const d = ch.doc.data(); if (d && d.d) txMap.set(ch.doc.id, d.d); } });
    meta.tx = { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites };
    gotTx = true; check(); setStatus(); if (gotTx && gotCfg) emit();
  }, () => { gotTx = true; check(); }));
  unsubs.push(onSnapshot(doc(db, "users", uid, "meta", "config"), { includeMetadataChanges: true }, snap => {
    cfg = snap.exists() ? (snap.data().d || null) : null;
    meta.cfg = { fromCache: snap.metadata.fromCache, pending: snap.metadata.hasPendingWrites };
    gotCfg = true; check(); setStatus(); if (gotTx && gotCfg) emit();
  }, () => { gotCfg = true; check(); }));
  return Promise.race([ready, new Promise(r => setTimeout(r, 8000))]);
}
async function commit(ops) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([kind, ref, data]) => (kind === "set" ? b.set(ref, data) : b.delete(ref)));
    b.commit().catch(e => console.warn("Azur : écriture refusée", e && e.code));
  }
}
const need = () => { if (!session || !db) throw { code: "unauthenticated", message: "Connecte-toi d'abord." }; return session.uid; };
const wrap = fn => async (...a) => { try { return ok(await fn(...a)); } catch (e) { return e && e.code && !String(e.code).includes("/") ? fail(e.code, e.message, e) : fbError(e); } };

async function openSession(user, kind, ident, displayName) {
  session = { uid: user.uid, kind, identifier: ident, displayName, masked: mask(kind, ident) };
  return publicAccount({ uid: user.uid, kind, displayName, masked: session.masked, lastLogin: Date.now() });
}

window.azur = {
  configured: !!config,
  auth: {
    list: wrap(async () => readAccounts().map(publicAccount)),
    session: wrap(async () => null),
    register: async p => {
      try {
        if (!auth) return fail("not_configured", "Azur n'est pas encore relié à Firebase.");
        const kind = p.kind, ident = normalize(kind, p.identifier), name = String(p.displayName || "").trim();
        if (!name) throw { code: "invalid_name", message: "Indique ton prénom et ton nom." };
        if (name.length > 40) throw { code: "invalid_name", message: "Le nom est trop long (40 caractères au plus)." };
        checkPassword(p.password);
        if (!online()) return fail("offline", "Une connexion Internet est nécessaire pour créer un compte.");
        const cred = await createUserWithEmailAndPassword(auth, authEmail(kind, ident), p.password);
        await updateProfile(cred.user, { displayName: name });
        setDoc(doc(db, "users", cred.user.uid), { displayName: name, kind, identifier: ident, createdAt: serverTimestamp() }).catch(() => {});
        await remember(cred.user, kind, ident, name, p.password);
        return ok({ user: await openSession(cred.user, kind, ident, name) });
      } catch (e) { return e && e.code && !String(e.code).includes("/") ? fail(e.code, e.message) : fbError(e, p && p.kind); }
    },
    login: async p => {
      const accounts = readAccounts();
      let acc = p.id ? accounts.find(a => a.uid === p.id) : null;
      let kind = acc ? acc.kind : p.kind, ident;
      try {
        if (!auth) return fail("not_configured", "Azur n'est pas encore relié à Firebase.");
        ident = acc ? acc.identifier : normalize(kind, p.identifier);
        if (!acc) acc = accounts.find(a => a.kind === kind && a.identifier === ident) || null;
        if (!p.password) throw { code: "missing", message: "Saisis ton mot de passe." };
        await authReady;
        const tryOffline = async () => {
          if (!acc) return fail("offline", "Pas de connexion Internet. La première connexion d'un compte sur cet appareil demande Internet.");
          const v = await verifier(p.password, acc.salt);
          if (v.hash !== acc.hash) return fail("bad_credentials", "Mot de passe incorrect.");
          if (!auth.currentUser || auth.currentUser.uid !== acc.uid) return fail("offline", "Pas de connexion Internet. Pour changer de compte sur cet appareil, connecte-toi à Internet.");
          acc.lastLogin = Date.now(); writeAccounts([acc, ...accounts.filter(a => a.uid !== acc.uid)]);
          return ok(await openSession(auth.currentUser, acc.kind, acc.identifier, acc.displayName));
        };
        if (!online()) return await tryOffline();
        let cred;
        try { cred = await signInWithEmailAndPassword(auth, acc ? acc.email : authEmail(kind, ident), p.password); }
        catch (e) { if (/network-request-failed/.test(e.code || "")) return await tryOffline(); throw e; }
        let name = cred.user.displayName || (acc && acc.displayName) || "";
        if (!name) { try { const s = await getDoc(doc(db, "users", cred.user.uid)); name = (s.exists() && s.data().displayName) || ident; } catch (e) { name = ident; } }
        await remember(cred.user, kind, ident, name, p.password);
        return ok(await openSession(cred.user, kind, ident, name));
      } catch (e) { return e && e.code && !String(e.code).includes("/") ? fail(e.code, e.message) : fbError(e, kind); }
    },
    reset: async p => {
      try {
        if (!auth) return fail("not_configured", "Azur n'est pas encore relié à Firebase.");
        if (p.kind !== "email") return fail("phone_reset", "Un compte téléphone ne peut pas recevoir d'e-mail de réinitialisation.");
        const ident = normalize("email", p.identifier);
        if (!online()) return fail("offline", "Une connexion Internet est nécessaire.");
        auth.languageCode = "fr";
        await sendPasswordResetEmail(auth, ident);
        return ok({ sent: true, email: ident });
      } catch (e) { if (/user-not-found|invalid-email/.test((e && e.code) || "")) return ok({ sent: true, email: p.identifier }); return fbError(e, "email"); }
    },
    logout: wrap(async () => { stopData(); session = null; return true; }),
    forget: wrap(async id => { writeAccounts(readAccounts().filter(a => a.uid !== id)); return true; }),
    onLocked: fn => { if (native && native.onLocked) native.onLocked(fn); }
  },
  account: {
    changePassword: wrap(async (oldPw, newPw) => {
      need(); checkPassword(newPw);
      if (!online()) throw { code: "offline", message: "Une connexion Internet est nécessaire pour changer de mot de passe." };
      const u = auth.currentUser;
      try { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, oldPw)); } catch (e) { throw { code: "bad_password", message: "Le mot de passe actuel est incorrect." }; }
      await updatePassword(u, newPw);
      await remember(u, session.kind, session.identifier, session.displayName, newPw);
      return true;
    }),
    sendReset: wrap(async () => {
      need();
      if (session.kind !== "email") throw { code: "phone_reset", message: "Disponible seulement pour les comptes Gmail." };
      auth.languageCode = "fr"; await sendPasswordResetEmail(auth, session.identifier);
      return session.identifier;
    }),
    rename: wrap(async name => {
      const uid = need(); const n = String(name || "").trim();
      if (!n || n.length > 40) throw { code: "invalid_name", message: "Indique un nom de 1 à 40 caractères." };
      updateProfile(auth.currentUser, { displayName: n }).catch(() => {});
      setDoc(doc(db, "users", uid), { displayName: n }, { merge: true }).catch(() => {});
      session.displayName = n;
      const list = readAccounts(); const a = list.find(x => x.uid === uid); if (a) { a.displayName = n; writeAccounts(list); }
      return publicAccount({ uid, kind: session.kind, displayName: n, masked: session.masked, lastLogin: Date.now() });
    }),
    remove: wrap(async pw => {
      const uid = need();
      if (!online()) throw { code: "offline", message: "Une connexion Internet est nécessaire pour supprimer le compte." };
      const u = auth.currentUser;
      try { await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, pw)); } catch (e) { throw { code: "bad_password", message: "Le mot de passe est incorrect." }; }
      const snap = await getDocs(collection(db, "users", uid, "tx"));
      const ops = snap.docs.map(d => ["del", d.ref]);
      ops.push(["del", doc(db, "users", uid, "meta", "config")], ["del", doc(db, "users", uid)]);
      for (let i = 0; i < ops.length; i += 400) { const b = writeBatch(db); ops.slice(i, i + 400).forEach(([, r]) => b.delete(r)); await b.commit(); }
      stopData(); await deleteUser(u);
      writeAccounts(readAccounts().filter(a => a.uid !== uid)); session = null;
      return true;
    })
  },
  data: {
    load: wrap(async () => { const uid = need(); await startData(uid); setStatus(); const s = stateNow(); lastEmit = JSON.stringify(s); return s; }),
    saveConfig: wrap(async c => { const uid = need(); cfg = clean(c); commit([["set", doc(db, "users", uid, "meta", "config"), { d: cfg, u: serverTimestamp() }]]); return true; }),
    replaceMonth: wrap(async (month, items) => {
      const uid = need(); const ops = []; const keep = new Set();
      (items || []).forEach(t => {
        if (!t || !t.id || !t.date) return; keep.add(t.id);
        const c = clean(t); const prev = txMap.get(t.id);
        if (!prev || JSON.stringify(prev) !== JSON.stringify(c)) { txMap.set(t.id, c); ops.push(["set", doc(db, "users", uid, "tx", String(t.id)), { d: c, m: String(t.date).slice(0, 7), u: serverTimestamp() }]); }
      });
      [...txMap.entries()].forEach(([id, t]) => { if (String(t.date || "").slice(0, 7) === month && !keep.has(id)) { txMap.delete(id); ops.push(["del", doc(db, "users", uid, "tx", id)]); } });
      if (ops.length) commit(ops);
      return true;
    }),
    replaceAll: wrap(async s => {
      const uid = need(); const ops = []; const next = new Map();
      Object.values((s && s.tx) || {}).flat().forEach(t => { if (t && t.id && t.date) next.set(String(t.id), clean(t)); });
      [...txMap.keys()].forEach(id => { if (!next.has(id)) ops.push(["del", doc(db, "users", uid, "tx", id)]); });
      next.forEach((t, id) => ops.push(["set", doc(db, "users", uid, "tx", id), { d: t, m: t.date.slice(0, 7), u: serverTimestamp() }]));
      txMap = next;
      if (s && s.config) { cfg = clean(s.config); ops.push(["set", doc(db, "users", uid, "meta", "config"), { d: cfg, u: serverTimestamp() }]); }
      commit(ops);
      return true;
    }),
    onRemote: fn => { remoteCbs.push(fn); return () => { remoteCbs = remoteCbs.filter(f => f !== fn); }; }
  },
  sync: {
    status: () => status,
    onStatus: fn => { statusCbs.push(fn); fn(status); return () => { statusCbs = statusCbs.filter(f => f !== fn); }; }
  },
  file: {
    save: async (name, text) => {
      if (native) return native.file.save(name, text);
      try {
        const type = name.endsWith(".csv") ? "text/csv;charset=utf-8" : "application/json";
        const url = URL.createObjectURL(new Blob([text], { type }));
        const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        return ok({ saved: true });
      } catch (e) { return fail("error", "Le téléchargement n'a pas pu démarrer."); }
    }
  },
  app: {
    info: async () => (native ? native.app.info() : ok({ version: window.AZUR_VERSION || "", platform: "web" })),
    native: !!native
  },
  legacy: native && native.legacy ? native.legacy : null
};

if (emu) {
  // Outils réservés aux tests automatiques sur l'émulateur Firebase
  window.__azurTest = {
    uid: () => (session ? session.uid : null),
    readOther: async uid => { try { await getDocs(collection(db, "users", uid, "tx")); return "allowed"; } catch (e) { return e.code || "denied"; } },
    count: () => txMap.size
  };
}
