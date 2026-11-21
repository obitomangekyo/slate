import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { authQueryOptions } from "#/lib/auth";

export const Route = createFileRoute("/_is_in")({
  beforeLoad: async ({ context, location }) => {
    // Check login before loading any page inside this route group.
    const user = await context.queryClient.query({ ...authQueryOptions, staleTime: "static" });

    if (!user) {
      // Save the requested page so login can return the person to where they started.
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    return { user };
  },
  component: Outlet,
});
