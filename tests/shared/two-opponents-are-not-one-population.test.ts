/**
 * R-03 and R-04, second half: the record says what the instrument was, and a reading refuses to
 * pool two of them.
 *
 * THE FIRST HALF WAS RECORDING, AND RECORDING IS NOT ENFORCING. `blitz_games` gained
 * `analysis_engine_build` and `opponent_depth` in the commit before this one, and a field nothing
 * reads is a field nothing can be wrong about. `shared/evidence-policy.ts` learned this the
 * expensive way and says so in its own words: `reveal-timing.ts` had recorded which mode was in
 * force since the day it was written, *"and until now nothing enforced it. The recording happened.
 * The wall did not exist."* This is the wall, built while there is still nothing on the other side
 * of it.
 *
 * WHAT MAKES THE POOLING WORTH REFUSING. `docs/ACTION_PLAN.md` §B1 measured 13.61% of decisions
 * flipping verdict between two builds of this engine. A calibration gap computed across a build
 * change is therefore an artefact of the change, and it is invisible: both halves of the pooled set
 * are complete, plausible rows.
 *
 * WHAT THIS FILE DOES NOT TEST. Whether the largest stratum is the RIGHT one to read. It is chosen
 * from sizes alone, before anything is scored, and that is the only property asserted here -- the
 * choice ignores the answer. Preferring one regime on scientific grounds is a decision about what
 * the product measures, and `blitz-strata.ts` says at length why it is not smuggled in.
 */
import { describe, expect, it } from "vitest";
import {
  blitzCalibrationPopulation,
  blitzSearchPopulation,
  blitzStratumId,
  analysisInstrumentOf,
  exclusionOf,
  LEGACY_INSTRUMENT,
  type BlitzStratumKey,
} from "../../shared/blitz-strata";
import * as strataModule from "../../shared/blitz-strata";
import type { StoredBlitzDecision, StoredBlitzGame } from "../../shared/blitz-record";
import { CURRENT_PROTOCOL_VERSION } from "../../shared/measurement-protocol";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

const game = (gameId: string, over: Partial<StoredBlitzGame> = {}): StoredBlitzGame => ({
  gameId,
  playedAs: "w",
  timeControl: { initialMs: 180_000, incrementMs: 0 },
  outcome: { kind: "resignation", loser: "b" },
  startedAt: "2026-08-30T12:00:00.000Z",
  finishedAt: "2026-08-30T12:03:00.000Z",
  measurementProtocol: "instrumented-blitz",
  protocolVersion: CURRENT_PROTOCOL_VERSION,
  analysisTiming: "after-play",
  samplingPolicyVersion: 1,
  askRate: 0.15,
  analysisState: "complete",
  analysedAt: "2026-08-30T12:03:20.000Z",
  analysis: { engine: "stockfish", build: "18-lite-single-aaaa", depth: 12 },
  opponent: { kind: "engine", engine: "stockfish", build: "18-lite-single-aaaa", depth: 4 },
  ...over,
});

/** A readable decision: scored, and asked. Everything else here is a deliberate departure. */
const decision = (
  gameId: string,
  ply: number,
  over: Partial<StoredBlitzDecision> = {},
): StoredBlitzDecision => ({
  gameId,
  ply,
  side: "w",
  san: "e4",
  fenBefore: START,
  thinkMs: 1200,
  clockBeforeMs: 180_000,
  opponentClockBeforeMs: 180_000,
  wasAsked: true,
  samplingProbability: 0.15,
  confidence: 5,
  instrumentationLatencyMs: 800,
  cpLoss: 30,
  standingCp: 40,
  ...over,
});

const plies = (gameId: string, n: number, over: Partial<StoredBlitzDecision> = {}) =>
  Array.from({ length: n }, (_, i) => decision(gameId, i * 2 + 1, over));

