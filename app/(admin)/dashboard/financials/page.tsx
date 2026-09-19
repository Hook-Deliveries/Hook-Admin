"use client";

import { useState } from "react";
import {
  TrendingUp,
  Wallet,
  Banknote,
  Clock,
  Search,
  Filter,
  Calendar,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { Input } from "@/components/ui/input";
import { TransactionTable } from "@/components/financials/TransactionTable";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/lib/query";
import { SuperAdminGuard } from "@/components/auth/PermissionGuard";
import { money } from "@/lib/admin-utils";
import { HookLoader } from "@/components/shared/HookLoader";

const TIME_TABS = ["24H", "7D", "30D", "YTD"];

interface FinancialsSummary {
  grossVolume: number;
  platformRevenue: number;
  escrowBalance: number;
  pendingPayouts: number;
  recentPayments: unknown[];
  recentSettlements: unknown[];
  trend: Array<{ label: string; volume: number; revenue: number }>;
}

export default function FinancialsPage() {
  const [activeTime, setActiveTime] = useState("7D");
  const { data, isLoading, error } = useApiQuery<FinancialsSummary>(["admin", "financials", activeTime], `/admin/financials?period=${activeTime.toLowerCase()}`);
  const trend = data?.trend || [];
  const trendMax = Math.max(1, ...trend.flatMap((row) => [row.volume, row.revenue]));

  const kpis = {
    grossVolume: data?.grossVolume ?? 0,
    escrowBalance: data?.escrowBalance ?? 0,
    platformRevenue: data?.platformRevenue ?? 0,
    pendingPayouts: data?.pendingPayouts ?? 0,
  };

  const errorMessage = error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "";

  return (
    <div className="w-full space-y-5 px-4 py-5">
      <PageHeader
        title="Financial Controls"
        description="Monitor platform revenue, refunds, payment reconciliation, and legacy settlement balances."
        actions={
          <>
            <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
              {TIME_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTime(tab)}
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-sm",
                    activeTime === tab
                      ? "border border-zinc-200 bg-white text-zinc-900 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-900",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-2">
              <Calendar size={16} className="text-zinc-500" /> Select range
            </Button>
            <SuperAdminGuard>
              <Button variant="brand" size="sm" className="flex items-center gap-2">
                <Download size={18} /> <span className="hidden sm:inline">Export Statement</span>
              </Button>
            </SuperAdminGuard>
          </>
        }
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorMessage}
        </div>
      )}

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          <div className="col-span-2 rounded-xl border border-border bg-card py-8 lg:col-span-4">
            <HookLoader size="page" label="Loading financial stats..." />
          </div>
        ) : (
          <>
            <KpiCard icon={TrendingUp} tone="green" label="Total Processed Vol." value={money(kpis.grossVolume)} caption="Gross payment volume" />
            <KpiCard icon={Wallet} tone="blue" label="Escrow Balance" value={money(kpis.escrowBalance)} caption="Pending release" />
            <KpiCard icon={Banknote} tone="amber" label="Platform Revenue" value={money(kpis.platformRevenue)} caption="After commissions" />
            <KpiCard icon={Clock} tone="red" label="Legacy Liabilities" value={money(kpis.pendingPayouts)} caption="Historical balances pending review" />
          </>
        )}
      </div>

      {/* Main Layout Area */}
      <div className="flex flex-col gap-4 lg:flex-row lg:h-125">
        {/* Left Column: Chart */}
        <Card className="flex flex-col border-zinc-200 p-4 shadow-card sm:p-6 lg:w-[55%]">
          <div className="mb-5 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-bold text-zinc-900">Volume & Revenue Analysis</h3>
              <p className="text-sm text-zinc-500">Transaction volume vs Platform revenue over time</p>
            </div>
            <div className="flex items-center gap-4 text-sm font-medium text-zinc-600">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-800" /> Volume
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-gold" /> Revenue
              </div>
            </div>
          </div>

          <div className="flex min-h-50 flex-1 items-end gap-2 overflow-x-auto border-b border-zinc-200 px-1 pt-6">
            {!isLoading && trend.length === 0 && <div className="m-auto text-center"><p className="font-medium text-zinc-700">No settled payment activity</p><p className="mt-1 text-sm text-zinc-500">Verified Paystack transactions for this period will appear here.</p></div>}
            {trend.map((row) => <div key={row.label} className="flex h-full min-w-12 flex-1 flex-col justify-end gap-1 text-center" title={`${row.label}: ${money(row.volume)} volume, ${money(row.revenue)} revenue`}>
              <div className="mx-auto flex h-[85%] items-end gap-1">
                <div className="w-3 rounded-t bg-zinc-800" style={{ height: `${Math.max(3, row.volume / trendMax * 100)}%` }} />
                <div className="w-3 rounded-t bg-brand-gold" style={{ height: `${Math.max(3, row.revenue / trendMax * 100)}%` }} />
              </div>
              <span className="truncate pb-2 text-[10px] text-zinc-500">{row.label}</span>
            </div>)}
          </div>
        </Card>

        {/* Right Column: Transactions List */}
        <Card className="flex flex-1 flex-col overflow-hidden border-zinc-200 p-4 shadow-card sm:p-6">
          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <h3 className="text-base font-bold text-zinc-900">Recent Payouts & Transfers</h3>
            <button className="text-sm font-semibold text-amber-600 hover:underline">View All</button>
          </div>

          <div className="mb-4 flex gap-2 sm:mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <Input type="text" placeholder="Search transactions..." className="pl-9" />
            </div>
            <Button variant="outline" size="sm" className="p-2">
              <Filter size={18} />
            </Button>
          </div>

          <div className="overflow-x-auto">
            <TransactionTable />
          </div>
        </Card>
      </div>
    </div>
  );
}
