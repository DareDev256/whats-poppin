// Service Worker for offline play
const CACHE_NAME = 'whatspoppin-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/game.js',
  '/src/audio.js',
  '/src/icons.js',
  '/src/powerups.js',
  '/src/characters.js',
  '/node_modules/phaser/dist/phaser.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
