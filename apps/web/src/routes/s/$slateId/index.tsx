import { createFileRoute } from "@tanstack/react-router";
import { Board } from "@/features/board";

export const Route = createFileRoute("/s/$slateId/")({
  head: ({ params }) => ({ meta: [{ title: `Slate . ${params.slateId}` }] }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Board />;
}
