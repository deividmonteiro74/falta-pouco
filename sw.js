/* Falta Pouco · service worker
   Recebe os avisos no celular e guarda uma cópia do app para abrir mesmo sem internet. */
const CACHE = 'falta-pouco-v3';
const VERSAO = 'avisos-3';
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
  // biblioteca do Supabase e fontes: guardadas no aparelho, abre mais rápido
  if (/^(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com|cdnjs\.cloudflare\.com)$/.test(u.hostname)) {
    e.respondWith(caches.match(r).then(x => x || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
    return;
  }
  if (u.origin !== location.origin || r.headers.has('range') || /\.(mp4|bin)$/i.test(u.pathname)) return;
  if (r.mode === 'navigate') {   // página: busca a versão nova; se a internet demorar mais de 4 s ou faltar, abre a guardada
    e.respondWith(new Promise(resolve => {
      let feito = false;
      const guardada = () => caches.match('/').then(x => x || caches.match(r));
      const t = setTimeout(() => guardada().then(x => { if (x && !feito) { feito = true; resolve(x); } }), 4000);
      fetch(r.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
        clearTimeout(t);
        if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put('/', cp)); }
        if (!feito) { feito = true; resolve(res); }
      }).catch(() => { clearTimeout(t); guardada().then(x => { if (!feito) { feito = true; resolve(x || Response.error()); } }); });
    }));
    return;
  }
  if (/\.(png|jpg|jpeg|svg|webp|ico|webmanifest)$/i.test(u.pathname)) {   // ícones: usa o guardado e atualiza por trás
    e.respondWith(caches.match(r).then(x => {
      const rede = fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; });
      return x || rede;
    }));
  }
});

/* o app pergunta se este é o service worker novo (usado na conferência dos avisos) */
self.addEventListener('message', e => {
  if (e.data && e.data.ping && e.ports && e.ports[0]) e.ports[0].postMessage({ versao: VERSAO });
  if (e.data && e.data.pular) self.skipWaiting();
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
