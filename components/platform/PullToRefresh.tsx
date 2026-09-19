"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { HookLoader } from "@/components/shared/HookLoader";
import { cn } from "@/lib/utils";

const PULL_THRESHOLD = 72;
const MAX_PULL = 120;

/**
 * Wraps a portal's scrollable content. Only active in standalone/installed
 * mode — a normal browser tab already has its own native pull-to-refresh, so
 * this would double up with it there.
 */
export function PullToRefresh({
  queryKeyPrefix,
  children,
}: {
  queryKeyPrefix: readonly unknown[];
  children: React.ReactNode;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Gesture bookkeeping the handlers need moment-to-moment but that never
  // drives what's rendered — kept in refs so the listeners can stay bound
  // for the whole lifetime of `enabled` instead of rebinding on every touch
  // event.
  const startY = useRef<number | null>(null);
  const refreshingRef = useRef(false);
  const pullRef = useRef(0);
  const draggingRef = useRef(false);

  useEffect(() => {
    const query = window.matchMedia("(display-mode: standalone)");
    const sync = () => setEnabled(query.matches || (window.navigator as { standalone?: boolean }).standalone === true);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    function onTouchStart(event: TouchEvent) {
      if (window.scrollY > 0 || refreshingRef.current) {
        startY.current = null;
        return;
      }
      startY.current = event.touches[0].clientY;
      draggingRef.current = false;
      setDragging(false);
    }

    function onTouchMove(event: TouchEvent) {
      if (startY.current === null || refreshingRef.current) return;
      const delta = event.touches[0].clientY - startY.current;
      if (delta <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      // Only take over the gesture once it's clearly a downward pull from
      // the top — otherwise let normal scrolling behave normally.
      draggingRef.current = true;
      setDragging(true);
      const next = Math.min(delta * 0.5, MAX_PULL);
      pullRef.current = next;
      setPull(next);
    }

    async function onTouchEnd() {
      if (!draggingRef.current) {
        startY.current = null;
        return;
      }
      draggingRef.current = false;
      setDragging(false);
      startY.current = null;
      if (pullRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(PULL_THRESHOLD);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeyPrefix }),
          router.refresh(),
        ]);
        // A brief hold so the spinner doesn't just flash on a fast refetch —
        // matches how native pull-to-refresh feels rather than reading as a
        // glitch.
        await new Promise((resolve) => setTimeout(resolve, 400));
        refreshingRef.current = false;
        setRefreshing(false);
      }
      pullRef.current = 0;
      setPull(0);
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [enabled, queryClient, queryKeyPrefix, router]);

  if (!enabled) return <>{children}</>;

  return (
    <div className="relative">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center overflow-hidden transition-[height]",
          !dragging && !refreshing && "duration-200",
        )}
        style={{ height: pull }}
      >
        <div className="flex items-end pb-2">
          <HookLoader size="inline" />
        </div>
      </div>
      <div
        className={cn("transition-transform", !dragging && !refreshing && "duration-200")}
        // A permanent translateY(0) makes nested fixed action bars relative to
        // this content wrapper instead of the viewport, even when not pulling.
        style={{ transform: pull > 0 ? `translateY(${pull}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  );
}
