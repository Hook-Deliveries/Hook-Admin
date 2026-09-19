"use client";

import { useParams } from "next/navigation";
import { MarketAssociateVendorOnboardingPage } from "@/components/market-associate/MarketAssociateVendorOnboardingPage";

export default function NewMarketAssociateVendorPage() {
  const { id } = useParams<{ id: string }>();
  return <MarketAssociateVendorOnboardingPage marketId={id} />;
}
