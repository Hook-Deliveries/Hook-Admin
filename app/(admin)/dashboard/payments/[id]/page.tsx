"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { DetailSection } from "@/components/shared/DetailSection";
import { DefinitionGrid } from "@/components/shared/DefinitionGrid";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { QueryState } from "@/components/shared/QueryState";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/lib/query";
import { moneyMinor } from "@/components/payments/PaymentsTable";

interface PaymentAttempt {
  publicId?: string;
  provider?: string;
  status?: string;
  amountMinor?: number;
  reference?: string;
  failureReason?: string;
  createdAt?: string;
}

interface PaymentDetail {
  payment: Record<string, any>;
  order?: { id: string; reference: string; status?: string; totalMinor?: number; currency?: string; createdAt?: string };
  customer?: { name?: string; email?: string; phone?: string };
  attempts?: PaymentAttempt[];
  timeline?: Array<Record<string, any>>;
}

function when(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : parsed.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });
}

export default function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error, refetch } = useApiQuery<PaymentDetail>(
    ["admin", "commerce", "payments", id],
    `/admin/commerce/payments/${id}`,
  );

  const payment = data?.payment;
  const status = payment?.commerceStatus || payment?.status || "pending";

  return (
    <div className="w-full min-w-0 space-y-5 px-4 py-5">
      <PageHeader
        className="mb-0"
        title={payment?.publicId || id}
        description="Payment record, customer, and every provider attempt."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/payments">
              <ArrowLeft size={15} /> Back to payments
            </Link>
          </Button>
        }
      />

      <QueryState
        loading={isLoading}
        error={error}
        empty={!isLoading && !error && !payment}
        loadingLabel="Loading payment..."
        errorTitle="This payment could not be loaded"
        emptyTitle="Payment not found"
        onRetry={() => refetch()}
      >
        <div className="grid min-w-0 gap-4 xl:grid-cols-3">
          <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
            <DetailSection title="Payment" description="What was charged and how.">
              <DefinitionGrid
                items={[
                  { label: "Reference", value: payment?.reference || payment?.publicId || "—" },
                  { label: "Status", value: <StatusBadge status={status} /> },
                  { label: "Amount", value: moneyMinor(payment?.amountMinor, payment?.currency) },
                  { label: "Provider", value: <span className="capitalize">{payment?.gateway || "—"}</span> },
                  { label: "Method", value: <span className="capitalize">{payment?.paymentMethod || "—"}</span> },
                  { label: "Paid at", value: when(payment?.paidAt) },
                  { label: "Created", value: when(payment?.createdAt) },
                ]}
              />
            </DetailSection>

            <DetailSection
              title="Provider attempts"
              description="Each time the customer tried to pay, in order."
              contentClassName="p-0"
            >
              {data?.attempts?.length ? (
                <div className="divide-y divide-border">
                  {data.attempts.map((attempt, index) => (
                    <div
                      key={attempt.publicId || `${attempt.reference}-${index}`}
                      className="flex min-w-0 items-center gap-3 px-4 py-3"
                    >
                      <span className="w-5 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="truncate text-sm font-medium capitalize">
                            {attempt.provider || "—"}
                          </span>
                          <StatusBadge status={attempt.status || "pending"} />
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {attempt.reference || "No reference"}
                          {attempt.failureReason ? ` · ${attempt.failureReason}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {when(attempt.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-muted-foreground">No provider attempts recorded.</p>
              )}
            </DetailSection>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <DetailSection title="Customer" description="Who this payment is from.">
              <DefinitionGrid
                columns={1}
                items={[
                  { label: "Name", value: data?.customer?.name || "—" },
                  { label: "Email", value: data?.customer?.email || "—" },
                  { label: "Phone", value: data?.customer?.phone || "—" },
                ]}
              />
            </DetailSection>

            <DetailSection
              title="Order"
              description="What this payment was for."
              action={
                data?.order ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/orders/${data.order.id}`}>
                      <ExternalLink size={14} /> Open
                    </Link>
                  </Button>
                ) : undefined
              }
            >
              {data?.order ? (
                <DefinitionGrid
                  columns={1}
                  items={[
                    { label: "Reference", value: data.order.reference },
                    { label: "Status", value: <StatusBadge status={data.order.status || "pending"} /> },
                    { label: "Order total", value: moneyMinor(data.order.totalMinor, data.order.currency) },
                    { label: "Placed", value: when(data.order.createdAt) },
                  ]}
                />
              ) : (
                <p className="text-sm text-muted-foreground">This payment is not linked to an order.</p>
              )}
            </DetailSection>
          </div>
        </div>
      </QueryState>
    </div>
  );
}
