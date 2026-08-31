/**
 * §30: a document and the code it describes, held together by something that can fail.
 *
 * THE PLAN NAMES `VERIFIED_LEARNING.md` AS ALREADY DRIFTED, and it was — four claims in one
 * paragraph, every one of them naming a rule the code had left:
 *
 *   "centipawn loss is at most 30"          `ACCURATE_CP_LOSS`, which `detector.ts` records as
 *                                           abandoned. At +10.00 the two rules disagree by 182cp.
 *   "application is reported"               `applied_rule` is stored and read by nothing that grades.
 *   "recall is non-empty"                   the shipped rule is a word-overlap floor, which is
 *                                           stricter, and can mark a correct paraphrase wrong.
 *   "fewer than two successes refutes"      the asymmetry `learning-record.ts` was rewritten to
 *                                           remove: one bad sitting used to grade a rule refuted
 *                                           PERMANENTLY while replication needed two separate days.
 *
 * THE LAST ONE IS WHY THIS FILE EXISTS RATHER THAN A CAREFUL EDIT. A document that describes a
 * TERMINAL grade by the wrong rule is worse than no document: the grade it describes is one nothing
 * can revive, and a reader checking whether the product was fair to them would have been reading
 * the rule that was unfair.
 *
 * TWO MECHANISMS, BECAUSE THE DRIFT HAS TWO SHAPES.
 *
 *   1. A NUMBER WRITTEN AS PROSE. `MIN_BUCKET_N = 30` appears in `MEASUREMENTS.md` eleven times
 *      across two documents. Nothing held any of them. `CITED_CONSTANTS` below is the registry of
 *      names a document may put a value beside, and every citation of a registered name has to
 *      match what this build ships.
 *   2. A RULE WRITTEN AS A SENTENCE. No scan catches "application is reported" being false. Those
 *      are asserted one at a time, in the second block, each against the code path that decides it.
 *
 * THE REGISTRY IS DELIBERATELY NOT "EVERY EXPORTED CONSTANT". Documents legitimately cite numbers
 * this build does not ship — `MIN_GAP_DIFFERENCE = 0.45` is a threshold the detector ABANDONED and
 * `MEASUREMENTS.md` discusses it in the past tense, `AUROC2 = 0.71` is a measured value in the same
 * shape. A gate that failed on those would be demanding the history be rewritten. So the registry
 * is a list, and the gate also requires every entry in it to be cited somewhere: an entry nothing
 * cites is protecting nothing, and would sit there looking like coverage.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCURATE_CP_LOSS, MIN_BUCKET_N, SEPARABILITY_K, accurateDecision } from "@shared/detector";
import { ATTRIBUTION_K } from "@shared/discovery/attribution";
import { MATE_SCORE } from "@shared/reveal";
import { MAX_DRILL_POSITIONS, MIN_DRILL_POSITIONS } from "@shared/drill-positions";
import {
  RETRIEVAL_INTERVAL_DAYS,
  TRANSFER_MINIMUM_SUCCESSES,
  TRANSFER_POSITION_COUNT,
} from "@shared/learning-record";
import { BLITZ_ASK_RATE } from "@shared/blitz-instrument";
import { CONFIDENCE_GRID_VERSION, CONFIDENCE_LEVELS } from "@shared/confidence";

const DOCS = resolve(__dirname, "../../docs");

/**
 * THE CONSTANTS A DOCUMENT MAY PUT A NUMBER BESIDE.
 *
 * Every one of these is imported, so a rename breaks the build here rather than leaving a string
 * that matches nothing and a gate that silently checks less than it did.
 */
const CITED_CONSTANTS: Readonly<Record<string, number>> = {
  MIN_BUCKET_N,
  SEPARABILITY_K,
  ATTRIBUTION_K,
  ACCURATE_CP_LOSS,
  MATE_SCORE,
  MIN_DRILL_POSITIONS,
  MAX_DRILL_POSITIONS,
  TRANSFER_MINIMUM_SUCCESSES,
  TRANSFER_POSITION_COUNT,
  BLITZ_ASK_RATE,
  CONFIDENCE_LEVELS,
  CONFIDENCE_GRID_VERSION,
};

/** Every `NAME = value` a document writes inside backticks, with where it was written. */
function citations(): { file: string; name: string; value: string }[] {
  const found: { file: string; name: string; value: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) {
        const text = readFileSync(full, "utf8");
        for (const match of text.matchAll(/`([A-Z][A-Z0-9_]{3,})\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)`/g)) {
          found.push({ file: entry.name, name: match[1], value: match[2] });
        }
      }
    }
  };
  walk(DOCS);
  return found;
}

