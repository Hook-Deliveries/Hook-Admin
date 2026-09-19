"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { DetailSection } from "@/components/shared/DetailSection";
import { DefinitionGrid } from "@/components/shared/DefinitionGrid";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QueryState } from "@/components/shared/QueryState";
import { PermissionGuard } from "@/components/auth/PermissionGuard";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/lib/query";
import { apiPost } from "@/lib/api";

interface VendorDetail {
  vendor: Record<string, any>;
  collections?: Array<Record<string, any>>;
  invitations?: Array<{
    publicId?: string;
    status?: string;
    expiresAt?: string;
    emailSentAt?: string;
    acceptedAt?: string;
    createdAt?: string;
  }>;
}

function when(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function VendorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, refetch } = useApiQuery<VendorDetail>(
    ["admin", "market-vendors", id],
    `/admin/market-vendors/${id}`,
  );
  const [inviting, setInviting] = useState(false);
  const vendor = data?.vendor;

  async function sendInvite() {
    setInviting(true);
    try {
      const result = await apiPost<{ inviteUrl?: string; email?: string | null }>(
        `/admin/market-vendors/${id}/invite`,
        {},
      );
      // The vendor may have no email on file, in which case the link is the
      // only way to reach them — surface it rather than claiming it was sent.
      toast.success(
        result?.email
          ? `Invitation sent to ${result.email}`
          : "Invitation created. Share the link with the vendor.",
      );
      await refetch();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message.replace(/^\d+:\s*/, "") : "Could not send the invitation.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title={vendor?.businessName || id}
        description="Supplier profile, onboarding status, and invitation history."
        actions={
          <>
            <PermissionGuard permission="market.vendors.invite">
              <Button type="button" variant="outline" size="sm" disabled={inviting || !vendor} onClick={sendInvite}>
                <Send size={15} /> {inviting ? "Sending..." : "Send invitation"}
              </Button>
            </PermissionGuard>
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard/vendors">
                <ArrowLeft size={15} /> Back to vendors
              </Link>
            </Button>
          </>
        }
      />

      <QueryState
        loading={isLoading}
        error={error}
        empty={!isLoading && !error && !vendor}
        loadingLabel="Loading vendor..."
        errorTitle="This vendor could not be loaded"
        emptyTitle="Vendor not found"
        onRetry={() => refetch()}
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            <DetailSection title="Business" description="How this supplier is identified and reached.">
              <DefinitionGrid
                items={[
                  { label: "Business name", value: vendor?.businessName || "—" },
                  { label: "Status", value: <StatusBadge status={vendor?.status || "pending"} /> },
                  { label: "Contact name", value: vendor?.contactName || "—" },
                  { label: "Preferred channel", value: <span className="capitalize">{vendor?.preferredContactChannel || "—"}</span> },
                  { label: "Phone", value: vendor?.phone || "—" },
                  { label: "Email", value: vendor?.email || "—" },
                  { label: "Address", value: vendor?.address || "—", span: 2 },
                ]}
              />
            </DetailSection>

            <DetailSection
              title="Invitations"
              description="Every onboarding invitation sent to this vendor."
              contentClassName="p-0"
            >
              {data?.invitations?.length ? (
                <div className="divide-y divide-border">
                  {data.invitations.map((invitation, index) => (
                    <div
                      key={invitation.publicId || index}
                      className="flex min-w-0 items-center gap-3 px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {invitation.publicId || "Invitation"}
                          </span>
                          <StatusBadge status={invitation.status || "pending"} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Sent {when(invitation.emailSentAt || invitation.createdAt)} · Expires{" "}
                          {when(invitation.expiresAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">
                  No invitations have been sent to this vendor yet.
                </p>
              )}
            </DetailSection>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <DetailSection title="Payment profile" description="How this vendor is paid.">
              <DefinitionGrid
                columns={1}
                items={[
                  { label: "Method", value: <span className="capitalize">{vendor?.paymentProfile?.method || "cash"}</span> },
                  { label: "Bank", value: vendor?.paymentProfile?.bankName || "—" },
                  { label: "Account name", value: vendor?.paymentProfile?.accountName || "—" },
                  {
                    label: "Account number",
                    value: vendor?.paymentProfile?.accountNumberLast4
                      ? `•••• ${vendor.paymentProfile.accountNumberLast4}`
                      : "—",
                  },
                  {
                    label: "Verification",
                    value: <StatusBadge status={vendor?.paymentProfile?.verificationStatus || "unverified"} />,
                  },
                ]}
              />
            </DetailSection>

            <DetailSection title="Record" description="Onboarding history.">
              <DefinitionGrid
                columns={1}
                items={[
                  { label: "Consent given", value: when(vendor?.consentAt) },
                  { label: "Last contacted", value: when(vendor?.lastContactedAt) },
                  { label: "Added", value: when(vendor?.createdAt) },
                  { label: "Notes", value: vendor?.notes || "—" },
                ]}
              />
            </DetailSection>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
