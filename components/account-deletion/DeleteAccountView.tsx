"use client";

import { useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, LoaderCircle, MailCheck, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PublicShell } from "@/components/public/PublicShell";
import { emptyProof, ProofFields, proofReady, toProof, type ProofState } from "@/components/account-deletion/ProofFields";
import { accountDeletionApi, type DeletionError, type DeletionView } from "@/lib/public-account-deletion-api";

const COOLING_OFF_DAYS = 14;

const formatDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" }) : "";

function ErrorNotice({ error }: { error: DeletionError }) {
  const blocked = error.code === "ACCOUNT_DELETION_BLOCKED";
  const orders = error.details?.orders || [];
  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{blocked ? "We can't delete your account yet" : "We couldn't continue"}</AlertTitle>
      <AlertDescription>
        <p>{error.message}</p>
        {blocked && orders.length ? <p className="mt-1 font-medium">In progress: {orders.slice(0, 5).join(", ")}</p> : null}
        {error.code === "INVALID_CREDENTIALS" ? (
          <p className="mt-1">Forgotten your password? Reset it in the Hook app, then come back. Signed in with Google or Apple? Use the link under the password box.</p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}

function Facts() {
  return (
    <section aria-labelledby="your-data" className="space-y-3">
      <h2 id="your-data" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your data</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl py-5 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-base"><Trash2 className="h-4 w-4 text-destructive" />What we delete</CardTitle>
          </CardHeader>
          <CardContent className="px-(--card-spacing) text-sm text-muted-foreground">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Your name, email address and phone number</li>
              <li>Saved delivery addresses and profile photo</li>
              <li>Your cart, saved items and notifications</li>
              <li>Sign-in details and push-notification tokens</li>
              <li>Messages you sent while negotiating prices</li>
              <li>Any unused Hook Coin balance</li>
            </ul>
          </CardContent>
        </Card>
        <Card className="rounded-xl py-5 shadow-sm">
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-brand-gold" />What we keep</CardTitle>
          </CardHeader>
          <CardContent className="px-(--card-spacing) text-sm text-muted-foreground">
            <p>
              Order, payment and refund records, which the law requires us to hold for tax and accounting. Your name, contact
              details and delivery address are removed from them, so they can no longer be linked to you.
            </p>
            <p className="mt-3">Orders still being delivered, or refunds still being processed, must finish before an account can be deleted.</p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Confirm it is you", body: "Use your email and password, or an emailed code if you signed in with Google or Apple." },
  { title: "Your account closes", body: "You are signed out everywhere straight away." },
  { title: `${COOLING_OFF_DAYS}-day grace period`, body: "Change your mind at any time. We email a reminder before the end." },
  { title: "Permanent deletion", body: "Your personal data is erased. This cannot be undone." },
];

function Steps({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <ol className="space-y-6">
      {STEPS.map((step, index) => (
        <li key={step.title} className="relative flex gap-4">
          {index < STEPS.length - 1 ? <span aria-hidden className={`absolute left-[15px] top-9 h-[calc(100%-0.5rem)] w-px ${dark ? "bg-white/15" : "bg-border"}`} /> : null}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-sm font-bold text-zinc-950">{index + 1}</span>
          <div>
            <p className={`font-semibold ${dark ? "text-white" : "text-foreground"}`}>{step.title}</p>
            <p className={`mt-0.5 text-sm leading-6 ${dark ? "text-zinc-400" : "text-muted-foreground"}`}>{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Scheduled({ view, onCancel }: { view: DeletionView; onCancel: () => void }) {
  return (
    <Card className="rounded-xl border-brand-gold/40 py-6 shadow-sm">
      <CardContent className="space-y-4 px-6 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {view.alreadyRequested ? "Your deletion is already scheduled" : "Deletion scheduled"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your Hook account will be permanently deleted on <strong className="text-foreground">{formatDate(view.scheduledFor)}</strong>.
          </p>
        </div>
        <div className="mx-auto max-w-md space-y-2 rounded-lg bg-muted/60 p-4 text-left text-sm">
          <p className="flex gap-2"><MailCheck className="mt-0.5 h-4 w-4 shrink-0" />We emailed you a confirmation with a one-click link to keep your account.</p>
          <p className="flex gap-2"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />You are signed out of the app now. You can change your mind until that date.</p>
        </div>
        {view.canCancel ? (
          <Button variant="outline" size="lg" onClick={onCancel}><Undo2 className="h-4 w-4" />I changed my mind</Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DeleteAccountView() {
  const [tab, setTab] = useState("delete");

  // ── Delete tab ───────────────────────────────────────────────────────────
  const [proof, setProof] = useState<ProofState>(emptyProof);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<DeletionError | null>(null);
  const [result, setResult] = useState<DeletionView | null>(null);

  // ── Cancel tab ───────────────────────────────────────────────────────────
  const [cancelProof, setCancelProof] = useState<ProofState>(emptyProof);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<DeletionError | null>(null);
  const [cancelState, setCancelState] = useState<{ kind: "restored" | "none" | "scheduled"; view?: DeletionView } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !confirmed || !proofReady(proof)) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await accountDeletionApi.request(toProof(proof), reason.trim()));
      setProof(emptyProof);
    } catch (cause) {
      setError(cause as DeletionError);
    } finally {
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (cancelBusy || !proofReady(cancelProof)) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const view = await accountDeletionApi.status(toProof(cancelProof));
      setCancelState({ kind: view.state === "none" ? "none" : "scheduled", view });
    } catch (cause) {
      setCancelError(cause as DeletionError);
    } finally {
      setCancelBusy(false);
    }
  }

  async function keepAccount() {
    if (cancelBusy || !proofReady(cancelProof)) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      const view = await accountDeletionApi.cancel(toProof(cancelProof));
      setCancelState({ kind: "restored", view });
      setCancelProof(emptyProof);
    } catch (cause) {
      setCancelError(cause as DeletionError);
    } finally {
      setCancelBusy(false);
    }
  }

  return (
    <PublicShell
      eyebrow="Account & data"
      title="Delete your Hook account"
      description="Ask us to permanently delete your account and personal data. You do not need the app, and you can cancel any time during the grace period."
      aside={<Steps />}
    >
      <div className="space-y-8">
        {/* The dark panel with the steps is desktop only, so phones get them here. */}
        <Card className="rounded-xl py-5 shadow-sm lg:hidden">
          <CardHeader className="pb-1"><CardTitle className="text-base">How it works</CardTitle></CardHeader>
          <CardContent className="px-(--card-spacing)"><Steps tone="light" /></CardContent>
        </Card>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid h-auto w-full grid-cols-2 p-1">
            <TabsTrigger value="delete" className="py-2.5">Delete my account</TabsTrigger>
            <TabsTrigger value="cancel" className="py-2.5">Changed your mind?</TabsTrigger>
          </TabsList>

          <TabsContent value="delete" className="mt-4">
            {result ? (
              <Scheduled view={result} onCancel={() => { setTab("cancel"); }} />
            ) : (
              <Card className="rounded-xl py-5 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Confirm and request deletion</CardTitle>
                  <CardDescription>We need to check it is really you before we do this.</CardDescription>
                </CardHeader>
                <CardContent className="px-(--card-spacing)">
                  <form onSubmit={submit} className="space-y-5" noValidate>
                    <ProofFields idPrefix="delete" value={proof} onChange={setProof} disabled={busy} />
                    <div className="space-y-1.5">
                      <Label htmlFor="delete-reason">Why are you leaving? <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Textarea id="delete-reason" rows={2} maxLength={1000} value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
                      <Checkbox checked={confirmed} disabled={busy} onCheckedChange={(next) => setConfirmed(next === true)} className="mt-0.5" />
                      <span>
                        I understand my account and personal data will be permanently deleted after {COOLING_OFF_DAYS} days, and that any Hook Coin balance will be lost.
                      </span>
                    </label>
                    {error ? <ErrorNotice error={error} /> : null}
                    <Button type="submit" variant="brand" size="lg" className="w-full" disabled={busy || !confirmed || !proofReady(proof)}>
                      {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      {busy ? "Requesting…" : "Request account deletion"}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="cancel" className="mt-4">
            <Card className="rounded-xl py-5 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Keep your account</CardTitle>
                <CardDescription>
                  Asked for deletion by mistake, or changed your mind? Confirm it is you and we will restore your account. This works until the deletion date.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-(--card-spacing)">
                {cancelState?.kind === "restored" ? (
                  <Alert>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertTitle>Your account is back</AlertTitle>
                    <AlertDescription>The deletion was cancelled. Nothing was removed. You can sign in to the Hook app as usual.</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <ProofFields idPrefix="cancel" value={cancelProof} onChange={setCancelProof} disabled={cancelBusy} />
                    {cancelState?.kind === "none" ? (
                      <Alert><AlertTitle>No deletion is scheduled</AlertTitle><AlertDescription>This account is not scheduled for deletion.</AlertDescription></Alert>
                    ) : null}
                    {cancelState?.kind === "scheduled" ? (
                      <Alert>
                        <CalendarClock className="h-4 w-4" />
                        <AlertTitle>Deletion is scheduled for {formatDate(cancelState.view?.scheduledFor)}</AlertTitle>
                        <AlertDescription>{cancelState.view?.canCancel ? "You can still keep your account." : "Erasure has already started and can no longer be stopped."}</AlertDescription>
                      </Alert>
                    ) : null}
                    {cancelError ? <ErrorNotice error={cancelError} /> : null}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button variant="brand" size="lg" className="flex-1" disabled={cancelBusy || !proofReady(cancelProof)} onClick={keepAccount}>
                        {cancelBusy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
                        Keep my account
                      </Button>
                      <Button variant="outline" size="lg" className="flex-1" disabled={cancelBusy || !proofReady(cancelProof)} onClick={checkStatus}>
                        Check status
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Facts />
        <p className="text-center text-xs text-muted-foreground">
          Questions about your data? Contact Hook support or read our{" "}
          <a className="font-medium text-foreground underline-offset-4 hover:underline" href="/privacy">Privacy Policy</a>.
        </p>
      </div>
    </PublicShell>
  );
}
