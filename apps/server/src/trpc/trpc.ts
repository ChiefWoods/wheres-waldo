import { initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { Context } from "./context.ts";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const router = t.router;
const publicProcedure = t.procedure;

export { publicProcedure, router };
