"use client";

import Link from "next/link";
import {
  Camera,
  ClipboardCheck,
  ClipboardList,
  MapPinned,
  PackageCheck,
  RotateCcw,
  Store,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { HookLoader } from "@/components/shared/HookLoader";
import {
  MobileEmpty,
  MobileRow,
  MobileSection,
  MobileStat,
} from "@/components/mobile/MobileUI";
import { useApiQuery } from "@/lib/query";

interface Dashboard {
  assignedMarkets: number;
  drafts: number;
  submitted: number;
  changesRequested: number;
  approved: number;
  availabilityChecksDue: number;
  recentPublished: Array<{ publicId: string; title: string; publishedAt: string }>;
}

interface FulfilmentRow {
  publicId?: string;
  id?: string;
  status?: string;
  orderId?: string;
  orderPublicId?: string;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function MarketAssociateDashboardPage() {
  const query = useApiQuery<Dashboard>(["marketassociate", "catalog-dashboard"], "/market-associate/dashboard");
  const tasks = useApiQuery<{ data: FulfilmentRow[]; total: number }>(
    ["marketassociate", "fulfilments", { limit: 5 }],
    "/market-associate/fulfilments?limit=5",
  );

  if (query.isLoading) {
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading your dashboard" />
      </div>
    );
  }
  if (query.isError || !query.data) {
    return <p className="text-sm text-destructive">Your Market Associate dashboard could not be loaded.</p>;
  }

  const data = query.data;
  const openTasks = tasks.data?.data || [];

  return (
    <div>
      <div className="mb-6 px-1">
        <p className="text-[13px] text-[#8F8F8F]">{greeting()} 👋</p>
        <h1 className="mt-0.5 text-[22px] font-bold leading-tight text-black">Today&apos;s work</h1>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3">
        <MobileStat icon={MapPinned} label="Assigned markets" value={data.assignedMarkets} />
        <MobileStat icon={ClipboardList} label="Drafts" value={data.drafts} tone="neutral" />
        <MobileStat icon={PackageCheck} label="In review" value={data.submitted} tone="neutral" />
        <MobileStat
          icon={RotateCcw}
          label="Changes requested"
          value={data.changesRequested}
          tone={data.changesRequested > 0 ? "danger" : "neutral"}
        />
      </div>

      {(data.changesRequested > 0 || data.availabilityChecksDue > 0) && (
        <MobileSection>
          {data.changesRequested > 0 && (
            <MobileRow
              icon={TriangleAlert}
              tone="danger"
              label={`${data.changesRequested} submission${data.changesRequested === 1 ? "" : "s"} need changes`}
              description="Catalog Review sent these back to you"
              href="/market-associate/submissions"
            />
          )}
          {data.availabilityChecksDue > 0 && (
            <MobileRow
              icon={ClipboardCheck}
              tone="danger"
              label={`${data.availabilityChecksDue} product${data.availabilityChecksDue === 1 ? "" : "s"} need an availability check`}
              description="Confirm or pause products flagged for review"
              href="/market-associate/availability"
            />
          )}
        </MobileSection>
      )}

      <MobileSection title="Quick actions">
        <MobileRow icon={Camera} label="Capture a product" description="Add a new product from your market" href="/market-associate/submissions/new" />
        <MobileRow icon={UserPlus} label="Onboard a vendor" description="Invite a new supplier to one of your markets" href="/market-associate/markets" />
        <MobileRow
          icon={ClipboardCheck}
          label="Availability checks"
          description="Confirm or pause products flagged for review"
          href="/market-associate/availability"
          value={data.availabilityChecksDue > 0 ? data.availabilityChecksDue : undefined}
        />
        <MobileRow icon={Store} label="Assigned markets" description="Vendors, products, and collections" href="/market-associate/markets" />
      </MobileSection>

      <MobileSection
        title="Your task queue"
        action={
          <Link href="/market-associate/fulfilments" className="text-[13px] font-semibold text-[#9a7400]">
            View all
          </Link>
        }
      >
        {tasks.isLoading ? (
          <div className="py-6">
            <HookLoader size="inline" />
          </div>
        ) : openTasks.length ? (
          openTasks.map((task) => (
            <MobileRow
              key={task.publicId || task.id}
              icon={PackageCheck}
              label={task.publicId || task.id || "Task"}
              description={`Order ${task.orderPublicId || task.orderId || "-"}`}
              value={<span className="capitalize">{String(task.status || "").replaceAll("_", " ").toLowerCase()}</span>}
              href={`/market-associate/fulfilments/${task.publicId || task.id}`}
            />
          ))
        ) : (
          <MobileRow icon={PackageCheck} tone="neutral" label="No tasks assigned" description="New orders will appear here" />
        )}
      </MobileSection>

      <MobileSection title="Recently published">
        {data.recentPublished.length ? (
          data.recentPublished.map((item) => (
            <MobileRow
              key={item.publicId}
              icon={PackageCheck}
              label={item.title}
              description={item.publicId}
              tone="neutral"
            />
          ))
        ) : (
          <div className="py-2">
            <MobileEmpty
              icon={PackageCheck}
              title="Nothing published yet"
              description="Approved products appear here once Commercial publishes them."
            />
          </div>
        )}
      </MobileSection>
    </div>
  );
}
