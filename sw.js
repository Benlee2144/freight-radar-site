// Offline copy of the page and the locked data files. The data stays locked in the cache:
// only a browser holding the key can read it.
const SHELL = 'fr-shell-800ede038a', FILES = 'fr-data';
self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['./', 'manifest.webmanifest', 'icon-192.png'])).catch(() => { /* first visit offline */ }));
});
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== SHELL && k !== FILES) await caches.delete(k);
  await self.clients.claim();
})()));
// The page says which day's data (and which map) it is showing; older files are dropped.
self.addEventListener('message', e => {
  const keep = e.data && e.data.keep, map = (e.data && e.data.map) || '';
  if (keep) e.waitUntil((async () => {
    const c = await caches.open(FILES);
    for (const req of await c.keys()) {
      const u = new URL(req.url), v = u.searchParams.get('v');
      if ((u.pathname.includes('/d/') && v !== keep) || (u.pathname.includes('/m/') && v !== map)) await c.delete(req);
    }
  })());
});
async function cacheFirst(req) {  // a day's lead files (and a map's files) never change
  const c = await caches.open(FILES), hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}
async function networkFirst(req, name) {  // always the newest page and list when online
  const c = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.includes('/d/') || u.pathname.includes('/m/')) e.respondWith(cacheFirst(req));
  else e.respondWith(networkFirst(req, u.pathname.endsWith('data.json') ? FILES : SHELL));
});
