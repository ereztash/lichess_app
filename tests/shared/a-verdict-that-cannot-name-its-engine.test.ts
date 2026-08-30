/**
 * R-03: a `cp_loss` that cannot say which engine produced it is not a measurement.
 *
 * WHY `engine_source` WAS NOT ALREADY THE ANSWER, which is the whole of this row. It names a
 * FAMILY -- `local_sf18` or `lichess_cloud` -- and `docs/ACTION_PLAN.md` §B1 measured a change
 * WITHIN the local family: 13.61% of decisions flipped verdict (216 of 1,587) between the engine
 * that produced this project's published numbers and the engine that ships, and 1 bucket of 38 was
 * stable to display resolution. Two rows agreeing on `engine_source` are therefore not two rows
 * from one instrument, and "accurate" is undefined for a row that cannot say which of them spoke.
 *
 * THE BUILD IS THE CONTENT HASH OF THE WASM, not `package.json`. The dependency range is `^18.0.8`,
 * so the binary can change without any version string a build could embed changing with it.
 *
 * WHAT THIS COSTS, SAID OUT LOUD. Every decision revealed before this field existed becomes
 * unreadable for calibration, which on an existing record is all of them. That is the intended
 * price and not an oversight: `shared/evidence-policy.ts` made the same trade when it was written
 * -- *"a source does not become eligible because excluding it leaves too little data"* -- and the
 * same sentence applies to an instrument nobody wrote down. The cost is bounded, because every
 * decision taken from here on records its build, and it is NAMED rather than silent, which is the
 * half these tests spend the most assertions on.
 */
import { describe, expect, it } from "vitest";
import {
  forDiscovery,
  forDescriptiveHistory,
  readableInstrument,
  stratumId,
  discoverySearchPopulation,
} from "@shared/evidence-policy";
import { scoreDecisions } from "@shared/scoring";
import { resultSchema } from "@shared/decision-atom";
import type { DecisionAtom } from "@shared/decision-atom";

const BUILD = "stockfish-18-lite-single-a1b2c3";

/**
 * A scoreable free-play decision, with every axis this file varies made explicit.
 *
 * `result: null` is spelled out rather than omitted because the two are not the same to
 * `readableInstrument`: an atom read back from the record always HAS the key.
 */
const decision = (over: {
  build?: string | undefined;
  revealed?: boolean;
  confidence?: number | null;
} = {}): DecisionAtom =>
  ({
    purpose: "play",
    reveal_timing: null,
    measurement_protocol: null,
    protocol_version: null,
    analysis_timing: null,
    entry_state: { fen: "8/8/8/8/8/8/8/K6k w - - 0 1", phase: "endgame", clock_ms_remaining: 60_000 },
    bounded_action: {
      confidence: over.confidence === undefined ? 5 : over.confidence,
      confidence_scale: 7,
      seconds_taken: 12,
    },
    result:
      over.revealed === false
        ? null
        : {
            engine_eval_cp: 20,
            engine_best_move: "a1b2",
            engine_depth: 14,
            engine_source: "local_sf18",
            engine_build: "build" in over ? over.build : BUILD,
            cp_loss: 10,
          },
  }) as unknown as DecisionAtom;

const score = (atoms: DecisionAtom[]) =>
  scoreDecisions(
    atoms,
    atoms.map((_, i) => `d${i}`),
  );

const strataOf = (atoms: DecisionAtom[]) =>
  forDiscovery(
    atoms,
    atoms.map((_, i) => `d${i}`),
  );

