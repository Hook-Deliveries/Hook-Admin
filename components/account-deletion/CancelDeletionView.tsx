"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, LoaderCircle, TriangleAlert, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PublicShell } from "@/components/public/PublicShell";
import { accountDeletionApi, type DeletionError } from "@/lib/public-account-deletion-api";

/**
 * Landing page for the "Keep my account" button in the deletion emails.
 * Cancelling needs a click here rather than happening on page load: email
 * scanners and link previewers fetch links automatically, and that must never
 * cancel someone's deletion (or trigger anything else) on its own.
 */
export function CancelDeletionView() {
  const token = useSearchParams().get("token") || "";
  const [state, setState] = useState<"ready" | "busy" | "done" | "error">("ready");
  const [message, setMessage] = useState("");

  async function keep() {
    if (state === "busy") return;
    setState("busy");
    try {
      await accountDeletionApi.cancelWithToken(token);
      setState("done");
    } catch (cause) {
      const error = cause as DeletionError;
      setMessage(error.message);
      setState("error");
    }
  }

  return (
    <PublicShell
      eyebrow="Account & data"
      title="Keep your Hook account"
      description="Changed your mind about deleting your account? Confirm below and we will restore it."
      width="md"
      centered
    >
      <Card className="rounded-2xl py-6 shadow-sm">
        <CardContent className="space-y-5 px-6 text-center">
          {state === "done" ? (
            <>
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
              <div>
                <h2 className="text-lg font-bold">Your account is back</h2>
                <p className="mt-1 text-sm text-muted-foreground">The deletion was cancelled and nothing was removed. You can sign in to the Hook app as usual.</p>
              </div>
            </>
          ) : state === "error" || !token ? (
            <>
              <TriangleAlert className="mx-auto h-10 w-10 text-amber-500" />
              <div>
                <h2 className="text-lg font-bold">This link can&apos;t be used</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {token ? message : "The link is incomplete."} You can also keep your account from the
                  {" "}<a className="font-medium text-foreground underline underline-offset-4" href="/delete-account">account deletion page</a>.
                </p>
              </div>
            </>
          ) : (
            <>
              <Undo2 className="mx-auto h-10 w-10 text-brand-gold" />
              <div>
                <h2 className="text-lg font-bold">Cancel the deletion?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Your account will be restored and will not be deleted.</p>
              </div>
              <Button variant="brand" size="lg" className="w-full" disabled={state === "busy"} onClick={keep}>
                {state === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                Keep my account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </PublicShell>
  );
}
