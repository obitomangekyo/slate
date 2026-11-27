import { Star } from "iconoir-react";
import { type ComponentProps, useCallback, useEffect, useMemo, useState } from "react";
import { StarredSlateCard, StarredSlateCardSkeleton } from "#/components/starred-slate-card";
import { Alert, AlertDescription, AlertTitle } from "#/components/ui/alert";
import { Button } from "#/components/ui/button";
import type { CarouselApi } from "#/components/ui/carousel";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "#/components/ui/carousel";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty";
import { useSlatePagesQuery } from "#/lib/slates";

const carouselOptions = { align: "start", containScroll: "trimSnaps" } satisfies ComponentProps<
  typeof Carousel
>["opts"];

const starredSkeletonKeys = ["starred-1", "starred-2", "starred-3", "starred-4", "starred-5"];
const nextStarredSkeletonKeys = ["more-starred-1", "more-starred-2", "more-starred-3"];

export function HomeStarredSection() {
  const query = useSlatePagesQuery({ starred: true });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = query;
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const refetchSlates = useCallback(() => refetch(), [refetch]);
  const retryNextPage = useCallback(() => fetchNextPage(), [fetchNextPage]);
  const slates = useMemo(
    () => query.data?.pages.flatMap((page) => page.slates) ?? [],
    [query.data],
  );
  const setApi = useCallback((api: CarouselApi) => setCarouselApi(api), []);

  useEffect(() => {
    if (!carouselApi) return;

    // Fetch another page when the carousel is close to its last loaded slate.
    const loadNearEnd = () => {
      const lastNearEnd = carouselApi.scrollSnapList().length - 3;
      if (carouselApi.selectedScrollSnap() >= lastNearEnd && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    carouselApi.on("select", loadNearEnd);
    carouselApi.on("reInit", loadNearEnd);
    loadNearEnd();
    return () => {
      carouselApi.off("select", loadNearEnd);
      carouselApi.off("reInit", loadNearEnd);
    };
  }, [carouselApi, fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <section aria-labelledby="starred-heading">
      <h1 id="starred-heading" className="mb-3 text-lg font-semibold tracking-tight">
        Starred
      </h1>

      {query.data ? (
        slates.length ? (
          <Carousel setApi={setApi} opts={carouselOptions} aria-label="Starred slates">
            <div className="mb-3 flex justify-end gap-2">
              {slates.length > 1 && (
                <>
                  <CarouselPrevious
                    className="static size-8"
                    aria-label="Previous starred slates"
                  />
                  <CarouselNext className="static size-8" aria-label="Next starred slates" />
                </>
              )}
            </div>
            <CarouselContent className="-ml-3">
              {slates.map((slate) => (
                <CarouselItem
                  key={slate.id}
                  className="basis-2/3 pl-3 sm:basis-2/5 lg:basis-28/100 2xl:basis-22/100"
                >
                  <StarredSlateCard slate={slate} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <Empty className="gap-2 py-5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Star aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>No starred slates yet</EmptyTitle>
              <EmptyDescription>Star a slate to keep it close at hand.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )
      ) : query.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load starred slates</AlertTitle>
          <AlertDescription>Check your connection and try again.</AlertDescription>
          <Button variant="outline" size="sm" onClick={refetchSlates}>
            Try again
          </Button>
        </Alert>
      ) : query.isPending ? (
        <div>
          {/* Announce loading once; the decorative cards below are hidden from screen readers. */}
          <output className="sr-only">Loading starred slates...</output>
          <div aria-hidden="true" className="flex gap-3 overflow-hidden">
            {starredSkeletonKeys.map((key) => (
              <div
                key={key}
                className="min-w-0 shrink-0 basis-2/3 sm:basis-2/5 lg:basis-28/100 2xl:basis-22/100"
              >
                <StarredSlateCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {query.isFetchingNextPage && (
        <div className="mt-3">
          <output className="sr-only">Loading more starred slates...</output>
          <div aria-hidden="true" className="flex gap-3 overflow-hidden">
            {nextStarredSkeletonKeys.map((key) => (
              <div
                key={key}
                className="min-w-0 shrink-0 basis-2/3 sm:basis-2/5 lg:basis-28/100 2xl:basis-22/100"
              >
                <StarredSlateCardSkeleton />
              </div>
            ))}
          </div>
        </div>
      )}
      {query.isFetchNextPageError && (
        <Alert variant="destructive" className="mt-3">
          <AlertTitle>Could not load more starred slates</AlertTitle>
          <Button variant="outline" size="sm" onClick={retryNextPage}>
            Try again
          </Button>
        </Alert>
      )}
    </section>
  );
}
