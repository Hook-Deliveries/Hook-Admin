"use client";

import { useParams } from "next/navigation";
import { Ticket, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { hasPermission } from "@/lib/permissions";
import {
  couponValueLabel,
  couponWindowLabel,
  formatNaira,
  isExpired,
  type CouponRecord,
  type CouponRedemptionRecord,
} from "./coupon-types";

interface RedemptionPage {
  data: CouponRedemptionRecord[];
  total: number;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function CouponDetailWorkspace() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data: session } = useAdminSession();
  const allowed = hasPermission(session, "coupons.view");

  const coupon = useApiQuery<CouponRecord>(
    ["admin", "coupon", id],
    `/admin/coupons/${id}`,
    Boolean(session && allowed && id),
  );
  const redemptions = useApiQuery<RedemptionPage>(
    ["admin", "coupon", id, "redemptions"],
    `/admin/coupons/${id}/redemptions?limit=50`,
    Boolean(session && allowed && id),
  );

  const rows = redemptions.data?.data || [];

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title={coupon.data?.code || "Coupon"}
        description={coupon.data?.description || "Coupon usage and redemption history."}
      />

      <QueryState
        loading={coupon.isLoading}
        error={coupon.error}
        loadingLabel="Loading coupon"
        errorTitle="Coupon unavailable"
        onRetry={() => coupon.refetch()}
      >
        {coupon.data ? (
          <Card className="rounded-xl shadow-none">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-lg font-semibold text-foreground">{coupon.data.code}</p>
                  <p className="mt-1 text-sm font-medium text-[#8a6900]">{couponValueLabel(coupon.data)}</p>
                </div>
                <StatusBadge status={isExpired(coupon.data) ? "expired" : coupon.data.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-dashed pt-4 md:grid-cols-4">
                <Fact
                  label="Times used"
                  value={`${coupon.data.usedCount}${coupon.data.totalUsageLimit ? ` of ${coupon.data.totalUsageLimit}` : ""}`}
                />
                <Fact label="Per customer" value={String(coupon.data.perUserLimit ?? 1)} />
                <Fact label="Window" value={couponWindowLabel(coupon.data)} />
                <Fact
                  label="Minimum order"
                  value={coupon.data.minSubtotalMinor ? formatNaira(coupon.data.minSubtotalMinor) : "None"}
                />
              </div>
            </CardContent>
          </Card>
        ) : null}
      </QueryState>

      <div>
        <p className="mb-3 text-sm font-medium text-foreground">
          Redemptions
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {redemptions.data?.total ?? 0} total
          </span>
        </p>
        <QueryState
          loading={redemptions.isLoading}
          error={redemptions.error}
          loadingLabel="Loading redemptions"
          errorTitle="Redemptions unavailable"
          empty={!redemptions.isLoading && !redemptions.isError && !rows.length}
          emptyIcon={Users}
          emptyTitle="Not used yet"
          emptyDescription="Nobody has redeemed this coupon so far."
          onRetry={() => redemptions.refetch()}
        >
          <Card className="rounded-xl shadow-none">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Discount</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.publicId || row.id} className="border-b last:border-b-0">
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{row.customer?.name || "Hook customer"}</p>
                          {row.customer?.email ? (
                            <p className="text-xs text-muted-foreground">{row.customer.email}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{row.orderId || "—"}</td>
                        <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                          {formatNaira(row.discountMinor)}
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </QueryState>
      </div>

      {session && !allowed ? (
        <div className="flex min-h-64 items-center justify-center text-center">
          <div>
            <Ticket className="mx-auto size-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Coupon access is restricted for your role.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
