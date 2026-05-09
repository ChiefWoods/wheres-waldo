import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../trpc.ts";

const sceneRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.scene.findMany({
      where: { is_active: true },
      select: {
        id: true,
        slug: true,
        name: true,
        width: true,
        height: true,
      },
      orderBy: { id: "asc" },
    });
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const scene = await ctx.prisma.scene.findFirst({
        where: {
          slug: input.slug,
          is_active: true,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          width: true,
          height: true,
          sceneCharacters: {
            select: {
              character: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { id: "asc" },
          },
        },
      });

      if (!scene) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scene not found",
        });
      }

      return {
        id: scene.id,
        slug: scene.slug,
        name: scene.name,
        width: scene.width,
        height: scene.height,
        totalTargets: scene.sceneCharacters.length,
        characters: scene.sceneCharacters.map(
          (entry: (typeof scene.sceneCharacters)[number]) => entry.character,
        ),
      };
    }),
});

export { sceneRouter };
