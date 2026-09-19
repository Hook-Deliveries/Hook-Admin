import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * One row of a directory list, matching the Orders page.
 *
 * The fulfilment pages each grew their own row markup — different paddings,
 * different separators, some with avatars and some without — so the same kind
 * of record looked different depending which page you opened. This is that
 * design extracted once so every list reads the same.
 *
 * Layout: index · avatar · (title line / meta line) · trailing actions.
 */
export function ListRow({
  index,
  initials,
  title,
  subject,
  meta,
  actions,
  tint,
}: {
  /** 1-based position, shown in the leading gutter. Omit to hide it. */
  index?: number;
  initials?: string;
  title: ReactNode;
  /** Sits after the title, separated by a middot. */
  subject?: ReactNode;
  /** Secondary line. Strings are joined with the house pipe separator. */
  meta?: ReactNode[];
  actions?: ReactNode;
  /** Optional row tint, e.g. to flag a failure that needs a human. */
  tint?: string;
}) {
  return (
    <article
      className={`group flex min-w-0 items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 xl:px-5 ${tint || ""}`}
    >
      {index !== undefined ? (
        <span className="w-6 shrink-0 text-xs font-semibold tabular-nums text-zinc-400">{index}</span>
      ) : null}

      {initials !== undefined ? (
        <Avatar className="size-9 shrink-0">
          <AvatarFallback className="bg-zinc-100 text-xs font-semibold text-zinc-600">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {title}
          {subject ? (
            <>
              <span className="text-zinc-300">·</span>
              <span className="truncate text-sm font-medium text-zinc-700">{subject}</span>
            </>
          ) : null}
        </div>
        {meta?.length ? (
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-zinc-500">
            {meta.filter(Boolean).map((entry, position) => (
              <span key={position} className="flex min-w-0 items-center gap-2">
                {position > 0 ? <span className="text-zinc-300">|</span> : null}
                <span className="truncate">{entry}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </article>
  );
}

/** The card shell every list sits in, matching the Orders page. */
export function ListCard({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-card">
      {children}
    </div>
  );
}

/** Initials for the row avatar. */
export function initialsOf(value?: string) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return `${parts[0][0]}${parts[1]?.[0] || ""}`.toUpperCase();
}
