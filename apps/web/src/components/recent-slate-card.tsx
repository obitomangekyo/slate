import type { SlateSummary } from "@slate/shared";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { NavArrowRight, Star } from "iconoir-react";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { Button } from "#/components/ui/button";
import { useToggleStarredMutation } from "#/lib/slates";

const dotGridStyle = {
  backgroundImage: "radial-gradient(var(--color-line) 1px, transparent 1px)",
  backgroundSize: "4px 4px",
} satisfies CSSProperties;

function SlatePreview({ slate }: { slate: SlateSummary }) {
  const nodeStyles = useMemo(
    () =>
      slate.previewNodes.map((node, index) => ({
        left: `${12 + ((Math.abs(node.position.x) + index * 19) % 68)}%`,
        top: `${12 + ((Math.abs(node.position.y) + index * 23) % 55)}%`,
      })),
    [slate.previewNodes],
  );

  return (
    <figure
      className="bg-paper border-line relative h-32 overflow-hidden rounded-t-[inherit] border-b"
      aria-label={`Canvas preview with ${slate.previewNodes.length} visible notes`}
    >
      {/* A few real notes make it easy to recognize a board without opening it. */}
      <div className="absolute inset-0 opacity-50" style={dotGridStyle} />
      {slate.previewNodes.length ? (
        slate.previewNodes.map((node, index) => (
          <div
            key={`${node.position.x}-${node.position.y}-${node.content}`}
            className={`absolute flex max-h-14 min-h-9 w-24 items-center overflow-hidden rounded-xs border p-2 text-[9px] leading-tight shadow-sm ${node.tone === "clay" ? "border-clay/40 bg-clay/15" : node.tone === "mineral" ? "border-mineral/40 bg-mineral/15" : node.tone === "citron" ? "border-citron/50 bg-citron/25" : "border-line bg-paper-raised"}`}
            style={nodeStyles[index]}
          >
            <span className="line-clamp-3">{node.content || "A note on the canvas"}</span>
          </div>
        ))
      ) : (
        <div className="text-muted absolute inset-0 grid place-items-center text-xs">
          An open canvas, ready for ideas
        </div>
      )}
      <span className="bg-paper-raised/90 text-muted absolute right-3 bottom-2 rounded-xs px-2 py-1 text-[10px]">
        {slate.nodeCount} items
      </span>
    </figure>
  );
}

export function RecentSlateCard({ slate }: { slate: SlateSummary }) {
  const starMutation = useToggleStarredMutation();
  const slateRouteParams = useMemo(() => ({ slateId: slate.id }), [slate.id]);

  return (
    <article className="group border-line bg-paper-raised hover:border-mineral relative flex min-h-56 flex-col rounded-sm border transition-colors">
      <Link
        to="/s/$slateId"
        params={slateRouteParams}
        aria-label={`Open ${slate.title}`}
        className="focus-visible:outline-mineral flex flex-1 flex-col rounded-[inherit] focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <SlatePreview slate={slate} />
        <div className="flex flex-1 items-start justify-between gap-3 p-3">
          <div className="min-w-0">
            <h3 className="group-hover:text-mineral-dark truncate font-medium tracking-tight">
              {slate.title}
            </h3>
            <p className="text-muted mt-1 text-xs">
              Edited {formatDistanceToNow(new Date(slate.updatedAt), { addSuffix: true })}
            </p>
          </div>
          <NavArrowRight
            aria-hidden="true"
            className="text-muted mt-0.5 size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
          />
        </div>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={slate.starred ? "Remove from starred" : "Add to starred"}
        aria-pressed={slate.starred}
        disabled={starMutation.isPending}
        onClick={() => starMutation.mutate({ slateId: slate.id, starred: !slate.starred })}
        className="bg-paper-raised/90 absolute top-2 right-2"
      >
        <Star className={slate.starred ? "fill-citron text-citron" : ""} />
      </Button>
    </article>
  );
}
