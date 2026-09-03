import { ENV } from "./env.js";
import { protectedProcedure, router } from "./trpc.js";

/*
 * `system.health` IS GONE, AND IT WAS THE DEFECT `/api/health` FIXED, ONE ROUTE OVER.
 *
 * It returned `{ ok: true }` unconditionally -- a test that a line of code ran, wearing the name of
 * a health check -- while `/api/health` had already been rewritten to measure the database and say
 * so in its own comment. Two health endpoints that disagree are worse than one that is wrong: a
 * monitor pointed at the second would have watched a dead database stay "ok". Nothing in the client
 * called it. One health authority: `/api/health` in server/app.ts.
 */
export const systemRouter = router({
  /**
   * Which server-side pieces the Lichess integration needs, and whether each is present.
   *
   * PRESENCE ONLY -- never a value, never a prefix, never a length. A configuration report that
   * leaks the thing it reports on is worse than no report.
   *
   * Protected, not public: these names describe the deployment, and the moment they matter is
   * after sign-in anyway. Before sign-in the missing pieces are the VITE_ ones, and the client
   * can see those without asking the server.
   */
  lichessConfig: protectedProcedure.query(({ ctx }) => {
    const present = {
      LICHESS_API_TOKEN: Boolean(process.env.LICHESS_API_TOKEN),
      OWNER_OPEN_ID: Boolean(ENV.ownerOpenId),
      OAUTH_SERVER_URL: Boolean(ENV.oAuthServerUrl),
      JWT_SECRET: Boolean(ENV.cookieSecret),
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
    };
    return {
      present,
      missing: Object.entries(present)
        .filter(([, ok]) => !ok)
        .map(([name]) => name),
      /**
       * Whether the signed-in account is the one the deployment is gated to. A correct token
       * with the wrong owner fails exactly like a missing token, so the two are separated.
       */
      isOwner: Boolean(ENV.ownerOpenId) && ctx.user.openId === ENV.ownerOpenId,
    };
  }),
});
