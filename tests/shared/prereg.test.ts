/**
 * The import -> live-loop bridge, and the four things it is not allowed to do.
 *
 * The value of a pre-registration is entirely in its constraints. A bucket named in advance lets
 * the detector search one place instead of six, which is what makes n = 20 legal instead of 30 --
 * but only if it really was named in advance, only if it names a bucket the live detector knows,
 * and only if it never claims to know what will be found there. Drop any one of those and this
 * stops being pre-registration and becomes a lower threshold with a story attached.
 */
import { describe, expect, it } from "vitest";
import {
  BUCKETINGS,
  DEFAULT_THRESHOLDS,
  MIN_BUCKET_N,
  PREREGISTERED_THRESHOLDS,
  detect,
  normaliseConfidence,
  seededRandom,
  shuffleControl,
  MAX_SHUFFLED_FALSE_POSITIVE_RATE,
  type ScoredDecision,
} from "../../shared/detector";
import {
  hypothesisFromImport,
  isRegistrableBucket,
  isTestable,
  refutationFor,
  type PreregisteredHypothesis,
} from "../../shared/prereg";
import { diagnoseImportedGames, IMPORT_BUCKETINGS } from "../../shared/import-diagnostic";
import { MemoryRecordStore } from "../../server/record";
import { currentClaim, registerHypothesis } from "../../shared/record-service";

/** Noise: no relationship between context and calibration. Deterministic by seed. */
function noise(n: number, seed: number): ScoredDecision[] {
  const random = seededRandom(seed);
  return Array.from({ length: n }, (_, index) => ({
    decision_id: `n-${index}`,
    confidence: normaliseConfidence(1 + Math.floor(random() * 5)),
    accurate: random() < 0.5,
    phase: (["opening", "middlegame", "endgame"] as const)[Math.floor(random() * 3)],
    secondsTaken: Math.floor(random() * 200),
    clockMsRemaining: Math.floor(random() * 300_000),
  }));
}

describe("the threshold the narrowing buys, and the measurement behind it", () => {
  it("is a lower n, and NOT a lower gap", () => {
    /*
     * The design was proposed on the opposite assumption -- that six chances to clear should need
     * a higher bar than one, so naming a bucket in advance should buy a lower gap. The sweep
     * refuted it: the six bucketings are not six independent tests, because the three phase
     * buckets partition the same decisions and the clock buckets overlap. This asserts what the
     * measurement actually supports, so a future reader cannot reintroduce the assumption.
     */
    expect(PREREGISTERED_THRESHOLDS.minGapDifference).toBe(DEFAULT_THRESHOLDS.minGapDifference);
    expect(PREREGISTERED_THRESHOLDS.minBucketN).toBeLessThan(DEFAULT_THRESHOLDS.minBucketN);
  });

  it("holds the shuffled-label ceiling at n=20 for EVERY bucket that could be named", () => {
    /*
     * The whole justification for n = 20, re-measured here rather than cited. It has to hold for
     * every bucket, not on average: the player does not choose which bucket their import names,
     * so the worst one is the one that matters.
     */
    for (const bucketing of BUCKETINGS) {
      let worst = 0;
      for (const size of [40, 60, 80, 120, 200]) {
        for (let seedOffset = 1; seedOffset <= 3; seedOffset += 1) {
          const report = shuffleControl(
            noise(size, 7 + size),
            120,
            20260821 + seedOffset,
            PREREGISTERED_THRESHOLDS,
            bucketing.key,
          );
          worst = Math.max(worst, report.falsePositiveRate);
        }
      }
      expect(worst, `${bucketing.key} finds structure in noise at the pre-registered thresholds`)
        .toBeLessThanOrEqual(MAX_SHUFFLED_FALSE_POSITIVE_RATE);
    }
  });

  it("would NOT hold at n=20 without the narrowing, which is why the narrowing is required", () => {
    /*
     * The other half, and the one that makes the first half mean something. If the six-bucket
     * scan also cleared the ceiling at n = 20, the restriction would be a formality attached to a
     * threshold someone wanted anyway. It does not clear it.
     */
    let worst = 0;
    for (const size of [40, 60, 80, 120, 200]) {
      for (let seedOffset = 1; seedOffset <= 3; seedOffset += 1) {
        const report = shuffleControl(
          noise(size, 7 + size),
          120,
          20260821 + seedOffset,
          PREREGISTERED_THRESHOLDS,
          null,
        );
        worst = Math.max(worst, report.falsePositiveRate);
      }
    }
    expect(worst).toBeGreaterThan(MAX_SHUFFLED_FALSE_POSITIVE_RATE);
  });
});

