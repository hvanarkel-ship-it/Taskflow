const CACHE = 'dpm-crm-v21';
const STATIC = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API calls: always network-only — never serve stale cached data
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // HTML navigation: network-first so updates always arrive
  if (e.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, cl)); }
      return r;
    }).catch(() => caches.match(e.request).then(c => c || caches.match('/'))));
    return;
  }
  // Other static assets: cache-first
  e.respondWith(caches.match(e.request).then(c => {
    if (c) return c;
    return fetch(e.request).then(r => {
      if (r.ok && (url.origin === location.origin || url.hostname.includes('googleapis') || url.hostname.includes('gstatic') || url.hostname.includes('cdnjs'))) {
        const cl = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, cl));
      }
      return r;
    });
  }).catch(() => { if (e.request.mode === 'navigate') return caches.match('/'); }));
});
