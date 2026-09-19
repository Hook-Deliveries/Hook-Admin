import type { Metadata } from "next";
import { Compass, Home, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Page not found | Hook",
  robots: { index: false, follow: false },
};

/**
 * Shown for any address that does not exist, in the same frame as the other
 * public pages. A server component on purpose: it needs no script to render,
 * so it still works when the rest of the app cannot load.
 */
export default function NotFound() {
  return (
    <PublicShell
      eyebrow="Error 404"
      title="We can't find that page"
      description="The link may be broken, or the page may have moved. Nothing is wrong with your account."
      width="lg"
      centered
    >
      <Card className="rounded-2xl py-8 shadow-sm">
        <CardContent className="space-y-6 px-6 text-center sm:px-8">
          <p aria-hidden className="select-none text-7xl font-black tracking-tighter text-foreground/10 sm:text-8xl">404</p>
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand-gold/20 text-zinc-950">
            <Compass className="size-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold tracking-tight">This page doesn&apos;t exist</h2>
            <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
              Check the address for typos, or head back to Hook. If you followed a link from an email or the app, it may have expired.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild variant="brand" size="lg" className="sm:min-w-44">
              {/* A full navigation, so it works even if client routing is unavailable. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/"><Home className="size-4" />Go to Hook</a>
            </Button>
            <Button asChild variant="outline" size="lg" className="sm:min-w-44">
              <a href="/privacy"><ShieldCheck className="size-4" />Privacy policy</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PublicShell>
  );
}
