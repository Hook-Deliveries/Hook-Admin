"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaintenanceScreen } from "@/components/shared/MaintenanceScreen";
import { checkHookHealth, ensureAccountSession } from "@/lib/api";
import { dashboardPath } from "@/lib/auth-routing";

/** Held on screen for a beat so the splash always registers as a deliberate
 * moment rather than a flash — even when the health check and session
 * resolve instantly. */
const MIN_VISIBLE_DURATION = 4_000;
const RETRY_INTERVAL = 5_000;

/**
 * The entry point for the whole site (see app/page.tsx, which redirects
 * here) and the PWA's start_url (see app/manifest.ts — the manifest can only
 * point at one static path, but Market Associates and Partners need to land
 * on two different dashboards). Pings the backend first, so a down API shows
 * a real "under maintenance" screen instead of a spinner that never
 * resolves, then reads the logged-in session and forwards to whichever
 * dashboard belongs to that account — the same resolution
 * safeDashboardDestination uses after login. No session → login screen.
 *
 * Adapted from the Hook-App (Expo) splash screen's health-check + background
 * recovery pattern, ported to this stack's session/routing helpers.
 */
export default function LaunchPage() {
  const router = useRouter();
  const routed = useRef(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const replace = useCallback(
    (path: string) => {
      if (routed.current) return;
      routed.current = true;
      router.replace(path);
    },
    [router],
  );

  const routeToDestination = useCallback(async () => {
    try {
      const session = await ensureAccountSession();
      replace(session ? dashboardPath(session) : "/auth/login");
    } catch {
      replace("/auth/login");
    }
  }, [replace]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const [, healthy] = await Promise.all([
        new Promise((resolve) => setTimeout(resolve, MIN_VISIBLE_DURATION)),
        checkHookHealth(),
      ]);
      if (!mounted) return;
      setBackendAvailable(healthy);
      if (healthy) await routeToDestination();
    })();

    return () => {
      mounted = false;
    };
  }, [routeToDestination]);

  // While the backend is down, keep checking in the background so a launch
  // during a brief outage or network blip recovers on its own.
  useEffect(() => {
    if (backendAvailable !== false) return;
    let active = true;
    const interval = setInterval(async () => {
      if (routed.current) return;
      const healthy = await checkHookHealth();
      if (!active || !healthy || routed.current) return;
      setBackendAvailable(true);
      await routeToDestination();
    }, RETRY_INTERVAL);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [backendAvailable, routeToDestination]);

  async function retryNow() {
    const healthy = await checkHookHealth();
    if (healthy) {
      setBackendAvailable(true);
      await routeToDestination();
    } else {
      setBackendAvailable(false);
    }
  }

  if (backendAvailable === false) return <MaintenanceScreen onRetry={retryNow} />;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#FFC809] px-6">
      <div className="flex w-full flex-1 items-center justify-center">
        <p className="text-[55px] font-bold leading-[66px] text-black">
          hook<span className="text-white">.</span>
        </p>
      </div>
      <div className="w-full items-center pb-8 text-center">
        <div className="mx-auto mb-3 h-px w-8 bg-black/20" />
        <p className="text-[11px] font-bold uppercase tracking-[1.6px] text-black/60">
          Velaris Technologies Limited
        </p>
      </div>
    </div>
  );
}
