"use client";

import Link from "next/link";
import { ChevronRight, MapPin, Plus, Store } from "lucide-react";
import { HookLoader } from "@/components/shared/HookLoader";
import { QueryState } from "@/components/shared/QueryState";
import { MobileHeader } from "@/components/mobile/MobileUI";
import { useApiQuery } from "@/lib/query";
import { MarketImage } from "@/components/markets/MarketImage";

type Market = {
  id?: string;
  publicId?: string;
  name: string;
  address?: string;
  imageUrl?: string;
  shortDisplayName?: string;
  status?: string;
  stateId?: string;
};

type MarketsResponse = { markets: Market[]; assignments?: Array<{ marketId: string }> };

function marketId(market: Market) {
  return market.publicId || market.id || "";
}

export function MarketAssociateMarketsWorkspace() {
  const query = useApiQuery<MarketsResponse>(["marketassociate", "markets"], "/market-associate/markets");
  const markets = query.data?.markets || [];

  if (query.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading assigned Markets" />
      </div>
    );

  return (
    <div>
      <MobileHeader
        title="Your markets"
        subtitle="Track suppliers and capture products with the right source."
        action={
          <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#8F8F8F]">
            {markets.length}
          </span>
        }
      />

      <QueryState
        error={query.error}
        errorTitle="Assigned Markets could not load"
        empty={!markets.length}
        emptyIcon={Store}
        emptyTitle="No active Markets assigned"
        emptyDescription="Operations will show a Market here when an active assignment is created."
        onRetry={() => void query.refetch()}
      >
        <div className="space-y-3">
          {markets.map((market) => {
            const id = marketId(market);
            return (
              <div key={id} className="overflow-hidden rounded-[14px] bg-white">
                <Link href={`/market-associate/markets/${id}`} className="block">
                  <div className="relative h-32 bg-muted">
                    <MarketImage src={market.imageUrl} alt={`${market.name} market`} className="size-full" />
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold shadow-sm">
                      Active
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] font-bold text-black">{market.name}</p>
                      <p className="mt-1 flex items-start gap-1.5 text-[13px] leading-5 text-[#8F8F8F]">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span className="truncate">{market.address || "Address pending"}</span>
                      </p>
                    </div>
                    <ChevronRight size={18} className="shrink-0 text-[#A3A3A6]" />
                  </div>
                </Link>
                <Link
                  href={`/market-associate/markets/${marketId(market)}/vendors/new`}
                  className="flex w-full items-center justify-center gap-2 border-t border-[#D9D9D9] py-3.5 text-[14px] font-semibold text-[#9a7400] transition active:bg-black/3"
                >
                  <Plus size={16} /> Onboard a supplier
                </Link>
              </div>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
