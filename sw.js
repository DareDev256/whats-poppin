// Service Worker for offline play
const CACHE_NAME = 'whatspoppin-v4';

// Canonical CSP — applied to all synthesized responses
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

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
        // Network failure with no cache — return a CSP-protected offline response
        if (event.request.destination === 'document') {
          return new Response(
            '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
            '<meta name="viewport" content="width=device-width,initial-scale=1">' +
            '<title>Offline — What\'s Poppin</title>' +
            '<style>body{background:#0a0a0f;color:#e0e0e0;font-family:system-ui,sans-serif;' +
            'display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;' +
            'text-align:center}h1{font-size:1.5rem;margin-bottom:.5rem}p{opacity:.6;font-size:.9rem}</style>' +
            '</head><body><div><h1>You\'re Offline</h1>' +
            '<p>Reconnect and reload to keep poppin\'.</p></div></body></html>',
            {
              headers: {
                'Content-Type': 'text/html; charset=UTF-8',
                'Content-Security-Policy': CSP_POLICY,
                'X-Content-Type-Options': 'nosniff',
              },
            }
          );
        }
        return new Response('', { status: 503, headers: { 'X-Content-Type-Options': 'nosniff' } });
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
