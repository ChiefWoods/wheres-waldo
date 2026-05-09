import { router } from "../trpc.ts";
import { sceneRouter } from "./scene.ts";
import { sessionRouter } from "./session.ts";

const appRouter = router({
  scene: sceneRouter,
  session: sessionRouter,
});

type AppRouter = typeof appRouter;

export { appRouter };
export type { AppRouter };
