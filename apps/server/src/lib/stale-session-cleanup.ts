import type { PrismaClient } from "../../generated/prisma/client";

const ONE_HOUR_IN_MS = 60 * 60 * 1000;

const DEFAULT_LOGGER = {
  info: (data: Record<string, unknown>, message: string) => {
    console.info(message, data);
  },
  error: (data: Record<string, unknown>, message: string) => {
    console.error(message, data);
  },
};

type SessionCleanupPrisma = Pick<PrismaClient, "$transaction" | "session">;

type SessionCleanupLogger = {
  info: (data: Record<string, unknown>, message: string) => void;
  error: (data: Record<string, unknown>, message: string) => void;
};

type CleanupCycleOptions = {
  now?: Date;
  logger?: SessionCleanupLogger;
};

type CleanupCycleResult = {
  deletedCount: number;
  activeSessionCount: number;
  stopScheduler: boolean;
};

class StaleSessionCleanupScheduler {
  private readonly prisma: SessionCleanupPrisma;
  private readonly logger: SessionCleanupLogger;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private runningCleanup = false;

  constructor(prisma: SessionCleanupPrisma, logger: SessionCleanupLogger) {
    this.prisma = prisma;
    this.logger = logger;
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  start(): boolean {
    if (this.intervalId) {
      return false;
    }

    this.intervalId = setInterval(() => {
      void this.runCycle();
    }, ONE_HOUR_IN_MS);

    this.intervalId.unref?.();

    this.logger.info(
      {
        intervalMs: ONE_HOUR_IN_MS,
      },
      "Stale session cleanup scheduler started",
    );

    return true;
  }

  stop(): boolean {
    if (!this.intervalId) {
      return false;
    }

    clearInterval(this.intervalId);
    this.intervalId = null;

    this.logger.info({}, "Stale session cleanup scheduler stopped");

    return true;
  }

  async runCycle(now = new Date()): Promise<CleanupCycleResult> {
    if (this.runningCleanup) {
      return {
        deletedCount: 0,
        activeSessionCount: 0,
        stopScheduler: false,
      };
    }

    this.runningCleanup = true;

    try {
      const result = await runStaleSessionCleanupCycle(this.prisma, {
        now,
        logger: this.logger,
      });

      if (result.stopScheduler) {
        this.stop();
      }

      return result;
    } catch (error) {
      this.logger.error(
        {
          err: error,
        },
        "Stale session cleanup cycle failed",
      );
      throw error;
    } finally {
      this.runningCleanup = false;
    }
  }
}

let scheduler: StaleSessionCleanupScheduler | null = null;

const toLogger = (logger?: SessionCleanupLogger): SessionCleanupLogger => {
  return logger ?? DEFAULT_LOGGER;
};

const getOrCreateScheduler = (
  prisma: SessionCleanupPrisma,
  logger?: SessionCleanupLogger,
): StaleSessionCleanupScheduler => {
  if (!scheduler) {
    scheduler = new StaleSessionCleanupScheduler(prisma, toLogger(logger));
  }

  return scheduler;
};

const runStaleSessionCleanupCycle = async (
  prisma: SessionCleanupPrisma,
  options: CleanupCycleOptions = {},
): Promise<CleanupCycleResult> => {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - ONE_HOUR_IN_MS);
  const logger = toLogger(options.logger);

  const [deleted, activeSessionCount] = await prisma.$transaction([
    prisma.session.deleteMany({
      where: {
        status: "STARTED",
        last_activity_at: {
          lte: cutoff,
        },
      },
    }),
    prisma.session.count({
      where: {
        status: "STARTED",
      },
    }),
  ]);

  const deletedCount = deleted.count;
  const stopScheduler = activeSessionCount === 0;

  logger.info(
    {
      deletedCount,
      activeSessionCount,
      cutoffIso: cutoff.toISOString(),
    },
    "Stale session cleanup cycle completed",
  );

  return {
    deletedCount,
    activeSessionCount,
    stopScheduler,
  };
};

const ensureStaleSessionCleanupSchedulerRunning = (
  prisma: SessionCleanupPrisma,
  logger?: SessionCleanupLogger,
): boolean => {
  const cleanupScheduler = getOrCreateScheduler(prisma, logger);
  return cleanupScheduler.start();
};

const isStaleSessionCleanupSchedulerRunning = (): boolean => {
  return scheduler?.isRunning() ?? false;
};

const stopStaleSessionCleanupScheduler = (): boolean => {
  return scheduler?.stop() ?? false;
};

const runStaleSessionCleanupSchedulerCycle = async (now?: Date): Promise<CleanupCycleResult> => {
  if (!scheduler) {
    throw new Error("Stale session cleanup scheduler has not been initialized");
  }

  return scheduler.runCycle(now);
};

export {
  ONE_HOUR_IN_MS,
  ensureStaleSessionCleanupSchedulerRunning,
  isStaleSessionCleanupSchedulerRunning,
  runStaleSessionCleanupCycle,
  runStaleSessionCleanupSchedulerCycle,
  stopStaleSessionCleanupScheduler,
};
export type { CleanupCycleResult, SessionCleanupLogger, SessionCleanupPrisma };
