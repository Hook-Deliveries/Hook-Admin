"use client";

import { PublicLegalPage } from "@/components/public/PublicLegalPage";
import { HookLoader } from "@/components/shared/HookLoader";
import { useApiQuery } from "@/lib/query";

type LegalContent = {
  type: "terms" | "privacy";
  title: string;
  bodyHtml: string;
  effectiveDate: string | null;
};

export default function TermsPage() {
  const query = useApiQuery<LegalContent>(["public", "legal", "terms"], "/public/legal/terms");

  if (query.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-muted/30"><HookLoader label="Loading Terms of Service" /></div>;
  }

  return (
    <PublicLegalPage
      title={query.data?.title || "Terms of Service"}
      effectiveDate={query.data?.effectiveDate}
      bodyHtml={query.data?.bodyHtml || ""}
    />
  );
}
