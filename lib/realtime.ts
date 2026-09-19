"use client";

import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { getAccessToken } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api/v1";

function socketBaseUrl() {
  return API_BASE.replace(/\/api\/v1\/?$/, "").replace(/\/$/, "");
}

const NOTIFICATION_KEYS = [
  ["notifications"],
  ["marketassociate", "notifications"],
  ["partner", "notifications"],
] as const;

/**
 * Catalog movement reaches every portal: Admin reviews it, Market Associates
 * capture and confirm against it, Partners browse and price from it.
 */
const CATALOG_KEYS = [
  ["admin", "products"],
  ["admin", "categories"],
  ["admin", "product-category-options"],
  ["admin", "markets"],
  ["admin", "market"],
  ["admin", "product-submissions"],
  ["products"],
  ["home-content"],
  ["markets"],
  ["marketassociate", "availability-checks"],
  ["marketassociate", "markets"],
  ["marketassociate", "market"],
  ["marketassociate", "market-vendors"],
  ["marketassociate", "market-vendor"],
  ["marketassociate", "submissions"],
  ["marketassociate", "submission"],
  ["marketassociate", "catalog-dashboard"],
  ["partner", "discover"],
  ["partner", "product"],
  ["partner", "commerce-config"],
] as const;

/** Orders move custody and fulfilment state in both self-service portals. */
const ORDER_KEYS = [
  ["admin", "orders"],
  ["admin", "recent-orders"],
  ["admin", "dashboard"],
  ["admin", "sidebar-summary"],
  ["orders"],
  ["marketassociate", "fulfilments"],
  ["marketassociate", "fulfilment"],
  ["marketassociate", "catalog-dashboard"],
  ["partner", "orders"],
  ["partner", "custody"],
] as const;

/** Basket and negotiation state, which drive the Partner checkout flow. */
const CART_KEYS = [
  ["partner", "basket"],
  ["partner", "negotiations"],
  ["partner", "negotiation"],
] as const;

function invalidateAll(
  queryClient: QueryClient,
  keys: readonly (readonly string[])[],
) {
  for (const queryKey of keys) queryClient.invalidateQueries({ queryKey });
}

function invalidateForEvent(queryClient: QueryClient, event: string) {
  if (event === "realtime.connected") {
    // Anything could have changed while the socket was down, so resync every
    // surface rather than guessing which ones drifted.
    invalidateAll(queryClient, [
      ...NOTIFICATION_KEYS,
      ...CATALOG_KEYS,
      ...ORDER_KEYS,
      ...CART_KEYS,
    ]);
    return;
  }
  if (event === "home.updated" || event === "catalog.updated") {
    invalidateAll(queryClient, CATALOG_KEYS);
  }
  if (event === "notification.created" || event === "notification.updated") {
    invalidateAll(queryClient, NOTIFICATION_KEYS);
  }
  if (event === 'app-release.updated') queryClient.invalidateQueries({ queryKey: ['admin', 'app-releases'] });
  if (event === 'negotiation.messages' || event === 'negotiation.updated') queryClient.invalidateQueries({ queryKey: ['admin', 'negotiations'] });
  if (event === "order.updated") {
    invalidateAll(queryClient, ORDER_KEYS);
  }
  if (event === "cart.updated") {
    invalidateAll(queryClient, CART_KEYS);
  }
  if (event === "admin.dashboard.updated" || event === "admin.operations.updated") {
    invalidateAll(queryClient, [["admin"], ["dashboard"]]);
  }
}

export function AdminRealtimeBridge() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let socket: Socket | undefined;
    let disposed = false;
    let authSignature = "";

    const connect = () => {
      const accessToken = getAccessToken();
      if (!accessToken || disposed) {
        socket?.disconnect();
        return;
      }
      if (!socket) {
        socket = io(socketBaseUrl(), {
          autoConnect: false,
          transports: ["websocket", "polling"],
          reconnection: true,
          reconnectionDelay: 500,
          reconnectionDelayMax: 10_000,
          auth: { accessToken },
        });
        socket.onAny((event) => invalidateForEvent(queryClient, event));
        socket.on("connect", () => {
          invalidateForEvent(queryClient, "realtime.connected");
        });
      } else {
        socket.auth = { accessToken };
      }
      const nextSignature = JSON.stringify({ accessToken });
      const credentialsChanged = authSignature !== nextSignature;
      authSignature = nextSignature;
      if (credentialsChanged && socket.connected) socket.disconnect();
      if (!socket.connected) socket.connect();
    };

    const onAuthChanged = () => connect();
    window.addEventListener("hook-auth-changed", onAuthChanged);
    connect();
    return () => {
      disposed = true;
      window.removeEventListener("hook-auth-changed", onAuthChanged);
      socket?.disconnect();
    };
  }, [queryClient]);

  return null;
}
