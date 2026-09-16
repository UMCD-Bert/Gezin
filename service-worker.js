// Simpele, read-only offline-fallback voor de app-shell (HTML/manifest/icons/
// supabase-js library). Live data (Supabase-aanroepen) lopen hier NIET doorheen —
// die worden al apart offline-vriendelijk afgehandeld in index.html.
const CACHE_VERSION = 'gezin-shell-v3';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './apple-touch-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/ical.js@1.5.0/build/ical.min.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isAppShellRequest(request) {
  const url = new URL(request.url);
  if (url.origin === self.location.origin) return true;
  return APP_SHELL.includes(request.url);
}

// Afspraak-herinneringen komen binnen als een pushmelding vanaf de
// stuur-herinneringen Edge Function — puur tonen, geen eigen logica hier
// over wanneer/aan wie (dat is al bepaald vóórdat de melding hier aankomt).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (fout) { data = {}; }
  const titel = data.titel || 'Oranjetipje';
  event.waitUntil(
    self.registration.showNotification(titel, {
      body: data.body || '',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !isAppShellRequest(request)) return;

  event.respondWith(
    // cache: 'no-store' dwingt een écht netwerkverzoek af — zonder deze optie
    // kan de browser's eigen HTTP-cache (GitHub Pages stuurt Cache-Control:
    // max-age=600 mee) deze fetch tot 10 minuten lang beantwoorden zonder de
    // server te raken, waardoor updates niet doorkomen ondanks "netwerk
    // eerst"-logica hieronder.
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
