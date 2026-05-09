import "dotenv/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";

import { PrismaClient } from "../../generated/prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

export { prisma };
