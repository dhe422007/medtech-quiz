// sw.js
const CACHE_VERSION = 'v22';
const CACHE_NAME = `quiz-cache-${CACHE_VERSION}`;
const URLS_TO_CACHE = [
  './',
  './index.html',
  './app.js?v=21',
  './questions.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(URLS_TO_CACHE)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('quiz-cache-') && k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (event) => {
  event.respondWith((async ()=>{
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try{
      const res = await fetch(event.request);
      if (!event.request.url.endsWith('.html')) cache.put(event.request, res.clone());
      return res;
    }catch(e){
      return cached || Response.error();
    }
  })());
});
