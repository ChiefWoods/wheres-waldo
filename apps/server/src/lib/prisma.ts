import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "../../generated/prisma/client";
import { seedDatabase } from "../../prisma/seed.ts";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

const shouldAutoSeed = process.env.AUTO_SEED_ON_EMPTY_DB === "true";

if (shouldAutoSeed) {
  const sceneCount = await prisma.scene.count();

  if (sceneCount === 0) {
    await seedDatabase(prisma);
  }
}

export { prisma };
