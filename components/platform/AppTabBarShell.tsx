"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Home,
  Camera,
  Package,
  Store,
  User,
  LayoutDashboard,
  Search,
  ShoppingCart,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { HookLogo } from "@/components/shared/HookLogo";
import { HookLoader } from "@/components/shared/HookLoader";
import { NotificationBell } from "@/components/shared/NotificationBell";
import { MessagesBell } from "@/components/partner/MessagesBell";
import { ShoppingForIndicator } from "@/components/partner/ShoppingForIndicator";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useApiQuery, useLogout } from "@/lib/query";
import { PortalGuard } from "@/components/platform/PortalGuard";
import { ServiceWorkerRegistration } from "@/components/platform/ServiceWorkerRegistration";
import { InstallPrompt } from "@/components/platform/InstallPrompt";
import { PullToRefresh } from "@/components/platform/PullToRefresh";
import { ChangesRequestedBanner, type WorkflowAlert } from "@/components/market-associate/ChangesRequestedBanner";
import { FulfilmentHeaderAction } from "@/components/market-associate/FulfilmentHeaderAction";
import { APP_TAB_BAR_CONTENT_INSET, APP_TAB_BAR_HEIGHT, APP_TAB_BAR_BOTTOM_GAP } from "@/lib/tab-bar-layout";

type PortalType = "marketassociate" | "partner";

// The account-type discriminator ("marketassociate") no longer matches the
// URL prefix ("/market-associate") after the portal rename — keep them
// mapped separately rather than assuming `/${type}`. Exported so other
// portal-page components (e.g. ProfileWorkspace) build the same, correct
// page links.
export const PORTAL_BASE_PATH: Record<PortalType, string> = {
  marketassociate: "/market-associate",
  partner: "/partner",
};

type TabConfig = {
  label: string;
  icon: LucideIcon;
  href: string;
  match?: (pathname: string) => boolean;
};

interface DashboardAlertSummary {
  changesRequested: number;
  availabilityChecksDue: number;
}

type ActiveFulfilment = {
  id?: string;
  publicId?: string;
  status?: string;
  previewImage?: string;
  previewTitle?: string;
};

type AvailabilityCheck = {
  publicId?: string;
  title?: string;
  images?: string[];
};

const marketAssociateTabs: TabConfig[] = [
  { label: "Home", icon: Home, href: "/market-associate/dashboard" },
  { label: "Capture", icon: Camera, href: "/market-associate/submissions" },
  { label: "Orders", icon: Package, href: "/market-associate/fulfilments" },
  {
    label: "Activity",
    icon: Store,
    href: "/market-associate/markets",
    match: (pathname) => pathname.startsWith("/market-associate/markets") || pathname.startsWith("/market-associate/availability"),
  },
  {
    label: "Profile",
    icon: User,
    href: "/market-associate/profile",
    match: (pathname) => pathname.startsWith("/market-associate/profile") || pathname.startsWith("/market-associate/security"),
  },
];

const partnerTabs: TabConfig[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/partner/dashboard" },
  { label: "Browse", icon: Search, href: "/partner/browse" },
  { label: "Basket", icon: ShoppingCart, href: "/partner/basket" },
  { label: "Orders", icon: Package, href: "/partner/orders" },
  {
    label: "Profile",
    icon: User,
    href: "/partner/profile",
    match: (pathname) =>
      pathname.startsWith("/partner/profile")
      || pathname.startsWith("/partner/security")
      || pathname.startsWith("/partner/location")
      || pathname.startsWith("/partner/customers")
      || pathname.startsWith("/partner/fulfilment"),
  },
];

function isTabActive(tab: TabConfig, pathname: string) {
  if (tab.match) return tab.match(pathname);
  return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
}

