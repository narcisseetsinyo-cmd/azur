"use strict";
// Tests de la base locale : node test/db.test.js
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const store = require("../src/db");

const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "azur-")), "test.sqlite");
const db = store.open(file);
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("  ok  " + name); };
const throwsCode = (fn, code) => assert.throws(fn, e => e.code === code, "attendu : " + code);

t("normalise les numéros togolais", () => {
  assert.strictEqual(store.normalizeIdentifier("phone", "90 12 34 56"), "+22890123456");
  assert.strictEqual(store.normalizeIdentifier("phone", "00229 97 00 00 00"), "+22997000000");
  throwsCode(() => store.normalizeIdentifier("phone", "123"), "invalid_phone");
  throwsCode(() => store.normalizeIdentifier("email", "pas-une-adresse"), "invalid_email");
});

let ama, kofi;
t("crée un compte Gmail avec code de secours", () => {
  const r = db.register({ kind: "email", identifier: " Ama.Test@Gmail.com ", displayName: "Ama", password: "azur2026!" });
  ama = r.user;
  assert.strictEqual(ama.identifier, "ama.test@gmail.com");
  assert.match(r.recoveryCode, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  ama.code = r.recoveryCode;
});
t("refuse les mots de passe faibles et les doublons", () => {
  throwsCode(() => db.register({ kind: "phone", identifier: "90000000", displayName: "X", password: "court1" }), "weak_password");
  throwsCode(() => db.register({ kind: "phone", identifier: "90000000", displayName: "X", password: "seulementdeslettres" }), "weak_password");
  throwsCode(() => db.register({ kind: "email", identifier: "ama.test@gmail.com", displayName: "B", password: "azur2026!" }), "exists");
});
t("crée un compte téléphone", () => {
  kofi = db.register({ kind: "phone", identifier: "+228 91 22 33 44", displayName: "Kofi", password: "budget123" }).user;
  assert.strictEqual(db.listAccounts().length, 2);
});
t("le mot de passe n'est pas stocké en clair", () => {
  const raw = fs.readFileSync(file).toString("latin1") + (fs.existsSync(file + "-wal") ? fs.readFileSync(file + "-wal").toString("latin1") : "");
  assert.ok(!raw.includes("azur2026!") && !raw.includes("budget123"));
});
t("connexion correcte et incorrecte", () => {
  assert.strictEqual(db.login({ kind: "email", identifier: "AMA.TEST@gmail.com", password: "azur2026!" }).id, ama.id);
  throwsCode(() => db.login({ kind: "email", identifier: "ama.test@gmail.com", password: "mauvais99" }), "bad_password");
  throwsCode(() => db.login({ kind: "email", identifier: "inconnu@gmail.com", password: "azur2026!" }), "not_found");
  assert.strictEqual(db.login({ id: ama.id, password: "azur2026!" }).id, ama.id);
  throwsCode(() => db.login({ id: "inexistant", password: "azur2026!" }), "not_found");
});
t("bloque après 5 essais ratés", () => {
  for (let i = 0; i < 5; i++) { try { db.login({ kind: "phone", identifier: "91223344", password: "faux1234" }); } catch (e) { /* attendu */ } }
  throwsCode(() => db.login({ kind: "phone", identifier: "91223344", password: "budget123" }), "locked");
});
t("réinitialise avec le code de secours", () => {
  throwsCode(() => db.resetPassword({ kind: "email", identifier: "ama.test@gmail.com", recoveryCode: "AAAA-BBBB-CCCC", newPassword: "nouveau2026" }), "bad_code");
  const r = db.resetPassword({ kind: "email", identifier: "ama.test@gmail.com", recoveryCode: ama.code.toLowerCase().replace(/-/g, " "), newPassword: "nouveau2026" });
  assert.notStrictEqual(r.recoveryCode, ama.code);
  assert.strictEqual(db.login({ kind: "email", identifier: "ama.test@gmail.com", password: "nouveau2026" }).id, ama.id);
});
t("les données de chaque compte sont séparées", () => {
  db.saveConfig(ama.id, { currency: "FCFA", budgets: { alim: 70000 } });
  db.replaceMonth(ama.id, "2026-10", [{ id: "a1", type: "out", amount: 5000, cat: "transport", date: "2026-10-03", note: "Zém" }, { id: "a2", type: "in", amount: 320000, cat: "salaire", date: "2026-10-01" }]);
  db.replaceMonth(kofi.id, "2026-10", [{ id: "k1", type: "out", amount: 1000, cat: "alim", date: "2026-10-04" }]);
  const sa = db.loadState(ama.id), sk = db.loadState(kofi.id);
  assert.strictEqual(sa.tx["2026-10"].length, 2);
  assert.strictEqual(sk.tx["2026-10"].length, 1);
  assert.strictEqual(sk.config, null);
  assert.strictEqual(sa.config.budgets.alim, 70000);
});
t("remplace un mois et supprime un compte avec ses données", () => {
  db.replaceMonth(ama.id, "2026-10", [{ id: "a1", type: "out", amount: 6000, cat: "transport", date: "2026-10-03" }]);
  assert.strictEqual(db.loadState(ama.id).tx["2026-10"][0].amount, 6000);
  throwsCode(() => db.deleteAccount(kofi.id, "mauvais00"), "bad_password");
  db.deleteAccount(ama.id, "nouveau2026");
  assert.deepStrictEqual(db.loadState(ama.id).tx, {});
  assert.strictEqual(db.listAccounts().length, 1);
});
db.close();
console.log(`\n${n} tests réussis`);
