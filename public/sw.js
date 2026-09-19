// Hand-written service worker — deliberately minimal (app-shell + offline
// fallback only, not full asset precaching). Registered only from
// ServiceWorkerRegistration.tsx, which only mounts inside AppTabBarShell —
// i.e. only for Market Associate and Partner routes. Admin never registers
// this.
//
// Bump CACHE_VERSION on any change here so the old cache is dropped on
// activate instead of serving stale assets forever.
const CACHE_VERSION = "hook-shell-v4";
const OFFLINE_URL = "/offline";
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept Next runtime or build chunks. Development reuses some
  // chunk URLs while replacing their module factories, and production build
  // assets are already content-hashed and browser-cacheable. Serving either
  // from a service-worker cache can mix two builds and crash React hydration.
  if (url.pathname.startsWith("/_next/")) {
    return;
  }

  // Only navigations get the offline fallback — everything else (API calls)
  // just goes to the network as normal. A failed API call should surface as
  // a real error the app can show, not a silent swap for cached HTML.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});
