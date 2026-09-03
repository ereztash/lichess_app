import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState } from "../../shared/const.js";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import { getSessionCookieOptions } from "./cookies.js";
import { ENV } from "./env.js";
import { describeForOperator } from "./safe-error.js";
import { emit, requestIdFrom, type OperatorEventCode } from "./telemetry.js";
import { sdk } from "./sdk.js";
const qp = (req: Request, key: string) =>
  typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;

/**
 * The reasons a sign-in can fail that a PERSON is shown, as a closed list the front door renders.
 *
 * Every one of these used to end on `/api/oauth/callback?code=…` as an English JSON body -- a dead
 * page with no way back, in a product whose failure copy is Hebrew and names an act. A visitor whose
 * portal was down, or whose ten-minute state cookie had expired, most likely closed the tab. The
 * callback now sends them home with a reason the client turns into a sentence, and the operator
 * gets a line that says which of the five it was, which the old `console.error(error)` did not.
 *
 * THE REASON IS A CODE, NOT A MESSAGE. The URL is the one place on this route an outside party can
 * write, and `AuthFailureNotice` renders only what it recognises.
 */
export const AUTH_FAILURE_REASONS = [
  "oauth-malformed",
  "oauth-state-rejected",
  "oauth-not-configured",
  "oauth-portal-unreachable",
  "oauth-no-openid",
] as const satisfies readonly OperatorEventCode[];
export type AuthFailureReason = (typeof AUTH_FAILURE_REASONS)[number];

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const requestId = requestIdFrom(req.headers);
    const home = (reason: AuthFailureReason, detail?: string) => {
      emit({ code: reason, failureClass: reason === "oauth-not-configured" ? "precondition" : "auth", path: "/api/oauth/callback", requestId, detail });
      res.redirect(302, `/?auth=failed&reason=${reason}`);
    };
    const code = qp(req, "code"),
      state = qp(req, "state");
    if (!code || !state) return home("oauth-malformed");
    const { nonce } = decodeOAuthState(state);
    const expected = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expected) return home("oauth-state-rejected");
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "lax" });
    /*
     * Named BEFORE the exchange is attempted, because the exchange's own error for this case is
     * "OAuth is not configured" thrown from inside the SDK, and an operator reading the line should
     * not have to know that to tell a missing variable from a portal that is down.
     */
    if (!ENV.oAuthServerUrl || !ENV.appId || !ENV.cookieSecret) return home("oauth-not-configured");
    try {
      const token = await sdk.exchangeCodeForToken(code, state);
      const user = await sdk.getUserInfo(token.accessToken);
      if (!user.openId) return home("oauth-no-openid");
      const session = await sdk.createSessionToken(user.openId, {
        name: user.name || "User",
        expiresInMs: ONE_YEAR_MS,
      });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      /* The class and the status, never the object: the object carries the portal's response. */
      home("oauth-portal-unreachable", describeForOperator(error));
    }
  });
}
