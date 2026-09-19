"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { defaultCollapsedGroups, type NavGroup as HookNavGroup } from "@/components/layout/nav-items";

function isRouteActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// A parent route (/fulfilment) also matches its children (/fulfilment/hub), so
// only the most specific matching item in the group counts as active.
function isItemActive(pathname: string, href: string, siblings: Array<{ href: string }>) {
  return (
    isRouteActive(pathname, href) &&
    !siblings.some((other) => other.href.length > href.length && isRouteActive(pathname, other.href))
  );
}

const STORAGE_KEY = "hook.sidebar.collapsed-groups";

/**
 * Per-browser convenience only, so a throwing or empty read is not an error.
 * Returns null when nothing has been stored yet, which is what lets a group
 * fall back to its `defaultCollapsed` rather than being forced open.
 */
function readCollapsed(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : null;
  } catch {
    return null;
  }
}

function writeCollapsed(labels: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
  } catch {
    // Private windows and blocked site data: the sidebar still works, it just
    // will not remember the choice.
  }
}

export function NavGroup({ label, items, defaultCollapsed }: HookNavGroup) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const hasActiveItem = items.some((item) => isRouteActive(pathname, item.href));

  // Server and first client render must agree, so start from the static
  // default and adopt the stored preference after mount.
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed));

  useEffect(() => {
    const stored = readCollapsed();
    // Once the user has toggled anything, that list is the whole truth: a
    // group in it is closed, one absent from it is open. Before then, the
    // group's own default applies.
    setCollapsed(stored ? stored.includes(label) : Boolean(defaultCollapsed));
  }, [label, defaultCollapsed]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    // Seed from the defaults on the very first toggle, otherwise collapsing
    // one group would spring every default-collapsed group open.
    const stored = (readCollapsed() ?? defaultCollapsedGroups).filter((value) => value !== label);
    writeCollapsed(next ? [...stored, label] : stored);
  }

  // Never hide the section containing the current page, and never collapse
  // when the rail is in icon mode — there is no header to click to reopen it.
  const iconMode = state === "collapsed" && !isMobile;
  const showItems = !collapsed || hasActiveItem || iconMode;

  return (
    <SidebarGroup className="py-1.5">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={showItems}
        className="flex h-7 w-full items-center gap-1 rounded-md px-2 text-[10px] font-semibold uppercase text-muted-foreground/70 transition-colors hover:text-muted-foreground group-data-[collapsible=icon]:hidden"
      >
        <ChevronRight
          size={11}
          className={`shrink-0 transition-transform duration-200 ${showItems ? "rotate-90" : ""}`}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </button>

      {showItems ? (
        <SidebarMenu>
          {items.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(pathname, item.href, items);

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className="h-9 data-[active=true]:bg-zinc-950 data-[active=true]:text-white data-[active=true]:hover:bg-zinc-900 [&[data-active=true]>svg]:text-brand-gold"
                >
                  <Link href={item.href} onClick={() => { if (isMobile) setOpenMobile(false); }}>
                    <Icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
                {item.badge ? <SidebarMenuBadge>{item.badge}</SidebarMenuBadge> : null}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      ) : null}
    </SidebarGroup>
  );
}
