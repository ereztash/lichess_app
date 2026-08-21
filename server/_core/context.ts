import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sdk, type AuthenticatedUser } from "./sdk.js";
export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: AuthenticatedUser | null;
};
export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const user = await sdk.authenticateRequest(opts.req).catch(() => null);
  return { req: opts.req, res: opts.res, user };
}
