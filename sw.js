// S-Gyver Mobile Service Worker for PWA Installation & Offline Support
const CACHE_NAME = 'sgyver-mobile-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Network-first fetch strategy with fallback
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
