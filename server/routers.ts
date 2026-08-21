import { COOKIE_NAME } from "../shared/const.js";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies.js";
import { recordStore, type RecordStore } from "./record.js";
import { buildRecordRouter } from "./recordRouter.js";
import { ENV } from "./_core/env.js";
import { systemRouter } from "./_core/systemRouter.js";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc.js";
import {
  getLichessAccount,
  getLichessGamePgn,
  getLichessStudyPgn,
  getPersonalOpening,
  getPostGameLayers,
  getRecentLichessGames,
} from "./lichess.js";
/**
 * The single-tenant gate.
 *
 * Two different causes used to produce one identical message: a deployment that never set
 * OWNER_OPEN_ID, and a visitor signed in as somebody else. Identical output erasing different
 * causes is the thing this product exists to stop, so the two are separated here.
 */
const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ENV.ownerOpenId)
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "בפריסה הזו לא הוגדר OWNER_OPEN_ID, ולכן אף חשבון אינו יכול לעבור את השער. " +
        "זו הגדרה חסרה בשרת, לא הרשאה חסרה שלך.",
    });
  if (ctx.user.openId !== ENV.ownerOpenId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "חיבור Lichess זמין רק לבעל החשבון שהגדיר אותו. אתם מחוברים בחשבון אחר מזה " +
        "ש-OWNER_OPEN_ID מצביע עליו.",
    });
  return next({ ctx });
});
export function buildAppRouter(store: RecordStore = recordStore) {
  return router({
    system: systemRouter,
    record: buildRecordRouter(store),
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
}

export const appRouter = buildAppRouter();
export type AppRouter = ReturnType<typeof buildAppRouter>;