describe("what the documents still say", () => {
  describe("a number written as prose", () => {
    const all = citations();

    it("finds citations at all, so a broken pattern cannot pass as compliance", () => {
      /*
       * THE FLOOR. A regex that stopped matching would make every assertion below vacuous, and the
       * output -- an empty list of mismatches -- is exactly what perfect compliance looks like.
       */
      expect(all.length).toBeGreaterThan(10);
    });

    it("matches every cited constant to what this build ships", () => {
      const wrong = all
        .filter((c) => c.name in CITED_CONSTANTS)
        .filter((c) => Number(c.value) !== CITED_CONSTANTS[c.name])
        .map((c) => `${c.file}: ${c.name} = ${c.value}, but the build ships ${CITED_CONSTANTS[c.name]}`);
      expect(wrong).toEqual([]);
    });

    it("keeps every registered constant actually cited somewhere", () => {
      /*
       * An entry nothing cites protects nothing and looks like coverage. Either a document names it
       * -- in which case this gate is doing work -- or the entry comes out.
       */
      const cited = new Set(all.map((c) => c.name));
      const uncited = Object.keys(CITED_CONSTANTS).filter((name) => !cited.has(name));
      expect(uncited).toEqual([]);
    });
  });

  describe("a rule written as a sentence", () => {
    const learning = readFileSync(join(DOCS, "VERIFIED_LEARNING.md"), "utf8");

    /**
     * THE SPEC, WITHOUT THE HISTORY.
     *
     * `VERIFIED_LEARNING.md` now carries a blockquote spelling out what the old paragraph claimed
     * and why each claim was wrong -- which is the right thing for a reader and the wrong thing for
     * a naive absence check, because the abandoned rule is quoted there verbatim. Blockquote lines
     * are dropped: `>` is the document's own mark for "this is what we used to say", and a rule
     * stated in the body is a rule the product is making.
     *
     * FOUND BY THIS TEST FAILING ON ITS FIRST RUN, which is the ordinary way a distinction like
     * this gets discovered rather than designed.
     */
    const spec = (from: string, to: string) =>
      from
        .slice(0, from.indexOf(to))
        .split("\n")
        .filter((line) => !line.trimStart().startsWith(">"))
        .join("\n");

    it("no longer says a position succeeds at thirty centipawns", () => {
      /*
       * ASSERTED AS AN ABSENCE PLUS A PRESENCE, because the sentence could be reworded into the
       * same claim. What must be gone is the RULE -- a raw centipawn cut -- and what must be there
       * is the name of the function that actually decides it.
       */
      const lifecycle = spec(learning, "## Measurement contract");
      expect(lifecycle).toContain("accurateDecision");
      expect(lifecycle).not.toMatch(/centipawn loss\s+is at most 30/);
    });

    it("names application as recorded rather than as a success condition", () => {
      /*
       * The claim, checked against the code path rather than against another sentence: a transfer
       * observation whose `applied_rule` is false still succeeds when the recall and the accuracy
       * hold, because `finishLearningTransfer` never reads the field.
       */
      const service = readFileSync(resolve(__dirname, "../../shared/record-service.ts"), "utf8");
      const success = service.slice(service.indexOf("const successes = atoms.filter"));
      const body = success.slice(0, success.indexOf("}).length"));
      expect(body, "the success condition now reads applied_rule").not.toContain("applied_rule");
      expect(body).toContain("clearedFloor");
      expect(body).toContain("accurateDecision");
    });

    it("describes refutation as symmetric with replication", () => {
      const lifecycle = spec(learning, "## Measurement contract");
      expect(lifecycle).toMatch(/two distinct dates/);
      expect(lifecycle).not.toMatch(/Fewer than two successes refutes/);
    });

    it("keeps the oracle's copy of the detector's floor equal to the detector's", () => {
      /*
       * `research/discovery-oracle/q6_blitz_time.py` duplicates `MIN_BUCKET_N` rather than importing
       * it, and says why: a study that imported it would report "usable" against whatever the
       * constant happens to be, and that table's whole job is to say what the SHIPPED floor does to
       * a blitz record. A duplicate with a reason is fine; a duplicate nothing checks is how the
       * number in `docs/decisions/D05-blitz-time.md` stops describing the product.
       */
      const q6 = readFileSync(
        resolve(__dirname, "../../research/discovery-oracle/q6_blitz_time.py"),
        "utf8",
      );
      const match = q6.match(/^MIN_BUCKET_N = (\d+)$/m);
      expect(match, "q6 no longer declares MIN_BUCKET_N -- check what it uses instead").not.toBeNull();
      expect(Number(match![1])).toBe(MIN_BUCKET_N);
    });

    it("names the accuracy rule the record actually uses, at an evaluation where they differ", () => {
      /*
       * NOT A DOCUMENT ASSERTION AT ALL, and it is here on purpose: the reason the old sentence
       * mattered is that the two rules disagree, and the disagreement is what a reader was being
       * misinformed about. At +10.00 a 200-centipawn loss is accurate by the shipped rule and was a
       * failure by the documented one -- and the grade it fed is terminal.
       */
      expect(accurateDecision(1000, 200)).toBe(true);
      expect(200 <= ACCURATE_CP_LOSS).toBe(false);
    });

    it("keeps the retrieval schedule the code ships", () => {
      const lifecycle = spec(learning, "## Measurement contract");
      expect(lifecycle).toContain(RETRIEVAL_INTERVAL_DAYS.join(", ").replace(/, (\d+)$/, ", and $1"));
    });
  });
});
