/**
 * The OAuth callback used to strand a person on English JSON; now it sends them home with a reason.
 *
 * FIVE WAYS THE CALLBACK FAILS, FIVE CODES, ONE REDIRECT. A visitor whose state cookie expired, whose
 * portal was down, or whose deployment was never configured all landed on
 * `/api/oauth/callback?code=…` reading `{"error":"OAuth callback failed"}` with no control on the
 * page -- and the operator's line was `console.error(error)`, which said nothing about which of the
 * five it was and could carry the portal's whole response.
 *
 * WHAT IS HELD. Each failure is a 302 to the front door with a reason from a closed list; the
 * operator line carries the reason and the request id; and neither the `code` nor the `state` the
 * URL carried -- the two values an outside party controls on this route -- appears in the line.
 */
import { createServer, type Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeOAuthState, OAUTH_STATE_COOKIE } from "../../shared/const";
import type { OperatorLine } from "../../server/_core/telemetry";

let server: Server | undefined;
let origin = "";
let lines: OperatorLine[];
const saved = { ...process.env };

async function serve(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const key of ["JWT_SECRET", "OAUTH_SERVER_URL", "VITE_APP_ID", "OWNER_OPEN_ID"]) delete process.env[key];
  Object.assign(process.env, env);
  const telemetry = await import("../../server/_core/telemetry");
  lines = [];
  telemetry.useSinkForTests((_level, line) => lines.push(JSON.parse(line) as OperatorLine));
  const sdkModule = await import("../../server/_core/sdk");
  const { createApp } = await import("../../server/app");
  server = createServer(createApp());
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", () => done()));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  return { sdk: sdkModule.sdk, telemetry };
}

afterEach(async () => {
  if (server) await new Promise<void>((done) => server!.close(() => done()));
  server = undefined;
  process.env = { ...saved };
  vi.restoreAllMocks();
});

const CONFIGURED = {
  JWT_SECRET: "test-secret-for-oauth-home",
  OAUTH_SERVER_URL: "https://portal.example",
  VITE_APP_ID: "app-1",
  OWNER_OPEN_ID: "owner",
};

const callback = (query: string, cookie?: string) =>
  fetch(`${origin}/api/oauth/callback?${query}`, {
    redirect: "manual",
    headers: { "x-vercel-id": "iad1::oauth-1", ...(cookie ? { cookie } : {}) },
  });

describe("a sign-in that did not complete", () => {
  it("goes home when the state does not match the nonce cookie, saying the attempt expired", async () => {
    await serve(CONFIGURED);
    const state = encodeOAuthState({ redirectUri: `${origin}/api/oauth/callback`, nonce: "n-1" });
    const response = await callback(`code=abc123&state=${encodeURIComponent(state)}`);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?auth=failed&reason=oauth-state-rejected");
    expect(lines.find((l) => l.code === "oauth-state-rejected")).toMatchObject({
      failureClass: "auth",
      requestId: "iad1::oauth-1",
    });
  });

  it("goes home naming the deployment when sign-in was never configured, before reaching for a portal", async () => {
    await serve({ ...CONFIGURED, OAUTH_SERVER_URL: undefined });
    const state = encodeOAuthState({ redirectUri: `${origin}/api/oauth/callback`, nonce: "n-2" });
    const response = await callback(
      `code=abc123&state=${encodeURIComponent(state)}`,
      `${OAUTH_STATE_COOKIE}=n-2`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?auth=failed&reason=oauth-not-configured");
    expect(lines.find((l) => l.code === "oauth-not-configured")?.failureClass).toBe("precondition");
  });

  it("goes home when the portal refuses, and logs the class of the refusal but not the code or state", async () => {
    const { sdk } = await serve(CONFIGURED);
    const CODE = "authcode-SENSITIVE-9f8e7d";
    vi.spyOn(sdk, "exchangeCodeForToken").mockRejectedValue(
      new Error(`OAuth request failed (502) for code ${CODE}`),
    );
    const state = encodeOAuthState({ redirectUri: `${origin}/api/oauth/callback`, nonce: "n-3" });
    const response = await callback(
      `code=${CODE}&state=${encodeURIComponent(state)}`,
      `${OAUTH_STATE_COOKIE}=n-3`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/?auth=failed&reason=oauth-portal-unreachable");
    const line = lines.find((l) => l.code === "oauth-portal-unreachable");
    expect(line, "the portal failure left no line").toBeTruthy();
    const logged = JSON.stringify(line);
    expect(logged, "the operator line carried the authorisation code").not.toContain(CODE);
    expect(logged, "the operator line carried the state").not.toContain(state);
    expect(line!.detail).toBe("Error");
  });

  it("goes home when the portal answers without an identity", async () => {
    const { sdk } = await serve(CONFIGURED);
    vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue({ accessToken: "t" });
    vi.spyOn(sdk, "getUserInfo").mockResolvedValue({ openId: "", name: "x" });
    const state = encodeOAuthState({ redirectUri: `${origin}/api/oauth/callback`, nonce: "n-4" });
    const response = await callback(
      `code=abc&state=${encodeURIComponent(state)}`,
      `${OAUTH_STATE_COOKIE}=n-4`,
    );
    expect(response.headers.get("location")).toBe("/?auth=failed&reason=oauth-no-openid");
  });

  it("still signs in when everything holds, and says nothing to the operator", async () => {
    const { sdk } = await serve(CONFIGURED);
    vi.spyOn(sdk, "exchangeCodeForToken").mockResolvedValue({ accessToken: "t" });
    vi.spyOn(sdk, "getUserInfo").mockResolvedValue({ openId: "owner", name: "Owner" });
    const state = encodeOAuthState({ redirectUri: `${origin}/api/oauth/callback`, nonce: "n-5" });
    const response = await callback(
      `code=abc&state=${encodeURIComponent(state)}`,
      `${OAUTH_STATE_COOKIE}=n-5`,
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("set-cookie")).toContain("app_session_id=");
    expect(lines.filter((l) => l.code.startsWith("oauth-"))).toHaveLength(0);
  });
});
