"use strict";
/*
 * Banc d'essai sans Electron : sert l'interface et branche window.azur sur la vraie base (src/db.js)
 * via HTTP local. Sert uniquement aux tests automatiques : node test/harness.js <port> <fichier.sqlite>
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const store = require("../src/db");

const port = +process.argv[2] || 5177;
const db = store.open(process.argv[3] || path.join(require("os").tmpdir(), "azur-harness.sqlite"));
const R = path.join(__dirname, "..", "src", "renderer");
let session = null;
const handlers = {
  "auth:list": () => db.listAccounts(),
  "auth:session": () => (session ? db.listAccounts().find(a => a.id === session.userId) || null : null),
  "auth:register": p => { const r = db.register(p || {}); session = { userId: r.user.id }; return r; },
  "auth:login": p => { const u = db.login(p || {}); session = { userId: u.id }; return u; },
  "auth:reset": p => { const r = db.resetPassword(p || {}); session = { userId: r.user.id }; return r; },
  "auth:logout": () => { session = null; return true; },
  "account:changePassword": (a, b) => db.changePassword(session.userId, a, b),
  "account:newRecoveryCode": pw => db.newRecoveryCode(session.userId, pw),
  "account:rename": n => db.rename(session.userId, n),
  "account:delete": pw => { db.deleteAccount(session.userId, pw); session = null; return true; },
  "data:load": () => db.loadState(session.userId),
  "data:saveConfig": c => db.saveConfig(session.userId, c),
  "data:replaceMonth": (m, items) => db.replaceMonth(session.userId, m, items),
  "data:replaceAll": s => db.replaceAll(session.userId, s),
  "file:save": () => ({ saved: true, path: "/tmp/test" }),
  "app:info": () => ({ version: "1.0.0-test" }),
  "app:showDb": () => true
};
const AUTH_FREE = new Set(["auth:list", "auth:session", "auth:register", "auth:login", "auth:reset", "auth:logout", "app:info"]);
const BRIDGE = `window.azur=(()=>{const c=(ch,...a)=>fetch("/ipc/"+ch,{method:"POST",body:JSON.stringify(a)}).then(r=>r.json());
return{auth:{list:()=>c("auth:list"),session:()=>c("auth:session"),register:p=>c("auth:register",p),login:p=>c("auth:login",p),reset:p=>c("auth:reset",p),logout:()=>c("auth:logout"),onLocked:()=>{}},
account:{changePassword:(a,b)=>c("account:changePassword",a,b),newRecoveryCode:p=>c("account:newRecoveryCode",p),rename:n=>c("account:rename",n),remove:p=>c("account:delete",p)},
data:{load:()=>c("data:load"),saveConfig:x=>c("data:saveConfig",x),replaceMonth:(m,i)=>c("data:replaceMonth",m,i),replaceAll:s=>c("data:replaceAll",s)},
file:{save:(n,t)=>c("file:save",n,t)},app:{info:()=>c("app:info"),showDb:()=>c("app:showDb")}}})();`;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".woff2": "font/woff2" };

http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/ipc/")) {
    let body = "";
    req.on("data", d => (body += d));
    req.on("end", () => {
      const ch = req.url.slice(5);
      let out;
      try {
        if (!handlers[ch]) throw Object.assign(new Error("Canal inconnu"), { code: "unknown" });
        if (!AUTH_FREE.has(ch) && !session) out = { ok: false, error: { code: "unauthenticated", message: "Connecte-toi d'abord." } };
        else out = { ok: true, data: handlers[ch](...JSON.parse(body || "[]")) };
      } catch (e) { out = { ok: false, error: { code: e.code || "error", message: e.message, retryIn: e.retryIn || 0 } }; }
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(out));
    });
    return;
  }
  if (req.url === "/bridge.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(BRIDGE); }
  const f = path.join(R, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!f.startsWith(R) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  let data = fs.readFileSync(f);
  if (f.endsWith("index.html")) data = data.toString().replace("connect-src 'none'", "connect-src 'self'").replace('<script src="app.js">', '<script src="bridge.js"></script><script src="app.js">');
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(data);
}).listen(port, () => console.log("harness on " + port));
