// Service Worker with network-first strategy and hard cache busting
// 캐시가 배포본을 고착시키는 문제를 방지하기 위해 네트워크 우선 전략 사용

const CACHE_NAME = 'webtoon-tracker-v4-2025-01-08';
const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  // 신규 SW를 즉시 활성화하도록 요청
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 이전 캐시 모두 제거
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
      // 현재 클라이언트에 즉시 반영
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // 네비게이션 요청은 항상 네트워크 우선 (index.html 최신 유지)
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          const cache = await caches.open(CACHE_NAME);
          cache.put('/', networkResponse.clone());
          return networkResponse;
        } catch (err) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/')
          return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // 그 외 리소스는 stale-while-revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          // 성공 응답만 캐시에 저장
          if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
});
