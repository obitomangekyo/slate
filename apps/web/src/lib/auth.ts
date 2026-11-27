import type {
  ApiErrorResponse,
  ApiSuccessResponse,
  AuthUser,
  LoginInput,
  RegisterInput,
  ResendEmailVerificationResponse,
} from "@slate/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { type AxiosError, isAxiosError } from "axios";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toastManager } from "#/components/ui/toast";
import { api } from "#/lib/api";
import type {
  EmailVerificationChallenge,
  ResendEmailVerificationInput,
  VerifyEmailInput,
} from "#/types/auth";

// Unwrap the shared API envelope here so the rest of the app works with auth data directly.
export const authQueryOptions = queryOptions({
  queryKey: ["auth", "me"] as const,
  // The browser must perform this check so it can send the path-scoped refresh cookie.
  queryFn: async () => {
    try {
      const { data } = await api.get<ApiSuccessResponse<{ user: AuthUser }>>("/auth/me");
      return data.data.user;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        try {
          await api.post("/auth/refresh");
          const { data } = await api.get<ApiSuccessResponse<{ user: AuthUser }>>("/auth/me");
          return data.data.user;
        } catch (refreshError) {
          if (isAxiosError(refreshError) && refreshError.response?.status === 401) return null;
          throw refreshError;
        }
      }
      throw error;
    }
  },
  staleTime: 5 * 60 * 1000,
});

export function useLoginMutation() {
  const queryClient = useQueryClient();

  return useMutation<AuthUser, AxiosError<ApiErrorResponse>, LoginInput>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSuccessResponse<{ user: AuthUser }>>("/auth/login", input);
      return data.data.user;
    },
    onSuccess: (user) => {
      // Update the shared current-user cache so protected routes see the new session.
      queryClient.setQueryData(authQueryOptions.queryKey, user);
    },
  });
}

export function useRegisterMutation() {
  // Registration returns a challenge, not a user, until email ownership is confirmed.
  return useMutation<
    EmailVerificationChallenge,
    AxiosError<ApiErrorResponse>,
    RegisterInput,
    unknown
  >({
    mutationFn: async (input) => {
      const { data } = await api.post<
        ApiSuccessResponse<{
          verification: EmailVerificationChallenge;
        }>
      >("/auth/register", input);

      return data.data.verification;
    },
  });
}

export function useVerifyEmailMutation() {
  const queryClient = useQueryClient();

  return useMutation<AuthUser, AxiosError<ApiErrorResponse>, VerifyEmailInput, unknown>({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSuccessResponse<{ user: AuthUser }>>(
        "/auth/verify-email",
        input,
      );

      return data.data.user;
    },
    onSuccess: (user) => {
      // Verification also signs in, so store that user in the same shared cache.
      queryClient.setQueryData(authQueryOptions.queryKey, user);
    },
  });
}

export function useResendEmailVerificationMutation() {
  // The server returns the next allowed resend time so the UI can start its timer.
  return useMutation<
    ResendEmailVerificationResponse,
    AxiosError<ApiErrorResponse>,
    ResendEmailVerificationInput,
    unknown
  >({
    mutationFn: async (input) => {
      const { data } = await api.post<ApiSuccessResponse<ResendEmailVerificationResponse>>(
        "/auth/verify-email/resend",
        input,
      );
      return data.data;
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation<void, AxiosError<ApiErrorResponse>, void>({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSuccess: () => {
      // Remove private cached data after the API clears the browser session.
      queryClient.setQueryData(authQueryOptions.queryKey, null);
      queryClient.clear();
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Could not log out",
        description: error.response?.data?.message ?? "Please try again.",
      });
    },
  });
}

/**
 * Routes API field errors directly to React Hook Form inputs,
 * and falls back to Base UI Toast for general/network errors.
 */
export function handleFormApiError<TFieldValues extends FieldValues>(
  error: AxiosError<ApiErrorResponse>,
  setError: UseFormSetError<TFieldValues>,
  fallbackTitle = "Action failed",
) {
  // Put field messages beside their inputs; show a toast for errors with no field to attach to.
  const payload = isAxiosError<ApiErrorResponse>(error) ? error.response?.data : undefined;

  if (payload?.data.kind === "field") {
    for (const [field, message] of Object.entries(payload.data.fieldErrors)) {
      setError(field as Path<TFieldValues>, { type: "server", message });
    }
    return;
  }

  toastManager.add({
    type: "error",
    title: fallbackTitle,
    description: payload?.message ?? "Something went wrong. Please try again.",
  });
}
