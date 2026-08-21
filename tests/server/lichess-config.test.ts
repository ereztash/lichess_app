/**
 * The configuration report.
 *
 * Its whole job is to turn "the button does nothing" into a named cause, so the tests are mostly
 * about what it must NOT do: leak a value, or conflate a missing token with a wrong owner.
 */
import type { Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const OWNER = "owner-open-id";
process.env.JWT_SECRET = "test-secret-for-config-route";
process.env.OWNER_OPEN_ID = OWNER;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");

let server: Server;
let origin: string;
let ownerToken: string;
let strangerToken: string;

beforeAll(async () => {
  ownerToken = await sdk.createSessionToken(OWNER, { name: "Owner" });
  strangerToken = await sdk.createSessionToken("someone-else", { name: "Stranger" });
  const app = createApp({ store: new MemoryRecordStore() });
  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!server) return;
  await new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done())));
});

afterEach(() => {
  delete process.env.LICHESS_API_TOKEN;
});

async function config(token: string) {
  const response = await fetch(`${origin}/api/trpc/system.lichessConfig`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: response.status, text: await response.text() };
}

describe("the Lichess configuration report", () => {
  it("names a missing token instead of staying silent", async () => {
    const { text } = await config(ownerToken);
    expect(JSON.parse(text).result.data.json.missing).toContain("LICHESS_API_TOKEN");
  });

  it("stops naming it once it is present", async () => {
    process.env.LICHESS_API_TOKEN = "some-token-value";
    const { text } = await config(ownerToken);
    const data = JSON.parse(text).result.data.json;
    expect(data.missing).not.toContain("LICHESS_API_TOKEN");
    expect(data.present.LICHESS_API_TOKEN).toBe(true);
  });

  it("NEVER leaks a value, a prefix, or a length", async () => {
    process.env.LICHESS_API_TOKEN = "lip_supersecrettokenvalue";
    const { text } = await config(ownerToken);
    expect(text).not.toContain("lip_");
    expect(text).not.toContain("supersecret");
    expect(text).not.toContain("test-secret-for-config-route");
    // Presence is a boolean and nothing else.
    expect(JSON.parse(text).result.data.json.present.LICHESS_API_TOKEN).toBe(true);
  });

  it("separates a wrong owner from a missing token", async () => {
    process.env.LICHESS_API_TOKEN = "some-token-value";
    const owner = JSON.parse((await config(ownerToken)).text).result.data.json;
    const stranger = JSON.parse((await config(strangerToken)).text).result.data.json;
    // Same configuration, different account: only isOwner differs.
    expect(owner.missing).toEqual(stranger.missing);
    expect(owner.isOwner).toBe(true);
    expect(stranger.isOwner).toBe(false);
  });

  it("is not readable without signing in", async () => {
    const response = await fetch(`${origin}/api/trpc/system.lichessConfig`);
    expect(response.status).toBe(401);
  });
});
