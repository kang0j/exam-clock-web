// Offline support. Cache-first: page always opens from cache, even with no network.
// Cache refreshes in the background when online; new version takes effect on next load.
var CACHE = 'exam-clock-v4';
var PAGE = './index.html';

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(['./', PAGE, './sw.js']); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function refresh(cache, req) {
  return fetch(req, { cache: 'no-store' }).then(function (res) {
    if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
    return res;
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  var isPage = req.mode === 'navigate';

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      var lookup = isPage
        ? cache.match(PAGE).then(function (r) { return r || cache.match('./'); })
        : cache.match(req, { ignoreSearch: true });
      return lookup.then(function (cached) {
        var net = refresh(cache, isPage ? PAGE : req);
        if (cached) { e.waitUntil(net.catch(function () {})); return cached; }
        return net.catch(function () {
          return new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
        });
      });
    })
  );
});
