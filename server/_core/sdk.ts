import { AXIOS_TIMEOUT_MS, COOKIE_NAME, ONE_YEAR_MS, decodeOAuthState } from "../../shared/const.js";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./env.js";
export type AuthenticatedUser = {
  openId: string;
  name: string;
  email: string | null;
  role: "user" | "admin";
};
type TokenResponse = { accessToken: string };
type UserInfo = { openId: string; name?: string; email?: string | null };
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AXIOS_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`OAuth request failed (${response.status})`);
    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}
class SDKServer {
  async exchangeCodeForToken(code: string, state: string): Promise<TokenResponse> {
    if (!ENV.oAuthServerUrl || !ENV.appId) throw new Error("OAuth is not configured");
    return postJson<TokenResponse>(
      `${ENV.oAuthServerUrl.replace(/\/$/, "")}/webdev.v1.WebDevAuthPublicService/ExchangeToken`,
      {
        clientId: ENV.appId,
        grantType: "authorization_code",
        code,
        redirectUri: decodeOAuthState(state).redirectUri,
      },
    );
  }
  async getUserInfo(accessToken: string): Promise<UserInfo> {
    if (!ENV.oAuthServerUrl) throw new Error("OAuth is not configured");
    return postJson<UserInfo>(
      `${ENV.oAuthServerUrl.replace(/\/$/, "")}/webdev.v1.WebDevAuthPublicService/GetUserInfo`,
      { accessToken },
    );
  }
  private secret() {
    if (!ENV.cookieSecret) throw new Error("JWT_SECRET is not configured");
    return new TextEncoder().encode(ENV.cookieSecret);
  }
  /**
   * ISSUER AND AUDIENCE ARE PINNED. A token signed with this secret for any other purpose -- another
   * deployment sharing a secret by mistake, a test token, a future second token type -- verified
   * here before, because HS256 with the right key was the whole check. Now it must also say who
   * minted it and for which app. Existing sessions minted without these claims stop verifying, so
   * the owner signs in once more after the deploy that carries this.
   */
  private static readonly ISSUER = "decision-lab";
  private audience() {
    return ENV.appId || "decision-lab";
  }
  async createSessionToken(openId: string, options: { expiresInMs?: number; name?: string } = {}) {
    const expires = Math.floor((Date.now() + (options.expiresInMs ?? ONE_YEAR_MS)) / 1000);
    return new SignJWT({ openId, appId: ENV.appId, name: options.name || "User" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(SDKServer.ISSUER)
      .setAudience(this.audience())
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(this.secret());
  }
  async authenticateRequest(req: Request): Promise<AuthenticatedUser | null> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    let token = cookies[COOKIE_NAME];
    const auth = req.headers.authorization;
    if (!token && auth?.startsWith("Bearer ")) token = auth.slice(7);
    if (!token || !ENV.cookieSecret) return null;
    try {
      const { payload } = await jwtVerify(token, this.secret(), {
        algorithms: ["HS256"],
        issuer: SDKServer.ISSUER,
        audience: this.audience(),
      });
      const openId = typeof payload.openId === "string" ? payload.openId : "";
      if (!openId) return null;
      const name = typeof payload.name === "string" ? payload.name : "User";
      return {
        openId,
        name,
        email: null,
        role: ENV.ownerOpenId && openId === ENV.ownerOpenId ? "admin" : "user",
      };
    } catch {
      return null;
    }
  }
}
export const sdk = new SDKServer();
