import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { Prisma } from "../../../generated/prisma/client";
import { ensureStaleSessionCleanupSchedulerRunning } from "../../lib/stale-session-cleanup.ts";
import { publicProcedure, router } from "../trpc.ts";

const normalizedCoordinate = z.number().finite().min(0).max(1);

const sessionRouter = router({
  start: publicProcedure
    .input(z.object({ sceneId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const scene = await ctx.prisma.scene.findFirst({
        where: {
          id: input.sceneId,
          is_active: true,
        },
        select: { id: true },
      });

      if (!scene) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Scene not found",
        });
      }

      const session = await ctx.prisma.session.create({
        data: {
          scene_id: scene.id,
          last_activity_at: new Date(),
        },
        select: {
          id: true,
          scene_id: true,
          status: true,
          started_at: true,
        },
      });

      ensureStaleSessionCleanupSchedulerRunning(ctx.prisma, ctx.req.log);

      return {
        sessionId: session.id,
        sceneId: session.scene_id,
        status: session.status,
        startedAt: session.started_at,
      };
    }),

  guess: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
        characterId: z.number().int().positive(),
        xNorm: normalizedCoordinate,
        yNorm: normalizedCoordinate,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.$transaction(async (tx) => {
        const session = await tx.session.findUnique({
          where: { id: input.sessionId },
          select: {
            id: true,
            scene_id: true,
            status: true,
            started_at: true,
          },
        });

        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Session not found",
          });
        }

        if (session.status !== "STARTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Session is inactive",
          });
        }

        const now = new Date();

        await tx.session.update({
          where: { id: session.id },
          data: {
            attempts: {
              increment: 1,
            },
            last_activity_at: now,
          },
        });

        const sceneCharacter = await tx.sceneCharacter.findUnique({
          where: {
            scene_id_character_id: {
              scene_id: session.scene_id,
              character_id: input.characterId,
            },
          },
          select: {
            id: true,
            target_x_norm: true,
            target_y_norm: true,
            tolerance_norm: true,
          },
        });

        if (!sceneCharacter) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Character is not valid for this scene",
          });
        }

        const deltaX = input.xNorm - sceneCharacter.target_x_norm;
        const deltaY = input.yNorm - sceneCharacter.target_y_norm;
        const distance = Math.hypot(deltaX, deltaY);
        const isCorrect = distance <= sceneCharacter.tolerance_norm;

        if (!isCorrect) {
          const [foundCount, totalTargets] = await Promise.all([
            tx.discovery.count({
              where: { session_id: session.id },
            }),
            tx.sceneCharacter.count({
              where: { scene_id: session.scene_id },
            }),
          ]);

          return {
            isCorrect: false,
            alreadyFound: false,
            foundCount,
            totalTargets,
            status: "STARTED" as const,
          };
        }

        let alreadyFound = false;

        try {
          await tx.discovery.create({
            data: {
              session_id: session.id,
              scene_character_id: sceneCharacter.id,
              click_x_norm: input.xNorm,
              click_y_norm: input.yNorm,
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            alreadyFound = true;
          } else {
            throw error;
          }
        }

        const [foundCount, totalTargets] = await Promise.all([
          tx.discovery.count({
            where: { session_id: session.id },
          }),
          tx.sceneCharacter.count({
            where: { scene_id: session.scene_id },
          }),
        ]);

        let status: "STARTED" | "FINISHED" = "STARTED";

        if (foundCount === totalTargets && totalTargets > 0) {
          const endedAt = new Date();

          await tx.session.update({
            where: { id: session.id },
            data: {
              status: "FINISHED",
              ended_at: endedAt,
              elapsed_ms: endedAt.getTime() - session.started_at.getTime(),
              end_reason: "all_found",
              last_activity_at: endedAt,
            },
          });

          status = "FINISHED";
        }

        return {
          isCorrect: true,
          alreadyFound,
          foundCount,
          totalTargets,
          status,
        };
      });
    }),

  terminate: publicProcedure
    .input(
      z.object({
        sessionId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.prisma.session.deleteMany({
        where: {
          id: input.sessionId,
          status: "STARTED",
        },
      });

      return {
        terminated: deleted.count > 0,
      };
    }),

  best: publicProcedure
    .input(
      z.object({
        sceneId: z.number().int().positive(),
        page: z.number().int().positive().default(1),
        pageSize: z.number().int().positive().max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const skip = (input.page - 1) * input.pageSize;

      const where = {
        scene_id: input.sceneId,
        status: "FINISHED" as const,
        ended_at: { not: null },
        attempts: { gt: 0 },
      };

      const [rows, total] = await Promise.all([
        ctx.prisma.session.findMany({
          where,
          select: {
            id: true,
            scene_id: true,
            attempts: true,
            started_at: true,
            ended_at: true,
            elapsed_ms: true,
          },
          orderBy: [{ elapsed_ms: "asc" }, { attempts: "asc" }],
          skip,
          take: input.pageSize,
        }),
        ctx.prisma.session.count({
          where,
        }),
      ]);

      return {
        page: input.page,
        pageSize: input.pageSize,
        total,
        rows: rows.map((row) => ({
          sessionId: row.id,
          sceneId: row.scene_id,
          attempts: row.attempts,
          startedAt: row.started_at,
          endedAt: row.ended_at,
          elapsedMs: row.elapsed_ms,
        })),
      };
    }),
});

export { sessionRouter };
