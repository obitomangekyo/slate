import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "cn";
import { NavArrowLeft } from "iconoir-react";
import { buttonVariants } from "#/components/ui/button";
import { Board } from "#/features/board";
import { authQueryOptions } from "#/lib/auth";
import { publicSlateQueryOptions, slateDetailQueryOptions } from "#/lib/slates";
import { SlateDrawer } from "./-components/slate-drawer";
import { SlateTitleField } from "./-components/slate-title-field";

export const Route = createFileRoute("/_is_in/s/$slateId/")({
  // Slate data uses the browser's relative `/api` proxy, so this loader must not run on the server.
  ssr: false,
  loader: async ({ context, params }) => {
    // Signed-in people get their access-specific slate data; guests can only fetch public boards.
    const user = await context.queryClient.query({
      ...authQueryOptions,
      staleTime: "static",
    });
    const slateQuery = user
      ? slateDetailQueryOptions(params.slateId)
      : publicSlateQueryOptions(params.slateId);
    return context.queryClient.query({ ...slateQuery, staleTime: "static" });
  },
  head: ({ loaderData, params }) => ({
    meta: [{ title: `${loaderData?.title ?? params.slateId} · Slate` }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { slateId } = Route.useParams();
  const { data: user } = useSuspenseQuery(authQueryOptions);
  const { data: slate } = useSuspenseQuery(
    user ? slateDetailQueryOptions(slateId) : publicSlateQueryOptions(slateId),
  );
  const isOwner = user?.id === slate.ownerId;
  const canEdit =
    isOwner ||
    slate.collaborators.some(
      (collaborator) => collaborator.userId === user?.id && collaborator.role === "editor",
    );

  return (
    <>
      {/* These small controls float above the canvas; the empty space still belongs to the board. */}
      <header className="fixed inset-x-0 top-0 z-30">
        <div className="pointer-events-none container mx-auto flex h-16 w-11/12 items-center justify-between gap-3 md:h-18 lg:h-16 xl:h-18">
          <Link
            to="/"
            aria-label="Back to home"
            className={cn(
              buttonVariants({ variant: "outline", size: "icon-lg" }),
              "pointer-events-auto shrink-0",
            )}
          >
            <NavArrowLeft aria-hidden="true" />
          </Link>
          <SlateTitleField slateId={slateId} title={slate.title} canEdit={canEdit} />

          <SlateDrawer
            {...(user?.id !== undefined && { userId: user.id })}
            ownerId={slate.ownerId}
            collaborators={slate.collaborators}
            isPublic={slate.isPublic}
          />
        </div>
      </header>

      <main className="size-full">
        <Board />
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20">
        <div className="container mx-auto"></div>
      </footer>
    </>
  );
}
