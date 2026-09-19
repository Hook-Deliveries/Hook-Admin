import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiGet,
  apiDelete,
  apiPatch,
  apiPost,
  checkHookHealth,
  clearSession,
  ensureAccountSession,
  loginAccount,
  logoutAccount,
  requestPasswordReset,
  resetPassword,
  type AdminUser,
  type AuthSession,
} from "@/lib/api";

type ToastOptions = {
  successMessage?: string;
  silent?: boolean;
};

type ApiQueryOptions = {
  staleTime?: number;
  refetchOnMount?: boolean | "always";
  refetchOnWindowFocus?: boolean;
  refetchOnReconnect?: boolean;
};

export function useApiQuery<T>(queryKey: readonly unknown[], path: string, enabled = true, options?: ApiQueryOptions) {
  return useQuery({
    queryKey,
    queryFn: () => apiGet<T>(path),
    enabled,
    ...options,
  });
}

/**
 * Shared across every guard that shows a maintenance screen (AuthShell,
 * AdminGuard, PortalGuard) — one polling query rather than each guard
 * pinging /health independently. Stays quiet (no retries, short staleTime)
 * so a real outage is reflected quickly without hammering a server that's
 * already down.
 */
export function useBackendHealth() {
  return useQuery({
    queryKey: ["backend-health"],
    queryFn: checkHookHealth,
    staleTime: 15_000,
    refetchInterval: (query) => (query.state.data === false ? 5_000 : 30_000),
    retry: false,
  });
}

export function useApiPost<TData, TVariables = unknown>(
  path: string,
  invalidate?: readonly unknown[],
  toastOptions: ToastOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => apiPost<TData>(path, variables),
    meta: {
      successMessage: toastOptions.successMessage || "Saved successfully",
      silent: toastOptions.silent,
    },
    onSuccess: () => {
      if (invalidate) queryClient.invalidateQueries({ queryKey: invalidate });
    },
  });
}

/**
 * POST to a path derived from the mutation variables, for per-row actions whose
 * URL is only known at call time. Toasts stay owned by the global MutationCache
 * via `meta`, matching `useApiPost`.
 *
 * `optimistic` lets a caller rewrite the cached list before the request lands
 * and restores the snapshot automatically if it fails.
 *
 * `buildBody` separates the request payload from the variables. Without it the
 * whole variables object is sent, which fails against endpoints whose schema is
 * strict about unknown keys — pass it whenever the variables carry routing data
 * (an id for the path) that the API does not accept in the body.
 */
export function useApiPostTo<TData, TVariables>(
  buildPath: (variables: TVariables) => string,
  options: ToastOptions & {
    invalidate?: readonly unknown[];
    optimistic?: (previous: unknown, variables: TVariables) => unknown;
    buildBody?: (variables: TVariables) => unknown;
  } = {},
) {
  const queryClient = useQueryClient();
  const { invalidate, optimistic, buildBody, successMessage, silent } = options;

  return useMutation({
    mutationFn: (variables: TVariables) =>
      apiPost<TData>(
        buildPath(variables),
        buildBody ? buildBody(variables) : variables,
      ),
    meta: {
      successMessage: successMessage || "Saved successfully",
      silent,
    },
    onMutate: async (variables: TVariables) => {
      if (!invalidate || !optimistic) return;
      await queryClient.cancelQueries({ queryKey: invalidate });
      const previous = queryClient.getQueryData(invalidate);
      queryClient.setQueryData(invalidate, (current: unknown) =>
        optimistic(current, variables),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      const snapshot = context as { previous?: unknown } | undefined;
      if (invalidate && snapshot && "previous" in snapshot) {
        queryClient.setQueryData(invalidate, snapshot.previous);
      }
    },
    onSettled: () => {
      if (invalidate) queryClient.invalidateQueries({ queryKey: invalidate });
    },
  });
}

export function useApiPatch<TData, TVariables = unknown>(
  path: string,
  invalidate?: readonly unknown[],
  toastOptions: ToastOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => apiPatch<TData>(path, variables),
    meta: {
      successMessage: toastOptions.successMessage || "Changes saved",
      silent: toastOptions.silent,
    },
    onSuccess: () => {
      if (invalidate) queryClient.invalidateQueries({ queryKey: invalidate });
    },
  });
}

export function useApiDelete<TData = unknown, TVariables = undefined>(
  path: string,
  invalidate?: readonly unknown[],
  toastOptions: ToastOptions = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: TVariables) => apiDelete<TData>(path, variables),
    meta: {
      successMessage: toastOptions.successMessage || "Record archived",
      silent: toastOptions.silent,
    },
    onSuccess: () => {
      if (invalidate) queryClient.invalidateQueries({ queryKey: invalidate });
    },
  });
}

export function useAccountSession(enabled = true) {
  return useQuery<AdminUser | null>({
    queryKey: ["auth", "session"],
    queryFn: ensureAccountSession,
    enabled,
    retry: false,
  });
}

export function useAdminSession(enabled = true) {
  return useAccountSession(enabled);
}

export function useAccountLogin() {
  const queryClient = useQueryClient();
  return useMutation<AuthSession, Error, { email: string; password: string }>({
    mutationFn: ({ email, password }) => loginAccount(email, password),
    meta: {
      successMessage: "Signed in successfully",
    },
    onSuccess: (session) => {
      queryClient.setQueryData(["auth", "session"], session.user);
      queryClient.invalidateQueries();
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logoutAccount,
    meta: {
      successMessage: "Signed out successfully",
    },
    onSettled: () => {
      clearSession();
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation<{ sent: boolean } | { message: string }, Error, { email: string }>({
    mutationFn: ({ email }) => requestPasswordReset(email),
    meta: {
      successMessage: "If that account exists, an OTP has been sent",
    },
  });
}

export function useResetPassword() {
  return useMutation<{ reset: boolean } | { message: string }, Error, { email: string; code: string; password: string }>({
    mutationFn: ({ email, code, password }) => resetPassword(email, code, password),
    meta: {
      successMessage: "Password reset successfully",
    },
  });
}
