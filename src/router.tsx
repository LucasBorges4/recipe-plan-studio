import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  // Desidrata o cache do React Query no HTML do servidor: sem isso o primeiro
  // render do cliente parte de um cache vazio e ocorre hydration mismatch.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
};
