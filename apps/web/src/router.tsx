import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import * as TanstackQuery from "#/integrations/tanstack-query";
import { routeTree } from "#/routeTree.gen";

export function getRouter() {
  // Build a new router and query cache for each server request.
  const rqContext = TanstackQuery.getContext();

  const router = createTanStackRouter({
    routeTree,
    context: { ...rqContext },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient: rqContext.queryClient,
  });

  return router;
}