describe("what may be registered", () => {
  it("accepts only buckets the live detector knows", () => {
    for (const bucketing of BUCKETINGS) expect(isRegistrableBucket(bucketing.key)).toBe(true);
    // The import's standing buckets read the engine's verdict on the position the player FACED,
    // which the live record structurally cannot have -- R3 forbids the engine speaking first.
    for (const importOnly of IMPORT_BUCKETINGS) {
      expect(isRegistrableBucket(importOnly.key), `${importOnly.key} has no live twin`).toBe(false);
    }
  });

  it("throws rather than quietly finding nothing when the bucket does not exist", () => {
    // A stored hypothesis pointing at a removed bucket is a bug in whatever stored it. Returning
    // the ordinary "no patterns" answer would hide it behind this function's most common result.
    expect(() => detect(noise(80, 3), PREREGISTERED_THRESHOLDS, "no-such-bucket")).toThrow(
      /no bucketing named/,
    );
  });
});

describe("the import cannot claim more than it measured", () => {
  it("registers nothing when the worst bucket is not separable from the next", () => {
    // Six measurements always differ. Registering the lowest of them would launder sampling noise
    // into a pre-registration, which is worse than no bridge -- it would carry the authority of one.
    const flat = diagnoseImportedGames([]);
    const outcome = hypothesisFromImport(flat, {
      registered_at: "2026-08-24T10:00:00.000Z",
      decisions_before: 0,
      games: 0,
    });
    expect(outcome.kind).not.toBe("registered");
  });

  it("states a refutation condition about WHERE to look, never about the player", () => {
    const condition = refutationFor("החלטות תחת פחות מ-45 שניות");
    // It says the import pointed at a place, not that the player is bad there. The import has no
    // confidence data at all -- nobody was asked during a game already played -- so any
    // directional claim would be the bridge inventing what it could not have measured.
    expect(condition).toContain("לא על מה שיימצא שם");
    expect(condition).not.toMatch(/ביטחון (גבוה|נמוך)/);
    // And it names a way to be wrong. A condition that cannot fail measures nothing (R5).
    expect(condition).toContain("הופרכה");
  });
});

describe("pre-registration is only pre-registration if it precedes the decisions", () => {
  it("is not testable until the record has grown past the boundary", () => {
    const hypothesis: PreregisteredHypothesis = {
      bucket_key: "fast-under-45s",
      scope: "s",
      registered_at: "2026-08-24T10:00:00.000Z",
      decisions_before: 12,
      evidence: {
        accurate_rate: 0.4,
        n: 90,
        runner_up_key: "phase-endgame",
        separation: 0.2,
        threshold: 0.1,
        games: 20,
      },
      refutation_condition: "x",
    };
    expect(isTestable(hypothesis, 12)).toBe(false);
    expect(isTestable(hypothesis, 13)).toBe(true);
  });

  it("takes the boundary from the STORE, discarding whatever the caller sent", async () => {
    /*
     * The security-shaped half of the mechanism. A caller that could choose `decisions_before`
     * could choose zero, and the hypothesis would be tested on the very decisions that suggested
     * it. The service reads the count itself, so the field is not merely validated -- it is
     * ignored on the way in.
     */
    const store = new MemoryRecordStore();
    for (let index = 0; index < 7; index += 1) {
      await store.commitDecision({
        decisionId: `d-${index}`,
        gameId: "g",
        fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
        ply: index,
        phase: "middlegame",
        clockMsRemaining: 60_000,
        secondsTaken: 20,
        chosenMove: "a1b1",
        candidateMovesConsidered: ["a1b1"],
        statedRead: "r",
        statedUnknown: "u",
        confidence: 3,
      });
    }
    const saved = await registerHypothesis(store, {
      bucket_key: "fast-under-45s",
      scope: "החלטות תחת פחות מ-45 שניות",
      registered_at: "2026-08-24T10:00:00.000Z",
      evidence: {
        accurate_rate: 0.4,
        n: 90,
        runner_up_key: "phase-endgame",
        separation: 0.2,
        threshold: 0.1,
        games: 20,
      },
      refutation_condition: "x",
    });
    expect(saved.decisions_before).toBe(7);
  });

  it("refuses a bucket the live detector cannot search", async () => {
    const store = new MemoryRecordStore();
    await expect(
      registerHypothesis(store, {
        bucket_key: "standing-losing",
        scope: "החלטות מתוך עמדה מפסידה",
        registered_at: "2026-08-24T10:00:00.000Z",
        evidence: {
          accurate_rate: 0.4,
          n: 90,
          runner_up_key: "phase-endgame",
          separation: 0.2,
          threshold: 0.1,
          games: 20,
        },
        refutation_condition: "x",
      }),
    ).rejects.toThrow();
  });
});