describe("a verdict that cannot name its engine", () => {
  describe("the schema carries the build, and carries its absence as absence", () => {
    it("accepts a verdict that names its build", () => {
      expect(resultSchema.safeParse(decision().result).success).toBe(true);
    });

    it("accepts one that does not, because rows written before the field exist", () => {
      /*
       * OPTIONAL RATHER THAN REQUIRED, and the alternative was considered and refused: making it
       * required would make every stored row fail to parse, which turns a reading that is quietly
       * wrong into a record that cannot be read at all. The refusal belongs where the number is
       * USED, not where the row is loaded.
       */
      expect(resultSchema.safeParse(decision({ build: undefined }).result).success).toBe(true);
    });

    it("REFUSES a build stated as an empty string, which is not the same as not stating one", () => {
      const empty = { ...decision().result, engine_build: "" };
      expect(resultSchema.safeParse(empty).success).toBe(false);
    });
  });

  describe("what a reading does with the absence", () => {
    it("refuses it, and counts it under its own name rather than dropping it", () => {
      /*
       * THE GATE. Three decisions, all revealed, all with a stated confidence, none naming an
       * engine. `scored` is empty and `withoutInstrument` is 3 -- not `awaitingReveal`, which would
       * tell the player to wait for something that has already happened, and not
       * `withoutConfidence`, which would tell them they were never asked.
       */
      const summary = score([
        decision({ build: undefined }),
        decision({ build: undefined }),
        decision({ build: undefined }),
      ]);
      expect(summary.scored).toHaveLength(0);
      expect(summary.withoutInstrument).toBe(3);
      expect(summary.awaitingReveal).toBe(0);
      expect(summary.withoutConfidence).toBe(0);
      expect(summary.total).toBe(3);
    });

    it("scores the ones that DO name an engine, in the same record", () => {
      // The other half: refusing is only correct if it refuses exactly the rows it should.
      const summary = score([decision(), decision({ build: undefined }), decision()]);
      expect(summary.scored).toHaveLength(2);
      expect(summary.withoutInstrument).toBe(1);
    });

    it("keeps an UNREVEALED decision a wait rather than a defect", () => {
      /*
       * The distinction the count exists for. A row with no verdict has no engine to name yet, and
       * calling that unreadable would be telling a player their decision is spoiled when it is
       * simply next in the queue.
       */
      const summary = score([decision({ revealed: false }), decision({ revealed: false })]);
      expect(summary.awaitingReveal).toBe(2);
      expect(summary.withoutInstrument).toBe(0);
      expect(readableInstrument(decision({ revealed: false }))).toBe(true);
    });

    it("counts a decision nobody was asked about as unasked, not as unreadable", () => {
      /*
       * ORDER OF THE GUARDS, ASSERTED. A decision with no confidence can never be scored whatever
       * engine judged it, so counting it as `withoutInstrument` would move rows out of a number
       * already on screen for a reason that has nothing to do with the engine.
       */
      const summary = score([decision({ confidence: null, build: undefined })]);
      expect(summary.withoutConfidence).toBe(1);
      expect(summary.withoutInstrument).toBe(0);
    });
  });

  describe("the rest of the record stays readable", () => {
    it("still reports a build-less decision as something the player DID", () => {
      /*
       * THE SECOND CLAUSE OF THE GATE, and the one that keeps this change from being a deletion.
       * The engine's verdict is unreadable; the decision is not. The player made the move, stated
       * the confidence and took the time, and every one of those is theirs to see. `unreadable` and
       * `never happened` must not render alike.
       */
      const atoms = [decision({ build: undefined }), decision({ build: undefined })];
      const history = forDescriptiveHistory(
        atoms,
        atoms.map((_, i) => `d${i}`),
      );
      expect(history.atoms).toHaveLength(2);
      expect(history.ids).toEqual(["d0", "d1"]);
    });

    it("leaves such a decision inside its stratum rather than vanishing it from the population", () => {
      /*
       * Refused by the SCORER, not by the policy's purpose table, and the difference is visible
       * here: the row is still in the population the detector was handed, and is still counted in
       * `total`. Something that explains a denominator can therefore say what happened to it.
       */
      const strata = strataOf([decision({ build: undefined }), decision({ build: undefined })]);
      expect(strata).toHaveLength(1);
      expect(strata[0].atoms).toHaveLength(2);
    });
  });

  describe("two builds are two populations", () => {
    it("keeps two decisions that differ ONLY in engine build out of the same stratum", () => {
      const strata = strataOf([decision(), decision({ build: "stockfish-18-lite-single-zzzz" })]);
      expect(strata).toHaveLength(2);
      for (const s of strata) expect(s.atoms).toHaveLength(1);
    });

    it("still pools two decisions scored by the SAME build", () => {
      // The control. A key that separated every row would satisfy the test above and say nothing.
      const strata = strataOf([decision(), decision(), decision()]);
      expect(strata).toHaveLength(1);
      expect(strata[0].atoms).toHaveLength(3);
    });

    it("searches the larger build and names the one it set aside", () => {
      const strata = strataOf([
        decision(),
        decision(),
        decision(),
        decision({ build: "stockfish-18-lite-single-zzzz" }),
      ]);
      const { chosen, setAside } = discoverySearchPopulation(strata);
      expect(chosen?.key.engineBuild).toBe(BUILD);
      expect(setAside).toHaveLength(1);
      expect(setAside[0].n).toBe(1);
    });

    it("does not let a pile of UNREADABLE rows win the search", () => {
      /*
       * The ordering defect this would otherwise have introduced, and the reason `forDiscovery`
       * sorts by scoreable rows rather than by row count. Five build-less decisions under one
       * reveal timing against two good ones under another: counting rows hands the detector the
       * five, which score to nothing, and the record's only usable population is never looked at.
       */
      const strata = strataOf([
        ...Array.from({ length: 5 }, () =>
          decision({ build: undefined, revealed: true }),
        ).map((a) => ({ ...a, reveal_timing: "per-decision" }) as DecisionAtom),
        ...Array.from({ length: 2 }, () => decision()).map(
          (a) => ({ ...a, reveal_timing: "end-of-game" }) as DecisionAtom,
        ),
      ]);
      const { chosen } = discoverySearchPopulation(strata);
      expect(chosen?.key.revealTiming).toBe("end-of-game");
      expect(score(chosen?.atoms ?? []).scored).toHaveLength(2);
    });

    it("gives the build its own component of the stratum id, encoded so it cannot forge one", () => {
      /*
       * The build is free text out of a record; protocol and reveal timing are closed enums. A
       * build containing the separator could otherwise produce the id of a different regime, which
       * is silent pooling arriving through the identifier of the module that prevents it.
       */
      const forged = stratumId({ protocol: "legacy", revealTiming: "legacy", engineBuild: "a/b" });
      const real = stratumId({ protocol: "legacy", revealTiming: "legacy", engineBuild: "a" });
      expect(forged).not.toBe(`${real}/b`);
      expect(forged).toContain("a%2Fb");
    });
  });
});
