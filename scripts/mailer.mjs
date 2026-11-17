// Azur — e-mails automatiques envoyés avec Brevo.
// Lancé toutes les 10 minutes par GitHub Actions (.github/workflows/mail.yml).
//   1. Nouvelle demande d'accès  → e-mail à l'administratrice
//   2. Code d'accès créé         → e-mail à la personne (comptes Gmail)
//   3. Début de mois             → bilan du mois écoulé à chaque compte autorisé (désactivable)
//
// Secrets : FIREBASE_SA (clé JSON du compte de service), BREVO_API_KEY, BREVO_SENDER (adresse validée dans Brevo).
// Essai sans envoi : MAIL_DRY=1 (les e-mails sont écrits dans MAIL_OUT, un fichier JSON).
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const C = require("../src/renderer/calc.js");
const T = await import("./mail-templates.mjs");

const ADMIN_EMAIL = "narcisseetsinyo@gmail.com";
const APP_URL = "https://narcisseetsinyo-cmd.github.io/azur/";
const DRY = process.env.MAIL_DRY === "1";
const NOW = process.env.MAIL_NOW ? new Date(process.env.MAIL_NOW) : new Date();
const sent = [];

if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-azur" });
else {
  if (!process.env.FIREBASE_SA) { console.log("::warning title=E-mails::Secret FIREBASE_SA absent : rien n'est envoyé."); process.exit(0); }
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SA)) });
}
if (!DRY && !process.env.BREVO_API_KEY) { console.log("::warning title=E-mails::Secret BREVO_API_KEY absent : rien n'est envoyé."); process.exit(0); }
const db = getFirestore(), auth = getAuth();
const sender = { email: process.env.BREVO_SENDER || ADMIN_EMAIL, name: process.env.BREVO_SENDER_NAME || "Azur" };

const realEmail = e => (e && !/@telephone\.azur\.app$/i.test(e) ? e : null);
async function userOf(uid) { try { return await auth.getUser(uid); } catch (e) { return null; } }

async function send(to, subject, html, tag) {
  if (DRY) { sent.push({ to, subject, tag, html }); return true; }
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender, to: [to], subject, htmlContent: html, tags: [tag] })
  });
  if (!r.ok) { console.log(`::warning title=Brevo::${tag} → ${to.email} : ${r.status} ${(await r.text()).slice(0, 200)}`); return false; }
  console.log(`Envoyé : ${tag} → ${to.email}`);
  return true;
}

// 1. Demandes d'accès à signaler
async function requests() {
  const snap = await db.collection("accessRequests").get();
  for (const d of snap.docs) {
    const r = d.data();
    if (r.notifiedAt) continue;
    const ok = await send({ email: ADMIN_EMAIL, name: "Administratrice Azur" }, `Nouvelle demande d'accès : ${r.name || "sans nom"}`, T.requestMail({ name: r.name, ident: r.ident, kind: r.kind, url: APP_URL }), "demande-acces");
    if (ok) await d.ref.update({ notifiedAt: FieldValue.serverTimestamp() });
  }
}

// 2. Codes d'accès à envoyer par e-mail
async function invites() {
  const snap = await db.collection("invites").where("used", "==", false).get();
  for (const d of snap.docs) {
    const v = d.data();
    if (v.mailedAt || (v.expires && v.expires.toMillis() < NOW.getTime())) continue;
    const u = await userOf(v.for);
    const email = realEmail(u && u.email);
    if (!email) { await d.ref.update({ mailedAt: "sans-email" }); continue; }
    const ok = await send({ email, name: v.name || (u && u.displayName) || "" }, "Ton code d'accès à Azur", T.codeMail({ name: v.name || (u && u.displayName), code: d.id, expires: v.expires ? v.expires.toDate() : null, url: APP_URL }), "code-acces");
    if (ok) await d.ref.update({ mailedAt: FieldValue.serverTimestamp() });
  }
}

// 3. Bilan du mois, du 1er au 3e jour suivant la fin de la période budgétaire
function fromIdMap(o) { return o && typeof o === "object" && !Array.isArray(o) ? Object.entries(o).map(([id, v]) => ({ id, ...v })).sort((a, b) => (a._o || 0) - (b._o || 0)) : o || []; }
async function bilans() {
  const uids = new Set((await db.collection("grants").get()).docs.map(d => d.id));
  try { uids.add((await auth.getUserByEmail(ADMIN_EMAIL)).uid); } catch (e) { /* pas encore de compte admin */ }
  for (const uid of uids) {
    const u = await userOf(uid);
    const email = realEmail(u && u.email);
    if (!email) continue;
    const cfgDoc = await db.doc(`users/${uid}/meta/config`).get();
    const cfg = cfgDoc.exists ? (cfgDoc.data().c || cfgDoc.data().d || {}) : {};
    if (cfg.mailBilan === false) continue;
    const startDay = +cfg.startDay || 1;
    const p = C.period(-1, startDay, NOW);
    const daysSince = Math.floor((NOW - new Date(p.endD.getFullYear(), p.endD.getMonth(), p.endD.getDate() + 1)) / 864e5);
    if (daysSince < 0 || daysSince > 2) continue;
    const markRef = db.doc(`users/${uid}/meta/mail`);
    const mark = await markRef.get();
    if (mark.exists && mark.data().lastBilan === p.start) continue;
    const months = [...new Set([p.start.slice(0, 7), p.end.slice(0, 7), (() => { const x = C.period(-2, startDay, NOW); return x.start.slice(0, 7); })()])];
    const txs = [];
    for (const m of months) (await db.collection(`users/${uid}/tx`).where("m", "==", m).get()).docs.forEach(d => txs.push(d.data().d));
    const pp = C.period(-2, startDay, NOW);
    const all = txs.filter(t => t && t.date), L = C.inRange(all, p), P = C.inRange(all, pp);
    if (!L.length) { await markRef.set({ lastBilan: p.start }, { merge: true }); continue; }
    const html = T.buildBilan({ name: (u.displayName || "").split(" ")[0], p, L, P, cfg: { ...cfg, debts: fromIdMap(cfg.debts) }, url: APP_URL });
    const ok = await send({ email, name: u.displayName || "" }, `Ton bilan de ${T.monthLabel(p)}`, html, "bilan-mensuel");
    if (ok) await markRef.set({ lastBilan: p.start, at: FieldValue.serverTimestamp() }, { merge: true });
  }
}

let failed = false;
for (const [name, fn] of [["demandes", requests], ["codes", invites], ["bilans", bilans]]) {
  try { await fn(); } catch (e) { failed = true; console.log(`::error title=E-mails (${name})::${e.message}`); }
}
if (DRY && process.env.MAIL_OUT) fs.writeFileSync(process.env.MAIL_OUT, JSON.stringify(sent, null, 1));
console.log(`${DRY ? "Essai" : "Envoi"} terminé : ${sent.length || "voir ci-dessus"} e-mail(s).`);
process.exit(failed ? 1 : 0);
