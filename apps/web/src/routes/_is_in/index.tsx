import { zodResolver } from "@hookform/resolvers/zod";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { createFileRoute } from "@tanstack/react-router";
import { NavArrowDown, Plus, Search } from "iconoir-react";
import {
  type ChangeEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Controller, type ControllerProps, useForm } from "react-hook-form";
import { useIntersection } from "react-use";
import { z } from "zod";
import { HomeStarredSection } from "#/components/home-starred-section";
import { RecentSlateCard, RecentSlateCardSkeleton } from "#/components/recent-slate-card";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/components/ui/input-group";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { WorkspaceHeader } from "#/components/workspace-header";
import { useCreateSlateMutation, useSlatePagesQuery } from "#/lib/slates";

export const Route = createFileRoute("/_is_in/")({
  head: () => ({ meta: [{ title: "Home · Slate" }] }),
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const createSlate = useCreateSlateMutation();
  const create = useCallback(
    () =>
      createSlate.mutate(undefined, {
        onSuccess(slate) {
          navigate({ to: "/s/$slateId", params: { slateId: slate.id } });
        },
      }),
    [createSlate, navigate],
  );
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const filterForm = useForm<SlateFilterValues>({
    resolver: zodResolver(slateFilterSchema),
    defaultValues: defaultSlateFilters,
  });

  const [appliedFilters, setAppliedFilters] = useState<SlateFilterValues>(defaultSlateFilters);

  const applyFilters = filterForm.handleSubmit((values) => {
    setAppliedFilters(values);
  });

  const clearFilters = useCallback(() => {
    filterForm.reset(defaultSlateFilters);
    setAppliedFilters(defaultSlateFilters);
  }, [filterForm]);
  const endRef = useRef<HTMLDivElement>(null);
  const end = useIntersection(endRef as unknown as RefObject<HTMLElement>, {
    root: null,
    rootMargin: "240px",
    threshold: 0,
  });
  const saveSearch = useDebouncedCallback((value: string) => setSearch(value.trim()), {
    wait: 300,
  });
  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchText(event.target.value);
      saveSearch(event.target.value);
    },
    [saveSearch],
  );
  const query = useSlatePagesQuery({
    ...(search && { search }),
    scope: appliedFilters.scope,
    ...(appliedFilters.starred !== "all" && {
      starred: appliedFilters.starred === "true",
    }),
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  const slates = useMemo(
    () => query.data?.pages.flatMap((page) => page.slates) ?? [],
    [query.data],
  );
  const refetchSlates = useCallback(() => refetch(), [refetch]);
  const retryNextPage = useCallback(() => fetchNextPage(), [fetchNextPage]);

  // Load the next page before the person reaches the end of the slate grid.
  useEffect(() => {
    if (end?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [end?.isIntersecting, fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Leave browser shortcuts alone while someone is typing in a field.
  useHotkeys([
    {
      hotkey: "Mod+N",
      callback: (event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
        )
          return;
        event.preventDefault();
        if (!createSlate.isPending) create();
      },
    },
  ]);

  return (
    <>
      <WorkspaceHeader />
      <main className="container mx-auto w-11/12 space-y-8 py-8 md:py-10">
        <HomeStarredSection />
        <section aria-labelledby="recents-heading">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="recents-heading" className="text-lg font-semibold tracking-tight">
              Recents
            </h2>
            {slates.length > 0 && (
              <Button onClick={create} disabled={createSlate.isPending}>
                {createSlate.isPending ? "Creating..." : "New slate"}
              </Button>
            )}
          </div>

          <div className="mb-5 flex flex-wrap gap-3">
            <InputGroup className="min-w-56 flex-1">
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search slates, people, or IDs"
                value={searchText}
                onChange={handleSearchChange}
                placeholder="Search slates, people, or IDs"
                type="search"
              />
            </InputGroup>
            <Popover>
              <PopoverTrigger render={popoverTriggerRender}>
                Filters <NavArrowDown aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent align="end">
                <PopoverTitle>Filter slates</PopoverTitle>

                <form onSubmit={applyFilters} className="grid gap-4">
                  <div className="grid gap-1.5 text-xs font-medium">
                    <span>Ownership</span>

                    <Controller
                      control={filterForm.control}
                      name="scope"
                      render={ownershipControllerRender}
                    />
                  </div>

                  <div className="grid gap-1.5 text-xs font-medium">
                    <span>Starred</span>

                    <Controller
                      control={filterForm.control}
                      name="starred"
                      render={starredControllerRender}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="ghost" onClick={clearFilters}>
                      Reset
                    </Button>

                    <Button type="submit">Apply filters</Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          </div>

          {query.data ? (
            slates.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {slates.map((slate) => (
                  <RecentSlateCard key={slate.id} slate={slate} />
                ))}
              </div>
            ) : search || appliedFilters.starred !== "all" || appliedFilters.scope !== "all" ? (
              <Empty className="gap-3 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No matching slates</EmptyTitle>
                  <EmptyDescription>Try changing your search or filters.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Empty className="gap-3 py-8">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Plus aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No slates yet</EmptyTitle>
                  <EmptyDescription>
                    Create a slate to start mapping ideas together.
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={create} disabled={createSlate.isPending}>
                    {createSlate.isPending ? "Creating..." : "Create new slate"}
                  </Button>
                </EmptyContent>
              </Empty>
            )
          ) : query.error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load slates</AlertTitle>
              <AlertDescription>Check your connection and try again.</AlertDescription>
              <AlertAction>
                <Button variant="outline" size="sm" onClick={refetchSlates}>
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          ) : query.isPending ? (
            <div>
              {/* Keep the layout steady while loading, and announce the wait to screen readers. */}
              <output className="sr-only">Loading recent slates...</output>
              <div
                aria-hidden="true"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
              >
                {recentSkeletonKeys.map((key) => (
                  <RecentSlateCardSkeleton key={key} />
                ))}
              </div>
            </div>
          ) : null}

          {query.data && hasNextPage && <div ref={endRef} className="h-4" aria-hidden="true" />}
          {isFetchingNextPage && (
            <div className="mt-3">
              <output className="sr-only">Loading more slates...</output>
              <div
                aria-hidden="true"
                className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
              >
                {nextRecentSkeletonKeys.map((key) => (
                  <RecentSlateCardSkeleton key={key} />
                ))}
              </div>
            </div>
          )}
          {query.isFetchNextPageError && (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Could not load more slates</AlertTitle>
              <AlertAction>
                <Button variant="outline" size="sm" onClick={retryNextPage}>
                  Try again
                </Button>
              </AlertAction>
            </Alert>
          )}
        </section>
      </main>
    </>
  );
}

const slateScopeOpts = {
  all: "All slates",
  owned: "Owned by me",
  shared: "Shared with me",
} as const;

const slateStarredOpts = {
  all: "Starred and unstarred",
  true: "Starred only",
  false: "Not starred",
} as const;

const slateFilterSchema = z.object({
  scope: z.enum(["all", "owned", "shared"]),
  starred: z.enum(["all", "true", "false"]),
});

type SlateFilterValues = z.infer<typeof slateFilterSchema>;

const defaultSlateFilters: SlateFilterValues = {
  scope: "all",
  starred: "all",
};

const recentSkeletonKeys = [
  "recent-1",
  "recent-2",
  "recent-3",
  "recent-4",
  "recent-5",
  "recent-6",
  "recent-7",
  "recent-8",
];
const nextRecentSkeletonKeys = ["more-recent-1", "more-recent-2", "more-recent-3", "more-recent-4"];

const popoverTriggerRender = <Button type="button" size="lg" variant="outline" />;

const ownershipControllerRender: ControllerProps<SlateFilterValues, "scope">["render"] = ({
  field,
}) => (
  <Select value={field.value} onValueChange={field.onChange} items={slateScopeOpts}>
    <SelectTrigger className="w-full" aria-label="Slate ownership">
      <SelectValue />
    </SelectTrigger>

    <SelectContent align="start">
      {Object.entries(slateScopeOpts).map(([value, label]) => (
        <SelectItem key={value} value={value}>
          {label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const starredControllerRender: ControllerProps<SlateFilterValues, "starred">["render"] = ({
  field,
}) => (
  <Select value={field.value} onValueChange={field.onChange} items={slateStarredOpts}>
    <SelectTrigger className="w-full" aria-label="Starred filter">
      <SelectValue />
    </SelectTrigger>

    <SelectContent align="start">
      {Object.entries(slateStarredOpts).map(([value, label]) => (
        <SelectItem key={value} value={value}>
          {label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
