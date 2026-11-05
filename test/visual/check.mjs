// Vérification visuelle de l'interface sur de nombreuses tailles d'écran (sans Firebase).
//   node test/visual/check.mjs <dossier-de-sortie> [playwright-module]
// Produit une capture par écran et par taille, et liste les éléments qui dépassent de l'écran.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.argv[2] || "visual-out");
const PW = process.argv[3] || "playwright";
const { chromium } = await import(PW);
const R = path.resolve("src/renderer");
const MOCK = fs.readFileSync(path.resolve("test/visual/mock-cloud.js"));
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2", ".webmanifest": "application/manifest+json", ".json": "application/json" };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  if (u === "/cloud.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(MOCK); }
  const f = path.join(R, u === "/" ? "index.html" : u);
  if (!f.startsWith(R) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(fs.readFileSync(f));
}).listen(5310);

const SIZES = [
  ["telephone-320", 320, 640, true], ["telephone-360", 360, 760, true], ["telephone-390", 390, 844, true], ["telephone-430", 430, 932, true],
  ["paysage-740", 740, 360, true], ["tablette-768", 768, 1024, true], ["tablette-1024", 1024, 768, true],
  ["ordinateur-1280", 1280, 800, false], ["ordinateur-1440", 1440, 900, false], ["ordinateur-1920", 1920, 1080, false], ["ecran-2560", 2560, 1440, false]
];
const only = process.env.SIZES ? process.env.SIZES.split(",") : null;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const report = [];

async function overflow(p, label) {
  const r = await p.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = [];
    const sw = document.documentElement.scrollWidth;
    document.querySelectorAll("body *").forEach(el => {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || el.closest(".chart") || el.closest("[hidden]")) return;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return;
      if (b.right > vw + 1 || b.left < -1) {
        let anc = el.parentElement, clipped = false;
        while (anc && anc !== document.body) { const s = getComputedStyle(anc); if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { const ab = anc.getBoundingClientRect(); if (ab.right <= vw + 1 && ab.left >= -1) { clipped = true; break; } } anc = anc.parentElement; }
        if (!clipped) out.push((el.id ? "#" + el.id : el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 2).join(".")) + ` (${Math.round(b.left)}→${Math.round(b.right)})`);
      }
    });
    // Textes coupés sans points de suspension ni défilement
    const clipped = [];
    document.querySelectorAll("button, .btn, .chip, strong, h1, h2, h3, .mini-val, .kpi strong, .flow strong").forEach(el => {
      if (el.closest("[hidden]") || !el.offsetParent) return;
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== "ellipsis" && cs.overflowX !== "visible") clipped.push(el.tagName.toLowerCase() + "." + [...el.classList].slice(0, 2).join(".") + " «" + el.textContent.trim().slice(0, 24) + "»");
    });
    return { sw, vw, out: [...new Set(out)].slice(0, 8), clipped: [...new Set(clipped)].slice(0, 6) };
  });
  if (r.sw > r.vw + 1 || r.out.length || r.clipped.length) report.push(`${label} : largeur ${r.sw}/${r.vw}${r.out.length ? " | dépassent : " + r.out.join(", ") : ""}${r.clipped.length ? " | coupés : " + r.clipped.join(", ") : ""}`);
}

for (const [name, w, h, mobile] of SIZES) {
  if (only && !only.includes(name)) continue;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "reduce", hasTouch: mobile, isMobile: mobile && w < 800 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", e => errs.push(e.message));
  const shot = async (n, full) => { await p.waitForTimeout(250); const t = await p.$(".toast"); if (t) await t.evaluate(e => e.remove()); await overflow(p, `${name} ${n}`); await p.screenshot({ path: path.join(OUT, `${name}__${n}.png`), fullPage: !!full }); };
  const click = s => p.evaluate(s => { const e = [...document.querySelectorAll(s)].find(x => x.offsetParent !== null) || document.querySelector(s); e && e.click(); }, s);
  await p.goto("http://127.0.0.1:5310/"); await p.waitForTimeout(500);
  await p.fill("#x-name", "Ama Mensah"); await p.fill("#x-email", "ama.mensah@gmail.com"); await p.fill("#x-pw", "Azur2026!"); await p.fill("#x-pw2", "Azur2026!");
  await shot("01-inscription", true);
  await p.click("form button[type=submit]"); await p.waitForTimeout(500);
  await click('[data-act="demo-load"]'); await p.waitForTimeout(500);
  await shot("02-accueil", true);
  await click("[data-act=add]"); await p.waitForTimeout(300); await p.fill("#f-amount", "12500"); await click("[data-sh=cat][data-v=alim]");
  await shot("03-ajout"); await click("[data-act=close]"); await p.waitForTimeout(300);
  await click("[data-act=add]"); await p.waitForTimeout(200); await click("[data-sh=type][data-v=in]"); await p.fill("#f-amount", "150000"); await click("[data-sh=cat][data-v=presta]"); await click("[data-act=tx-save]"); await p.waitForTimeout(900);
  await shot("04-repartition"); await click("[data-act=split-confirm]"); await p.waitForTimeout(300);
  for (const [v, n] of [["ops", "05-operations"], ["budgets", "06-budgets"], ["goals", "07-objectifs"], ["stats", "08-stats"], ["settings", "10-parametres"]]) { await click(`[data-nav=${v}]`); await p.waitForTimeout(350); await shot(n, true); }
  await click("[data-nav=stats]"); await p.waitForTimeout(200); await click(".page-h [data-nav=review]"); await p.waitForTimeout(350); await shot("09-bilan", true);
  await click("[data-act=logout]"); await p.waitForTimeout(400); await shot("11-connexion");
  if (errs.length) report.push(`${name} erreurs : ${errs.slice(0, 3).join(" ; ")}`);
  await ctx.close();
}
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, "rapport.txt"), report.join("\n") || "Aucun débordement détecté.");
console.log(report.join("\n") || "Aucun débordement détecté.");