describe("the narrowing stops narrowing once the ordinary scan is possible", () => {
  it("hands back the six-bucket scan at MIN_BUCKET_N * 2 revealed decisions", async () => {
    /*
     * The rule that keeps the two false-positive rates from compounding. Exactly one search runs
     * at any record size: narrowed while the record is small, ordinary once it is not. Running
     * the narrowed search AND falling back to the wide one would be two chances to clear, and the
     * measured 1.3% and 0.7% are each for ONE search.
     *
     * It also means a hypothesis cannot suppress a finding forever.
     */
    const store = new MemoryRecordStore();
    await registerHypothesis(store, {
      bucket_key: "fast-under-45s",
      scope: "החלטות תחת פחות מ-45 שניות",
      registered_at: "2026-08-24T10:00:00.000Z",
      evidence: {
        accurate_rate: 0.4,
        n: 90,
        runner_up_key: "phase-endgame",
        separation: 0.2,
        threshold: 0.1,
        games: 20,
      },
      refutation_condition: "x",
    });

    // Well past the ordinary floor, all revealed.
    const total = MIN_BUCKET_N * 2 + 20;
    for (let index = 0; index < total; index += 1) {
      const id = `d-${String(index).padStart(3, "0")}`;
      await store.commitDecision({
        decisionId: id,
        gameId: "g",
        fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
        ply: index,
        phase: index % 2 === 0 ? "middlegame" : "endgame",
        clockMsRemaining: 60_000,
        secondsTaken: index % 2 === 0 ? 10 : 200,
        chosenMove: "a1b1",
        candidateMovesConsidered: ["a1b1"],
        statedRead: "r",
        statedUnknown: "u",
        confidence: 3,
      });
      await store.recordReveal(id, {
        engine_eval_cp: 0,
        engine_best_move: "a1b1",
        engine_depth: 12,
        engine_source: "local_sf18",
        cp_loss: index % 3 === 0 ? 5 : 90,
      });
    }

    const view = await currentClaim(store, { created_at: "2026-08-24T11:00:00.000Z" });
    // The hypothesis is on record and is deliberately NOT narrowing any more.
    expect(await store.getPreregisteredHypothesis()).not.toBeNull();
    expect(view.prereg).toBeNull();
  });

  it("narrows while the record is still short, and says so", async () => {
    const store = new MemoryRecordStore();
    await registerHypothesis(store, {
      bucket_key: "fast-under-45s",
      scope: "החלטות תחת פחות מ-45 שניות",
      registered_at: "2026-08-24T10:00:00.000Z",
      evidence: {
        accurate_rate: 0.4,
        n: 90,
        runner_up_key: "phase-endgame",
        separation: 0.2,
        threshold: 0.1,
        games: 20,
      },
      refutation_condition: "x",
    });
    // One decision after registration: below every floor, but past the boundary.
    await store.commitDecision({
      decisionId: "d-after",
      gameId: "g",
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      ply: 1,
      phase: "middlegame",
      clockMsRemaining: 60_000,
      secondsTaken: 10,
      chosenMove: "a1b1",
      candidateMovesConsidered: ["a1b1"],
      statedRead: "r",
      statedUnknown: "u",
      confidence: 3,
    });

    const view = await currentClaim(store, { created_at: "2026-08-24T11:00:00.000Z" });
    expect(view.prereg?.bucket_key).toBe("fast-under-45s");
    // A DIFFERENT sentence from the ordinary silence: the wait is shorter and counted from the
    // import onward, and section 4.5 forbids two different facts rendering as one.
    expect(view.reason).toContain(String(PREREGISTERED_THRESHOLDS.minBucketN * 2));
    expect(view.reason).toContain("דלי אחד במקום שישה");
  });
});

