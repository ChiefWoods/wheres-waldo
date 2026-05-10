import { createRouter } from "@tanstack/react-router";

import { NotFoundPage } from "./components/not-found";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
  defaultPreload: "intent",
  defaultNotFoundComponent: NotFoundPage,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
