import { type AxiosError, create, type InternalAxiosRequestConfig } from "axios";
import { env } from "#/env";

export const API_SERVER_URL = env.VITE_API_URL;

export const api = create({
  // The web server proxies this path to the API, and cookies carry the session.
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

interface RetryableRequest extends InternalAxiosRequestConfig {
  // Mark a request after its one allowed retry to prevent refresh loops.
  retry?: boolean;
}

// Reuse one refresh request when many API calls expire together.
let refreshPromise: Promise<void> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    // Axios keeps the original request config so it can be sent again after refresh.
    const originalRequest = error.config as RetryableRequest | undefined;

    // Skip refresh loop for auth endpoints themselves or already-retried requests
    if (
      !originalRequest ||
      originalRequest.retry ||
      error.response?.status !== 401 ||
      originalRequest.url?.includes("/auth/")
    ) {
      return Promise.reject(error);
    }

    originalRequest.retry = true;

    try {
      // Share one refresh call when several requests expire at the same time.
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh").then(() => undefined);
      }
      await refreshPromise;
      return api(originalRequest);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    } finally {
      refreshPromise = null;
    }
  },
);
