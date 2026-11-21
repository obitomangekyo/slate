import { createFileRoute } from "@tanstack/react-router";
import { FramePlusIn, Plus } from "iconoir-react";
import { type MouseEvent, useCallback } from "react";
import SlateAppIcon from "#/assets/svgs/slate-app-icon.svg?react";
import { Button } from "#/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";

export const Route = createFileRoute("/_is_in/")({ component: RouteComponent });

interface SlateSummary {
  id: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
}

const INITIAL_SLATES: SlateSummary[] = [
  {
    id: "sprint-14-retro",
    title: "Sprint 14 Engineering Retro",
    updatedAt: "2 hours ago",
    nodeCount: 18,
  },
  {
    id: "q4-story-map",
    title: "Checkout Flow Story Mapping",
    updatedAt: "Yesterday",
    nodeCount: 31,
  },
  {
    id: "auth-architecture",
    title: "Session Rotation & Edge Auth",
    updatedAt: "3 days ago",
    nodeCount: 9,
  },
];

function RouteComponent() {
  const navigate = Route.useNavigate();

  const handleOpenSlate = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const slateId = event.currentTarget.dataset.slateId;
      if (!slateId) return;
      navigate({ to: "/s/$slateId", params: { slateId } });
    },
    [navigate],
  );

  return (
    <>
      {/* Top Room Header */}
      <header className="border-line bg-paper-raised border-b">
        <div className="container mx-auto flex h-16 w-11/12 items-center justify-between md:h-18 lg:h-16 xl:h-18">
          <div className="flex items-center text-xs leading-none">
            <SlateAppIcon aria-hidden="true" className="h-[3em]" />
            <span className="mr-3 ml-1 text-[2em] font-semibold tracking-tight">Slate</span>
            <span className="border-line bg-paper text-muted rounded-xs border px-2 py-1">
              Workspace
            </span>
          </div>

          <Button type="button">
            <Plus /> New Slate
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto w-11/12 py-10">
        {/* Section Bar & Filter Tabs */}
        <div className="border-line mb-8 flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Project Slates</h1>
            <p className="text-muted mt-0.5 text-sm">
              Spatial boards for team retrospectives and system mapping.
            </p>
          </div>
        </div>

        {/* Slates Grid */}
        {INITIAL_SLATES.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FramePlusIn strokeWidth={1.75} />
              </EmptyMedia>
              <EmptyTitle>No slates on the table yet</EmptyTitle>
              <EmptyDescription>
                Open a fresh spatial surface to map system flows, drop notes, and run live team
                retros.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button type="button">
                <Plus strokeWidth={2} data-icon="inline-start" />
                Create new slate
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {INITIAL_SLATES.map((slate) => (
              <article
                key={slate.id}
                className="group border-line bg-paper-raised hover:border-mineral relative flex flex-col justify-between rounded-sm border transition-colors"
              >
                <button
                  type="button"
                  onClick={handleOpenSlate}
                  data-slate-id={slate.id}
                  className="flex flex-1 flex-col rounded-[inherit] text-left focus:outline-none"
                >
                  {/* Tactile Paper Preview Surface */}
                  <div className="border-line bg-paper relative h-36 rounded-t-[inherit] border-b p-4">
                    <div className="flex gap-2 opacity-75">
                      <span className="border-line bg-paper-raised h-8 w-12 rounded-xs border" />
                      <span className="border-clay/40 bg-paper-raised mt-3 h-8 w-14 rounded-xs border" />
                      <span className="border-mineral/40 bg-paper-raised h-7 w-10 rounded-xs border" />
                    </div>
                  </div>

                  {/* Card Metadata */}
                  <div className="flex flex-1 flex-col justify-between p-4">
                    <h2 className="text-ink group-hover:text-mineral-dark font-medium">
                      {slate.title}
                    </h2>
                    <div className="text-muted mt-4 flex items-center justify-between text-xs">
                      <span>{slate.nodeCount} items</span>
                      <span>Edited {slate.updatedAt}</span>
                    </div>
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
