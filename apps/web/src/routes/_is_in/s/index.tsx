import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_is_in/s/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
