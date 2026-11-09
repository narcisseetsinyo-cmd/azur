/* Azur — mise en cache de la version web, pour l'ouvrir même sans Internet.
   La version est réécrite à chaque publication : un nouveau fichier = une nouvelle mise en cache. */
const VERSION = "1.3.0";
const CACHE = "azur-ui-" + VERSION;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const manifest = await (await fetch("ui-manifest.json", { cache: "no-store" })).json();
    const files = manifest.files.map(f => f.path).filter(p => p !== "sw.js");
    await cache.addAll(["./", ...files]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith("azur-ui-") && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);
  // Seulement les fichiers de l'application : Firebase et le manifeste passent toujours par le réseau
  if (req.method !== "GET" || url.origin !== self.location.origin || url.pathname.endsWith("ui-manifest.json")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === "navigate") { const page = await cache.match("./"); if (page) return page; }
      throw err;
    }
  })());
});
