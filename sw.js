/* Falta Pouco — service worker: sempre busca a versão mais nova na rede e só usa o cache se estiver sem internet. */
const CACHE = 'falta-pouco-offline';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.searchParams.has('_v')) return;   // _v = conferência de versão: vai direto à rede
  e.respondWith((async () => {
    try {
      const r = await fetch(req, { cache: 'no-store' });
      if (r.ok) (await caches.open(CACHE)).put(req, r.clone());
      return r;
    } catch {
      return (await caches.match(req)) || (req.mode === 'navigate' ? await caches.match('/') : null) || Response.error();
    }
  })());
});
