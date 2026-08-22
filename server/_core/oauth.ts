import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "../../shared/const.js";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies.js";
import { sdk } from "./sdk.js";
const qp = (req: Request, key: string) =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;
export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = qp(req, "code"),
      state = qp(req, "state");
    if (!code || !state) return void res.status(400).json({ error: "code and state are required" });
    const { nonce } = decodeOAuthState(state);
    const expected = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expected)
      return void res.status(403).json({ error: "invalid oauth state" });
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const token = await sdk.exchangeCodeForToken(code, state);
      const user = await sdk.getUserInfo(token.accessToken);
      if (!user.openId) return void res.status(400).json({ error: "openId missing" });
      const session = await sdk.createSessionToken(user.openId, {
        name: user.name || "User",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
