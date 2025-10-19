/* sw.js v15.2.8 */
const CACHE_NAME='clinical-physio-v15.2.8';
const ASSETS=['./','./index.html','./app.js','./questions.json','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS).catch(()=>{})))});
self.addEventListener('activate',e=>{e.waitUntil((async()=>{const ks=await caches.keys();await Promise.all(ks.map(k=>k!==CACHE_NAME?caches.delete(k):Promise.resolve()));await self.clients.claim();})())});
const GA=['www.google-analytics.com','www.googletagmanager.com','analytics.google.com'];
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(GA.includes(u.hostname))return;
  if(e.request.mode==='navigate'||e.request.destination==='document'){e.respondWith((async()=>{try{const f=await fetch(e.request);const c=await caches.open(CACHE_NAME);c.put(e.request,f.clone());return f;}catch(err){const c=await caches.open(CACHE_NAME);const m=await c.match(e.request)||await c.match('./index.html');return m||Response.error();}})());return;}
  e.respondWith((async()=>{const c=await caches.open(CACHE_NAME);const m=await c.match(e.request);if(m)return m;try{const f=await fetch(e.request);c.put(e.request,f.clone());return f;}catch(err){return Response.error();}})());
});

