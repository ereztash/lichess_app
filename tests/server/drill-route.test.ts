/**
 * The drill loop over real HTTP: claim -> drill -> graded, in both directions.
 *
 * Section 3.5: "Report the result even when it refutes the pattern -- especially then." The
 * refutation path is tested first here, for that reason.
 */
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "../../shared/confidence";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const OWNER = "owner-open-id";
process.env.JWT_SECRET = "test-secret-for-drill-route";
process.env.OWNER_OPEN_ID = OWNER;

const { createApp } = await import("../../server/app");
const { MemoryRecordStore } = await import("../../server/record");
const { sdk } = await import("../../server/_core/sdk");
const { MIN_BUCKET_N } = await import("../../shared/detector");
const { MIN_DRILL_POSITIONS } = await import("../../shared/drill-positions");

let server: Server;
let origin: string;
let token: string;
let store: InstanceType<typeof MemoryRecordStore>;

const FENS = [
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 3",
  "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
  "r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 6",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 7",
  "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 8",
];

let seeded = 0;

/** Positions a client would offer: from a loaded game, none of them decided. */
const UNDECIDED = [
  "rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3",
  "rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 0 4",
  "rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5",
  "rnbqkb1r/ppp2ppp/3p1n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R b KQkq - 0 6",
  "rnbqkb1r/ppp2pp1/3p1n1p/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 7",
  "rnbqkb1r/ppp2pp1/3p1n1p/4p3/2B1P3/2NP1N2/PPP2PPP/R1BQK2R b KQkq - 0 8",
  "rn1qkb1r/ppp2pp1/3p1n1p/4p3/2B1P1b1/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 9",
  "rn1qkb1r/ppp2pp1/3p1n1p/4p3/2B1P1b1/2NP1N1P/PPP2PP1/R1BQK2R b KQkq - 0 10",
];

/**
 * Seed a record with a strong overconfidence-under-time-pressure pattern.
 *
 * THIS FIXTURE USED TO BE DEGENERATE, and that is worth writing down because it is the exact
 * configuration `gapDifferenceStandardError` now refuses. Every fast decision carried
 * `confidence: 5` and `cp_loss: 200`, so every fast gap was exactly 1.0 and the bucket's sample
 * variance was exactly 0. The pooled standard error then collapsed to the slow side's alone, and
 * the "strong pattern" this file proves the drill loop on was clearing the threshold on an
 * artefact rather than on an effect. Simulation puts that path at up to 13% false positives
 * against the product's own 2% ceiling.
 *
 * So the fast bucket now varies on BOTH axes, the way a real player does: mostly very confident
 * but not uniformly, mostly wrong under time pressure but not always. The gap difference is still
 * large -- this is a fixture for a pattern that exists -- but it now has to clear the threshold
 * on its size rather than on a zero denominator.
 */
async function seedPattern(count: number) {
  for (let i = 0; i < count; i += 1) {
    const fast = i % 2 === 0;
    const id = `seed-${seeded + i}`;
    await store.commitDecision({
      decisionId: id,
      gameId: "g",
      fen: FENS[i % FENS.length],
      ply: i,
      phase: "opening",
      clockMsRemaining: 120_000,
      purpose: "play",
      drillId: null,
      secondsTaken: fast ? 10 : 200,
      chosenMove: "e2e4",
      candidateMovesConsidered: ["e2e4"],
      statedRead: "k",
      statedUnknown: "u",
      // Varies within the bucket: a player who says "certain" four times in five, not five.
      confidence: fast ? (i % 10 === 4 ? CONFIDENCE_LEVELS - 1 : CONFIDENCE_LEVELS) : EVEN_ODDS_LEVEL,
      confidenceScale: CONFIDENCE_LEVELS,
      probeAssignment: "not-probed",
      legalMoves: 20,
      revealTiming: "per-decision",
      measurementProtocol: null,
      protocolVersion: null,
      analysisTiming: null,
    });
    await store.recordReveal(id, {
      engine_eval_cp: 10,
      engine_best_move: "e2e4",
      engine_depth: 18,
      engine_source: "local_sf18",
      engine_build: "sf18-test-build",
      // Fast decisions are usually wrong and occasionally right, which is what makes the bucket
      // a measurement rather than a constant.
      cp_loss: fast ? (i % 8 === 0 ? 5 : 200) : i % 3 === 0 ? 120 : 5,
    });
  }
  seeded += count;
}

/**
 * Record drill decisions with a chosen confidence/accuracy profile.
 *
 * THE PROFILE VARIES WITHIN ITSELF, for the same reason `seedPattern` above does. A drill where
 * every position carries the identical confidence and the identical outcome has a sample variance
 * of exactly zero, and `gapDifferenceStandardError` now refuses that -- correctly, because a
 * sample that cannot estimate its own error is not a sample that measured something precisely.
 *
 * It matters more here than in the baseline, because a drill is 5-8 positions and a refusal is
 * indistinguishable in the stored result from a refutation. Before this varied, the refuting test
 * below was passing for the wrong reason: not because the drill failed to reproduce the gap, but
 * because the drill could not be read at all. One nudged position per profile is enough to make
 * the verdict mean what its name says.
 */
