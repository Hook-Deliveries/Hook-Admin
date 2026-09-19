"use client";

import { useEffect } from "react";

/**
 * One-time fix for browsers that already installed the PWA service worker
 * with root ("/") scope before ServiceWorkerRegistration started passing a
 * narrow `scope` (see that file's comment for the full story). A root-scoped
 * worker controls every route on the origin, including /dashboard — so an
 * Admin who'd ever visited the Market Associate or Partner portal in the
 * same browser could get served the offline fallback page here even while
 * online, because a stale/failed fetch inside the worker's root-scoped
 * fetch handler silently swapped in cached HTML instead of the real page.
 *
 * Any worker already scoped narrowly to a portal path (not "/") is left
 * alone — it isn't controlling Admin and unregistering it would just make
 * that portal re-register on its next visit for no benefit.
 */
export function AdminServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        const scopePath = new URL(registration.scope).pathname;
        if (scopePath === "/") registration.unregister();
      }
    });
  }, []);

  return null;
}
