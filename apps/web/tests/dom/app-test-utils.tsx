import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { NotFoundPage } from "../../src/components/not-found";
import { ThemeProvider } from "../../src/components/theme-provider";
import { routeTree } from "../../src/routeTree.gen";

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createTestRouter(initialLocation: string) {
  const history: RouterHistory = createMemoryHistory({
    initialEntries: [initialLocation],
  });

  return createRouter({
    routeTree,
    history,
    defaultPreload: "intent",
    defaultNotFoundComponent: NotFoundPage,
  });
}

function renderApp(initialLocation: string) {
  const queryClient = createTestQueryClient();
  const router = createTestRouter(initialLocation);

  const renderResult = render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </QueryClientProvider>,
  );

  return {
    ...renderResult,
    queryClient,
    router,
  };
}

export { renderApp };
