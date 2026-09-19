"use client";

import { useState } from "react";
import { RefreshCw, Wrench } from "lucide-react";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const footerCopy = {
  customer: "Your account and cart are safe.",
  staff: "Your session and pending work are safe - nothing is lost.",
} as const;

export function MaintenanceScreen({
  onRetry,
  audience = "customer",
}: {
  onRetry?: () => Promise<void> | void;
  audience?: keyof typeof footerCopy;
}) {
  const queryClient = useQueryClient();
  const [retrying, setRetrying] = useState(false);

  async function retryNow() {
    setRetrying(true);
    if (onRetry) await onRetry();
    else await queryClient.invalidateQueries({ queryKey: ["backend-health"] });
    setRetrying(false);
  }

  return (
    <PublicShell
      eyebrow="Service status"
      title="Hook is under maintenance"
      description="We cannot reach Hook right now. Our team is working to bring everything back online."
      width="md"
      centered
    >
      <div className="flex flex-col items-center rounded-2xl bg-card px-6 py-10 text-center shadow-sm ring-1 ring-foreground/10">
        <span className="grid size-16 place-items-center rounded-2xl bg-zinc-950">
          <Wrench size={29} className="text-brand-gold" />
        </span>
        <h2 className="mt-6 text-xl font-bold tracking-tight">We&apos;ll be right back</h2>
        <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{footerCopy[audience]} Try again in a moment.</p>
        <Button variant="brand" size="lg" className="mt-7 w-full" onClick={() => void retryNow()} disabled={retrying}>
          {retrying ? <span className="size-4 animate-spin rounded-full border-2 border-black/30 border-t-black" /> : <RefreshCw size={16} />}
          Try again
        </Button>
      </div>
    </PublicShell>
  );
}
