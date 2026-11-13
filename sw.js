// يخلي الموقع يخدم بلا إنترنت (وضع الهاتف الواحد)
const CACHE = "mohtal-v9";
const FILES = ["./", "./index.html", "./style.css", "./app.js", "./words.js", "./words2.js", "./words3.js", "./defs1.js", "./defs2.js", "./defs3.js", "./defs4.js", "./defs5.js", "./defs6.js", "./defs7.js", "./defs8.js", "./photos.js", "./uno.css", "./uno-engine.js", "./uno-ui.js", "./sj-data.js", "./sj.js", "./join.html","./qrcode.js", "./capacitor.js", "./config.js", "./icon.svg", "./icon-512.png", "./manifest.json", "./cairo-arabic.woff2", "./cairo-latin.woff2"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); });
self.addEventListener("activate", e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
// الشبكة أولاً (باش التحديثات توصل)، والكاش كي ما كانش نت
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