describe("the whole bridge, end to end", () => {
  /**
   * A game whose PHASE buckets separate: the player loses ground on most opening moves and
   * almost none later. `phase-opening` is ply <= 20, so a long game gives both a filled opening
   * bucket and a filled everything-else bucket.
   */
  function game(plies: number, playerColor: "w" | "b" = "w") {
    const FULL = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const fens = Array.from({ length: plies + 1 }, () => FULL);
    const evalScores = [0];
    for (let ply = 1; ply <= plies; ply += 1) {
      const isWhiteMove = ply % 2 === 1;
      const mine = isWhiteMove === (playerColor === "w");
      // Mine, in the opening: lose ground almost every time. Mine, later: almost never.
      const loses = mine && (ply <= 20 ? ply % 3 !== 0 : ply % 17 === 0);
      evalScores.push(evalScores[ply - 1] + (loses ? (isWhiteMove ? -200 : 200) : 0));
    }
    return {
      fens,
      evalScores,
      clockTimes: Array.from({ length: plies + 1 }, (_, i) => 600 - Math.floor(i / 2) * 20),
      timeControl: "600+0",
      playerColor,
      speed: "rapid",
    };
  }

  it("carries a bucket from imported games into a narrowed live search", async () => {
    /*
     * The connection this whole module exists for, exercised in one place rather than inferred
     * from its parts passing separately. Import -> reading -> hypothesis -> store -> the live
     * detector searching ONE bucket at n = 20 over decisions recorded after the registration.
     */
    const diagnostic = diagnoseImportedGames([game(120), game(120), game(120, "b")]);
    const outcome = hypothesisFromImport(diagnostic, {
      registered_at: "2026-08-24T10:00:00.000Z",
      decisions_before: 0,
      games: 3,
    });
    if (outcome.kind !== "registered") {
      throw new Error(`the fixture did not produce a separable bucket: ${outcome.kind}`);
    }
    // The import named a bucket the LIVE detector knows. That is the only kind it may name.
    expect(BUCKETINGS.some((b) => b.key === outcome.hypothesis.bucket_key)).toBe(true);

    const store = new MemoryRecordStore();
    // Decisions recorded BEFORE the import. These must never be tested against the hypothesis.
    for (let index = 0; index < 9; index += 1) await commit(store, `before-${index}`, index);

    const saved = await registerHypothesis(store, {
      bucket_key: outcome.hypothesis.bucket_key,
      scope: outcome.hypothesis.scope,
      registered_at: outcome.hypothesis.registered_at,
      evidence: outcome.hypothesis.evidence,
      refutation_condition: outcome.hypothesis.refutation_condition,
    });
    expect(saved.decisions_before).toBe(9);

    // Nothing recorded since: the hypothesis exists but is not yet testable, and the view says so
    // rather than narrowing a search over the decisions that preceded it.
    const before = await currentClaim(store, { created_at: "2026-08-24T11:00:00.000Z" });
    expect(before.prereg).toBeNull();

    for (let index = 0; index < 5; index += 1) await commit(store, `after-${index}`, index);
    const after = await currentClaim(store, { created_at: "2026-08-24T11:00:00.000Z" });
    expect(after.prereg?.bucket_key).toBe(outcome.hypothesis.bucket_key);
    // The whole record is still reported, even though the search covered only part of it.
    expect(after.recorded).toBe(14);
  });

  async function commit(store: MemoryRecordStore, id: string, index: number) {
    await store.commitDecision({
      decisionId: id,
      gameId: "g",
      fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
      ply: index,
      phase: index % 2 === 0 ? "opening" : "endgame",
      clockMsRemaining: 60_000,
      secondsTaken: 10,
      chosenMove: "a1b1",
      candidateMovesConsidered: ["a1b1"],
      statedRead: "r",
      statedUnknown: "u",
      confidence: 4,
    });
  }
});
