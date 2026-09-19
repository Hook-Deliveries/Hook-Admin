const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

const ACCESS_TOKEN_KEY = "hook_admin_token";
const REFRESH_TOKEN_KEY = "hook_admin_refresh_token";
const ADMIN_USER_KEY = "hook_admin_user";

function notifyAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("hook-auth-changed"));
}

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: "support" | "admin" | "super_admin" | string;
  permissions?: string[];
  assignedCategoryIds?: string[];
  avatarUrl?: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
  createdAt?: string;
  phone?: string;
  publicId?: string;
  accountType?: "customer" | "staff" | "marketassociate" | "partner";
  accountStatus?: string;
  roleKeys?: string[];
  scopeType?: "global" | "multi_state" | "single_state" | "hub" | "self";
  assignedStateIds?: string[];
  assignedHubIds?: string[];
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  };
}

function isBrowser() {
  return typeof window !== "undefined";
}

export function getAccessToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getStoredUser(): AdminUser | null {
  if (!isBrowser()) return null;
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(session.user));
  notifyAuthChanged();
}

export function setToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  notifyAuthChanged();
}

export const clearToken = clearSession;

export function isAuthenticated(): boolean {
  return !!getAccessToken();
}

function redirectToLogin() {
  if (!isBrowser()) return;
  const next = window.location.pathname + window.location.search;
  if (window.location.pathname !== "/auth/login") {
    window.location.href = `/auth/login?next=${encodeURIComponent(next)}`;
  }
}

export type ApiRequestError = Error & {
  status?: number;
  code?: string;
  requestId?: string;
  details?: unknown;
};

/**
 * True when a failed mutation may still have succeeded on the server
 * (timeout, dropped connection, 5xx, or a duplicate still being processed).
 * Check the resulting state or retry with the SAME idempotency key; never
 * submit it again as if it were a new action.
 */
export function isAmbiguousFailure(error: unknown) {
  const err = error as ApiRequestError | undefined;
  if (!err) return false;
  if (err.code === "REQUEST_TIMEOUT" || err.code === "OPERATION_IN_PROGRESS") return true;
  return err.status === undefined || err.status === 0 || err.status >= 500;
}

