"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Building2, Store, UsersRound } from "lucide-react";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { HookLoader } from "@/components/shared/HookLoader";
import { MaintenanceScreen } from "@/components/shared/MaintenanceScreen";
import { useAccountSession, useBackendHealth } from "@/lib/query";
import { dashboardPath } from "@/lib/auth-routing";

const copy = {
  "/auth/login": {
    eyebrow: "Hook operations",
    title: "One secure workspace for every Hook team.",
    description:
      "Staff, Market Associates, and Hook Partners are automatically taken to the workspace assigned to their account.",
    footer: "Hook identity and access",
  },
  "/forgot-password": {
    eyebrow: "Account recovery",
    title: "Recover access without slowing operations down.",
    description:
      "Request a one time password for your verified Hook account and continue securely.",
    footer: "OTP protected password recovery",
  },
  "/reset-password": {
    eyebrow: "Password reset",
    title: "Set a fresh Hook password with OTP verification.",
    description:
      "Use the code sent to your email to restore access and invalidate old admin sessions.",
    footer: "Hook admin reset workflow",
  },
};

export function AuthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const health = useBackendHealth();
  const session = useAccountSession(health.data !== false);
  const content = copy[pathname as keyof typeof copy] || copy["/auth/login"];

  useEffect(() => {
    if (session.data) {
      router.replace(dashboardPath(session.data));
    }
  }, [router, session.data]);

  if (health.data === false) return <MaintenanceScreen />;

  // The session check used to swap the whole screen for a full-page loader and
  // then swap it back, which read as a flash on every visit. The frame now
  // stays put and only the form column shows the wait.
  const checking = health.isLoading || session.isLoading || session.isPending || Boolean(session.data);

  return (
    <main className="min-h-dvh bg-background lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      {/* Form column. Nothing animates and nothing blurs here: this screen is
          the first thing every user sees, and full-height animated or blurred
          layers were what made it tear while painting. */}
      <section className="relative flex min-h-dvh items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full">
          {checking ? (
            <div className="flex min-h-72 items-center justify-center">
              <HookLoader size="page" label="Checking your session..." />
            </div>
          ) : (
            children
          )}
        </div>
      </section>

      {/* Brand panel: desktop only. One canvas of flickering squares, drawn
          at 30fps and paused when off screen; still under reduced motion. */}
      <aside className="relative hidden min-h-dvh flex-col justify-between overflow-hidden border-l border-white/10 bg-zinc-950 p-10 text-white lg:flex">
        <FlickeringGrid
          className="absolute inset-0 z-0"
          squareSize={4}
          gridGap={6}
          color="#FFC809"
          maxOpacity={0.35}
          flickerChance={0.12}
        />
        {/* Soft gold light at the top, and a fade at the bottom so the text
            and tiles stay crisp over the grid. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-linear-to-b from-brand-gold/10 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-linear-to-b from-zinc-950/0 via-zinc-950/40 to-zinc-950/95" />

        <div className="relative z-10 max-w-md space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand-gold">{content.eyebrow}</p>
          <h2 className="text-3xl font-semibold leading-[1.15] tracking-tight text-balance">{content.title}</h2>
          <p className="text-base leading-7 text-zinc-400">{content.description}</p>
        </div>

        <div className="relative z-10 space-y-4">
          <p className="text-center text-sm text-zinc-400">Built for the teams that run Hook</p>
          <ul className="grid grid-cols-3 gap-3">
            {[
              { icon: Building2, label: "Operations" },
              { icon: UsersRound, label: "Market Associates" },
              { icon: Store, label: "Hook Partners" },
            ].map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-2 py-4 text-center">
                <Icon className="size-5 text-brand-gold" />
                <span className="text-xs font-medium text-zinc-300">{label}</span>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-center gap-2 pt-2 text-xs text-zinc-500">
            <span className="size-1.5 rounded-full bg-brand-gold" />
            {content.footer}
          </p>
        </div>
      </aside>
    </main>
  );
}
