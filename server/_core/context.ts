import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sdk, type AuthenticatedUser } from "./sdk.js";
import { requestIdFrom } from "./telemetry.js";
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
  /**
   * The platform's id for this request (`x-vercel-id`), or a short local one.
   *
   * Carried on the context so the error shape and the operator line name the SAME request: a
   * player who pastes the id from a failure disclosure and an operator grepping the log are then
   * talking about one event, which is the whole of what "support without a debugger" needs.
   */
  requestId: string;
};
export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const user = await sdk.authenticateRequest(opts.req).catch(() => null);
  return { req: opts.req, res: opts.res, user, requestId: requestIdFrom(opts.req.headers) };
}