const DEFAULT_MUTATION_TIMEOUT_MS = 30_000;
const DEFAULT_READ_TIMEOUT_MS = 20_000;

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Reuses a key the caller already put in the body so header and body agree. */
function bodyIdempotencyKey(body: BodyInit | null | undefined) {
  if (typeof body !== "string") return undefined;
  try {
    const key = (JSON.parse(body) as { idempotencyKey?: unknown })?.idempotencyKey;
    return typeof key === "string" && key.length >= 8 ? key : undefined;
  } catch {
    return undefined;
  }
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const caller = init.signal;
  if (caller) {
    if (caller.aborted) controller.abort();
    else caller.addEventListener("abort", () => controller.abort(), { once: true });
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (controller.signal.aborted && !caller?.aborted) {
      const error = new Error(
        `0: ${init.method && init.method !== "GET" ? "This is taking longer than expected. Check the result before trying again." : "The request took too long. Please try again."}`,
      ) as ApiRequestError;
      error.status = 0;
      error.code = "REQUEST_TIMEOUT";
      throw error;
    }
    throw cause;
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse<T>(res: Response): Promise<T> {
  const contentType = res.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? ((await res.json()) as ApiEnvelope<T>)
    : null;

  if (!res.ok || !payload?.success) {
    const message = payload?.error?.message || `Request failed with ${res.status}`;
    const error = new Error(`${res.status}: ${message}`) as ApiRequestError;
    // Carry the status as data so callers stop regex-parsing it out of the message.
    error.status = res.status;
    error.code = payload?.error?.code;
    error.requestId = payload?.meta?.requestId;
    error.details = payload?.error?.details;
    throw error;
  }

  return payload.data as T;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      const session = await parseResponse<AuthSession>(res);
      setSession(session);
      return session.accessToken;
    } catch {
      clearSession();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  config: {
    auth?: boolean;
    retryOnUnauthorized?: boolean;
    /** Stable key for this action; reuse it when the user retries the same thing. */
    idempotencyKey?: string;
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const auth = config.auth ?? true;
  const retryOnUnauthorized = config.retryOnUnauthorized ?? true;
  const token = getAccessToken();

  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (auth && token) headers.set("Authorization", `Bearer ${token}`);
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD" && !headers.has("Idempotency-Key")) {
    // Minted once per call and reused by the 401 refresh replay below, so a
    // request that reaches the server twice is executed once. A key the caller
    // put in the body wins, so header and body always agree.
    headers.set(
      "Idempotency-Key",
      config.idempotencyKey || bodyIdempotencyKey(options.body) || newIdempotencyKey(),
    );
  }
  const timeoutMs = config.timeoutMs ?? (method === "GET" ? DEFAULT_READ_TIMEOUT_MS : DEFAULT_MUTATION_TIMEOUT_MS);
  if (isBrowser()) {
    const stateId = localStorage.getItem("hook_admin_state_id");
    const hubId = localStorage.getItem("hook_admin_hub_id");
    if (stateId) headers.set("X-Hook-State-Id", stateId);
    if (hubId) headers.set("X-Hook-Hub-Id", hubId);
  }

  const res = await fetchWithTimeout(`${API_BASE}${path}`, { ...options, headers }, timeoutMs);

  if (res.status === 401 && auth && retryOnUnauthorized) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${nextToken}`);
      const retry = await fetchWithTimeout(`${API_BASE}${path}`, { ...options, headers: retryHeaders }, timeoutMs);
      return parseResponse<T>(retry);
    }
    // Refresh failed or there was no refresh token — redirectToLogin() only
    // schedules a navigation, it doesn't stop this call. Without returning
    // here, every in-flight request fell through to parseResponse(res) and
    // threw its own "401" error against the stale original response instead
    // of just letting the redirect happen.
    redirectToLogin();
    throw new Error("401: Session expired — redirecting to sign in");
  }

  return parseResponse<T>(res);
}

export function apiGet<T>(path: string): Promise<T> {
  return apiRequest<T>(path);
}

type MutationConfig = { idempotencyKey?: string; timeoutMs?: number };

export function apiPost<T>(path: string, body?: unknown, config?: MutationConfig): Promise<T> {
  return apiRequest<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  }, config);
}

export function apiPatch<T>(path: string, body?: unknown, config?: MutationConfig): Promise<T> {
  return apiRequest<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  }, config);
}

export function apiDelete<T>(path: string, body?: unknown, config?: MutationConfig): Promise<T> {
  return apiRequest<T>(path, {
    method: "DELETE",
    body: body ? JSON.stringify(body) : undefined,
  }, config);
}

export async function loginAccount(email: string, password: string) {
  const session = await apiRequest<AuthSession>(
    "/auth/login",
    {
      method: "POST",
      headers: { "X-Hook-Portal": "staff" },
      body: JSON.stringify({ email, password }),
    },
    { auth: false },
  );
  const isLegacyStaff = ["support", "admin", "super_admin"].includes(
    session.user.role,
  );
  if (
    !["staff", "marketassociate", "partner"].includes(session.user.accountType || "") &&
    !isLegacyStaff
  ) {
    throw new Error("403: Use the Hook mobile app to access your customer account");
  }
  setSession(session);
  return session;
}

export async function logoutAccount() {
  const accessToken = getAccessToken();
  const refreshToken = getRefreshToken();
  if (!accessToken && !refreshToken) {
    throw new Error("401: Authentication token required");
  }
  await apiRequest<{ loggedOut: boolean }>(
    "/auth/logout",
    {
      method: "POST",
      body: JSON.stringify({ refreshToken: refreshToken || undefined }),
    },
    { auth: true, retryOnUnauthorized: false },
  );
  clearSession();
}

export async function requestPasswordReset(email: string) {
  return apiRequest<{ sent: boolean } | { message: string }>(
    "/auth/password/forgot",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
    { auth: false },
  );
}

export async function resetPassword(email: string, code: string, password: string) {
  return apiRequest<{ reset: boolean } | { message: string }>(
    "/auth/password/reset",
    {
      method: "POST",
      body: JSON.stringify({ email, code, password }),
    },
    { auth: false },
  );
}

/**
 * Pings the backend's own /health endpoint (outside /api/v1, so it can't go
 * through apiRequest). Used by the PWA launch screen to tell "you're not
 * logged in yet" apart from "the API is unreachable" — those need different
 * UI, and a plain fetch failure alone doesn't distinguish them.
 */
export async function checkHookHealth(): Promise<boolean> {
  const base = (API_BASE || "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${base}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export async function getCurrentAccount() {
  const user = await apiGet<AdminUser>("/auth/profile");
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
  return user;
}

export async function ensureAccountSession() {
  if (!getAccessToken() && !getRefreshToken()) return null;
  try {
    return await getCurrentAccount();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("401")) {
      const refreshed = await refreshAccessToken();
      if (refreshed) return getCurrentAccount();
    }
    clearSession();
    throw error;
  }
}
