// Test de bout en bout de la synchronisation, sur l'émulateur Firebase :
//   npx firebase-tools emulators:exec --only auth,firestore --project demo-azur "node test/sync.e2e.mjs"
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const R = path.resolve("src/renderer");
const CFG = `window.AZUR_FIREBASE={apiKey:"demo-key",authDomain:"demo-azur.firebaseapp.com",projectId:"demo-azur",appId:"1:1:web:1"};window.AZUR_VERSION="test";`;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/firebase-config.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(CFG); }
  const f = path.join(R, u === "/" ? "index.html" : u);
  if (!f.startsWith(R) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  let data = fs.readFileSync(f);
  if (f.endsWith("index.html")) data = data.toString().replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:9099 http://127.0.0.1:8080 ws://127.0.0.1:8080");
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(data);
}).listen(5199);
const URL0 = "http://127.0.0.1:5199/?emulator=127.0.0.1:9099:8080";

const results = [];
let failed = 0;
const check = (name, cond, detail = "") => { results.push(`${cond ? "OK  " : "ÉCHEC"} ${name}${detail ? " — " + detail : ""}`); if (!cond) failed++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { if (await fn()) return true; } catch (e) { /* on réessaie */ } await sleep(300); } return false; }

const browser = await chromium.launch();
const errors = [];
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  p.on("pageerror", e => errors.push(`${name}: ${e.message}`));
  await p.goto(URL0); await p.waitForTimeout(800);
  return { ctx, p };
}
const click = (p, s) => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.offsetParent !== null) || document.querySelector(s); e.click(); }, s);
async function addOp(p, amount, note) {
  await click(p, "[data-act=add]"); await p.waitForTimeout(300);
  await p.fill("#f-amount", String(amount)); await click(p, "[data-sh=cat][data-v=alim]"); await p.fill("#f-note", note);
  await click(p, "[data-act=tx-save]"); await p.waitForTimeout(500);
}
const notes = p => p.evaluate(() => [...document.querySelectorAll(".tx-txt small")].map(x => x.textContent).join(" | "));

try {
  // Appareil A : création du compte
  const A = await device("A");
  await A.p.fill("#x-name", "Ama Mensah"); await A.p.fill("#x-email", "ama@gmail.com");
  await A.p.fill("#x-pw", "Azur2026!"); await A.p.fill("#x-pw2", "Azur2026!");
  await A.p.click("form button[type=submit]");
  check("A crée son compte et entre dans l'app", await until(() => A.p.isVisible(".app")));
  await addOp(A.p, 12500, "Marché de Hédzranawoé");
  check("A voit son opération", (await notes(A.p)).includes("Hédzranawoé"));
  check("A est synchronisé", await until(async () => (await A.p.textContent("#sync")).includes("Synchronisé")), await A.p.textContent("#sync"));

  // Appareil B : même compte, autre appareil
  const B = await device("B");
  await click(B.p, "[data-a=go][data-v=login]"); await B.p.waitForTimeout(200);
  await B.p.fill("#x-email", "ama@gmail.com"); await B.p.fill("#x-pw", "Azur2026!"); await B.p.click("form button[type=submit]");
  check("B se connecte au même compte", await until(() => B.p.isVisible(".app")));
  check("B reçoit l'opération créée sur A", await until(async () => (await notes(B.p)).includes("Hédzranawoé")));

  // B ajoute, A reçoit en direct
  await addOp(B.p, 3000, "Zém vers Bè");
  check("A reçoit en direct l'opération de B", await until(async () => (await notes(A.p)).includes("Zém vers Bè")));

  // Hors ligne sur A
  await A.ctx.setOffline(true); await A.p.evaluate(() => window.dispatchEvent(new Event("offline")));
  await addOp(A.p, 7000, "Achat hors ligne");
  check("A affiche « Hors ligne »", await until(async () => (await A.p.textContent("#sync")).includes("Hors ligne")), await A.p.textContent("#sync"));
  await sleep(2500);
  check("B ne voit pas encore l'achat hors ligne", !(await notes(B.p)).includes("Achat hors ligne"));
  await A.ctx.setOffline(false); await A.p.evaluate(() => window.dispatchEvent(new Event("online")));
  check("Au retour du réseau, B reçoit l'achat hors ligne", await until(async () => (await notes(B.p)).includes("Achat hors ligne"), 30000));

  // Suppression sur B, propagée à A
  const delId = await B.p.evaluate(() => { const r = [...document.querySelectorAll(".tx-row")].find(x => x.textContent.includes("Zém vers Bè")); return r && r.dataset.id; });
  await B.p.evaluate(id => document.querySelector(`.tx-del[data-id="${id}"]`).click(), delId);
  check("La suppression sur B arrive sur A", await until(async () => !(await notes(A.p)).includes("Zém vers Bè")));

  // Réglages synchronisés
  await click(B.p, "[data-nav=budgets]"); await B.p.waitForTimeout(400);
  await B.p.fill("#b-alim", "70 000"); await B.p.press("#b-alim", "Tab");
  await click(A.p, "[data-nav=budgets]");
  check("Le plafond fixé sur B apparaît sur A", await until(async () => (await A.p.inputValue("#b-alim")).replace(/\s/g, "") === "70000"));

  // Connexion hors ligne avec un compte déjà utilisé sur l'appareil
  await click(A.p, ".rail [data-act=logout]"); await A.p.waitForTimeout(400);
  await A.ctx.setOffline(true); await A.p.evaluate(() => window.dispatchEvent(new Event("offline")));
  await A.p.click(".acc"); await A.p.fill("#x-pw", "Azur2026!"); await A.p.click("form button[type=submit]");
  check("A se reconnecte sans Internet", await until(() => A.p.isVisible(".app")));
  check("Les données restent disponibles hors ligne", await until(async () => (await notes(A.p)).includes("Achat hors ligne")));
  await click(A.p, ".rail [data-act=logout]"); await A.p.waitForTimeout(300);
  await A.p.click(".acc"); await A.p.fill("#x-pw", "mauvais999"); await A.p.click("form button[type=submit]"); await A.p.waitForTimeout(800);
  check("Un mauvais mot de passe est refusé hors ligne", !(await A.p.isVisible(".app")), await A.p.textContent("#x-err"));
  await A.ctx.setOffline(false);

  // Isolement : un autre compte ne voit rien et ne peut pas lire les données d'Ama
  const uidA = await B.p.evaluate(() => window.__azurTest.uid());
  const C = await device("C");
  await C.p.fill("#x-name", "Kofi Agbeko"); await C.p.click("[data-a=kind][data-k=phone]"); await C.p.fill("#x-phone", "91 22 33 44");
  await C.p.fill("#x-pw", "Budget123"); await C.p.fill("#x-pw2", "Budget123"); await C.p.click("form button[type=submit]");
  check("Un compte téléphone se crée", await until(() => C.p.isVisible(".app")));
  await C.p.waitForTimeout(1500);
  check("Le nouveau compte ne voit aucune opération d'Ama", (await C.p.evaluate(() => window.__azurTest.count())) === 0);
  const denied = await C.p.evaluate(uid => window.__azurTest.readOther(uid), uidA);
  check("Les règles interdisent de lire les données d'un autre compte", denied !== "allowed", denied);
} catch (e) {
  check("Le scénario s'est déroulé sans erreur", false, e.message.split("\n")[0]);
}
if (errors.length) check("Aucune erreur dans les pages", false, errors.slice(0, 3).join(" ; "));
await browser.close(); server.close();
console.log(results.join("\n"));
fs.writeFileSync("sync-results.txt", results.join("\n"));
process.exit(failed ? 1 : 0);
