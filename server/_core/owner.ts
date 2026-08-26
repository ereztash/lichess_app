/**
 * The single-tenant gate.
 *
 * WHAT IT GUARDS AND WHY IT LIVES HERE. This used to sit inside `server/routers.ts`, where only
 * the Lichess routes and Layer C could reach it -- so the deployed product was single-tenant
 * everywhere EXCEPT the one router holding the private text. A second signed-in account could
 * read another person's `stated_unknown`: what they admitted they did not understand, written
 * down before anyone told them the answer. Reproduced as HTTP 200 with the text in the body.
 *
 * Moving it here is the whole fix. `protectedProcedure` asks "is somebody signed in", which is a
 * different question from "is this their record", and no record table carries a `user_id` for a
 * query to scope by even if one had wanted to.
 *
 * TWO CAUSES, TWO MESSAGES, and this is not decoration. A deployment that never set
 * OWNER_OPEN_ID and a visitor signed in as somebody else are different facts with different
 * fixes -- one is a server the owner has to configure, the other is a browser session. They once
 * produced one identical FORBIDDEN, which is precisely the failure this product exists to stop,
 * occurring inside the product.
 */
import { TRPCError } from "@trpc/server";
import { ENV } from "./env.js";
import { protectedProcedure } from "./trpc.js";

export const ownerProcedure = protectedProcedure.use(({ ctx, next }) => {
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
        "הרשומה הזו שייכת לחשבון שהגדיר את הפריסה. אתם מחוברים בחשבון אחר מזה " +
        "ש-OWNER_OPEN_ID מצביע עליו.",
    });
  return next({ ctx });
});
