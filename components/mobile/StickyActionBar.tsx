"use client";

import { cn } from "@/lib/utils";
import {
  APP_ACTION_BAR_BOTTOM,
  APP_ACTION_BAR_HEIGHT,
} from "@/lib/tab-bar-layout";

/**
 * Page-level primary actions, docked directly above the tab bar.
 *
 * Deliberately mirrors the tab bar's own language — same `max-w-lg` width, same
 * `px-3` gutters, same pill radius and shadow — so the two read as one floating
 * control cluster rather than two competing bars. Sits at `z-40`, below the
 * tab bar's `z-50`, so navigation always wins if they ever meet.
 *
 * Pages rendering this owe `APP_ACTION_BAR_CONTENT_INSET` of extra bottom
 * padding; the shell's `<main>` only clears the tab bar.
 */
export function StickyActionBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-x-0 z-40 flex justify-center px-3"
      style={{ bottom: `calc(${APP_ACTION_BAR_BOTTOM}px + var(--safe-bottom))` }}
    >
      <div
        className={cn(
          "flex w-full max-w-lg items-center gap-2 rounded-[31px] border border-black/5 bg-white/95 px-2 shadow-[0_3px_14px_rgba(0,0,0,0.16)] backdrop-blur",
          className,
        )}
        style={{ minHeight: APP_ACTION_BAR_HEIGHT }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Compact height for buttons inside the bar, keeping the stack tight against
 * the 60px tab bar. `MobileButton` defaults to a 52px pill, which is too tall here.
 */
export const ACTION_BAR_BUTTON = "min-h-[44px] text-[14px]";
