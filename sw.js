/* sw.js (clinical physiology) — v15.2.4 */
const CACHE_NAME = 'clinical-physio-v15.2.4';
const ASSETS = ['./','./index.html','./app.js','./questions.json','./manifest.webmanifest'];

self.addEventListener('install', (event) => { self.skipWaiting(); event.waitUntil(caches.open(CACHE_NAME).then((c)=>c.addAll(ASSETS).catch(()=>{}))); });
self.addEventListener('activate', (event) => { event.waitUntil((async () => { const keys=await caches.keys(); await Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):Promise.resolve())); await self.clients.claim(); })()); });

const GA_HOSTS=['www.google-analytics.com','www.googletagmanager.com','analytics.google.com'];
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (GA_HOSTS.includes(url.hostname)) return;
  if (event.request.mode === 'navigate' || (event.request.destination === 'document')){
    event.respondWith((async () => { try { const fresh=await fetch(event.request); const cache=await caches.open(CACHE_NAME); cache.put(event.request, fresh.clone()); return fresh; } catch(e){ const cache=await caches.open(CACHE_NAME); const cached=await cache.match(event.request) || await cache.match('./index.html'); return cached || Response.error(); } })()); return;
  }
  event.respondWith((async () => { const cache=await caches.open(CACHE_NAME); const cached=await cache.match(event.request); if (cached) return cached; try{ const fresh=await fetch(event.request); cache.put(event.request, fresh.clone()); return fresh; } catch(e){ return Response.error(); } })());
});
