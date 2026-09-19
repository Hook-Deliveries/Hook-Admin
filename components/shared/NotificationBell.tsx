"use client";

import { Bell, BellOff, Check, ShoppingBag, Package, Wallet, Truck, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/lib/query";
import { apiPatch } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from 'next/navigation';

interface NotificationItem {
  data?: { href?: string; negotiationId?: string };
  id: string;
  title?: string;
  body?: string;
  message?: string;
  type?: string;
  createdAt?: string;
  isRead?: boolean;
}

interface NotificationsResponse {
  data: NotificationItem[];
  unread: number;
  total: number;
}

function relativeTime(value?: string) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-NG", { month: "short", day: "numeric" });
}

function notificationIcon(type?: string) {
  if (!type) return Sparkles;
  if (type.includes("order") || type.includes("assign")) return ShoppingBag;
  if (type.includes("payment") || type.includes("refund")) return Wallet;
  if (type.includes("deliver") || type.includes("shipment") || type.includes("handoff")) return Truck;
  if (type.includes("product") || type.includes("submission") || type.includes("catalog")) return Package;
  return Sparkles;
}


const NOTIFICATIONS_PATH_PREFIX: Record<string, string> = {
  admin: "admin",
  marketassociate: "market-associate",
  partner: "partner",
};

export function NotificationBell({ scope }: { scope: "admin" | "marketassociate" | "partner" }) {
  const router = useRouter();
  const endpoint = `/${NOTIFICATIONS_PATH_PREFIX[scope]}/notifications`;
  const queryKey = scope === "admin" ? (["notifications"] as const) : ([scope, "notifications"] as const);
  const queryClient = useQueryClient();
  const { data } = useApiQuery<NotificationsResponse>(queryKey, endpoint);
  const notifications = data?.data ?? [];
  const unreadCount = data?.unread ?? 0;

  async function markRead(id: string) {
    try {
      await apiPatch(`${endpoint}/${id}/read`, {});
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      /* best-effort */
    }
  }

  async function markAllRead() {
    try {
      await apiPatch(`${endpoint}/read-all`, {});
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      /* best-effort */
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative border-border" aria-label="Notifications">
          <Bell />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-2 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-80 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                {unreadCount} new
              </span>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <BellOff size={20} className="text-zinc-300" />
            <p className="text-sm font-medium text-zinc-500">No new notifications</p>
            <p className="text-xs text-zinc-400">You&apos;re all caught up</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = notificationIcon(notification.type);
            return (
              <button
                key={notification.id}
                type="button"
                onClick={() => {
                  if (!notification.isRead) void markRead(notification.id);
                  if (scope === 'admin' && notification.type === 'negotiation_started' && notification.data?.negotiationId) router.push(`/dashboard/ai-negotiation/${encodeURIComponent(notification.data.negotiationId)}`);
                }}
                className={`flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition ${notification.isRead ? "opacity-60" : "bg-amber-50/60 hover:bg-amber-50"}`}
              >
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-[#FFF3CC]">
                  <Icon size={13} className="text-[#9a7400]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {notification.title ?? notification.message ?? "Notification"}
                  </span>
                  {notification.body && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{notification.body}</span>
                  )}
                  {notification.createdAt && (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{relativeTime(notification.createdAt)}</span>
                  )}
                </span>
                {!notification.isRead && <Check size={13} className="mt-1 shrink-0 text-muted-foreground/40" />}
              </button>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
