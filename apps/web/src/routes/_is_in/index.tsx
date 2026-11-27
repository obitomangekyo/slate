import { useHotkeys } from "@tanstack/react-hotkeys";
import { useDebouncedCallback } from "@tanstack/react-pacer";
import { createFileRoute } from "@tanstack/react-router";
import { NavArrowDown, Search } from "iconoir-react";
import {
  type ChangeEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useIntersection } from "react-use";
import { HomeStarredSection } from "#/components/home-starred-section";
import { RecentSlateCard } from "#/components/recent-slate-card";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "#/components/ui/input-group";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "#/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { WorkspaceHeader } from "#/components/workspace-header";
import { useCreateSlateMutation, useSlatePagesQuery } from "#/lib/slates";

export const Route = createFileRoute("/_is_in/")({
  head: () => ({ meta: [{ title: "Home · Slate" }] }),
  component: RouteComponent,
});

type SlateScope = "all" | "owned" | "shared";

function RouteComponent() {
  const navigate = Route.useNavigate();
  const createSlate = useCreateSlateMutation();
  const create = useCallback(
    () =>
      createSlate.mutate(undefined, {
        onSuccess: (slate) => navigate({ to: "/s/$slateId", params: { slateId: slate.id } }),
      }),
    [createSlate, navigate],
  );
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<SlateScope>("all");
  const [starred, setStarred] = useState("all");
  const handleScopeChange = useCallback(
    (value: string | null) => setScope(value === "owned" || value === "shared" ? value : "all"),
    [],
  );
  const handleStarredChange = useCallback((value: string | null) => setStarred(value ?? "all"), []);
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
    scope,
    ...(starred !== "all" && { starred: starred === "true" }),
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
              <InputGroupAddon aria-hidden="true">
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search slates, people, or IDs"
                value={searchText}
                onChange={handleSearchChange}
                placeholder="Search slates, people, or IDs"
              />
            </InputGroup>
            <Popover>
              <PopoverTrigger className="border-line bg-paper-raised text-ink hover:bg-paper flex h-9 items-center gap-2 rounded-sm border px-3 text-sm transition-colors">
                Filters <NavArrowDown aria-hidden="true" />
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="border-line bg-paper-raised text-ink w-72 gap-4 rounded-sm border p-4 shadow-[0_12px_32px_-18px_rgba(24,38,43,0.38)]"
              >
                <PopoverTitle className="font-semibold">Filter slates</PopoverTitle>
                <div className="text-muted grid gap-1.5 text-xs font-medium">
                  <span>Ownership</span>
                  <Select value={scope} onValueChange={handleScopeChange}>
                    <SelectTrigger className="w-full" aria-label="Slate ownership">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="all">All slates</SelectItem>
                      <SelectItem value="owned">Owned by me</SelectItem>
                      <SelectItem value="shared">Shared with me</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-muted grid gap-1.5 text-xs font-medium">
                  <span>Starred</span>
                  <Select value={starred} onValueChange={handleStarredChange}>
                    <SelectTrigger className="w-full" aria-label="Starred filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent align="start">
                      <SelectItem value="all">Starred and unstarred</SelectItem>
                      <SelectItem value="true">Starred only</SelectItem>
                      <SelectItem value="false">Not starred</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {query.data ? (
            slates.length ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {slates.map((slate) => (
                  <RecentSlateCard key={slate.id} slate={slate} />
                ))}
              </div>
            ) : search || starred !== "all" || scope !== "all" ? (
              <p className="border-line bg-paper-raised text-muted rounded-sm border border-dashed px-4 py-6 text-center text-sm">
                No slates match these filters.
              </p>
            ) : (
              <div className="border-line bg-paper-raised rounded-sm border border-dashed px-4 py-8 text-center">
                <p className="font-medium">No slates yet</p>
                <p className="text-muted mt-1 text-sm">
                  Create a slate to start mapping ideas together.
                </p>
                <Button className="mt-4" onClick={create} disabled={createSlate.isPending}>
                  {createSlate.isPending ? "Creating..." : "Create new slate"}
                </Button>
              </div>
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
          ) : null}

          {query.data && hasNextPage && <div ref={endRef} className="h-4" aria-hidden="true" />}
          {isFetchingNextPage && <Skeleton className="mt-3 h-24" />}
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
