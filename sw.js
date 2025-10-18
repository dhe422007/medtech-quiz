// sw.js optimized (Network-First for questions.json, Stale-While-Revalidate for others)
const CACHE_VERSION = 'v6';
const STATIC_CACHE = `quiz-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `quiz-runtime-${CACHE_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './app.js?v=1',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k!==STATIC_CACHE && k!==RUNTIME_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isQuestions = url.pathname.endsWith('/questions.json') || url.pathname.endsWith('/questions.json/');
  if (isQuestions) {
    event.respondWith(networkFirst(req));
    return;
  }
  if (req.method === 'GET') {
    event.respondWith(staleWhileRevalidate(req));
  }
});

async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, fresh.clone());
    return fresh;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((res) => {
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  return cached || fetchPromise || new Response('Offline', { status: 503 });
}
