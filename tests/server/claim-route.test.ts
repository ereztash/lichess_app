/**
 * The claim procedure over real HTTP, including the states where it declines to speak.
 */
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const OWNER = "owner-open-id";
process.env.JWT_SECRET = "test-secret-for-claim-route";
process.env.OWNER_OPEN_ID = OWNER;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");
const { MIN_BUCKET_N } = await import("../../shared/detector");

let server: Server;
let origin: string;
let token: string;
const store = new MemoryRecordStore();

const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/**
 * A record with a strong, unambiguous calibration gap under time pressure.
 * Ids are globally unique: the store is append-only and correctly rejects a repeat.
 *
 * IT VARIES ON BOTH AXES, and it did not used to. Every fast decision carried `confidence: 5`
 * and a cp_loss above the accuracy threshold, so every fast gap was exactly 1.0 and the bucket's
 * sample variance was exactly 0 -- the configuration `gapDifferenceStandardError` now refuses,
 * measured at up to 13% false positives against this product's own 2% ceiling. The "strong,
 * unambiguous" gap was clearing the threshold on a zero denominator rather than on its size.
 *
 * This was the third fixture in the repo with the same defect, which is the part worth writing
 * down: every fixture that produced a pattern strong enough to test the loop on was producing it
 * degenerately. A real player is very confident MOSTLY, and wrong under time pressure MOSTLY.
 */
let seeded = 0;
async function seed(count: number, reveal = true) {
  for (let i = 0; i < count; i += 1) {
    const fast = i % 2 === 0;
    const id = `${fast ? "f" : "s"}-${seeded + i}`;
    await store.commitDecision({
      decisionId: id,
      gameId: "g",
      fen: FEN,
      ply: 0,
      phase: "opening",
      clockMsRemaining: 120_000,
      purpose: "play",
      drillId: null,
      secondsTaken: fast ? 10 : 200,
      chosenMove: "e2e4",
      candidateMovesConsidered: ["e2e4"],
      statedRead: "k",
      statedUnknown: "u",
      confidence: fast ? (i % 10 === 4 ? 4 : 5) : 3,
      confidenceScale: CONFIDENCE_LEVELS,
      probeAssignment: "not-probed",
      legalMoves: 20,
      revealTiming: "per-decision",
      measurementProtocol: null,
      protocolVersion: null,
      analysisTiming: null,
    });
    if (reveal) {
      await store.recordReveal(id, {
        engine_eval_cp: 10,
        engine_best_move: "e2e4",
        engine_depth: 18,
        engine_source: "local_sf18",
        engine_build: "sf18-test-build",
        // Fast decisions are usually wrong; slow ones usually fine. "Usually" on both sides:
        // an always-wrong bucket has no variance and cannot estimate its own error.
        cp_loss: fast ? (i % 8 === 0 ? 5 : i % 4 === 0 ? 200 : 150) : i % 3 === 0 ? 120 : 5,
      });
    }
  }
  seeded += count;
}

beforeAll(async () => {
  token = await sdk.createSessionToken(OWNER, { name: "Owner" });
  const app = createApp({ store });
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

async function claim() {
  const response = await fetch(`${origin}/api/trpc/record.claim`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as { result: { data: { json: Record<string, unknown> } } };
  return body.result.data.json;
}

describe("the claim surface declines before it speaks", () => {
  it("says nothing, with a reason, on an empty record", async () => {
    const data = await claim();
    expect(data.claim).toBeNull();
    expect(String(data.reason)).toContain("צריך");
    expect(data.recorded).toBe(0);
  });

  it("distinguishes unrevealed decisions from missing ones", async () => {
    /*
     * ASSERTED ON THE FIELDS, NOT ON THE PROSE.
     *
     * This used to require "ממתינות לחשיפה" inside `reason`, which made a route contract depend
     * on the wording of one renderer's copy -- and that copy has since moved to the context
     * ribbon, where the counts are read, so the panel's line would not repeat them. What the
     * ROUTE owes a caller is the distinction itself, and it always answered it here: ten
     * recorded against zero scored is exactly "recorded but not yet revealed", and no wording
     * can make those two numbers agree with "nothing has been recorded".
     */
    await seed(10, false);
    const data = await claim();
    expect(data.claim).toBeNull();
    expect(data.recorded).toBe(10);
    expect(data.scored).toBe(0);
    expect(Number(data.recorded) - Number(data.scored), "no decision is awaiting reveal").toBe(10);
    // An empty record is the other case, and it must not arrive looking like this one.
    expect(data.recorded).not.toBe(data.scored);
    expect(String(data.reason), "the route declined without saying why").toBeTruthy();
  });

  it("still declines below the floor of two full buckets", async () => {
    await seed(MIN_BUCKET_N, true);
    const data = await claim();
    expect(data.claim).toBeNull();
    expect(Number(data.scored)).toBeLessThan(MIN_BUCKET_N * 2);
  });

  it("produces exactly one claim, graded hypothesis, once the record is deep enough", async () => {
    await seed(MIN_BUCKET_N * 3, true);
    const data = await claim();
    expect(Number(data.scored)).toBeGreaterThanOrEqual(MIN_BUCKET_N * 2);
    const found = data.claim as { grade: string; n: number; refutation_condition: string } | null;
    expect(found, String(data.reason)).not.toBeNull();
    expect(found!.grade).toBe("hypothesis");
    expect(found!.n).toBeGreaterThanOrEqual(MIN_BUCKET_N);
    expect(found!.refutation_condition.length).toBeGreaterThan(0);
  });

  it("never returns a claim above hypothesis from retrospective data alone", async () => {
    const data = await claim();
    if (data.claim) expect((data.claim as { grade: string }).grade).toBe("hypothesis");
  });
});
