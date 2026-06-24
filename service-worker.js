// Cache-first App-Shell-Caching für Offline-Betrieb auf iOS Safari. CACHE_NAME muss
// bei jedem inhaltlichen Update der App-Dateien hochgezählt werden, damit Safari den
// neuen Service Worker aktiviert und alte Assets ersetzt.
const CACHE_NAME = "gutpump-v3";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/app.js",
  "./js/db.js",
  "./js/seed-data.js",
  "./js/groups.js",
  "./js/utils.js",
  "./js/chart.js",
  "./js/render-list.js",
  "./js/render-table.js",
  "./js/render-dialogs.js",
  "./js/render-stats.js",
  "./js/xlsx-export.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
