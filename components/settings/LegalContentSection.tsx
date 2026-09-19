"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HookLoader } from "@/components/shared/HookLoader";
import { QueryState } from "@/components/shared/QueryState";
import { LegalContentView } from "@/components/legal/LegalContentView";
import { apiPatch } from "@/lib/api";
import { useAdminSession, useApiQuery } from "@/lib/query";
import { hasPermission } from "@/lib/permissions";

type LegalContent = {
  type: "terms" | "privacy" | "returns";
  title: string;
  bodyHtml: string;
  version: number;
  effectiveDate: string | null;
  updatedAt: string | null;
};

const DOCUMENTS = [
  { type: "terms" as const, label: "Terms of Service", path: "/terms" },
  { type: "privacy" as const, label: "Privacy Policy", path: "/privacy" },
  { type: "returns" as const, label: "Returns Policy", path: "/returns" },
];

type LegalType = (typeof DOCUMENTS)[number]["type"];

export function LegalContentSection() {
  const session = useAdminSession();
  const canView = hasPermission(session.data, "settings.view");
  const canManage = hasPermission(session.data, "settings.manage");
  const [activeType, setActiveType] = useState<LegalType>("terms");
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const query = useApiQuery<LegalContent>(["admin", "legal", activeType], `/admin/legal/${activeType}`, canView);
  const active = DOCUMENTS.find((doc) => doc.type === activeType)!;

  useEffect(() => {
    if (query.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(query.data.title || "");
      setBodyHtml(query.data.bodyHtml || "");
    }
  }, [query.data]);

  async function save() {
    if (!bodyHtml.trim()) return toast.error("Add content before publishing");
    if (reason.trim().length < 3) return toast.error("Add a short audit reason");
    setSaving(true);
    try {
      await apiPatch(`/admin/legal/${activeType}`, {
        title: title.trim() || active.label,
        bodyHtml: bodyHtml.trim(),
        reason: reason.trim(),
      });
      toast.success(`${active.label} updated`);
      setReason("");
      await query.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : `Could not update ${active.label}`);
    } finally {
      setSaving(false);
    }
  }

  if (!canView) {
    return <QueryState empty emptyTitle="Legal content unavailable" emptyDescription="Your account does not have access to legal content settings." />;
  }

  return (
    <Card className="border-zinc-200 shadow-sm">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="size-5 text-brand-gold" /> Legal content
        </CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Terms of Service, Privacy Policy, and Returns Policy shown to customers at{" "}
          <span className="font-medium text-foreground">/terms</span>,{" "}
          <span className="font-medium text-foreground">/privacy</span>, and{" "}
          <span className="font-medium text-foreground">/returns</span>. Changes apply immediately —
          no redeploy needed.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="w-full space-y-2 sm:w-64">
            <Label htmlFor="legal-document">Document</Label>
            <Select value={activeType} onValueChange={(value) => setActiveType(value as LegalType)}>
              <SelectTrigger id="legal-document" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENTS.map((doc) => (
                  <SelectItem key={doc.type} value={doc.type}>{doc.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            {query.data?.version ? (
              <span className="text-xs text-muted-foreground">
                Version {query.data.version}
                {query.data.updatedAt ? ` · Updated ${new Date(query.data.updatedAt).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}` : ""}
              </span>
            ) : null}
            <Button variant="outline" size="sm" asChild>
              <a href={active.path} target="_blank" rel="noopener noreferrer">
                <ExternalLink /> View live page
              </a>
            </Button>
          </div>
        </div>

        <QueryState loading={query.isLoading} error={query.error} loadingLabel={`Loading ${active.label}`} onRetry={() => void query.refetch()}>
          <div className="space-y-2">
            <Label htmlFor="legal-title">Document title</Label>
            <Input id="legal-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={active.label} disabled={!canManage} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="legal-body">Content (HTML)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview((value) => !value)}>
                {showPreview ? "Edit" : "Preview"}
              </Button>
            </div>
            {showPreview ? (
              <div className="max-h-[520px] overflow-y-auto rounded-lg border bg-white">
                <LegalContentView title={title || active.label} bodyHtml={bodyHtml} />
              </div>
            ) : (
              <Textarea
                id="legal-body"
                value={bodyHtml}
                onChange={(event) => setBodyHtml(event.target.value)}
                placeholder="<h2>1. Section heading</h2><p>Paragraph text...</p>"
                className="min-h-[360px] font-mono text-xs leading-6"
                disabled={!canManage}
              />
            )}
            <p className="text-xs leading-5 text-zinc-500">
              Use plain HTML: <code className="rounded bg-zinc-100 px-1 py-0.5">&lt;h2&gt;</code>,{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5">&lt;p&gt;</code>,{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5">&lt;ul&gt;/&lt;li&gt;</code>, and{" "}
              <code className="rounded bg-zinc-100 px-1 py-0.5">&lt;a&gt;</code> are supported.
            </p>
          </div>

          {canManage ? (
            <>
              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>Publishing increments the document version and updates the effective date shown to customers immediately.</span>
              </div>

              <div className="grid gap-4 rounded-lg border bg-zinc-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="legal-reason">Audit reason</Label>
                  <Input
                    id="legal-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={`Why is the ${active.label} changing?`}
                  />
                </div>
                <Button variant="brand" disabled={saving} onClick={() => void save()}>
                  {saving ? <HookLoader size="button" /> : <><Save /> Publish</>}
                </Button>
              </div>
            </>
          ) : null}
        </QueryState>
      </CardContent>
    </Card>
  );
}
