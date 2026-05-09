import fp from "fastify-plugin";

import {
  ensureStaleSessionCleanupSchedulerRunning,
  stopStaleSessionCleanupScheduler,
} from "../lib/stale-session-cleanup.ts";

export default fp(async (fastify) => {
  fastify.addHook("onReady", async () => {
    const activeSessionCount = await fastify.prisma.session.count({
      where: {
        status: "STARTED",
      },
    });

    if (activeSessionCount > 0) {
      ensureStaleSessionCleanupSchedulerRunning(fastify.prisma, fastify.log);
    }
  });

  fastify.addHook("onClose", async () => {
    stopStaleSessionCleanupScheduler();
  });
});
