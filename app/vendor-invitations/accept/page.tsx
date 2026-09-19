"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Link2, ShieldCheck } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HookLoader } from "@/components/shared/HookLoader";
import { PublicShell } from "@/components/public/PublicShell";

function VendorInvitationAcceptForm() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function accept(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return setState("error");
    setState("saving");
    try {
      await apiRequest(`/public/vendor-invitations/${encodeURIComponent(token)}/accept`, { method: "POST", body: JSON.stringify({ contactName: contactName.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined }) }, { auth: false, retryOnUnauthorized: false });
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message.replace(/^\d+:\s*/, "") : "This invitation could not be accepted");
      setState("error");
    }
  }

  return (
    <PublicShell
      eyebrow="Supplier profile"
      title="Confirm your Hook supplier profile"
      description="Review the contact details Hook uses to coordinate product sourcing with your Market Associate. This does not create a supplier login."
      width="lg"
      centered
    >
      <Card className="rounded-2xl py-6 shadow-sm">
        <CardHeader className="px-6"><CardTitle className="flex items-center gap-3 text-lg"><span className="grid size-10 place-items-center rounded-xl bg-brand-gold/20"><Link2 className="size-5" /></span>Your contact details</CardTitle></CardHeader>
        <CardContent className="px-6">
          {state === "success" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="size-7" /><h2 className="mt-3 font-semibold">Profile confirmed</h2><p className="mt-1 text-sm leading-6">Your Market supplier record is now marked as consented. Hook will contact you through the details you provided.</p></div>
          ) : (
            <form onSubmit={accept} className="space-y-4">
              <div className="space-y-2"><Label htmlFor="vendor-invite-name">Contact name</Label><Input id="vendor-invite-name" value={contactName} onChange={(event) => setContactName(event.target.value)} placeholder="Your name" /></div>
              <div className="space-y-2"><Label htmlFor="vendor-invite-phone">Phone number</Label><Input id="vendor-invite-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="080..." /></div>
              <div className="space-y-2"><Label htmlFor="vendor-invite-email">Email <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="vendor-invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></div>
              {state === "error" ? <p className="text-sm text-destructive">{message || "This invitation link is missing or invalid."}</p> : null}
              <Button type="submit" variant="brand" size="lg" className="w-full" disabled={state === "saving" || !token}>{state === "saving" ? <HookLoader size="button" /> : <><ShieldCheck className="size-4" /> Confirm supplier details</>}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}

export default function VendorInvitationAcceptPage() {
  return <Suspense fallback={<main className="grid min-h-screen place-items-center bg-muted/30 p-4"><HookLoader label="Loading invitation" /></main>}><VendorInvitationAcceptForm /></Suspense>;
}
