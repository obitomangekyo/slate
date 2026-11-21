import { QueryClient } from "@tanstack/react-query";

interface QueryContext {
  queryClient: QueryClient;
}

export function getContext(): QueryContext {
  // Create one cache for this router context so users do not share cached account data.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 1000 * 60 * 5,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
      },
    },
  });

  return { queryClient };
}
