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
import { runtimeBuildIdentity } from "./_core/build.js";
import { emit, requestIdFrom } from "./_core/telemetry.js";
import { failureClassOfTrpcCode } from "../shared/failure-class.js";
import { clientFailureEventSchema } from "../shared/failure-event.js";

const CLIENT_EVENT_FIELDS = ["code", "failureClass", "surface", "build", "at"];

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
    /* The same line it always was, as a structured event: code, variable NAMES, consequence. */
    emit({
      code: "config-fault",
      failureClass: "precondition",
      detail: `${fault.code}: ${fault.consequence}`,
      variables: fault.variables,
    });
  }
  /*
   * `simple`, NOT EXPRESS 4's DEFAULT `extended`. The default runs `qs.parse` on every request's
   * query string before any route or any auth, and `qs` is where this build's three open moderate
   * advisories live (array-limit bypass, isBuffer DoS). Nothing here needs nested query objects:
   * tRPC reads `input` and `batch` as flat strings, and the OAuth callback reads `code` and `state`.
   * The `urlencoded` parser that used to sit below this line is gone for the same reason -- no
   * route ever consumed a form body, and it was one more qs entry point an anonymous caller could
   * reach with a megabyte.
   */
  app.set("query parser", "simple");
  /**
   * A browser's own report of a failure, and the strictest body this API accepts.
   *
   * BEFORE THE GENERAL JSON PARSER, so this route gets its own 2 KB ceiling rather than the
   * megabyte the record routes need. The body is enums and a commit sha and nothing else --
   * `clientFailureEventSchema` is `.strict()` and every field is a closed list -- so a report can
   * say WHICH of the product's own named failures a browser met and on WHICH screen, and it can
   * never carry a position, a sentence, a username or a stack. That is the whole of the privacy
   * argument for sending it at all, and the test beside it holds it.
   *
   * PUBLIC, because the failures worth knowing about happen to strangers who are not signed in.
   * 204 on success and 400 on a body the schema refuses, with nothing echoed either way.
   */
  app.post("/api/client-event", express.json({ limit: "2kb" }), (req, res) => {
    /*
     * OWN KEYS FIRST. zod's `.strict()` refuses unknown keys but lets an own `__proto__` key through
     * (found by the adversarial review); nothing read it, so nothing leaked, but "any other field
     * is refused" has to be true of every key, not most. Five names, exactly, before parsing.
     */
    const body: unknown = req.body;
    const ownKeys = body !== null && typeof body === "object" && !Array.isArray(body) ? Object.keys(body) : null;
    if (!ownKeys || ownKeys.length !== CLIENT_EVENT_FIELDS.length || ownKeys.some((k) => !CLIENT_EVENT_FIELDS.includes(k))) {
      res.status(400).end();
      return;
    }
    const parsed = clientFailureEventSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).end();
      return;
    }
    const event = parsed.data;
    emit({
      code: "client-failure",
      failureClass: event.failureClass,
      clientCode: event.code,
      surface: event.surface,
      clientBuild: event.build,
      requestId: requestIdFrom(req.headers),
    });
    res.status(204).end();
  });
  /*
   * 1 MB, DOWN FROM 10. Nothing this API accepts comes close: every prose field on a decision is
   * capped by its schema at 200-300 characters, the import diagnostic is bounded at 64 KiB where
   * it is parsed, and a tRPC batch carries a handful of those. Ten megabytes was a number nobody
   * chose -- it was the framework example -- and on a serverless function it is ten megabytes of
   * parse the caller gets to spend before a single validator runs.
   */
  app.use(express.json({ limit: "1mb" }));
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
  app.get("/api/health", (req, res) => {
    const configured = Boolean(process.env.DATABASE_URL);
    /*
     * WHAT THE BODY NOW SAYS, AND WHY EACH FIELD IS ALLOWED TO.
     *
     *   ok        the contract a monitor acts on, unchanged: 200/true or 503/false.
     *   build     which commit the FUNCTION is. `/build-identity.json` already says which commit
     *             the CDN serves, publicly; this lets the L6 suite hold the two equal, which is
     *             the check that catches a half-promoted deploy or a stuck alias. Same public fact,
     *             second party to it.
     *   checks    one word per SUBSYSTEM ROLE. `not-configured` is the supported browser-record
     *             deployment; `reachable` and `unreachable` are the two states of a configured one.
     *             The word is a role, never a variable name, a host, a port or a user, and the
     *             test that forbade those strings from this body still forbids them.
     *   requestId the platform's trace id, so "health said 503 at 14:02" can be found in the log.
     *
     * Liveness, readiness and dependency health are three questions and this is how one route
     * answers them: an HTTP answer at all is liveness (the function ran); `ok` is readiness (a
     * decision could be stored here now); `checks.storage` is the dependency that decided it.
     *
     * NOT AN `async` HANDLER. Express 4 does not catch a rejected promise from one -- it neither
     * responds nor errors, so the request hangs until the platform kills it, and a monitor reads
     * that timeout as "the whole deployment is gone" rather than "the database is down". A hung
     * health check is worse than a red one: it pages for the wrong thing. So the probe's failure
     * is handled here as well as inside it, and every path ends in a response.
     */
    const build = runtimeBuildIdentity();
    const requestId = requestIdFrom(req.headers);
    const answer = (ok: boolean, storage: "not-configured" | "reachable" | "unreachable") =>
      res.status(ok ? 200 : 503).json({ ok, build, checks: { storage }, requestId });
    if (!configured) {
      answer(true, "not-configured");
      return;
    }
    store
      .isAvailable()
      .then((ok) => answer(ok, ok ? "reachable" : "unreachable"))
      .catch(() => answer(false, "unreachable"));
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: buildAppRouter(store),
      createContext,
      /*
       * QUERIES ARRIVE AS POST. The client sends every query with `methodOverride: "POST"` so no
       * input (a FEN, a username) lands in a URL the platform logs. Without this flag tRPC answers
       * every such query 405, which the adversarial review found on the branch that added the client
       * half: the privacy change would have taken the whole read path down on deploy. Held by
       * `tests/server/a-query-that-travels-in-the-body.test.ts`, which uses the real client link.
       */
      allowMethodOverride: true,
      /*
       * The operator's half of the error, which is NOT the player's half.
       *
       * The wire now carries a fixed sentence for anything the product did not author, so without
       * this a 500 would be undiagnosable from either side. `describeForOperator` keeps the
       * PARAMETERIZED statement -- safe by construction, every value is `?` -- and drops
       * `message` and `params`, which are the two places drizzle puts the values.
       */
      onError: ({ error, path, ctx }) => {
        /*
         * EVERY CODE, NOT ONLY 500. A 429 from Lichess, a refused token and a rejected input each
         * used to leave no line, so the operator could count nothing but crashes. The class says
         * which subsystem; the detail is kept only for what the product did not author, because an
         * authored refusal's cause is its code.
         */
        emit({
          code: "request-failed",
          failureClass: failureClassOfTrpcCode(error.code),
          path: path ?? "?",
          requestId: ctx?.requestId,
          detail:
            error.code === "INTERNAL_SERVER_ERROR"
              ? describeForOperator(error.cause ?? error)
              : error.code,
        });
      },
    }),
  );
  return app;
}
