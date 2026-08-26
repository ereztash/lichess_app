/**
 * GATE-COMMIT (R3): no engine output reaches the client before a decision is recorded.
 *
 * Asserted on the NETWORK LAYER, not the DOM. A DOM-only check passes while the answer sits in
 * the props; only the response payload proves the client was never handed the evaluation.
 *
 * These requests are AUTHENTICATED on purpose. An unauthenticated request is refused at the auth
 * middleware and never reaches the commit gate at all -- it would make this suite pass for the
 * wrong reason, which is indistinguishable from not having the gate.
 */
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const OWNER = "owner-open-id";
process.env.JWT_SECRET = "test-secret-value-for-gate-commit";
process.env.OWNER_OPEN_ID = OWNER;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");

let server: Server;
let origin: string;
let token: string;

const DECISION_ID = "22222222-2222-4222-8222-222222222222";
const UNCOMMITTED_ID = "33333333-3333-4333-8333-333333333333";
const RESULT = {
  engine_eval_cp: 31,
  engine_best_move: "d2d4",
  engine_depth: 18,
  engine_source: "local_sf18" as const,
  cp_loss: 12,
};
const ENTRY = {
  game_id: "g1",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ply: 0,
  phase: "opening" as const,
  clock_ms_remaining: null,
};

/** Every field name that would betray an engine having spoken. */
const ENGINE_FIELDS = [
  "engine_eval_cp",
  "engine_best_move",
  "engine_depth",
  "engine_source",
  "cp_loss",
];

beforeAll(async () => {
  token = await sdk.createSessionToken(OWNER, { name: "Owner" });
  const app = createApp({ store: new MemoryRecordStore() });
  await new Promise<void>((done) => {
    server = app.listen(0, "127.0.0.1", done);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port assigned");
  origin = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  // Guarded: an unguarded close() here masks a beforeAll failure with a null-reference error.
  if (!server) return;
  await new Promise<void>((done, fail) => server.close((e) => (e ? fail(e) : done())));
});

async function get(path: string) {
  const response = await fetch(`${origin}/api/trpc/${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: response.status, body: await response.text() };
}

async function post(path: string, json: unknown) {
  const response = await fetch(`${origin}/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ json }),
  });
  return { status: response.status, body: await response.text() };
}

const commit = (decisionId: string) =>
  post("record.commitDecision", {
    decision_id: decisionId,
    entry_state: ENTRY,
    known: "needs central space",
    unknown: "cannot judge the resulting pawn structure",
    decision: "e2e4",
    bounded_action: { seconds_taken: 8, confidence: 3, confidence_scale: CONFIDENCE_LEVELS, candidate_moves_considered: ["e2e4"] },
    probe: null,
    reveal_timing: null,
    result: null,
    feedback: null,
  });

describe("GATE-COMMIT: the engine does not speak before the decision is recorded", () => {
  it("the request is genuinely authenticated, so the gate is what refuses", async () => {
    const { status } = await get("record.count");
    expect(status, "auth is not what this suite is testing").toBe(200);
  });

  it("refuses reveal for a decision that was never committed", async () => {
    const { status, body } = await post("record.reveal", {
      decision_id: UNCOMMITTED_ID,
      result: RESULT,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body).toContain("FORBIDDEN");
    for (const field of ENGINE_FIELDS) {
      expect(body, `refusal leaked ${field}`).not.toContain(`"${field}"`);
    }
  });

  it("the commit response itself carries no engine field", async () => {
    const { status, body } = await commit(DECISION_ID);
    expect(status).toBe(200);
    for (const field of ENGINE_FIELDS) {
      expect(body, `commit response leaked ${field}`).not.toContain(`"${field}"`);
    }
  });

  it("reveal succeeds only after the decision exists, and only once", async () => {
    const first = await post("record.reveal", { decision_id: DECISION_ID, result: RESULT });
    expect(first.status).toBe(200);
    expect(first.body).toContain("engine_eval_cp");

    // Append-only: the record cannot be revealed twice.
    const second = await post("record.reveal", { decision_id: DECISION_ID, result: RESULT });
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body).toContain("CONFLICT");
  });

  it("rejects a phase label that disagrees with the position", async () => {
    const { status, body } = await post("record.commitDecision", {
      decision_id: "44444444-4444-4444-8444-444444444444",
      entry_state: { ...ENTRY, phase: "endgame" },
      known: "k",
      unknown: "u",
      decision: "e2e4",
      bounded_action: { seconds_taken: 3, confidence: 2, confidence_scale: CONFIDENCE_LEVELS, candidate_moves_considered: [] },
      probe: null,
      reveal_timing: null,
      result: null,
      feedback: null,
    });
    expect(status).toBeGreaterThanOrEqual(400);
    expect(body).toContain("BAD_REQUEST");
  });
});
