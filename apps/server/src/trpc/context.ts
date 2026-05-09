import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
const createContext = ({ req, res }: CreateFastifyContextOptions) => {
  return {
    prisma: req.server.prisma,
    req,
    res,
  };
};

type Context = Awaited<ReturnType<typeof createContext>>;

export { createContext };
export type { Context };
