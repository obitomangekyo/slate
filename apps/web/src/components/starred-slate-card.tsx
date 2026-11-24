import type { SlateSummary } from "@slate/shared";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { NavArrowRight, Star } from "iconoir-react";
import { useMemo } from "react";
import { Button } from "#/components/ui/button";
import { useToggleStarredMutation } from "#/lib/slates";

export function StarredSlateCard({ slate }: { slate: SlateSummary }) {
  const starMutation = useToggleStarredMutation();
  const slateRouteParams = useMemo(() => ({ slateId: slate.id }), [slate.id]);

  return (
    <article className="group border-line bg-paper-raised hover:border-mineral relative flex min-h-28 flex-col justify-center rounded-sm border p-3 transition-colors">
      <Link
        to="/s/$slateId"
        params={slateRouteParams}
        aria-label={`Open ${slate.title}`}
        className="focus-visible:outline-mineral flex items-center gap-3 rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span className="bg-citron/20 text-citron flex size-9 shrink-0 items-center justify-center rounded-xs">
          <Star className="size-4 fill-current" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="group-hover:text-mineral-dark block truncate font-medium tracking-tight">
            {slate.title}
          </span>
          <span className="text-muted mt-1 block text-xs">
            {slate.nodeCount} items ·{" "}
            {formatDistanceToNow(new Date(slate.updatedAt), { addSuffix: true })}
          </span>
        </span>
        <NavArrowRight
          aria-hidden="true"
          className="text-muted size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        />
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Remove from starred"
        aria-pressed={slate.starred}
        disabled={starMutation.isPending}
        onClick={() => starMutation.mutate({ slateId: slate.id, starred: false })}
        className="text-muted hover:text-clay absolute top-1 right-1 size-7"
      >
        <Star className="size-3.5 fill-current" />
      </Button>
    </article>
  );
}
