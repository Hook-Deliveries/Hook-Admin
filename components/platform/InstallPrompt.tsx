"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import Image from "next/image";

const DISMISSED_KEY = "hook_install_prompt_dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone() {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari's own flag — not covered by the display-mode media query.
      (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

/**
 * Branded "Add to Home Screen" banner, mounted only from AppTabBarShell
 * (Market Associate / Partner) — never shown to Admin. Captures the
 * browser's own beforeinstallprompt event so we can trigger it from our own
 * UI instead of the raw browser popup, matching the app's Hook-gold styling.
 */
export function InstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;

    // beforeinstallprompt only ever fires asynchronously in response to the
    // browser's own eligibility checks — never synchronously on mount — so
    // reading the dismissal flag here, once the event actually arrives, is
    // enough; there's no earlier render that needs it.
    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      if (localStorage.getItem(DISMISSED_KEY) === "1") return;
      setDismissed(false);
      setDeferredEvent(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!deferredEvent || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  }

  async function install() {
    if (!deferredEvent) return;
    await deferredEvent.prompt();
    const choice = await deferredEvent.userChoice;
    setDeferredEvent(null);
    if (choice.outcome === "dismissed") dismiss();
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}>
      <div className="flex w-full max-w-lg items-center gap-3 rounded-2xl border border-black/5 bg-white p-3 shadow-[0_3px_14px_rgba(0,0,0,0.16)]">
        <span className="relative size-10 shrink-0 overflow-hidden rounded-xl">
          <Image src="/icons/icon-192.png" alt="" fill sizes="40px" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-black">Add Hook to your Home Screen</p>
          <p className="text-[12px] text-[#8F8F8F]">One-tap access, even offline.</p>
        </div>
        <button
          type="button"
          onClick={() => void install()}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#FFC809] px-3.5 text-[13px] font-bold text-black transition hover:bg-[#f0bb00]"
        >
          <Download size={14} /> Install
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="grid size-8 shrink-0 place-items-center rounded-full text-[#8F8F8F] transition hover:bg-[#EAEBE7]"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
