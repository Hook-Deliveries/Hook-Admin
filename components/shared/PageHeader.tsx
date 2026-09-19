"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
  /**
   * Overrides the URL-depth heuristic below. Sidebar destinations that happen
   * to sit at a nested path (e.g. /dashboard/fulfilment/hub) are not
   * drill-downs, so router.back() would send staff somewhere unrelated.
   */
  showBack?: boolean;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  showBack,
}: PageHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const dashboardSegments = pathname.split("/").filter(Boolean).slice(1);
  const isDepthPage = showBack ?? dashboardSegments.length > 1;

  return (
    <div
      className={cn(
        "mb-4 flex min-h-12 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          {isDepthPage ? (
            <Button type="button" variant="outline" size="icon-sm" className="shrink-0 rounded-full" aria-label="Go back" onClick={() => router.back()}>
              <ArrowLeft className="size-4" />
            </Button>
          ) : null}
          <h1 className="min-w-0 truncate text-lg font-semibold leading-tight tracking-normal text-foreground">
            {title}
          </h1>
        </div>
        {description && (
          <p className={cn("mt-1 max-w-3xl text-sm leading-5 text-muted-foreground", isDepthPage && "pl-10")}>
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
