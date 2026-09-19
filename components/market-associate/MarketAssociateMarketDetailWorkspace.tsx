"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  Landmark,
  Package,
  Plus,
  ReceiptText,
  Search,
  Store,
  UserRound,
} from "lucide-react";
import { HookLoader } from "@/components/shared/HookLoader";
import { QueryState } from "@/components/shared/QueryState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  MobileButton,
  MobileEmpty,
  MobileRow,
  MobileSection,
  MobileStat,
} from "@/components/mobile/MobileUI";
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/query";
import { VendorCollectionSheet } from "@/components/market-associate/VendorCollectionSheet";
import { MarketImage } from "@/components/markets/MarketImage";
import { money } from "@/lib/admin-utils";

type Vendor = {
  id?: string;
  publicId: string;
  businessName: string;
  contactName: string;
  phone: string;
  status: string;
  paymentProfile?: { method?: string; accountNumberLast4?: string | null };
};

type Submission = {
  publicId: string;
  basicTitle: string;
  status: string;
  marketVendorId?: string;
  marketVendorName?: string;
};

type Collection = {
  publicId: string;
  productTitleSnapshot: string;
  quantity: number;
  actualCostMinor: number;
  paymentStatus: string;
  marketVendorName?: string;
  collectedAt?: string;
};

type Detail = {
  market: { publicId?: string; id?: string; name: string; address?: string; imageUrl?: string };
  vendors: Vendor[];
  products: Array<{
    publicId: string;
    title: string;
    status: string;
    availabilityStatus?: string;
    sourceMarketVendorId?: string;
    marketVendorName?: string;
  }>;
  submissions: Submission[];
  collections?: Collection[];
  summary?: {
    vendors: number;
    assignedMarketAssociates: number;
    products: number;
    pendingAvailability: number;
    collections?: number;
  };
};

const label = (value?: string) => String(value || "-").replaceAll("_", " ");

