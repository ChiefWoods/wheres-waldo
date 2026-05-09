import type { FastifyTRPCPluginOptions } from "@trpc/server/adapters/fastify";
import type { FastifyPluginAsync } from "fastify";

import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";

import { createContext } from "../trpc/context.ts";
import { appRouter, type AppRouter } from "../trpc/routers/app.ts";

const trpcRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: "/trpc",
    trpcOptions: {
      router: appRouter,
      createContext,
      onError({ path, error }) {
        fastify.log.error({ err: error, path }, "tRPC handler error");
      },
    } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
  });
};

export default trpcRoutes;
