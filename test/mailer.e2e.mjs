// Test des e-mails automatiques sur l'émulateur Firebase (sans envoi réel : MAIL_DRY=1).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
const require = createRequire(import.meta.url);
const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || "demo-azur";
initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore(), auth = getAuth();
const results = []; let failed = 0;
const check = (n, c, d = "") => { results.push(`${c ? "OK  " : "ÉCHEC"} ${n}${d ? " — " + d : ""}`); if (!c) failed++; };
const mkUser = async (uid, email, name) => { try { await auth.deleteUser(uid); } catch (e) {} await auth.createUser({ uid, email, password: "Azur2026!", displayName: name }); };
const pad = n => String(n).padStart(2, "0");

const now = new Date(); const NOW = new Date(now.getFullYear(), now.getMonth(), 2, 9, 0, 0);
const prev = new Date(NOW.getFullYear(), NOW.getMonth() - 1, 10);
const pm = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;

await mkUser("mk-req", "kofi.request@gmail.com", "Kofi Demandeur");
await db.doc("accessRequests/mk-req").set({ name: "Kofi Demandeur", ident: "kofi.request@gmail.com", kind: "email", at: FieldValue.serverTimestamp() });
await db.doc("invites/MKTEST23").set({ for: "mk-req", name: "Kofi Demandeur", used: false, expires: Timestamp.fromMillis(Date.now() + 7 * 864e5) });
await mkUser("mk-tel", "t22890112233@telephone.azur.app", "Afi Téléphone");
await db.doc("invites/MKTEL234").set({ for: "mk-tel", name: "Afi Téléphone", used: false, expires: Timestamp.fromMillis(Date.now() + 7 * 864e5) });
await mkUser("mk-bil", "yao.bilan@gmail.com", "Yao Bilan");
await db.doc("grants/mk-bil").set({ code: "X", name: "Yao Bilan" });
await db.doc("users/mk-bil/meta/config").set({ c: { startDay: 1, currency: "FCFA", budgets: { alim: 50000 } } });
const tx = [["in", "salaire", "Salaire", 300000], ["gift", "dime", "Dîme", 30000], ["save", "tontine", "Tontine", 20000], ["out", "loyer", "Loyer", 70000], ["out", "alim", "Alimentation", 65000]];
for (const [i, [type, cat, catLabel, amount]] of tx.entries()) await db.doc(`users/mk-bil/tx/t${i}`).set({ d: { id: "t" + i, type, cat, catLabel, amount, date: `${pm}-${pad(5 + i)}` }, m: pm });
await mkUser("mk-off", "esi.off@gmail.com", "Esi Sans Bilan");
await db.doc("grants/mk-off").set({ code: "Y" });
await db.doc("users/mk-off/meta/config").set({ c: { mailBilan: false } });
await db.doc(`users/mk-off/tx/a`).set({ d: { id: "a", type: "in", cat: "salaire", amount: 1000, date: `${pm}-05` }, m: pm });

const run = () => { execFileSync("node", ["scripts/mailer.mjs"], { env: { ...process.env, MAIL_DRY: "1", MAIL_OUT: "mail-out.json", MAIL_NOW: NOW.toISOString() }, stdio: "inherit" }); return JSON.parse(fs.readFileSync("mail-out.json", "utf8")); };
try {
  const a = run();
  const by = tag => a.filter(m => m.tag === tag);
  check("L'administratrice est prévenue d'une demande", by("demande-acces").some(m => m.to.email === "narcisseetsinyo@gmail.com" && m.subject.includes("Kofi Demandeur")));
  check("Le code part par e-mail à la bonne personne", by("code-acces").some(m => m.to.email === "kofi.request@gmail.com" && m.html.includes("MKTE-ST23")));
  check("Pas d'e-mail de code pour un compte téléphone", !a.some(m => m.to.email.includes("telephone.azur.app")));
  const bil = by("bilan-mensuel").find(m => m.to.email === "yao.bilan@gmail.com");
  check("Le bilan du mois est envoyé", !!bil && bil.html.includes("300 000 FCFA") && bil.html.includes("Les voyants"), bil ? bil.subject : "absent");
  check("Le plafond dépassé apparaît dans le bilan", !!bil && bil.html.includes("plafond dépassé"));
  check("Pas de bilan si la personne l'a désactivé", !by("bilan-mensuel").some(m => m.to.email === "esi.off@gmail.com"));
  check("La demande est marquée comme signalée", !!(await db.doc("accessRequests/mk-req").get()).data().notifiedAt);
  const b = run();
  check("Rien n'est renvoyé au passage suivant", !b.some(m => ["kofi.request@gmail.com", "yao.bilan@gmail.com"].includes(m.to.email) || m.subject.includes("Kofi Demandeur")), b.map(m => m.tag + ":" + m.to.email).join(", "));
} catch (e) { check("Le script d'e-mails s'est déroulé sans erreur", false, e.message.split("\n")[0]); }
console.log(results.join("\n"));
fs.appendFileSync("sync-results.txt", "\n" + results.map(r => r.replace(/^(OK  |ÉCHEC)/, "$1 [e-mails]")).join("\n"));
process.exit(failed ? 1 : 0);