export function MarketAssociateMarketDetailWorkspace({ id }: { id: string }) {
  const query = useApiQuery<Detail>(["marketassociate", "market", id], `/market-associate/markets/${id}`);
  const queryClient = useQueryClient();

  /**
   * Supplier changes also feed the capture form's vendor picker, which reads a
   * separate cache — refetching this view alone would leave that list stale.
   */
  function syncMarket() {
    void queryClient.invalidateQueries({ queryKey: ["marketassociate", "market", id] });
    void queryClient.invalidateQueries({ queryKey: ["marketassociate", "market-vendors"] });
    void queryClient.invalidateQueries({ queryKey: ["marketassociate", "markets"] });
  }
  const [vendorSearch, setVendorSearch] = useState("");
  const [collectionSubmission, setCollectionSubmission] = useState<Submission | null>(null);
  const detail = query.data;

  const vendors = useMemo(() => {
    const all = detail?.vendors || [];
    const term = vendorSearch.trim().toLowerCase();
    if (!term) return all;
    return all.filter((vendor) =>
      [vendor.businessName, vendor.contactName, vendor.phone]
        .filter(Boolean)
        .some((field) => field.toLowerCase().includes(term)),
    );
  }, [detail?.vendors, vendorSearch]);

  if (query.isLoading)
    return (
      <div className="grid min-h-80 place-items-center">
        <HookLoader label="Loading Market operations" />
      </div>
    );
  if (query.isError || !detail)
    return (
      <QueryState
        error={query.error}
        errorTitle="Market operations could not load"
        onRetry={() => void query.refetch()}
      />
    );

  const vendorMap = new Map(detail.vendors.map((vendor) => [vendor.id || vendor.publicId, vendor.businessName]));
  const marketId = detail.market.publicId || detail.market.id || id;

  return (
    <div>
      <Link
        href="/market-associate/markets"
        className="mb-4 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-[#8F8F8F]"
      >
        <ArrowLeft size={15} /> Assigned Markets
      </Link>

      <div className="mb-6 overflow-hidden rounded-[14px] bg-white">
        <div className="relative h-40 bg-muted">
          <MarketImage src={detail.market.imageUrl} alt={`${detail.market.name} market`} className="size-full" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-4 pt-12 text-white">
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/75">Assigned Market</p>
            <h1 className="mt-0.5 text-[20px] font-bold leading-tight">{detail.market.name}</h1>
            <p className="mt-1 text-[13px] text-white/85">{detail.market.address || "Address pending"}</p>
          </div>
        </div>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3">
        <MobileStat icon={UserRound} label="Suppliers" value={detail.summary?.vendors ?? detail.vendors.length} />
        <MobileStat icon={Package} label="Products" value={detail.summary?.products ?? detail.products.length} tone="neutral" />
        <MobileStat icon={Clock3} label="Availability checks" value={detail.summary?.pendingAvailability ?? 0} tone="neutral" />
        <MobileStat icon={CheckCircle2} label="Assignments" value={detail.summary?.assignedMarketAssociates ?? 0} tone="neutral" />
      </div>

      <div className="mb-7">
        <MobileButton href={`/market-associate/markets/${marketId}/vendors/new`}>
          <Plus size={18} /> Onboard a supplier
        </MobileButton>
      </div>

      <MobileSection
        title="Market suppliers"
        action={<span className="text-[13px] text-[#8F8F8F]">{detail.vendors.length}</span>}
      >
        {detail.vendors.length > 4 && (
          <div className="relative py-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A6]" />
            <Input
              value={vendorSearch}
              onChange={(event) => setVendorSearch(event.target.value)}
              placeholder="Search suppliers"
              className="h-11 rounded-[10px] pl-9"
            />
          </div>
        )}
        {vendors.length ? (
          vendors.map((vendor) => (
            <MobileRow
              key={vendor.publicId}
              icon={vendor.paymentProfile?.method === "bank_transfer" ? Landmark : Banknote}
              label={vendor.businessName}
              description={`${vendor.contactName} · ${vendor.phone}`}
              href={`/market-associate/vendors/${vendor.publicId}`}
              value={<StatusBadge status={vendor.status} />}
            />
          ))
        ) : (
          <div className="py-2">
            <MobileEmpty
              icon={Store}
              title={vendorSearch ? "No matching suppliers" : "No suppliers yet"}
              description={
                vendorSearch
                  ? "Try a different name or phone number."
                  : "Onboard a supplier so you can link the products you collect from them."
              }
            />
          </div>
        )}
      </MobileSection>

      <MobileSection
        title="Captured products"
        action={
          <Link href="/market-associate/submissions/new" className="text-[13px] font-semibold text-[#9a7400]">
            New
          </Link>
        }
      >
        {detail.products.length ? (
          detail.products.map((product) => (
            <MobileRow
              key={product.publicId}
              icon={Package}
              tone="neutral"
              label={product.title}
              description={`From ${product.marketVendorName || vendorMap.get(product.sourceMarketVendorId || "") || "unlinked supplier"}`}
              value={<StatusBadge status={product.availabilityStatus || product.status} />}
            />
          ))
        ) : (
          <div className="py-2">
            <MobileEmpty icon={Package} title="No products captured" description="Products you capture from this Market appear here." />
          </div>
        )}
      </MobileSection>

      <MobileSection title="Recent submissions">
        {detail.submissions.length ? (
          detail.submissions.map((submission) => (
            <MobileRow
              key={submission.publicId}
              icon={ReceiptText}
              tone="neutral"
              label={submission.basicTitle}
              description={`Supplier: ${submission.marketVendorName || vendorMap.get(submission.marketVendorId || "") || "Not linked"}`}
              href={`/market-associate/submissions/${submission.publicId}`}
              value={
                submission.marketVendorId ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      setCollectionSubmission(submission);
                    }}
                    className="rounded-full bg-[#FFF3C4] px-2.5 py-1 text-[11px] font-semibold text-[#9a7400]"
                  >
                    Record
                  </button>
                ) : (
                  <StatusBadge status={submission.status} />
                )
              }
            />
          ))
        ) : (
          <div className="py-2">
            <MobileEmpty icon={ReceiptText} title="No submissions yet" description="Your captures for this Market appear here." />
          </div>
        )}
      </MobileSection>

      <MobileSection
        title="Supplier collections"
        action={<span className="text-[13px] text-[#8F8F8F]">{detail.summary?.collections ?? detail.collections?.length ?? 0}</span>}
      >
        {detail.collections?.length ? (
          detail.collections.map((collection) => (
            <MobileRow
              key={collection.publicId}
              icon={Banknote}
              tone="neutral"
              label={collection.productTitleSnapshot}
              description={`${collection.marketVendorName || "Supplier"} · Qty ${collection.quantity} · ${label(collection.paymentStatus)}`}
              value={money(collection.actualCostMinor)}
            />
          ))
        ) : (
          <div className="py-2">
            <MobileEmpty icon={Banknote} title="No collections recorded" description="Record what you pay suppliers to keep procurement reconciled." />
          </div>
        )}
      </MobileSection>

      <VendorCollectionSheet
        key={collectionSubmission?.publicId || "collection-closed"}
        submission={collectionSubmission}
        open={Boolean(collectionSubmission)}
        onClose={() => setCollectionSubmission(null)}
        onSuccess={syncMarket}
      />
    </div>
  );
}
