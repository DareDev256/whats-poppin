// Service Worker for offline play
const CACHE_NAME = 'whatspoppin-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/src/init.js',
  '/src/game.js',
  '/src/audio.js',
  '/src/icons.js',
  '/src/powerups.js',
  '/src/characters.js',
  'https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Only cache same-origin or approved CDN responses
        if (response && response.status === 200) {
          const url = new URL(event.request.url);
          if (url.origin === self.location.origin || url.hostname === 'cdn.jsdelivr.net') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        }
        return response;
      }).catch(() => {
        // Network failure with no cache — return a minimal offline response
        if (event.request.destination === 'document') {
          return new Response('<h1>Offline</h1><p>Reload when connected.</p>', {
            headers: { 'Content-Type': 'text/html' },
          });
        }
        return new Response('', { status: 503 });
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
