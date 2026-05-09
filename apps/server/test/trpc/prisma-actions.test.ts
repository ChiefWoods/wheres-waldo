import { afterAll, beforeAll, beforeEach, expect, test } from "bun:test";

import type { prisma as PrismaClientInstance } from "../../src/lib/prisma.ts";
import type { Context } from "../../src/trpc/context.ts";
import type { appRouter as AppRouterInstance } from "../../src/trpc/routers/app.ts";

import { DEFAULT_TOLERANCE_NORM } from "../../src/lib/game-config.ts";

const testDbUrl = "file:./data/test.db";

type SeedData = {
  activeSceneId: number;
  activeSceneSlug: string;
  secondSceneId: number;
  inactiveSceneSlug: string;
  waldoId: number;
  wendaId: number;
  wizardId: number;
};

let prisma: typeof PrismaClientInstance;
let appRouter: typeof AppRouterInstance;
let seedData: SeedData;
let dbPath: string;
let cleanDbSnapshot: Uint8Array;

const createCaller = () => {
  const ctx: Context = {
    prisma,
    req: {} as Context["req"],
    res: {} as Context["res"],
  };

  return appRouter.createCaller(ctx);
};

const resolveDatabasePath = (databaseUrl: string): string => {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error(`Expected SQLite DATABASE_URL to start with "file:", received: ${databaseUrl}`);
  }

  const rawPath = databaseUrl.slice("file:".length);
  if (rawPath.startsWith("/")) {
    return rawPath;
  }

  const normalized = rawPath.startsWith("./") ? rawPath.slice(2) : rawPath;
  return `${import.meta.dir}/../../${normalized}`;
};

const clearAllData = async () => {
  await prisma.discovery.deleteMany();
  await prisma.session.deleteMany();
  await prisma.sceneCharacter.deleteMany();
  await prisma.character.deleteMany();
  await prisma.scene.deleteMany();
};

const seedBaseData = async (): Promise<SeedData> => {
  const activeScene = await prisma.scene.create({
    data: {
      slug: "beach",
      name: "Beach",
      width: 1200,
      height: 800,
      is_active: true,
    },
  });

  const secondScene = await prisma.scene.create({
    data: {
      slug: "space",
      name: "Space",
      width: 1400,
      height: 900,
      is_active: true,
    },
  });

  const inactiveScene = await prisma.scene.create({
    data: {
      slug: "inactive-map",
      name: "Inactive Map",
      is_active: false,
    },
  });

  const waldo = await prisma.character.create({ data: { name: "Waldo" } });
  const wenda = await prisma.character.create({ data: { name: "Wenda" } });
  const wizard = await prisma.character.create({ data: { name: "Wizard" } });

  await prisma.sceneCharacter.createMany({
    data: [
      {
        scene_id: activeScene.id,
        character_id: waldo.id,
        target_x_norm: 0.5,
        target_y_norm: 0.5,
        tolerance_norm: DEFAULT_TOLERANCE_NORM,
      },
      {
        scene_id: activeScene.id,
        character_id: wenda.id,
        target_x_norm: 0.2,
        target_y_norm: 0.25,
        tolerance_norm: DEFAULT_TOLERANCE_NORM,
      },
      {
        scene_id: secondScene.id,
        character_id: wizard.id,
        target_x_norm: 0.6,
        target_y_norm: 0.6,
        tolerance_norm: DEFAULT_TOLERANCE_NORM,
      },
    ],
  });

  return {
    activeSceneId: activeScene.id,
    activeSceneSlug: activeScene.slug,
    secondSceneId: secondScene.id,
    inactiveSceneSlug: inactiveScene.slug,
    waldoId: waldo.id,
    wendaId: wenda.id,
    wizardId: wizard.id,
  };
};

beforeAll(async () => {
  process.env.DATABASE_URL ??= testDbUrl;
  dbPath = resolveDatabasePath(process.env.DATABASE_URL);

  if (!(await Bun.file(dbPath).exists())) {
    throw new Error(`SQLite database file not found at DATABASE_URL path: ${dbPath}`);
  }

  ({ prisma } = await import("../../src/lib/prisma.ts"));
  ({ appRouter } = await import("../../src/trpc/routers/app.ts"));

  await clearAllData();
  await prisma.$disconnect();
  cleanDbSnapshot = await Bun.file(dbPath).bytes();
});

beforeEach(async () => {
  await prisma.$disconnect();
  await Bun.write(dbPath, cleanDbSnapshot);

  seedData = await seedBaseData();
});

afterAll(async () => {
  await prisma.$disconnect();
});

test("scene.list returns active scenes only", async () => {
  const caller = createCaller();
  const scenes = await caller.scene.list();

  expect(scenes).toHaveLength(2);
  expect(scenes.map((scene) => scene.slug)).toEqual([seedData.activeSceneSlug, "space"]);
});

test("scene.getBySlug returns character targets and rejects inactive slug", async () => {
  const caller = createCaller();
  const scene = await caller.scene.getBySlug({ slug: seedData.activeSceneSlug });

  expect(scene.slug).toBe(seedData.activeSceneSlug);
  expect(scene.totalTargets).toBe(2);
  expect(scene.characters.map((character) => character.name)).toEqual(["Waldo", "Wenda"]);

  await expect(caller.scene.getBySlug({ slug: seedData.inactiveSceneSlug })).rejects.toThrow(
    "Scene not found",
  );
});

