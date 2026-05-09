import { expect, test } from "bun:test";
import Fastify from "fastify";

import PrismaPlugin from "../../src/plugins/prisma";

test("prisma plugin decorates fastify instance", async () => {
  const fastify = Fastify();
  // eslint-disable-next-line no-void
  void fastify.register(PrismaPlugin);

  await fastify.ready();

  expect(fastify.prisma).toBeDefined();

  await fastify.close();
});
