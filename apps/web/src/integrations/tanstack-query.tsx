import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

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

export function Provider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  // Make the router-owned cache available to queries throughout the React tree.
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
