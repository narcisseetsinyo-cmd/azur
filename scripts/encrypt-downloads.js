"use strict";
// Chiffre les installateurs pour la page de téléchargement protégée par mot de passe.
//   DOWNLOAD_PASSWORD=… node scripts/encrypt-downloads.js <dossier-des-installateurs> <dossier-de-sortie>
// Chaque installateur est découpé en morceaux de 32 Mo, chiffrés en AES-256-GCM avec une clé dérivée
// du mot de passe (PBKDF2-SHA256, 600 000 itérations). Sans le mot de passe, les fichiers publiés sont illisibles.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const [src, out] = process.argv.slice(2);
const pw = process.env.DOWNLOAD_PASSWORD || "";
if (!src || !out) { console.error("Usage : node scripts/encrypt-downloads.js <installateurs> <sortie>"); process.exit(2); }
if (pw.length < 8) { console.error("::error title=Téléchargements::Le secret DOWNLOAD_PASSWORD est absent ou trop court (8 caractères minimum)."); process.exit(1); }

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const CHUNK = 32 * 1024 * 1024, ITER = 600000;
const salt = crypto.randomBytes(16);
const key = crypto.pbkdf2Sync(Buffer.from(pw, "utf8"), salt, ITER, 32, "sha256");
const seal = (buf, aad) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad, "utf8"));
  return Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]);
};

const KINDS = [
  { re: /Setup-.*\.exe$/i, id: "win", label: "Windows 10 et 11", note: "Ordinateurs Windows 64 bits" },
  { re: /-arm64\.dmg$/i, id: "mac-arm64", label: "Mac Apple (M1, M2, M3, M4…)", note: "Puce Apple" },
  { re: /-x64\.dmg$/i, id: "mac-x64", label: "Mac Intel", note: "Processeur Intel" }
];
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const files = [];
for (const name of fs.readdirSync(src).sort()) {
  const kind = KINDS.find(k => k.re.test(name));
  if (!kind) continue;
  const data = fs.readFileSync(path.join(src, name));
  const parts = [];
  for (let i = 0, off = 0; off < data.length; i++, off += CHUNK) {
    const file = `${kind.id}-${String(i).padStart(2, "0")}.bin`;
    const sealed = seal(data.subarray(off, off + CHUNK), `${name}#${i}`);
    fs.writeFileSync(path.join(out, file), sealed);
    parts.push({ file, size: sealed.length });
  }
  files.push({ id: kind.id, name, label: kind.label, note: kind.note, size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex"), parts });
  console.log(`${name} : ${(data.length / 1048576).toFixed(1)} Mo en ${parts.length} morceaux`);
}
if (!files.length) { console.error("::error title=Téléchargements::Aucun installateur trouvé."); process.exit(1); }
const manifest = {
  version: pkg.version, date: new Date().toISOString(),
  kdf: { name: "PBKDF2", hash: "SHA-256", iterations: ITER, salt: salt.toString("base64") },
  check: seal(Buffer.from("azur-ok"), "check").toString("base64"),
  files
};
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`Manifeste écrit : version ${manifest.version}, ${files.length} installateurs.`);
