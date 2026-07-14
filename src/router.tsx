import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // GitHub Pages serves each prerendered page as a directory index and
    // 301-redirects "<page>" to "<page>/", so generate all links with the
    // trailing slash to keep crawlers off the redirect.
    trailingSlash: "always",
  });

  return router;
};
