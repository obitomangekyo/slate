import { useCallback, useEffect, useMemo, useState } from "react";
import { StarredSlateCard } from "#/components/starred-slate-card";
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
import { Skeleton } from "#/components/ui/skeleton";
import { useSlatePagesQuery } from "#/lib/slates";

const carouselOptions = { align: "start", containScroll: "trimSnaps" } as const;

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
                  className="basis-[88%] pl-3 sm:basis-[48%] lg:basis-[32%] 2xl:basis-[24%]"
                >
                  <StarredSlateCard slate={slate} />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        ) : (
          <p className="border-line bg-paper-raised text-muted rounded-sm border border-dashed px-4 py-3 text-sm">
            No starred slates yet.
          </p>
        )
      ) : query.error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load starred slates</AlertTitle>
          <AlertDescription>Check your connection and try again.</AlertDescription>
          <Button variant="outline" size="sm" onClick={refetchSlates}>
            Try again
          </Button>
        </Alert>
      ) : null}

      {query.isFetchingNextPage && <Skeleton className="mt-3 h-24" />}
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
