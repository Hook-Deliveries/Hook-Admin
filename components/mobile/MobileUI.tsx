"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mobile-app UI primitives for the Market Associate and Partner portals.
 * Tokens mirror the Hook-App native profile screen so both platforms
 * read as the same product.
 */

export const MOBILE_TOKENS = {
  pageBg: "#F5F5F5",
  surface: "#FFFFFF",
  brand: "#FFC809",
  brandSoft: "#FFF2B8",
  brandTint: "#FFF3C4",
  neutralTile: "#EAEBE7",
  divider: "#D9D9D9",
  muted: "#8F8F8F",
  rowValue: "#858589",
  chevron: "#A3A3A6",
} as const;

/** Section label sits above the white card, matching the native profile. */
export function MobileSection({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-7", className)}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          {title && <h2 className="text-[15px] font-semibold text-black">{title}</h2>}
          {action}
        </div>
      )}
      <div className="overflow-hidden rounded-[10px] bg-white px-2.5">{children}</div>
    </section>
  );
}

/** Free-form section body when the content is not a row list. */
export function MobileCard({
  children,
  className,
  padded = true,
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[10px] bg-white", padded && "p-4", className)}>
      {children}
    </div>
  );
}

type RowTone = "brand" | "neutral" | "danger";

const tileTone: Record<RowTone, string> = {
  brand: "bg-[#FFC809] text-black",
  neutral: "bg-[#EAEBE7] text-black",
  danger: "bg-red-50 text-red-600",
};

/**
 * The core list row: 30px squircle icon tile, label, optional value, chevron.
 * Renders as a link, a button, or a static div depending on props.
 */
export function MobileRow({
  icon: Icon,
  leading,
  label,
  description,
  value,
  href,
  onClick,
  tone = "brand",
  trailing,
  disabled,
}: {
  icon?: LucideIcon;
  leading?: React.ReactNode;
  label: string;
  description?: string;
  value?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: RowTone;
  trailing?: React.ReactNode;
  disabled?: boolean;
}) {
  const interactive = Boolean((href || onClick) && !disabled);

  const body = (
    <>
      {leading}
      {Icon && (
        <span className={cn("grid size-7.5 shrink-0 place-items-center rounded-[5px]", tileTone[tone])}>
          <Icon size={18} strokeWidth={2.1} />
        </span>
      )}
      <span className="ml-2.5 min-w-0 flex-1 text-left">
        <span
          className={cn(
            "block truncate text-[15px] font-semibold",
            tone === "danger" ? "text-red-600" : "text-black",
          )}
        >
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-[13px] font-normal text-[#8F8F8F]">
            {description}
          </span>
        )}
      </span>
      {value != null && <span className="mr-2 shrink-0 text-sm text-[#858589]">{value}</span>}
      {trailing ?? (interactive ? <ChevronRight size={18} className="shrink-0 text-[#A3A3A6]" /> : null)}
    </>
  );

  const rowClass = cn(
    "flex min-h-17.5 w-full items-center border-b border-[#D9D9D9] last:border-b-0",
    interactive && "transition-colors active:bg-black/3",
    disabled && "opacity-50",
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={rowClass}>
        {body}
      </Link>
    );
  }
  if (onClick && !disabled) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {body}
      </button>
    );
  }
  return <div className={rowClass}>{body}</div>;
}

/** Compact stat tile used in place of dense admin KPI grids. */
export function MobileStat({
  icon: Icon,
  label,
  value,
  tone = "brand",
}: {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  tone?: RowTone;
}) {
  return (
    <div className="rounded-[10px] bg-white p-3.5">
      {Icon && (
        <span className={cn("mb-2 grid size-7.5 place-items-center rounded-[5px]", tileTone[tone])}>
          <Icon size={17} strokeWidth={2.1} />
        </span>
      )}
      <p className="text-[22px] font-bold leading-tight text-black">{value}</p>
      <p className="mt-0.5 text-[12px] text-[#8F8F8F]">{label}</p>
    </div>
  );
}

/** Page title block. Large on first paint, like a native large-title header. */
export function MobileHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-3 px-1", className)}>
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-black">{title}</h1>
        {subtitle && <p className="mt-1 text-[13px] leading-5 text-[#8F8F8F]">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Full-width primary action, matching the native pill CTA. */
export function MobileButton({
  children,
  onClick,
  href,
  variant = "brand",
  disabled,
  type = "button",
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "brand" | "outline" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const styles = cn(
    "flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold transition",
    variant === "brand" && "bg-[#FFC809] text-black hover:bg-[#f0bb00]",
    variant === "outline" && "border border-zinc-200 bg-white text-black hover:bg-zinc-50",
    variant === "danger" && "border border-red-200 bg-white text-red-600 hover:bg-red-50",
    disabled && "pointer-events-none opacity-50",
    className,
  );
  if (href && !disabled) {
    return (
      <Link href={href} className={styles}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}

/** Centred empty state matching the native signed-out card. */
export function MobileEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-[10px] bg-white px-6 py-12 text-center">
      {Icon && (
        <span className="mb-4 grid size-16 place-items-center rounded-full bg-[#FFF2B8]">
          <Icon size={28} className="text-black" strokeWidth={2} />
        </span>
      )}
      <p className="text-[17px] font-bold text-black">{title}</p>
      {description && <p className="mt-1.5 max-w-xs text-[13px] leading-5 text-[#8F8F8F]">{description}</p>}
      {action && <div className="mt-5 w-full max-w-[240px]">{action}</div>}
    </div>
  );
}
