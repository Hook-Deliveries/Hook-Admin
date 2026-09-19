import type { ReactNode } from "react";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { HookLogo } from "@/components/shared/HookLogo";
import { cn } from "@/lib/utils";

const WIDTHS = { md: "max-w-md", lg: "max-w-lg", "2xl": "max-w-2xl", "3xl": "max-w-3xl" } as const;

export const PUBLIC_LINKS = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/returns", label: "Returns" },
  { href: "/delete-account", label: "Delete account" },
];

/**
 * The frame for every customer-facing page outside the admin dashboard, in the
 * same design as the sign-in screens: the content on the left, and a dark
 * brand panel on the right with the flickering grid. The panel carries the
 * page's title, description and any extra guidance (steps, contents list). On
 * phones the panel is hidden and the title moves above the content.
 */
export function PublicShell({
  eyebrow,
  title,
  description,
  aside,
  children,
  width = "2xl",
  centered = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  /** Extra content in the brand panel under the description (steps, contents list…). Desktop only. */
  aside?: ReactNode;
  children: ReactNode;
  width?: keyof typeof WIDTHS;
  /** Vertically centre the content on tall screens: for short forms. */
  centered?: boolean;
}) {
  return (
    <div className="min-h-dvh w-full bg-background lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <main className={cn("flex min-h-dvh flex-col bg-muted/30 px-6 py-10 sm:px-10 lg:px-14 lg:py-14", centered && "lg:justify-center")}>
        <div className={cn("mx-auto w-full", WIDTHS[width])}>
          {/* The panel is hidden below lg, so the identity moves here. */}
          <header className="mb-8 space-y-4 lg:hidden">
            <HookLogo className="text-3xl" />
            <div className="space-y-2">
              {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-gold">{eyebrow}</p> : null}
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
            </div>
          </header>
          <div className="mb-8 hidden lg:block"><HookLogo className="text-3xl" /></div>
          {children}
        </div>
      </main>

      <aside className="relative hidden overflow-hidden border-l border-white/10 bg-zinc-950 text-white lg:sticky lg:top-0 lg:block lg:h-dvh">
        <FlickeringGrid className="absolute inset-0 z-0" squareSize={4} gridGap={6} color="#FFC809" maxOpacity={0.35} flickerChance={0.12} />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-linear-to-b from-brand-gold/10 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 bg-linear-to-b from-zinc-950/0 via-zinc-950/40 to-zinc-950/95" />

        {/* The grid stays put; only this layer scrolls when a long contents list needs it. */}
        <div data-shell-scroll className="relative z-10 flex h-full flex-col justify-between gap-10 overflow-y-auto p-10 xl:p-12">
          <div className="space-y-8">
            <div className="max-w-md space-y-4">
              {eyebrow ? <p className="text-xs font-medium uppercase tracking-[0.28em] text-brand-gold">{eyebrow}</p> : null}
              <h1 className="text-3xl font-semibold leading-[1.15] tracking-tight text-balance">{title}</h1>
              {description ? <p className="text-base leading-7 text-zinc-400">{description}</p> : null}
            </div>
            {aside}
          </div>

          <nav aria-label="Legal and account" className="space-y-3 text-xs text-zinc-500">
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {PUBLIC_LINKS.map((link) => (
                <li key={link.href}>
                  <a className="font-medium text-zinc-300 underline-offset-4 hover:text-white hover:underline" href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
            <p>&copy; {new Date().getFullYear()} Hook</p>
          </nav>
        </div>
      </aside>
    </div>
  );
}