export function AppTabBarShell({
  type,
  children,
}: {
  type: PortalType;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();
  const base = PORTAL_BASE_PATH[type];

  // Shared with the dashboard page's own fetch of the same endpoint — same
  // query key, so React Query dedupes the request instead of firing twice.
  const alerts = useApiQuery<DashboardAlertSummary>(
    ["marketassociate", "catalog-dashboard"],
    "/market-associate/dashboard",
    type === "marketassociate",
  );
  const changesRequested = type === "marketassociate" ? alerts.data?.changesRequested || 0 : 0;
  // The dashboard summary's own availabilityChecksDue count can drift from
  // reality (assignment/ownership scoping computed separately) — the
  // Availability page's own list endpoint is the source of truth for "is
  // there anything to check right now", so the banner counts its rows
  // directly instead of trusting a second, independently-derived number.
  // This is the one thing on the whole portal that should never sit on a
  // stale 30s cache: it drives whether the alert banner shows at all, so it
  // always refetches on mount/focus/reconnect rather than trusting a cached
  // "0" from before a check existed.
  const availabilityChecks = useApiQuery<AvailabilityCheck[]>(
    ["marketassociate", "availability-checks"],
    "/market-associate/availability-checks",
    type === "marketassociate",
    { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchOnReconnect: true },
  );
  const availabilityChecksDue = type === "marketassociate" ? availabilityChecks.data?.length || 0 : 0;
  const activeFulfilments = useApiQuery<{ data: ActiveFulfilment[]; total: number }>(
    ["marketassociate", "fulfilments", { active: true, limit: 100 }],
    "/market-associate/fulfilments?active=true&limit=100",
    type === "marketassociate",
    { staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true, refetchOnReconnect: true },
  );
  const fulfilments = type === "marketassociate" ? activeFulfilments.data?.data || [] : [];
  const fulfilmentCount = type === "marketassociate"
    ? activeFulfilments.data?.total ?? fulfilments.length
    : 0;
  const oldestFulfilment = fulfilments[0];
  const hasBlockedFulfilment = fulfilments.some((task) => task.status === "BLOCKED");
  const oldestCheck = availabilityChecks.data?.[0];
  const dashboardAlerts: WorkflowAlert[] = [];
  if (changesRequested > 0) {
    dashboardAlerts.push({
      id: "changes-requested",
      kind: "changes",
      tone: "danger",
      count: changesRequested,
      href: "/market-associate/submissions",
      message: `${changesRequested} submission${changesRequested === 1 ? "" : "s"} need${changesRequested === 1 ? "s" : ""} changes — tap to review and resubmit`,
    });
  }
  if (availabilityChecksDue > 0) {
    dashboardAlerts.push({
      id: "availability-checks",
      kind: "availability",
      tone: "brand",
      count: availabilityChecksDue,
      href: "/market-associate/availability",
      message: `${availabilityChecksDue} availability check${availabilityChecksDue === 1 ? "" : "s"} waiting`,
      detail: oldestCheck?.title || "Confirm current product availability",
      imageUrl: oldestCheck?.images?.[0],
      imageAlt: oldestCheck?.title ? `${oldestCheck.title} product` : "Product awaiting availability check",
    });
  }

  if (pathname === `${base}/activate`) return <>{children}</>;

  /**
   * A negotiation is a focused, full-screen conversation — like a chat detail
   * screen on mobile, it shouldn't compete with a bottom tab bar for space.
   * Header stays (for logout/back-navigation context) but the tabs don't.
   */
  const isNegotiationDetail = type === "partner" && /^\/partner\/messages\/[^/]+$/.test(pathname);

  function handleLogout() {
    logout.mutate(undefined, {
      onSettled: () => router.replace("/auth/login"),
    });
  }

  const tabs = type === "marketassociate" ? marketAssociateTabs : partnerTabs;
  const portalLabel = type === "marketassociate" ? "Market Associate" : "Partner";

  return (
    <PortalGuard type={type}>
      {/* Scoped to this portal's own path (e.g. /market-associate/) — Admin
          never renders AppTabBarShell and is outside every registered
          scope, so it never gets a controlling service worker or an
          install prompt, even after visiting this portal in the same
          browser. */}
      <ServiceWorkerRegistration scope={`${base}/`} />
      <InstallPrompt />
      <div className="min-h-screen min-h-dvh bg-[#F5F5F5]">
        {/* Header shares the page background so the app reads as one continuous surface. */}
        <header
          className="sticky top-0 z-40 bg-[#F5F5F5]/90 backdrop-blur"
          style={{ paddingTop: "var(--safe-top)" }}
        >
          <div className="mx-auto flex h-16 w-full max-w-2xl items-center justify-between gap-3 px-5">
            <div className="flex min-w-0 items-center gap-3">
              <HookLogo className="shrink-0 text-xl" />
              {type === "partner" && <ShoppingForIndicator />}
            </div>
            {type === "marketassociate" && fulfilmentCount > 0 && (
              <div className="min-w-0 flex-1">
                <FulfilmentHeaderAction
                  count={fulfilmentCount}
                  blocked={hasBlockedFulfilment}
                  href={fulfilmentCount === 1 && oldestFulfilment
                    ? `/market-associate/fulfilments/${oldestFulfilment.publicId || oldestFulfilment.id}`
                    : "/market-associate/fulfilments"}
                  title={oldestFulfilment?.previewTitle || oldestFulfilment?.publicId || oldestFulfilment?.id}
                  imageUrl={oldestFulfilment?.previewImage}
                />
              </div>
            )}
            <div className="flex shrink-0 items-center gap-1">
              {type === "marketassociate" && dashboardAlerts.length > 0 && (
                <ChangesRequestedBanner alerts={dashboardAlerts} />
              )}
              {type === "partner" && <MessagesBell />}
              <NotificationBell scope={type} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" title="Log out">
                    <LogOut />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="max-w-sm">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Log out of Hook?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Your {portalLabel} session will be ended on this device. You can sign
                      in again whenever you need access.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleLogout}
                      disabled={logout.isPending}
                      className="bg-zinc-950 text-white hover:bg-zinc-800"
                    >
                      {logout.isPending ? <HookLoader size="button" variant="yellow" /> : "Log out"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </header>

        <PullToRefresh queryKeyPrefix={[type === "marketassociate" ? "marketassociate" : "partner"]}>
          <main
            className="mx-auto w-full max-w-2xl px-5 pt-2"
            style={{
              paddingBottom: isNegotiationDetail
                ? "calc(24px + var(--safe-bottom))"
                : `calc(${APP_TAB_BAR_CONTENT_INSET}px + var(--safe-bottom))`,
            }}
          >
            {children}
          </main>
        </PullToRefresh>

        {!isNegotiationDetail && (
          <nav
            aria-label={`${portalLabel} navigation`}
            className="fixed inset-x-0 z-50 flex justify-center px-3"
            style={{ bottom: `calc(${APP_TAB_BAR_BOTTOM_GAP}px + var(--safe-bottom))` }}
          >
            <div
              className="relative flex w-full max-w-lg items-center gap-1 rounded-[31px] border border-black/5 bg-white px-1 shadow-[0_3px_14px_rgba(0,0,0,0.16)]"
              style={{ height: APP_TAB_BAR_HEIGHT }}
            >
              {tabs.map((tab) => {
                const active = isTabActive(tab, pathname);
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className="relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
                  >
                    {active && (
                      <motion.div
                        layoutId={`${type}-tab-pill`}
                        className="absolute inset-1 -z-10 rounded-[25px] bg-[#FFC809]"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      />
                    )}
                    <Icon
                      size={20}
                      strokeWidth={active ? 2.4 : 2}
                      className={active ? "text-black" : "text-[#B2B2B5]"}
                    />
                    <span
                      className={`text-[10px] font-semibold ${active ? "text-black" : "text-[#B2B2B5]"}`}
                    >
                      {tab.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </PortalGuard>
  );
}
