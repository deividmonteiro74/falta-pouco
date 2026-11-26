/* Falta Pouco · service worker
   Recebe os avisos no celular e guarda uma cópia do app para abrir mesmo sem internet. */
const CACHE = 'falta-pouco-v2';
const BASICO = ['/', '/manifest.webmanifest', '/icon-192.png?v=10', '/icon-512.png?v=10', '/apple-touch-icon.png?v=10'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(BASICO.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== location.origin || r.headers.has('range') || /\.mp4$/i.test(u.pathname)) return;
  if (r.mode === 'navigate') {   // página: sempre tenta a versão nova; sem internet, usa a guardada
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(CACHE).then(c => c.put('/', cp)); return res; })
      .catch(() => caches.match('/').then(x => x || Response.error())));
    return;
  }
  if (/\.(png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(u.pathname)) {   // ícones: usa o guardado e atualiza por trás
    e.respondWith(caches.match(r).then(x => {
      const rede = fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; });
      return x || rede;
    }));
  }
});

/* ---------- avisos ---------- */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Falta Pouco', {
    body: d.body || '',
    tag: d.tag || undefined,
    renotify: !!d.tag,
    icon: '/icon-192.png?v=10',
    badge: '/favicon-64.png?v=10',
    data: { url: d.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const alvo = new URL((e.notification.data && e.notification.data.url) || '/', location.origin);
  const aba = alvo.searchParams.get('abrir');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(lista => {
    const aberta = lista.find(c => new URL(c.url).origin === location.origin);
    if (aberta) { if (aba) aberta.postMessage({ abrir: aba }); return aberta.focus(); }
    return self.clients.openWindow(alvo.href);
  }));
});

self.addEventListener('pushsubscriptionchange', e => {
  // o navegador trocou a inscrição: o app refaz o cadastro na próxima vez que abrir
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(l => l.forEach(c => c.postMessage({ reinscrever: true }))));
});