test("session.start creates a started session for active scenes", async () => {
  const caller = createCaller();
  const started = await caller.session.start({ sceneId: seedData.activeSceneId });

  expect(started.sceneId).toBe(seedData.activeSceneId);
  expect(started.status).toBe("STARTED");
  expect(started.sessionId).toBeTruthy();
});

test("session.guess handles wrong guesses, duplicate discoveries, and auto-finish", async () => {
  const caller = createCaller();
  const started = await caller.session.start({ sceneId: seedData.activeSceneId });

  const wrongGuess = await caller.session.guess({
    sessionId: started.sessionId,
    characterId: seedData.waldoId,
    xNorm: 0.95,
    yNorm: 0.95,
  });
  expect(wrongGuess).toEqual({
    isCorrect: false,
    alreadyFound: false,
    foundCount: 0,
    totalTargets: 2,
    status: "STARTED",
  });

  const firstCorrect = await caller.session.guess({
    sessionId: started.sessionId,
    characterId: seedData.waldoId,
    xNorm: 0.5,
    yNorm: 0.5,
  });
  expect(firstCorrect).toEqual({
    isCorrect: true,
    alreadyFound: false,
    foundCount: 1,
    totalTargets: 2,
    status: "STARTED",
  });

  const duplicateCorrect = await caller.session.guess({
    sessionId: started.sessionId,
    characterId: seedData.waldoId,
    xNorm: 0.5,
    yNorm: 0.5,
  });
  expect(duplicateCorrect).toEqual({
    isCorrect: true,
    alreadyFound: true,
    foundCount: 1,
    totalTargets: 2,
    status: "STARTED",
  });

  const finishingGuess = await caller.session.guess({
    sessionId: started.sessionId,
    characterId: seedData.wendaId,
    xNorm: 0.2,
    yNorm: 0.25,
  });
  expect(finishingGuess).toEqual({
    isCorrect: true,
    alreadyFound: false,
    foundCount: 2,
    totalTargets: 2,
    status: "FINISHED",
  });

  const finishedSession = await prisma.session.findUnique({
    where: { id: started.sessionId },
    select: {
      attempts: true,
      status: true,
      ended_at: true,
      elapsed_ms: true,
      end_reason: true,
    },
  });
  expect(finishedSession).toBeTruthy();
  expect(finishedSession?.attempts).toBe(4);
  expect(finishedSession?.status).toBe("FINISHED");
  expect(finishedSession?.end_reason).toBe("all_found");
  expect(finishedSession?.ended_at).toBeTruthy();
  expect(typeof finishedSession?.elapsed_ms === "number" && finishedSession.elapsed_ms >= 0).toBe(
    true,
  );
});

test("session.terminate is idempotent and deletes only active sessions", async () => {
  const caller = createCaller();
  const started = await caller.session.start({ sceneId: seedData.activeSceneId });

  const firstTerminate = await caller.session.terminate({ sessionId: started.sessionId });
  expect(firstTerminate).toEqual({ terminated: true });

  const secondTerminate = await caller.session.terminate({ sessionId: started.sessionId });
  expect(secondTerminate).toEqual({ terminated: false });
});

test("session.best filters and sorts leaderboard rows, with pagination", async () => {
  const now = new Date();
  const sceneId = seedData.activeSceneId;

  await prisma.session.createMany({
    data: [
      {
        id: "best-fast",
        scene_id: sceneId,
        status: "FINISHED",
        started_at: new Date(now.getTime() - 1000),
        ended_at: now,
        elapsed_ms: 800,
        attempts: 10,
      },
      {
        id: "best-medium-low-attempts",
        scene_id: sceneId,
        status: "FINISHED",
        started_at: new Date(now.getTime() - 1200),
        ended_at: now,
        elapsed_ms: 1000,
        attempts: 3,
      },
      {
        id: "best-medium-high-attempts",
        scene_id: sceneId,
        status: "FINISHED",
        started_at: new Date(now.getTime() - 1300),
        ended_at: now,
        elapsed_ms: 1000,
        attempts: 5,
      },
      {
        id: "exclude-started",
        scene_id: sceneId,
        status: "STARTED",
        started_at: now,
        attempts: 8,
      },
      {
        id: "exclude-zero-attempts",
        scene_id: sceneId,
        status: "FINISHED",
        started_at: now,
        ended_at: now,
        elapsed_ms: 50,
        attempts: 0,
      },
      {
        id: "exclude-no-ended-at",
        scene_id: sceneId,
        status: "FINISHED",
        started_at: now,
        ended_at: null,
        elapsed_ms: 75,
        attempts: 1,
      },
      {
        id: "exclude-other-scene",
        scene_id: seedData.secondSceneId,
        status: "FINISHED",
        started_at: now,
        ended_at: now,
        elapsed_ms: 1,
        attempts: 1,
      },
    ],
  });

  const firstPage = await createCaller().session.best({
    sceneId,
    page: 1,
    pageSize: 2,
  });

  expect(firstPage.total).toBe(3);
  expect(firstPage.rows.map((row) => row.sessionId)).toEqual([
    "best-fast",
    "best-medium-low-attempts",
  ]);

  const secondPage = await createCaller().session.best({
    sceneId,
    page: 2,
    pageSize: 2,
  });

  expect(secondPage.total).toBe(3);
  expect(secondPage.rows.map((row) => row.sessionId)).toEqual(["best-medium-high-attempts"]);
});
