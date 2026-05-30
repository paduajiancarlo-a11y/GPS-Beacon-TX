/* ============================================================
   GPS BEACON — Service Worker v4.0
   Handles: background sync, offline cache, push keep-alive
   ============================================================ */

const CACHE = 'beacon-v4';
const ASSETS = ['./index.html', './manifest.json'];

/* ── Install: cache shell ── */
self.addEventListener('install', e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
    );
});

/* ── Activate: purge old caches ── */
self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

/* ── Fetch: network-first, fallback to cache ── */
self.addEventListener('fetch', e => {
    // Pass through Firebase / Supabase / external requests untouched
    const url = e.request.url;
    if (url.includes('firebase') || url.includes('supabase') ||
        url.includes('nominatim') || url.includes('ipify') ||
        url.includes('my-ip.io') || url.startsWith('chrome-extension')) {
        return;
    }
    e.respondWith(
        fetch(e.request).catch(() => caches.match(e.request))
    );
});

/* ── Background Sync ── */
self.addEventListener('sync', e => {
    if (e.tag === 'beacon-sync') {
        e.waitUntil(notifyClients('SYNC_TRIGGERED'));
    }
});

/* ── Periodic Background Sync (Chrome Android) ── */
self.addEventListener('periodicsync', e => {
    if (e.tag === 'beacon-periodic') {
        e.waitUntil(notifyClients('PERIODIC_SYNC'));
    }
});

/* ── Push notifications (keep-alive ping) ── */
self.addEventListener('push', e => {
    e.waitUntil(
        self.registration.showNotification('GPS Beacon', {
            body: 'Beacon is active and transmitting.',
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'beacon-status',
            renotify: false,
            silent: true
        })
    );
});

/* ── Message relay to all open tabs ── */
async function notifyClients(type) {
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
    clients.forEach(c => c.postMessage({ type }));
}

self.addEventListener('message', e => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
    if (e.data && e.data.type === 'KEEP_ALIVE') {
        /* respond to keep-alive pings from the page */
        e.source && e.source.postMessage({ type: 'ALIVE_ACK' });
    }
});
