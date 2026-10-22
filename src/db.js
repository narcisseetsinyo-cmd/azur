"use strict";
/*
 * Base de données locale d'Azur (SQLite).
 * Un fichier unique sur l'ordinateur, plusieurs comptes, chaque compte ne voit que ses propres données.
 * Les mots de passe et les codes de secours ne sont jamais stockés en clair (scrypt + sel aléatoire).
 */
const Database = require("better-sqlite3");
const crypto = require("crypto");

const SCHEMA_VERSION = 1;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const MAX_FAILS = 5;

class AuthError extends Error {
  constructor(code, message, extra) { super(message); this.code = code; Object.assign(this, extra || {}); }
}

function hashSecret(secret, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(String(secret), salt, 64, SCRYPT).toString("hex");
  return { hash, salt };
}
function verifySecret(secret, hash, salt) {
  if (!hash || !salt) return false;
  const a = Buffer.from(crypto.scryptSync(String(secret), salt, 64, SCRYPT).toString("hex"), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- Identifiants ---------- */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function normalizeIdentifier(kind, raw) {
  const v = String(raw || "").trim();
  if (kind === "email") {
    const e = v.toLowerCase();
    if (!EMAIL_RE.test(e)) throw new AuthError("invalid_email", "Cette adresse e-mail n'est pas valide.");
    return e;
  }
  if (kind === "phone") {
    let d = v.replace(/[^\d+]/g, "");
    if (d.startsWith("00")) d = "+" + d.slice(2);
    if (!d.startsWith("+")) d = "+228" + d.replace(/^0+/, "");
    if (!/^\+\d{8,15}$/.test(d)) throw new AuthError("invalid_phone", "Ce numéro de téléphone n'est pas valide.");
    return d;
  }
  throw new AuthError("invalid_kind", "Choisis une adresse Gmail ou un numéro de téléphone.");
}
function checkPassword(pw) {
  const p = String(pw || "");
  if (p.length < 8) throw new AuthError("weak_password", "Le mot de passe doit contenir au moins 8 caractères.");
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) throw new AuthError("weak_password", "Le mot de passe doit contenir au moins une lettre et un chiffre.");
  return p;
}
function maskIdentifier(kind, id) {
  if (kind === "email") {
    const [u, dom] = id.split("@");
    return (u.length <= 2 ? u[0] + "•" : u.slice(0, 2) + "•".repeat(Math.min(5, u.length - 2))) + "@" + dom;
  }
  return id.slice(0, 4) + " •• •• " + id.slice(-4, -2) + " " + id.slice(-2);
}
const RC_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRecoveryCode() {
  const bytes = crypto.randomBytes(12);
  let s = "";
  for (let i = 0; i < 12; i++) s += RC_ALPHABET[bytes[i] % RC_ALPHABET.length];
  return s.slice(0, 4) + "-" + s.slice(4, 8) + "-" + s.slice(8);
}
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

/* ---------- Ouverture ---------- */
function open(file) {
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('email','phone')),
      identifier TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      pass_hash TEXT NOT NULL, pass_salt TEXT NOT NULL,
      recovery_hash TEXT NOT NULL, recovery_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL, last_login INTEGER,
      failed INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      json TEXT NOT NULL, updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS transactions (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      id TEXT NOT NULL,
      month TEXT NOT NULL,
      type TEXT NOT NULL, amount REAL NOT NULL, cat TEXT, date TEXT NOT NULL,
      note TEXT, pay TEXT, rec INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      PRIMARY KEY (user_id, id)
    );
    CREATE INDEX IF NOT EXISTS tx_user_month ON transactions(user_id, month);
    CREATE INDEX IF NOT EXISTS tx_user_date ON transactions(user_id, date);
  `);
  db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES ('schema', ?)").run(String(SCHEMA_VERSION));
  return makeApi(db);
}

function makeApi(db) {
  const q = {
    byIdent: db.prepare("SELECT * FROM users WHERE identifier = ?"),
    byId: db.prepare("SELECT * FROM users WHERE id = ?"),
    list: db.prepare("SELECT id, kind, identifier, display_name, last_login FROM users ORDER BY COALESCE(last_login, created_at) DESC"),
    insert: db.prepare(`INSERT INTO users (id, kind, identifier, display_name, pass_hash, pass_salt, recovery_hash, recovery_salt, created_at)
      VALUES (@id, @kind, @identifier, @display_name, @pass_hash, @pass_salt, @recovery_hash, @recovery_salt, @created_at)`),
    okLogin: db.prepare("UPDATE users SET failed = 0, locked_until = 0, last_login = ? WHERE id = ?"),
    badLogin: db.prepare("UPDATE users SET failed = ?, locked_until = ? WHERE id = ?"),
    setPass: db.prepare("UPDATE users SET pass_hash = ?, pass_salt = ?, failed = 0, locked_until = 0 WHERE id = ?"),
    setRecovery: db.prepare("UPDATE users SET recovery_hash = ?, recovery_salt = ? WHERE id = ?"),
    setName: db.prepare("UPDATE users SET display_name = ? WHERE id = ?"),
    delUser: db.prepare("DELETE FROM users WHERE id = ?"),
    getSettings: db.prepare("SELECT json FROM settings WHERE user_id = ?"),
    putSettings: db.prepare(`INSERT INTO settings(user_id, json, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at`),
    txAll: db.prepare("SELECT month, data FROM transactions WHERE user_id = ? ORDER BY date, rowid"),
    txDelMonth: db.prepare("DELETE FROM transactions WHERE user_id = ? AND month = ?"),
    txDelAll: db.prepare("DELETE FROM transactions WHERE user_id = ?"),
    txInsert: db.prepare(`INSERT OR REPLACE INTO transactions (user_id, id, month, type, amount, cat, date, note, pay, rec, data)
      VALUES (@user_id, @id, @month, @type, @amount, @cat, @date, @note, @pay, @rec, @data)`)
  };

  const publicUser = u => ({ id: u.id, kind: u.kind, displayName: u.display_name, identifier: u.identifier, masked: maskIdentifier(u.kind, u.identifier), lastLogin: u.last_login });

  function insertTx(userId, month, t) {
    if (!t || typeof t !== "object" || !t.id || !t.date || !t.type) return;
    q.txInsert.run({
      user_id: userId, id: String(t.id), month: String(t.date).slice(0, 7) || month,
      type: String(t.type), amount: Number(t.amount) || 0, cat: t.cat == null ? null : String(t.cat),
      date: String(t.date), note: t.note ? String(t.note) : null, pay: t.pay ? String(t.pay) : null,
      rec: t.rec ? 1 : 0, data: JSON.stringify(t)
    });
  }

  const api = {
    file: db.name,
    close: () => db.close(),

    listAccounts() {
      return q.list.all().map(u => ({ id: u.id, kind: u.kind, displayName: u.display_name, masked: maskIdentifier(u.kind, u.identifier), lastLogin: u.last_login }));
    },

    register({ kind, identifier, displayName, password }) {
      const ident = normalizeIdentifier(kind, identifier);
      const name = String(displayName || "").trim();
      if (!name) throw new AuthError("invalid_name", "Indique ton prénom ou ton nom.");
      if (name.length > 40) throw new AuthError("invalid_name", "Le nom est trop long (40 caractères au plus).");
      checkPassword(password);
      if (q.byIdent.get(ident)) throw new AuthError("exists", kind === "email" ? "Un compte existe déjà avec cette adresse." : "Un compte existe déjà avec ce numéro.");
      const pw = hashSecret(password);
      const code = newRecoveryCode();
      const rc = hashSecret(normCode(code));
      const id = crypto.randomUUID();
      q.insert.run({ id, kind, identifier: ident, display_name: name, pass_hash: pw.hash, pass_salt: pw.salt, recovery_hash: rc.hash, recovery_salt: rc.salt, created_at: Date.now() });
      q.okLogin.run(Date.now(), id);
      return { user: publicUser(q.byId.get(id)), recoveryCode: code };
    },

    login({ kind, identifier, password, id }) {
      const u = id ? q.byId.get(String(id)) : q.byIdent.get(normalizeIdentifier(kind, identifier));
      if (!u) throw new AuthError("not_found", id ? "Ce compte n'existe plus sur cet ordinateur." : kind === "email" ? "Aucun compte avec cette adresse sur cet ordinateur." : "Aucun compte avec ce numéro sur cet ordinateur.");
      const now = Date.now();
      if (u.locked_until > now) throw new AuthError("locked", "Trop d'essais. Réessaie dans quelques instants.", { retryIn: Math.ceil((u.locked_until - now) / 1000) });
      if (!verifySecret(password, u.pass_hash, u.pass_salt)) {
        const failed = u.failed + 1;
        const lock = failed >= MAX_FAILS ? now + Math.min(15 * 60, 30 * 2 ** (failed - MAX_FAILS)) * 1000 : 0;
        q.badLogin.run(failed, lock, u.id);
        const left = MAX_FAILS - failed;
        throw new AuthError("bad_password", left > 0 ? `Mot de passe incorrect. Encore ${left} essai${left > 1 ? "s" : ""} avant un blocage temporaire.` : "Mot de passe incorrect. Compte bloqué quelques instants.", { retryIn: lock ? Math.ceil((lock - now) / 1000) : 0 });
      }
      q.okLogin.run(now, u.id);
      return publicUser(q.byId.get(u.id));
    },

    resetPassword({ kind, identifier, recoveryCode, newPassword }) {
      const ident = normalizeIdentifier(kind, identifier);
      const u = q.byIdent.get(ident);
      const now = Date.now();
      if (!u) throw new AuthError("not_found", "Aucun compte avec cet identifiant sur cet ordinateur.");
      if (u.locked_until > now) throw new AuthError("locked", "Trop d'essais. Réessaie dans quelques instants.", { retryIn: Math.ceil((u.locked_until - now) / 1000) });
      if (!verifySecret(normCode(recoveryCode), u.recovery_hash, u.recovery_salt)) {
        const failed = u.failed + 1;
        q.badLogin.run(failed, failed >= MAX_FAILS ? now + 60000 : 0, u.id);
        throw new AuthError("bad_code", "Ce code de secours ne correspond pas.");
      }
      checkPassword(newPassword);
      const pw = hashSecret(newPassword);
      q.setPass.run(pw.hash, pw.salt, u.id);
      const code = newRecoveryCode();
      const rc = hashSecret(normCode(code));
      q.setRecovery.run(rc.hash, rc.salt, u.id);
      q.okLogin.run(now, u.id);
      return { user: publicUser(q.byId.get(u.id)), recoveryCode: code };
    },

    changePassword(userId, oldPassword, newPassword) {
      const u = q.byId.get(userId);
      if (!u) throw new AuthError("not_found", "Compte introuvable.");
      if (!verifySecret(oldPassword, u.pass_hash, u.pass_salt)) throw new AuthError("bad_password", "Le mot de passe actuel est incorrect.");
      checkPassword(newPassword);
      const pw = hashSecret(newPassword);
      q.setPass.run(pw.hash, pw.salt, userId);
      return true;
    },

    newRecoveryCode(userId, password) {
      const u = q.byId.get(userId);
      if (!u || !verifySecret(password, u.pass_hash, u.pass_salt)) throw new AuthError("bad_password", "Le mot de passe est incorrect.");
      const code = newRecoveryCode();
      const rc = hashSecret(normCode(code));
      q.setRecovery.run(rc.hash, rc.salt, userId);
      return code;
    },

    rename(userId, name) {
      const n = String(name || "").trim();
      if (!n || n.length > 40) throw new AuthError("invalid_name", "Indique un nom de 1 à 40 caractères.");
      q.setName.run(n, userId);
      return publicUser(q.byId.get(userId));
    },

    deleteAccount(userId, password) {
      const u = q.byId.get(userId);
      if (!u || !verifySecret(password, u.pass_hash, u.pass_salt)) throw new AuthError("bad_password", "Le mot de passe est incorrect.");
      q.delUser.run(userId);
      return true;
    },

    loadState(userId) {
      const s = q.getSettings.get(userId);
      let config = null;
      try { config = s ? JSON.parse(s.json) : null; } catch (e) { config = null; }
      const tx = {};
      for (const r of q.txAll.all(userId)) {
        try { (tx[r.month] = tx[r.month] || []).push(JSON.parse(r.data)); } catch (e) { /* ligne illisible ignorée */ }
      }
      return { config, tx };
    },

    saveConfig(userId, config) {
      if (!config || typeof config !== "object") throw new AuthError("invalid", "Réglages invalides.");
      q.putSettings.run(userId, JSON.stringify(config), Date.now());
      return true;
    },

    replaceMonth: db.transaction((userId, month, items) => {
      if (!/^\d{4}-\d{2}$/.test(month)) throw new AuthError("invalid", "Mois invalide.");
      q.txDelMonth.run(userId, month);
      (Array.isArray(items) ? items : []).forEach(t => insertTx(userId, month, t));
      return true;
    }),

    replaceAll: db.transaction((userId, state) => {
      q.txDelAll.run(userId);
      const tx = (state && state.tx) || {};
      Object.entries(tx).forEach(([m, items]) => (Array.isArray(items) ? items : []).forEach(t => insertTx(userId, m, t)));
      if (state && state.config) q.putSettings.run(userId, JSON.stringify(state.config), Date.now());
      return true;
    })
  };
  return api;
}

module.exports = { open, AuthError, normalizeIdentifier, maskIdentifier };
