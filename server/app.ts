/**
 * The single Express app. Both entry points import this.
 *
 * Before this existed, api/[...path].ts was a 250-line hand copy of server/lichess.ts +
 * server/routers.ts that imported nothing local, while the client took its types from
 * server/routers.ts. Types came from one file, behaviour from another, and the two had already
 * drifted in seven ways (see tests/server/lichess.test.ts).
 */
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createContext } from "./_core/context.js";
import { registerOAuthRoutes } from "./_core/oauth.js";
import { buildAppRouter } from "./routers.js";
import { recordStore, type RecordStore } from "./record.js";
import { describeForOperator } from "./_core/safe-error.js";
import { configurationFaults } from "./_core/configuration.js";
import { ENV } from "./_core/env.js";

export function createApp({ store = recordStore }: { store?: RecordStore } = {}) {
  const app = express();
  /*
   * WHAT EVERY API RESPONSE SAYS ABOUT HOW IT MAY BE TREATED.
   *
   * The deployment sent none of this. Each line below is one assumption a browser or a proxy was
   * otherwise free to make about a response carrying the player's own record:
   *
   * - `x-powered-by` named the framework and its major version to anyone who asked, for nothing.
   * - `nosniff`: without it a browser may re-guess the type of a JSON body and execute it. The
   *   record contains the player's own prose, so the bytes that would be re-guessed are theirs.
   * - `frame-ancestors 'none'` plus `X-Frame-Options`: the API in an invisible frame on another
   *   site is the shape clickjacking takes, and the two headers cover different browsers.
   * - `Referrer-Policy: no-referrer`: an API request has no reason to tell anywhere else which
   *   page it came from, and these paths carry record ids.
   * - `Cross-Origin-Resource-Policy: same-origin`: another origin may embed a response it cannot
   *   read, and side channels have repeatedly turned "embedded but unreadable" into "read".
   * - `Cache-Control: no-store`: this record is one person's, and the product's central claim is
   *   that it does not leave the deployment. A shared cache holding a copy would make that false
   *   without anything in the code changing.
   *
   * These are for `/api/*` only -- the pages and assets are served by the platform's CDN, not by
   * this app, so their headers live in `vercel.json` and cannot be set from here.
   */
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  /*
   * SAID ONCE, AT STARTUP, TO THE ONLY CHANNEL THAT CAN CARRY IT.
   *
   * `system.lichessConfig` is where this product names its missing pieces, and it is protected --
   * correctly, because those names describe the deployment. But reaching it needs a session and
   * creating a session needs `JWT_SECRET`, so on a deployment missing that variable the report
   * that would name it is the one thing unreachable. The operator sees a sign-in button that
   * appears to do nothing.
   *
   * On the serverless entry this runs per cold start rather than once per deploy, which is the
   * right frequency anyway: the variables can change under a running project.
   */
  for (const fault of configurationFaults({
    jwtSecret: ENV.cookieSecret,
    oAuthServerUrl: ENV.oAuthServerUrl,
    ownerOpenId: ENV.ownerOpenId,
    databaseUrl: process.env.DATABASE_URL ?? "",
  })) {
    console.warn(`[config] ${fault.code} (${fault.variables.join(", ")}): ${fault.consequence}`);
  }
  /*
   * 1 MB, DOWN FROM 10. Nothing this API accepts comes close: every prose field on a decision is
   * capped by its schema at 200-300 characters, the import diagnostic is bounded at 64 KiB where
   * it is parsed, and a tRPC batch carries a handful of those. Ten megabytes was a number nobody
   * chose -- it was the framework example -- and on a serverless function it is ten megabytes of
   * parse the caller gets to spend before a single validator runs.
   */
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));
  /**
   * Whether this deployment can do what it says, measured rather than asserted.
   *
   * THIS RETURNED `{ok: true}` UNCONDITIONALLY. It is the diagnostic this project actually used
   * during the FUNCTION_INVOCATION_FAILED outage and the evidence cited in docs/FINDINGS.md that
   * a deployment is alive -- and what it measured was that a line of code ran. A deployment whose
   * database was down was "ok" to every monitor watching it. "ok" is a much larger word than
   * "this handler executed", and this product exists to say so.
   *
   * ABSENT IS NOT DOWN. No DATABASE_URL is a SUPPORTED deployment: the record runs in the
   * browser, by design, and the client is told so. Down is a database that was configured and
   * cannot be reached -- that is the state where the loop breaks and somebody should be woken up.
   *
   * NO AUTH, SO NO DETAIL. `system.lichessConfig` is protected precisely because the names of the
   * missing pieces describe the deployment; listing them here would move that report to an
   * unauthenticated URL. The operator gets the names after signing in. A monitor gets a status
   * code, which is what a monitor acts on.
   */
  app.get("/api/health", (_req, res) => {
    const configured = Boolean(process.env.DATABASE_URL);
    /*
     * NOT AN `async` HANDLER. Express 4 does not catch a rejected promise from one -- it neither
     * responds nor errors, so the request hangs until the platform kills it, and a monitor reads
     * that timeout as "the whole deployment is gone" rather than "the database is down". A hung
     * health check is worse than a red one: it pages for the wrong thing. So the probe's failure
     * is handled here as well as inside it, and every path ends in a response.
     */
    const probe = configured ? store.isAvailable() : Promise.resolve(true);
    probe
      .then((ok) => res.status(ok ? 200 : 503).json({ ok }))
      .catch(() => res.status(503).json({ ok: false }));
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: buildAppRouter(store),
      createContext,
      /*
       * The operator's half of the error, which is NOT the player's half.
       *
       * The wire now carries a fixed sentence for anything the product did not author, so without
       * this a 500 would be undiagnosable from either side. `describeForOperator` keeps the
       * PARAMETERIZED statement -- safe by construction, every value is `?` -- and drops
       * `message` and `params`, which are the two places drizzle puts the values.
       */
      onError: ({ error, path }) => {
        if (error.code !== "INTERNAL_SERVER_ERROR") return;
        console.error(`[trpc] ${path ?? "?"} ${describeForOperator(error.cause ?? error)}`);
      },
    }),
  );
  return app;
}
