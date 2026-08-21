import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  getLichessAccount,
  getLichessGamePgn,
  getLichessStudyPgn,
  getPersonalOpening,
  getPostGameLayers,
  getRecentLichessGames,
} from "./lichess";
const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ENV.ownerOpenId || ctx.user.openId !== ENV.ownerOpenId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "חיבור Lichess זמין רק לבעל החשבון שהגדיר אותו.",
    });
  return next({ ctx });
});
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((o) => o.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  lichess: router({
    account: ownerProcedure.query(() => getLichessAccount()),
    recentGames: ownerProcedure
      .input(z.object({ max: z.number().int().min(1).max(30).default(12) }))
      .query(async ({ input }) => {
        const account = await getLichessAccount();
        return getRecentLichessGames(account.username, input.max);
      }),
    gamePgn: ownerProcedure
      .input(z.object({ gameId: z.string().min(8).max(16) }))
      .mutation(({ input }) => getLichessGamePgn(input.gameId)),
    postGameLayers: ownerProcedure
      .input(
        z.object({
          fen: z.string().min(8).max(200),
          source: z.enum(["demo", "imported", "finished", "study", "live"]),
        }),
      )
      .query(({ input }) => getPostGameLayers(input)),
    personalOpening: ownerProcedure
      .input(
        z.object({
          fen: z.string().min(8).max(200),
          source: z.enum(["demo", "imported", "finished", "study", "live"]),
          playerColor: z.enum(["white", "black"]),
        }),
      )
      .query(({ input }) => getPersonalOpening(input)),
    studyPgn: ownerProcedure
      .input(z.object({ studyReference: z.string().min(8).max(250) }))
      .mutation(({ input }) => getLichessStudyPgn(input.studyReference)),
  }),
});
export type AppRouter = typeof appRouter;
