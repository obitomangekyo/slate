import type { AuthUser } from "@slate/shared";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import axios from "axios";
import { API_SERVER_URL } from "#/lib/api";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  // Forward the incoming browser cookie so server rendering sees the same login session.
  const cookie = getRequestHeader("cookie");
  if (!cookie) return null;

  try {
    const response = await axios.get<{ user: AuthUser }>(`${API_SERVER_URL}/api/auth/me`, {
      headers: { cookie },
    });
    return response.data.user;
  } catch {
    // Treat expired sessions and API errors as signed-out during page rendering.
    return null;
  }
});