async function recordDrillDecisions(
  fens: string[],
  profile: { confidence: number; cpLoss: number },
): Promise<string[]> {
  const ids: string[] = [];
  for (const [index, fen] of fens.entries()) {
    const id = crypto.randomUUID();
    await store.commitDecision({
      decisionId: id,
      gameId: "drill",
      fen,
      ply: 0,
      phase: "opening",
      clockMsRemaining: null,
      purpose: "play",
      drillId: null,
      secondsTaken: 12,
      chosenMove: "e2e4",
      candidateMovesConsidered: ["e2e4"],
      statedRead: "k",
      statedUnknown: "u",
      // Nudged toward the middle of the scale, so the profile stays what it says it is.
      confidence:
        index === 1
          ? Math.min(
              CONFIDENCE_LEVELS,
              Math.max(1, profile.confidence + (profile.confidence >= EVEN_ODDS_LEVEL ? -1 : 1)),
            )
          : profile.confidence,
        confidenceScale: CONFIDENCE_LEVELS,
        probeAssignment: "not-probed",
        legalMoves: 20,
        revealTiming: "per-decision",
        measurementProtocol: null,
        protocolVersion: null,
        analysisTiming: null,
    });
    await store.recordReveal(id, {
      engine_eval_cp: 0,
      engine_best_move: "e2e4",
      engine_depth: 18,
      engine_source: "local_sf18",
      engine_build: "sf18-test-build",
      cp_loss: index === 2 ? (profile.cpLoss > 30 ? 10 : 200) : profile.cpLoss,
    });
    ids.push(id);
  }
  return ids;
}

beforeAll(async () => {
  token = await sdk.createSessionToken(OWNER, { name: "Owner" });
  store = new MemoryRecordStore();
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

async function call(path: string, json?: unknown) {
  const isQuery = json === undefined;
  const response = await fetch(`${origin}/api/trpc/${path}`, {
    method: isQuery ? "GET" : "POST",
    headers: {
      authorization: `Bearer ${token}`,
      ...(isQuery ? {} : { "content-type": "application/json" }),
    },
    body: isQuery ? undefined : JSON.stringify({ json }),
  });
  const text = await response.text();
  return { status: response.status, text, json: () => JSON.parse(text) };
}

const claimData = async () => (await call("record.claim")).json().result.data.json;

describe("the drill loop", () => {
  it("has a hypothesis to test once the record is deep enough", async () => {
    await seedPattern(MIN_BUCKET_N * 3);
    const data = await claimData();
    expect(data.claim, String(data.reason)).not.toBeNull();
    expect(data.claim.grade).toBe("hypothesis");
  });

  it("stores the refutation condition BEFORE returning any position (R5)", async () => {
    const data = await claimData();
    const started = (
      await call("record.startDrill", { claim_id: data.claim.claim_id, candidate_fens: UNDECIDED })
    ).json().result.data.json;
    expect(started.drill, String(started.reason)).not.toBeNull();
    expect(started.drill.refutation_condition).toBe(data.claim.refutation_condition);
    expect(started.drill.fens.length).toBeGreaterThanOrEqual(MIN_DRILL_POSITIONS);

    // The condition is on the record, not merely in the response.
    const stored = await store.getDrill(started.drill.drill_id);
    expect(stored?.spec.refutation_condition).toBe(data.claim.refutation_condition);
  });

  it("REFUTES and reports it when the drill shows no excess gap", async () => {
    const data = await claimData();
    const started = (
      await call("record.startDrill", { claim_id: data.claim.claim_id, candidate_fens: UNDECIDED })
    ).json().result.data.json;
    // Low confidence, accurate: the opposite of the predicted overconfidence.
    const ids = await recordDrillDecisions(started.drill.fens, { confidence: 1, cpLoss: 5 });

    const done = (
      await call("record.completeDrill", { drill_id: started.drill.drill_id, decision_ids: ids })
    ).json().result.data.json;

    expect(done.claim.grade).toBe("refuted");
    expect(done.description).toContain("הפריך");
    expect(done.claim.prospective_tests).toHaveLength(1);
  });

  it("keeps a refuted claim forever, and refuses to re-test it", async () => {
    const data = await claimData();
    expect(data.claim.grade).toBe("refuted");
    const retry = await call("record.startDrill", {
      claim_id: data.claim.claim_id,
      candidate_fens: UNDECIDED,
    });
    expect(retry.status).toBeGreaterThanOrEqual(400);
    expect(retry.text).toContain("PRECONDITION_FAILED");
  });
});

describe("the confirming direction", () => {
  it("REPLICATES when the drill reproduces the excess gap", async () => {
    // A fresh store, so this claim has no prior verdict.
    store = new MemoryRecordStore();
    seeded = 0;
    const app = createApp({ store });
    const local = app.listen(0, "127.0.0.1");
    await new Promise((done) => local.once("listening", done));
    const address = local.address();
    if (!address || typeof address === "string") throw new Error("no port");
    const localOrigin = `http://127.0.0.1:${address.port}`;

    const post = async (path: string, json: unknown) => {
      const r = await fetch(`${localOrigin}/api/trpc/${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ json }),
      });
      return JSON.parse(await r.text());
    };
    const get = async (path: string) => {
      const r = await fetch(`${localOrigin}/api/trpc/${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      return JSON.parse(await r.text());
    };

    try {
      await seedPattern(MIN_BUCKET_N * 3);
      const data = (await get("record.claim")).result.data.json;
      expect(data.claim, String(data.reason)).not.toBeNull();
      const started = (
        await post("record.startDrill", {
          claim_id: data.claim.claim_id,
          candidate_fens: UNDECIDED,
        })
      ).result.data.json;
      // Maximum confidence, badly wrong: exactly the predicted overconfidence.
      const ids = await recordDrillDecisions(started.drill.fens, { confidence: CONFIDENCE_LEVELS, cpLoss: 400 });
      const done = (
        await post("record.completeDrill", {
          drill_id: started.drill.drill_id,
          decision_ids: ids,
        })
      ).result.data.json;

      expect(done.claim.grade).toBe("replicated");
      expect(done.description).toContain("אישר");
      expect(done.verdict.n).toBe(ids.length);
    } finally {
      local.close();
    }
  });
});
