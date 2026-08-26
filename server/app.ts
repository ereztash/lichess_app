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

export function createApp({ store = recordStore }: { store?: RecordStore } = {}) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
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
  app.use("/api/trpc", createExpressMiddleware({ router: buildAppRouter(store), createContext }));
  return app;
}
