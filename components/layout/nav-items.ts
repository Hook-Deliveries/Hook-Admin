import {
  BadgeCheck,
  BarChart3,
  Bot,
  Boxes,
  Building2,
  ClipboardCheck,
  CreditCard,
  Handshake,
  LayoutGrid,
  LifeBuoy,
  MapPinned,
  RotateCcw,
  Settings,
  ScrollText,
  KeyRound,
  ShoppingCart,
  Store,
  Ticket,
  Tags,
  Truck,
  Undo2,
  UserCog,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
} from "lucide-react";
import type { AdminUser } from "@/lib/api";
import {
  hasPermission,
  isSuperAdmin,
  type Permission,
} from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  permission?: Permission;
  superAdminOnly?: boolean;
  badge?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
  /**
   * Collapsed by default. Set on sections that are reference or configuration
   * rather than day-to-day work, so the sidebar opens short and the sections
   * people actually live in stay visible without scrolling.
   */
  defaultCollapsed?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [{ label: "Control Tower", href: "/dashboard", icon: LayoutGrid }],
  },
  {
    label: "Commerce",
    items: [
      {
        label: "Orders",
        href: "/dashboard/orders",
        icon: ShoppingCart,
        permission: "orders.view",
      },
      {
        label: "POD Verification",
        href: "/dashboard/orders/pod",
        icon: BadgeCheck,
        permission: "commerce.pod.review",
      },
      {
        label: "Payments",
        href: "/dashboard/payments",
        icon: CreditCard,
        permission: "commerce.payments.view",
      },
      {
        label: "Coupons",
        href: "/dashboard/coupons",
        icon: Ticket,
        permission: "coupons.view",
      },
    ],
  },
  {
    label: "Catalog",
    items: [
      {
        label: "Product Submissions",
        href: "/dashboard/product-submissions",
        icon: ClipboardCheck,
        permission: "catalog.submission.view",
      },
      {
        label: "Product Inventory",
        href: "/dashboard/products",
        icon: Boxes,
        permission: "products.view",
      },
      {
        label: "Categories",
        href: "/dashboard/categories",
        icon: Tags,
        permission: "categories.view",
      },
      {
        label: "AI Negotiation",
        href: "/dashboard/ai-negotiation",
        icon: Bot,
        permission: "ai_negotiation.view",
      },
    ],
  },
  {
    // Day-to-day fulfilment work, separated from the network of places and
    // people it runs on — those are reference data, not a daily queue.
    label: "Operations",
    items: [
      {
        label: "Fulfilment",
        href: "/dashboard/fulfilment",
        icon: Truck,
        permission: "fulfilment.view",
      },
      {
        // The hub's daily operational queue — receiving, QC, consolidation.
        // Distinct from Network > Dispatch Hubs, which is hub configuration.
        // Auto-scoped: staff attached to a hub see their own hub's work.
        label: "Hub Workspace",
        href: "/dashboard/fulfilment/hub",
        icon: ClipboardCheck,
        permission: "fulfilment.hub.view",
      },
      {
        label: "Shipments",
        href: "/dashboard/fulfilment/shipments",
        icon: Truck,
        permission: "logistics.view",
      },
      {
        label: "Returns",
        href: "/dashboard/fulfilment/returns",
        icon: Undo2,
        permission: "returns.view",
      },
      {
        label: "Refunds",
        href: "/dashboard/fulfilment/refunds",
        icon: RotateCcw,
        permission: "finance.refunds.view",
      },
      {
        label: "Logistics Providers",
        href: "/dashboard/logistics",
        icon: Building2,
        permission: "logistics.view",
      },
    ],
  },
  {
    label: "Network",
    items: [
      {
        label: "Markets",
        href: "/dashboard/markets",
        icon: MapPinned,
        permission: "markets.view",
      },
      {
        label: "Vendors",
        href: "/dashboard/vendors",
        icon: Store,
        permission: "market.vendors.view",
      },
      {
        label: "Dispatch Hubs",
        href: "/dashboard/hubs",
        icon: Warehouse,
        permission: "hubs.view",
      },
      {
        label: "Market Associates",
        href: "/dashboard/market-associates",
        icon: UsersRound,
        permission: "runners.view",
      },
      {
        label: "Hook Partners",
        href: "/dashboard/partners",
        icon: Handshake,
        permission: "partners.view",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Customers",
        href: "/dashboard/customers",
        icon: Users,
        permission: "customers.view",
      },
      {
        label: "Support",
        href: "/dashboard/support",
        icon: LifeBuoy,
        permission: "deletions.view",
      },
      {
        label: "Staff",
        href: "/dashboard/staff",
        icon: UserCog,
        permission: "staff.view",
      },
    ],
  },
  {
    label: "Finance & Insights",
    items: [
      {
        label: "Financials",
        href: "/dashboard/financials",
        icon: Wallet,
        permission: "financials.view",
      },
      {
        label: "Reports",
        href: "/dashboard/reports",
        icon: BarChart3,
        permission: "reports.view",
      },
      {
        label: "Audit Log",
        href: "/dashboard/audit-log",
        icon: ScrollText,
        permission: "audit.view",
      },
    ],
  },
  {
    // Configuration: visited when something needs changing, not every day.
    label: "Configuration",
    defaultCollapsed: true,
    items: [
      {
        label: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
        permission: "settings.view",
      },
      {
        label: "Roles & Permissions",
        href: "/dashboard/roles",
        icon: KeyRound,
        permission: "roles.view",
      },
      {
        label: "Operating States",
        href: "/dashboard/operating-states",
        icon: MapPinned,
        permission: "states.view",
      },
      {
        label: "Delivery States & Fees",
        href: "/dashboard/delivery-states",
        icon: Truck,
        permission: "delivery.coverage.view",
      },
    ],
  },
];

export const navItems = navGroups.flatMap((group) => group.items);

/**
 * Sections closed on a first visit. The sidebar seeds its stored state with
 * these the first time anything is toggled, so collapsing one group does not
 * silently spring the others open.
 */
export const defaultCollapsedGroups = navGroups
  .filter((group) => group.defaultCollapsed)
  .map((group) => group.label);

export function canAccessNavItem(
  item: NavItem,
  user: AdminUser | null | undefined,
) {
  if (item.superAdminOnly) return isSuperAdmin(user);
  if (item.href === "/dashboard/settings" && hasPermission(user, "app_releases.view")) return true;
  if (!item.permission) return Boolean(user);
  return hasPermission(user, item.permission);
}

export function findNavItem(pathname: string) {
  return [...navItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) =>
      item.href === "/dashboard"
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(`${item.href}/`),
    );
}
