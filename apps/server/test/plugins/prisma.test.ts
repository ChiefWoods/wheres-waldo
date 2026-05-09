import Fastify from "fastify";
import * as assert from "node:assert";
import { test } from "node:test";

import PrismaPlugin from "../../src/plugins/prisma";

test("prisma plugin decorates fastify instance", async () => {
  const fastify = Fastify();
  // eslint-disable-next-line no-void
  void fastify.register(PrismaPlugin);

  await fastify.ready();

  assert.ok(fastify.prisma);

  await fastify.close();
});
