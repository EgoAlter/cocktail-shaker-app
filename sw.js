// Service worker — cache-first for all static assets, network-only for /api/*.
// Versioning: bump CACHE_NAME to invalidate old cache on deploy.
// Icons are excluded until generated — a 404 during install fails the whole SW install.

const CACHE_NAME = 'cocktail-shaker-v8';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/game/engine.js',
  '/game/sensors.js',
  '/game/renderer.js',
  '/game/score.js',
  '/bartender/questionnaire.js',
  '/bartender/selector.js',
  '/bartender/questions.js',
  '/shaker/shaker.js',
  '/shaker/animation.js',
  '/shaker/export.js',
  '/ui/screens.js',
  '/ui/hud.js',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Network-only for API routes.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for everything else.
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