describe("two opponents are not one population", () => {
  describe("what forces a split", () => {
    it("separates two ENGINE BUILDS that scored the same kind of game", () => {
      /*
       * The measured one. Everything else about these two games is identical -- same time control,
       * same protocol, same opponent, same sampler -- and pooling them would produce one calibration
       * gap over two instruments that disagree about 13.61% of verdicts.
       */
      const games = [
        game("g1"),
        game("g2", { analysis: { engine: "stockfish", build: "18-lite-single-bbbb", depth: 12 } }),
      ];
      const { strata } = blitzCalibrationPopulation(games, [...plies("g1", 3), ...plies("g2", 2)]);
      expect(strata).toHaveLength(2);
      expect(strata.map((s) => s.decisions.length)).toEqual([3, 2]);
    });

    it("separates two SEARCH DEPTHS of the same build", () => {
      // Same binary, different question asked of it. The cp-losses are not the same measurement.
      const games = [
        game("g1"),
        game("g2", { analysis: { engine: "stockfish", build: "18-lite-single-aaaa", depth: 20 } }),
      ];
      const { strata } = blitzCalibrationPopulation(games, [...plies("g1", 2), ...plies("g2", 2)]);
      expect(strata).toHaveLength(2);
    });

    it("separates two OPPONENT policies, which is R-04's whole clause", () => {
      /*
       * The engine that SCORED both games is identical here, so a wall that only knew about the
       * analyser would pool these. The games were played against opponents searching to different
       * depths, so the positions reached are different positions and the player was solving a
       * different problem.
       */
      const games = [
        game("g1"),
        game("g2", {
          opponent: { kind: "engine", engine: "stockfish", build: "18-lite-single-aaaa", depth: 8 },
        }),
      ];
      const { strata } = blitzCalibrationPopulation(games, [...plies("g1", 2), ...plies("g2", 2)]);
      expect(strata).toHaveLength(2);
      expect(new Set(strata.map((s) => s.key.analysis)).size, "the analyser differed").toBe(1);
    });

    it("separates a recorded instrument from one that was never recorded", () => {
      /*
       * `legacy` IS ITS OWN STRATUM AND NOT A WILDCARD. A row from before the column existed is not
       * a row whose engine was absent; it is a row nobody wrote it down for. Pooling it with a real
       * build asserts a fact this build never observed -- the same rule `LEGACY_PROTOCOL` follows.
       */
      const legacy = game("g2", { analysisState: "legacy-unknown", analysedAt: null, analysis: null });
      expect(analysisInstrumentOf(legacy)).toBe(LEGACY_INSTRUMENT);
      const { strata, excluded } = blitzCalibrationPopulation(
        [game("g1"), legacy],
        [...plies("g1", 2), ...plies("g2", 2)],
      );
      /* And it is not merely a separate stratum -- it cannot be read at all. See below. */
      expect(strata).toHaveLength(1);
      expect(excluded.find((e) => e.reason === "instrument-unrecorded")?.n).toBe(2);
    });

    it("separates two SAMPLING POLICY versions and two PROTOCOL versions", () => {
      const games = [
        game("g1"),
        game("g2", { samplingPolicyVersion: 2 }),
        game("g3", { protocolVersion: CURRENT_PROTOCOL_VERSION + 1 }),
      ];
      const { strata } = blitzCalibrationPopulation(games, [
        ...plies("g1", 3),
        ...plies("g2", 2),
        ...plies("g3", 1),
      ]);
      expect(strata).toHaveLength(3);
    });

    it("does NOT split on anything that is not a condition of the measurement", () => {
      /*
       * The other half, and the one that keeps the split from being free. A wall that separated
       * every game would satisfy every assertion above and give every stratum n=1, which is a
       * detector that can never say anything. Two games differing in outcome, clock and colour are
       * one population.
       */
      const games = [
        game("g1"),
        game("g2", {
          playedAs: "b",
          outcome: { kind: "flag", loser: "w" },
          timeControl: { initialMs: 300_000, incrementMs: 5_000 },
        }),
      ];
      const { strata } = blitzCalibrationPopulation(games, [...plies("g1", 2), ...plies("g2", 2)]);
      expect(strata, "a reading split on something that is not a measurement condition").toHaveLength(1);
      expect(strata[0].decisions).toHaveLength(4);
      expect(strata[0].gameIds).toEqual(["g1", "g2"]);
    });
  });

  describe("what cannot be read at all, named rather than dropped", () => {
    it("refuses an UNSCORED game and says it is unscored, not unasked", () => {
      /*
       * R-02 wrote the game before the engine ran, so this state is now common rather than
       * exceptional. Its decisions have no cp-loss and never had one -- reporting them as
       * "the evaluator was silent" would blame an engine that has not been asked yet.
       */
      const pending = game("g1", {
        analysisState: "pending",
        analysedAt: null,
        analysis: null,
      });
      const { strata, excluded } = blitzCalibrationPopulation(
        [pending],
        plies("g1", 3, { cpLoss: null, standingCp: null }),
      );
      expect(strata).toHaveLength(0);
      expect(excluded).toEqual([
        {
          reason: "analysis-not-run",
          n: 3,
          because: "Stored and not yet scored. The engine has not run on this game.",
        },
      ]);
    });

    it("tells a REFUSED analysis apart from one that has not happened", () => {
      const refused = game("g1", { analysisState: "refused", analysedAt: null, analysis: null });
      const { excluded } = blitzCalibrationPopulation([refused], plies("g1", 2, { cpLoss: null }));
      expect(excluded.map((e) => e.reason)).toEqual(["analysis-refused"]);
    });

    it("refuses a decision the engine could not answer for, inside a game it DID score", () => {
      // Distinct from every state above: the engine ran, and had nothing to say about this position.
      const { strata, excluded } = blitzCalibrationPopulation(
        [game("g1")],
        [decision("g1", 1), decision("g1", 3, { cpLoss: null })],
      );
      expect(strata[0].decisions).toHaveLength(1);
      expect(excluded.map((e) => e.reason)).toEqual(["evaluator-silent"]);
    });

    it("counts an UNASKED decision separately from a broken one", () => {
      /*
       * The exclusion that is not a defect. The sampler asks about 15% of decisions, so most rows
       * land here on every real record -- and folding them in with the instrument failures would
       * make a run where the sampler asked nothing indistinguishable from one where the engine
       * answered nothing.
       */
      const { strata, excluded } = blitzCalibrationPopulation(
        [game("g1")],
        [
          decision("g1", 1),
          decision("g1", 3, { wasAsked: false, confidence: null, instrumentationLatencyMs: null }),
        ],
      );
      expect(strata[0].decisions).toHaveLength(1);
      expect(excluded.map((e) => e.reason)).toEqual(["not-asked"]);
    });

    it("refuses a decision whose game it never received", () => {
      /*
       * The tear R-06's transaction now prevents, asserted anyway, because this reader is given two
       * lists and cannot know they came from one write. Treating an orphan as readable would give
       * it a stratum key derived from no game at all.
       */
      const { strata, excluded } = blitzCalibrationPopulation([], plies("g1", 2));
      expect(strata).toHaveLength(0);
      expect(excluded.map((e) => e.reason)).toEqual(["game-missing"]);
      expect(exclusionOf(decision("g1", 1), undefined)).toBe("game-missing");
    });

    it("reports the FIRST thing that went wrong when several are true at once", () => {
      // Unscored AND unasked. The sampler's silence is not what stopped this row being readable.
      const pending = game("g1", { analysisState: "pending", analysedAt: null, analysis: null });
      const orphan = decision("g1", 1, { cpLoss: null, confidence: null, wasAsked: false });
      expect(exclusionOf(orphan, pending)).toBe("analysis-not-run");
    });
  });

  describe("the reading a caller actually gets", () => {
    it("orders strata largest first and breaks ties by id, not by arrival", () => {
      /*
       * The determinism the choice depends on. `blitzSearchPopulation` takes the head, so an order
       * that depended on which row was written first would make the same record yield a different
       * reading on a different day.
       */
      const a = game("ga", {
        opponent: { kind: "engine", engine: "stockfish", build: "18-lite-single-aaaa", depth: 4 },
      });
      const b = game("gb", {
        opponent: { kind: "engine", engine: "stockfish", build: "18-lite-single-aaaa", depth: 6 },
      });
      const decisions = [...plies("ga", 2), ...plies("gb", 2)];
      const forward = blitzCalibrationPopulation([a, b], decisions).strata.map((s) =>
        blitzStratumId(s.key),
      );
      const backward = blitzCalibrationPopulation([b, a], [...decisions].reverse()).strata.map((s) =>
        blitzStratumId(s.key),
      );
      expect(forward).toEqual(backward);
    });

    it("chooses the largest stratum and NAMES the ones it set aside", () => {
      const games = [
        game("g1"),
        game("g2", { analysis: { engine: "stockfish", build: "18-lite-single-bbbb", depth: 12 } }),
      ];
      const { strata } = blitzCalibrationPopulation(games, [...plies("g1", 5), ...plies("g2", 2)]);
      const { chosen, setAside } = blitzSearchPopulation(strata);
      expect(chosen?.decisions).toHaveLength(5);
      expect(setAside).toHaveLength(1);
      expect(setAside[0].n).toBe(2);
      /* Named, not merely counted: a caller has to be able to say WHICH regime it did not read. */
      expect(setAside[0].id).toContain("bbbb");
    });

    it("chooses NOTHING rather than something, on a record with no readable decision", () => {
      // The empty case is a real one now: every game is `pending` until its analysis lands.
      const { chosen, setAside } = blitzSearchPopulation([]);
      expect(chosen).toBeNull();
      expect(setAside).toEqual([]);
    });

    it("cannot be flattened back into one population, because nothing here returns a flat set", () => {
      /*
       * ASSERTED ON THE MODULE'S SURFACE, which is the only place it can be asserted. The shape
       * `evidence-policy.ts` replaced let a caller pool by doing NOTHING AT ALL -- concatenating
       * two arrays is not a mistake anybody has to make on purpose -- and that is how this class of
       * defect survived a policy module written specifically to prevent it. Refusing to provide the
       * operation is stronger than documenting that it is wrong, so the guarantee is that the
       * operation is absent, and this is what catches somebody adding it back as a convenience.
       *
       * A SNAPSHOT OF THE EXPORTS, and it is meant to be edited when the module gains something.
       * Editing it is the moment somebody has to look at a new name and ask whether it flattens.
       */
      const surface = Object.keys(strataModule).sort();
      expect(surface).toEqual([
        "BLITZ_EXCLUSIONS",
        "BLITZ_EXCLUSION_REASON",
        "LEGACY_INSTRUMENT",
        "analysisInstrumentOf",
        "blitzCalibrationPopulation",
        "blitzSearchPopulation",
        "blitzStratumId",
        "exclusionOf",
        "opponentPolicyOf",
      ]);
      // And the one function that reads a record hands back strata, never a set.
      expect(Object.keys(blitzCalibrationPopulation([game("g1")], plies("g1", 1))).sort()).toEqual([
        "excluded",
        "strata",
      ]);
    });
  });

  describe("the stratum id, which is what a map keys on", () => {
    it("cannot be forged by a separator inside an engine name", () => {
      /*
       * Not hypothetical enough to skip. These components are free text out of a record, and two
       * regimes sharing an id is silent pooling arriving through the identifier of the module that
       * exists to prevent it. `evidence-policy.ts` joins two closed enums with a slash and is safe
       * for a reason that does not hold here.
       */
      const a: BlitzStratumKey = {
        analysis: "stockfish@a|b/12",
        opponent: "engine:x@y/4",
        protocolVersion: 1,
        samplingPolicyVersion: 1,
      };
      const b: BlitzStratumKey = {
        analysis: "stockfish@a",
        opponent: "b/12|engine:x@y/4",
        protocolVersion: 1,
        samplingPolicyVersion: 1,
      };
      expect(blitzStratumId(a)).not.toBe(blitzStratumId(b));
    });

    it("is stable for the same key", () => {
      const key: BlitzStratumKey = {
        analysis: "stockfish@18-lite-single-aaaa/12",
        opponent: "engine:stockfish@18-lite-single-aaaa/4",
        protocolVersion: 3,
        samplingPolicyVersion: 1,
      };
      expect(blitzStratumId(key)).toBe(blitzStratumId({ ...key }));
    });
  });
});
