import type { MetadataRoute } from "next";

/**
 * Served at /manifest.webmanifest by Next's file convention. This is the
 * only manifest the whole app can have — Next doesn't support scoping it
 * per route group the way it does app icons — so it covers Market Associate
 * and Partner (the two portals meant to be installable). Admin never sees an
 * install prompt or gets a service worker registered regardless of this
 * file's reachability; that's enforced in JS from AppTabBarShell, which
 * admin never renders.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hook — Market Operations",
    short_name: "Hook",
    description: "Capture, confirm, and fulfil for Hook — for Market Associates and Partners.",
    // The manifest only supports one static start_url, but Market Associates
    // and Partners land on two different dashboards — /launch reads the
    // logged-in session and forwards to the right one. See app/launch/page.tsx.
    start_url: "/launch",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F5F5F5",
    theme_color: "#FFC809",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New capture", short_name: "Capture", url: "/market-associate/submissions/new" },
      { name: "Availability checks", short_name: "Availability", url: "/market-associate/availability" },
      { name: "Browse catalog", short_name: "Browse", url: "/partner/browse" },
      { name: "Basket", short_name: "Basket", url: "/partner/basket" },
    ],
  };
}
