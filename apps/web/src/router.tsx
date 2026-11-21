import { createRouter as createTanStackRouter, useRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import type { ReactNode } from "react";
import * as TanstackQuery from "#/integrations/tanstack-query";
import { routeTree } from "#/routeTree.gen";

function RouterQueryProvider({ children }: { children: ReactNode }) {
  // Read the QueryClient from this router instance instead of creating another cache.
  const router = useRouter();
  return (
    <TanstackQuery.Provider queryClient={router.options.context.queryClient}>
      {children}
    </TanstackQuery.Provider>
  );
}

export function getRouter() {
  // Build a new router and query cache for each server request.
  const rqContext = TanstackQuery.getContext();

  const router = createTanStackRouter({
    routeTree,
    context: { ...rqContext },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    Wrap: RouterQueryProvider,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient: rqContext.queryClient,
  });

  return router;
}
