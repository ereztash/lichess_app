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
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { buildAppRouter } from "./routers";
import { recordStore, type RecordStore } from "./record";

export function createApp({ store = recordStore }: { store?: RecordStore } = {}) {
  const app = express();
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  app.get("/api/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  registerOAuthRoutes(app);
  app.use("/api/trpc", createExpressMiddleware({ router: buildAppRouter(store), createContext }));
  return app;
}
