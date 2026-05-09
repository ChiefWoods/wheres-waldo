import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";

import type { PrismaClient } from "../../generated/prisma/client";

const createContext = ({ req, res }: CreateFastifyContextOptions) => {
  const serverWithPrisma = req.server as typeof req.server & {
    prisma: PrismaClient;
  };

  return {
    prisma: serverWithPrisma.prisma,
    req,
    res,
  };
};

type Context = Awaited<ReturnType<typeof createContext>>;

export { createContext };
export type { Context };
