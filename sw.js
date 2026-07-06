// Bump this on every release. Old caches are deleted on activate.
const SW_VERSION = 'just-ate-v8';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './parser.js',
  './foods.js',
  './config.js',
  './sync.js',
  './manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SW_VERSION).then((c) => c.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SW_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for same-origin GETs, falling back to cache when offline.
// Cross-origin requests (Open Food Facts, Google Fonts) pass through untouched.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {                      // never let a transient 404/500 overwrite a good copy
          const copy = res.clone();
          caches.open(SW_VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match('./index.html')))
  );
});
