/**
 * The single-tenant gate must not erase its own causes.
 *
 * An unset OWNER_OPEN_ID and a visitor signed in as somebody else are different facts with
 * different fixes -- one is a server the owner has to configure, the other is a browser session.
 * They used to produce one identical FORBIDDEN message, which is the failure this product is
 * about, occurring inside the product.
 */
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.JWT_SECRET = "test-secret-for-owner-gate";
delete process.env.OWNER_OPEN_ID;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");
const { ENV } = await import("../../server/_core/env");

let server: Server;
let origin: string;
let token: string;

beforeAll(async () => {
  token = await sdk.createSessionToken("some-visitor", { name: "Visitor" });
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

/** Hit an owner-gated endpoint. The gate runs before any Lichess request, so nothing goes out. */
async function account() {
  const response = await fetch(`${origin}/api/trpc/lichess.account`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = JSON.parse(await response.text());
  return { status: response.status, message: body.error?.json?.message ?? "" };
}

describe("the owner gate", () => {
  it("reports an unconfigured deployment as a server gap, not as a denied permission", async () => {
    ENV.ownerOpenId = "";
    const { status, message } = await account();
    // 412, not 403: nothing about this visitor could have made it pass.
    expect(status).toBe(412);
    expect(message).toContain("OWNER_OPEN_ID");
  });

  it("reports a different signed-in account as a denied permission", async () => {
    ENV.ownerOpenId = "the-actual-owner";
    const { status, message } = await account();
    expect(status).toBe(403);
    expect(message).toContain("OWNER_OPEN_ID");
  });

  it("does not render the two causes identically", async () => {
    ENV.ownerOpenId = "";
    const unconfigured = await account();
    ENV.ownerOpenId = "the-actual-owner";
    const wrongAccount = await account();
    expect(unconfigured.status).not.toBe(wrongAccount.status);
    expect(unconfigured.message).not.toBe(wrongAccount.message);
  });

  it("lets the owner through the gate", async () => {
    ENV.ownerOpenId = "some-visitor";
    const { status } = await account();
    // Past the gate it fails on the missing Lichess token instead -- a different cause again.
    expect(status).not.toBe(403);
  });
});
