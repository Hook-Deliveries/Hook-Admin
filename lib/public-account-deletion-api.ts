const API_BASE = "/api/v1/public/account-deletion";
const REQUEST_TIMEOUT_MS = 20_000;

type Envelope<T> = { success: boolean; data?: T; error?: { code?: string; message?: string; details?: unknown } };

export type DeletionView = {
  state: "none" | "scheduled" | "erasing";
  scheduledFor?: string;
  canCancel: boolean;
  alreadyRequested?: boolean;
};

export type Proof = { email: string } & ({ password: string; code?: never } | { code: string; password?: never });

export type DeletionError = Error & {
  code?: string;
  status?: number;
  details?: { orders?: string[]; refunds?: number; returns?: number };
};

async function call<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    throw new Error(
      timedOut
        ? "Hook is taking too long to respond. Please try again in a moment."
        : "We couldn't reach Hook. Check your connection and try again.",
    );
  }
  const payload = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !payload?.success) {
    const error = new Error(payload?.error?.message || "Something went wrong. Please try again.") as DeletionError;
    error.code = payload?.error?.code;
    error.status = response.status;
    error.details = payload?.error?.details as DeletionError["details"];
    throw error;
  }
  return payload.data as T;
}

export const accountDeletionApi = {
  sendCode: (email: string) => call<{ sent: boolean }>("/code", { email }),
  request: (proof: Proof, reason?: string) => call<DeletionView>("/request", { ...proof, reason: reason || undefined }),
  status: (proof: Proof) => call<DeletionView>("/status", proof),
  cancel: (proof: Proof) => call<DeletionView>("/cancel", proof),
  cancelWithToken: (token: string) => call<DeletionView>("/cancel", { token }),
};
