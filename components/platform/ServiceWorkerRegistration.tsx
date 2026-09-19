"use client";

import { useEffect } from "react";

/**
 * Registers public/sw.js, scoped to the given portal path only.
 *
 * A service worker's scope is NOT "whichever component called .register()" —
 * it's the URL prefix it's allowed to control, and by default that's the
 * directory the script file lives in. Since sw.js is served from the origin
 * root, an unscoped register("/sw.js") controls the ENTIRE origin, including
 * /dashboard — which is exactly how Admin ended up seeing the offline
 * fallback page after visiting a Market Associate or Partner route in the
 * same browser: the worker had installed with root scope and started
 * intercepting every navigation on the site, forever, until unregistered.
 *
 * Passing `scope` limits control to that one subtree, so Admin is never
 * touched by this worker regardless of what else has been visited in the
 * same browser profile.
 */
export function ServiceWorkerRegistration({ scope }: { scope: string }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // Next development chunks are regenerated in place. A worker left over
      // from a production/PWA test must never control those module URLs.
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(
            registrations
              .filter((registration) => new URL(registration.scope).origin === window.location.origin)
              .map((registration) => registration.unregister()),
          )),
        "caches" in window
          ? caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("hook-shell-")).map((key) => caches.delete(key))))
          : Promise.resolve([]),
      ]);
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope, updateViaCache: "none" }).then((registration) => {
      void registration.update();
    }).catch(() => {
    });
  }, [scope]);

  return null;
}
