/**
 * THE RECORD IS ONE PERSON'S. Two signed-in accounts must not see each other's decisions.
 *
 * This is the failure a review reproduced against `main`: `record.*` was mounted on
 * `protectedProcedure`, which asks only "is somebody signed in" -- and no record table carries a
 * `user_id`, so there was nothing for a query to scope by even if one had wanted to. A second
 * account read the first account's private text and got a 200.
 *
 * WHY IT MATTERS MORE HERE THAN IN AN ORDINARY APP. The rows are `stated_read` and
 * `stated_unknown` -- what a person admitted they did not understand, written down before they
 * were told the answer. That is the most private thing this product holds, and the entire
 * instrument depends on people being willing to write it honestly.
 *
 * The gate is the one the rest of the product already uses. `OWNER_OPEN_ID` gates every Lichess
 * route and Layer C, which means the deployed product was ALREADY single-tenant everywhere except
 * the one place that holds the private text. This does not make it single-tenant; it stops the
 * record from being the exception.
 */
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";

process.env.JWT_SECRET = "test-secret-for-record-isolation";
delete process.env.OWNER_OPEN_ID;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");
const { ENV } = await import("../../server/_core/env");

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PRIVATE = "לא הבנתי למה הרגל הזה תקוע";
const DECISION_ID = "11111111-1111-4111-8111-111111111111";

let server: Server;
let origin: string;
let owner: string;
let stranger: string;

beforeAll(async () => {
  owner = await sdk.createSessionToken("the-owner", { name: "Owner" });
  stranger = await sdk.createSessionToken("somebody-else", { name: "Stranger" });
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

async function call(path: string, token: string, body?: unknown) {
  const response = await fetch(`${origin}/api/trpc/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify({ json: body }) }),
  });
  const text = await response.text();
  return { status: response.status, body: text };
}

const commit = {
  decision_id: DECISION_ID,
  entry_state: { game_id: "g1", fen: FEN, ply: 0, phase: "opening", clock_ms_remaining: null },
  known: "המרכז פתוח",
  unknown: PRIVATE,
  decision: "e2e4",
  bounded_action: {
    seconds_taken: 12,
    confidence: 3,
    confidence_scale: CONFIDENCE_LEVELS,
    candidate_moves_considered: ["e2e4"],
  },
  probe: null,
  reveal_timing: null,
  result: null,
  feedback: null,
};

describe("the record belongs to the account that wrote it", () => {
  it("lets the owner write and read their own decision", async () => {
    // The control. Without it, a test that only proves the stranger is refused would also pass
    // if the gate refused everybody -- which is a different bug wearing the same green tick.
    ENV.ownerOpenId = "the-owner";
    const written = await call("record.commitDecision", owner, commit);
    expect(written.status, written.body).toBe(200);
    const read = await call(`record.atom?input=${encodeURIComponent(JSON.stringify({ json: { decision_id: DECISION_ID } }))}`, owner);
    expect(read.status, read.body).toBe(200);
    expect(read.body).toContain(PRIVATE);
  });

  it("refuses a different signed-in account, and does not leak the text in the refusal", async () => {
    /*
     * THE LEAK, AS REPRODUCED. Before the gate this returned 200 with `stated_unknown` in the
     * body. Both halves are asserted: a 403 that still echoed the private text in an error
     * message would be the same disclosure with a worse status code.
     */
    ENV.ownerOpenId = "the-owner";
    const read = await call(`record.atom?input=${encodeURIComponent(JSON.stringify({ json: { decision_id: DECISION_ID } }))}`, stranger);
    expect(read.status, read.body).toBe(403);
    expect(read.body).not.toContain(PRIVATE);
  });

  it("refuses a different account's WRITES too, not only its reads", async () => {
    // A read-only gate would let a stranger append to the owner's record -- which corrupts the
    // measurement even though it discloses nothing.
    ENV.ownerOpenId = "the-owner";
    const written = await call("record.commitDecision", stranger, {
      ...commit,
      decision_id: "22222222-2222-4222-8222-222222222222",
    });
    expect(written.status, written.body).toBe(403);
  });

  it("says an unconfigured deployment is a server gap, not a denied permission", async () => {
    /*
     * The distinction the owner gate already draws for Lichess, now drawn for the record. An
     * unset OWNER_OPEN_ID and a visitor signed in as somebody else are different facts with
     * different fixes, and one identical message erasing both is the failure this product is
     * about, occurring inside the product.
     */
    ENV.ownerOpenId = "";
    const read = await call(`record.count`, owner);
    expect(read.status, read.body).toBe(412);
    expect(read.body).toContain("OWNER_OPEN_ID");
  });
});
