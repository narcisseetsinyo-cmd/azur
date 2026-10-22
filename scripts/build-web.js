"use strict";
// Prépare la version web (GitHub Pages) dans web-dist/ à partir de l'interface du logiciel.
const fs = require("fs");
const path = require("path");
const src = path.join(__dirname, "..", "src", "renderer");
const out = path.join(__dirname, "..", "web-dist");
fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(src, out, { recursive: true, filter: f => !f.endsWith("cloud.src.js") });
fs.writeFileSync(path.join(out, ".nojekyll"), "");
const cfg = fs.readFileSync(path.join(out, "firebase-config.js"), "utf8");
if (/AZUR_FIREBASE\s*=\s*null/.test(cfg)) console.warn("Attention : firebase-config.js ne contient pas encore la configuration Firebase.");
console.log("Version web prête dans web-dist/");
