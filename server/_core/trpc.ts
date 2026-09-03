import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "../../shared/const.js";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context.js";
import { safeErrorMessage } from "./safe-error.js";
/**
 * ONE PLACE DECIDES WHAT LEAVES THE SERVER, and it is here rather than in a router.
 *
 * A failed record write used to return the player's own sentence in the 500 body: drizzle-orm
 * appends the bound values to its message, `recordRouter`'s `toTrpc` rethrew anything that was not
 * a `RecordError`, and tRPC's default shape puts `message` on the wire verbatim. Reproduced
 * against a real MariaDB -- message, `params` and wire all carried `stated_unknown`, which is what
 * a player writes about what they did not understand before anybody tells them the answer.
 *
 * The formatter rather than the router, because a router-level fix covers only the procedures
 * somebody remembered to wrap. Lichess, Layer C and auth all raise driver and fetch errors too,
 * and the previous attempt at this class of defect was fixed on exactly one procedure and
 * declared closed. Here there is no procedure to forget.
 */
const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error, ctx }) => ({
    ...shape,
    message: safeErrorMessage(error.cause ?? error),
    /*
     * REBUILT, NOT SPREAD, AND THE STACK IS WHY.
     *
     * Sanitising `message` alone left the value on the wire anyway: tRPC's default shape puts
     * `data.stack` in every non-production build, and a drizzle stack BEGINS with the drizzle
     * message -- which is where the bound values are. Reproduced over real HTTP with the message
     * already clean and the body still carrying the player's sentence.
     *
     * So this lists what may leave rather than removing what may not. `code`, `httpStatus` and
     * `path` are the client's; anything a future tRPC adds to that object arrives here having to
     * be named before it ships.
     */
    data: {
      code: shape.data.code,
      httpStatus: shape.data.httpStatus,
      path: shape.data.path,
      /*
       * THE ONE ADDITION TO THE ALLOW-LIST, and it is a platform trace id rather than anything of
       * the player's: the same `x-vercel-id` the response headers already carry, named here so a
       * failure disclosure can show it and an operator can grep the log for it.
       */
      requestId: ctx?.requestId ?? null,
    },
  }),
});
export const router = t.router;
export const publicProcedure = t.procedure;
const requireUser = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const protectedProcedure = t.procedure.use(requireUser);
export const adminProcedure = t.procedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== "admin")
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    return next({ ctx: { ...ctx, user: ctx.user } });
  }),
);
