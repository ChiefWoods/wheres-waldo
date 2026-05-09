import fp from "fastify-plugin";

import { prisma } from "../lib/prisma.ts";

export default fp(async (fastify) => {
  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    prisma: typeof prisma;
  }
}
