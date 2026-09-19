"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PublicShell } from "@/components/public/PublicShell";

/**
 * A published legal document (terms, privacy, returns) in the public frame.
 * The brand panel carries a contents list built from the document's own
 * headings, so long policies stay navigable.
 */
export function PublicLegalPage({
  title,
  bodyHtml,
  effectiveDate,
}: {
  title: string;
  bodyHtml: string;
  effectiveDate?: string | null;
}) {
  const { html, headings } = useMemo(() => {
    const found: Array<{ id: string; title: string }> = [];
    const withIds = bodyHtml.replace(/<h2>([\s\S]*?)<\/h2>/gi, (_match, inner: string) => {
      const id = `section-${found.length + 1}`;
      found.push({ id, title: inner.replace(/<[^>]+>/g, "").trim() });
      return `<h2 id="${id}">${inner}</h2>`;
    });
    return { html: withIds, headings: found };
  }, [bodyHtml]);

  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  // A section chosen by clicking stays highlighted until the reader scrolls
  // themselves. Without this, a short final section that can never reach the top
  // of the screen would immediately hand the highlight back to the one before it.
  const pinned = useRef<string | null>(null);

  useEffect(() => {
    const sections = headings.map((heading) => document.getElementById(heading.id)).filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinned.current) return;
      // The active section is the first heading still on screen. It stays
      // active until that heading scrolls off the top, then the next takes over.
      const first = sections.find((section) => section.getBoundingClientRect().bottom > 8);
      setActive((first ?? sections[sections.length - 1]).id);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    // Wheel, touch or keys mean the reader took over from a click's smooth scroll.
    const release = () => { pinned.current = null; schedule(); };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("wheel", release, { passive: true });
    window.addEventListener("touchmove", release, { passive: true });
    window.addEventListener("keydown", release);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("wheel", release);
      window.removeEventListener("touchmove", release);
      window.removeEventListener("keydown", release);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headings]);

  // Keep the highlighted entry in view inside the (scrollable) side panel on desktop.
  useEffect(() => {
    if (!active || !window.matchMedia("(min-width: 1024px)").matches) return;
    const link = linkRefs.current[active];
    const panel = link?.closest<HTMLElement>("[data-shell-scroll]");
    if (!link || !panel) return;
    const a = panel.getBoundingClientRect();
    const l = link.getBoundingClientRect();
    if (l.top < a.top + 120 || l.bottom > a.bottom - 140) {
      panel.scrollTo({ top: panel.scrollTop + (l.top - a.top) - a.height / 3, behavior: "smooth" });
    }
  }, [active]);

  const goTo = useCallback((event: React.MouseEvent, id: string) => {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    pinned.current = id;
    setActive(id);
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  }, []);

  const position = headings.findIndex((heading) => heading.id === active) + 1;

  const effective = effectiveDate
    ? new Date(effectiveDate).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <PublicShell
      eyebrow="Legal"
      title={title}
      description={effective ? `Effective ${effective}` : undefined}
      width="3xl"
      aside={
        headings.length > 1 ? (
          <nav aria-label="Contents" className="space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <p>Contents</p>
              <p className="tabular-nums" aria-live="polite">{position || 1} / {headings.length}</p>
            </div>
            <ol className="relative space-y-0.5 border-l border-white/10">
              {headings.map((heading) => {
                const isActive = heading.id === active;
                return (
                  <li key={heading.id}>
                    <a
                      ref={(node) => { linkRefs.current[heading.id] = node; }}
                      href={`#${heading.id}`}
                      aria-current={isActive ? "location" : undefined}
                      onClick={(event) => goTo(event, heading.id)}
                      className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition-colors duration-200 ${
                        isActive
                          ? "border-brand-gold font-medium text-white"
                          : "border-transparent text-zinc-400 hover:border-white/30 hover:text-zinc-200"
                      }`}
                    >
                      {heading.title}
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null
      }
    >
      <article className="rounded-2xl bg-card px-6 py-8 shadow-sm ring-1 ring-foreground/10 sm:px-10 sm:py-10">
        {html ? (
          <div
            className="legal-content space-y-4 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-brand-gold [&_h2]:mb-2 [&_h2]:mt-10 [&_h2]:scroll-mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2:first-child]:mt-0 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">This document has not been published yet.</p>
        )}
      </article>
    </PublicShell>
  );
}
