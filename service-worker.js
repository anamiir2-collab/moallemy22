/* مُعلّمي Service Worker - v2.0.0 */
const APP_VERSION = 'v2.0.0';
const CACHE_NAME = `moallemy-${APP_VERSION}`;
const RUNTIME_CACHE = `moallemy-runtime-${APP_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/animations.css',
  './css/reports.css',
  './css/responsive.css',
  './css/print.css',
  './js/storage.js',
  './js/utils.js',
  './js/auth.js',
  './js/ai-analysis.js',
  './js/ai.js',
  './js/dashboard.js',
  './js/students.js',
  './js/groups.js',
  './js/lessons.js',
  './js/attendance.js',
  './js/assignments.js',
  './js/exams.js',
  './js/payments.js',
  './js/reports.js',
  './js/parent-report.js',
  './js/calendar.js',
  './js/notifications.js',
  './js/search.js',
  './js/backup.js',
  './js/settings.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

/* Install - precache core assets */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

/* Activate - cleanup old caches */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME && k !== RUNTIME_CACHE).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

/* Fetch */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation requests: network-first, fallback to cache (Offline كامل)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // نفس الأصل: cache-first مع تحديث خلفي
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // موارد خارجية (خطوط Google + Chart.js CDN): cache-first في كاش منفصل
  // حتى يعمل التطبيق Offline بخطوطه ورسومه البيانية
  if (url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
      })
    );
  }
});

/* Message - handle skip waiting from page */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
