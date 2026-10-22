"use strict";
// Prépare la version web (GitHub Pages) dans web-dist/ et le manifeste des mises à jour de l'interface.
//  - package.json « azurUi » : version de l'interface (à augmenter pour chaque mise à jour de l'interface)
//  - package.json « azurMinShell » : version minimale du logiciel capable d'utiliser cette interface
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const src = path.join(root, "src", "renderer");
const out = path.join(root, "web-dist");
const uiVersion = pkg.azurUi || pkg.version;

// Version affichée dans l'interface
const cfgPath = path.join(src, "firebase-config.js");
let cfg = fs.readFileSync(cfgPath, "utf8").replace(/window\.AZUR_VERSION\s*=\s*"[^"]*";/, `window.AZUR_VERSION = "${uiVersion}";`);
fs.writeFileSync(cfgPath, cfg);
if (/AZUR_FIREBASE\s*=\s*null/.test(cfg)) console.warn("Attention : firebase-config.js ne contient pas encore la configuration Firebase.");

// Manifeste : chaque fichier avec son empreinte SHA-256
const files = [];
(function walk(dir) {
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    const rel = path.relative(src, full).split(path.sep).join("/");
    if (fs.statSync(full).isDirectory()) { walk(full); continue; }
    if (rel === "ui-manifest.json" || rel.endsWith("cloud.src.js")) continue;
    files.push({ path: rel, sha256: crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex") });
  }
})(src);
const manifest = { version: uiVersion, minShell: pkg.azurMinShell || pkg.version, date: new Date().toISOString(), files };
fs.writeFileSync(path.join(src, "ui-manifest.json"), JSON.stringify(manifest, null, 1));

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true, filter: f => !f.endsWith("cloud.src.js") });
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`Interface ${uiVersion} prête dans web-dist/ (${files.length} fichiers, logiciel ${manifest.minShell} minimum)`);
