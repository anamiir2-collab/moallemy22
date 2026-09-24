/* مُعلّمي Service Worker - v1.2.0 (Gemini AI: التحليل الذكي + مولد الامتحانات) */
const APP_VERSION = 'v1.2.0';
const CACHE_NAME = `moallemy-${APP_VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/components.css',
  './css/ai.css',
  './css/animations.css',
  './css/responsive.css',
  './js/vendor/supabase.js',
  './js/supabase-config.js',
  './js/utils.js',
  './js/storage.js',
  './js/cloud.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/students.js',
  './js/groups.js',
  './js/lessons.js',
  './js/attendance.js',
  './js/assignments.js',
  './js/exams.js',
  './js/ai-analysis.js',
  './js/ai.js',
  './js/ai-generator.js',
  './js/payments.js',
  './js/reports.js',
  './js/calendar.js',
  './js/notifications.js',
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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

/* Fetch - network-first for navigation, cache-first for assets */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin requests (CDNs, fonts)
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first, fallback to cache
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

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (!res || res.status !== 200) return res;
        const copy = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        return res;
      }).catch(() => cached);
    })
  );
});

/* Message - handle skip waiting from page */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
