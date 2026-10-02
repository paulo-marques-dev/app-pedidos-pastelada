// Service Worker da Pastelada — permite instalar o app e
// funcionar mesmo com internet instável.
// Ao mudar os arquivos, troque o número da versão abaixo.
const CACHE = "pastelada-v7";

const APP_SHELL = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./supabase-config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {})           // se algum arquivo falhar, instala mesmo assim
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;

  // Só cuidamos de GET do próprio site.
  // Chamadas ao Supabase (outra origem) e websockets passam direto pela rede.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Rede primeiro (pega a versão mais nova quando online),
  // com o cache como reserva quando estiver offline.
  event.respondWith(
    fetch(req)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(cache => cache.put(req, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
  );
});
