import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/s/")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});
