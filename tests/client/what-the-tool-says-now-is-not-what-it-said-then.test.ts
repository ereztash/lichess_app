/**
 * F4. "מה הכלי אמר לכם עד כה" was computed by asking the tool, today, about decisions taken before.
 *
 * TWO CLAIMS, TWO REFERENTS, ONE SENTENCE:
 *
 *   A. "this is what your stored decisions come to under the definition in force now"
 *   B. "this is what the tool showed you at the time"
 *
 * `oneThingMix` computes A -- it calls `theOneThing` on stored rows, deliberately, so the
 * measurement of the product cannot drift from the product. The record page rendered it under B.
 *
 * THEY ARE NOT THE SAME BECAUSE THE RULE HAS ALREADY MOVED ONCE, and `reveal.ts` records the move
 * in its own words: *"They used to be `confidence >= 4` and `confidence <= 2`, read off the RAW
 * stored level."* On the seven-button grid a stated 5 asserts 65%, which is under
 * `CONFIDENT_ENOUGH_TO_NAME`; under the raw rule 5 cleared 4. So one stored decision, unchanged,
 * classifies differently depending on WHEN it is read -- which is exactly the thing a claim of
 * type B may not be built from.
 *
 * NO HISTORICAL SIMULATOR IS BUILT HERE, and none is needed. The two cut points are the whole
 * difference between the versions, and reproducing them is four lines. What the test has to show
 * is not what the tool said in 2025; it is that `theOneThing` today is not a WITNESS to it.
 *
 * THE CONSUMER DECISION THIS FILE PINS. The record page takes Option 1 -- current reinterpretation
 * -- because Option 2 needs something that recorded what was actually put on the screen, and the
 * only thing in this repository that does is `reveal_kind_presented` in
 * `client/src/lib/acquisition-evidence.ts`: per-browser, trial-scoped, never re-derived, and behind
 * an import-graph wall from `shared/`. It is evidence about a VISIT, not about a record, and
 * promoting it would be building the event store this repair is explicitly not building.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MATERIAL_LOSS_CP,
  oneThingMix,
  theOneThing,
  type MixableDecision,
  type OneThingKind,
} from "@shared/reveal";
import { CONFIDENCE_LEVELS } from "@shared/confidence";

const COSTLY = MATERIAL_LOSS_CP + 60;

/** One stored decision, costly, with the engine's move never placed on the board. */
const stored = (confidence: number, confidenceScale: number): MixableDecision => ({
  confidence,
  confidenceScale,
  candidatesConsidered: [],
  chosenMove: "e2e4",
  cpLoss: COSTLY,
  bestMove: "d2d4",
  revealTiming: "per-decision",
});

/** Today's rule, through the real function rather than a restatement of it. */
const kindNow = (d: MixableDecision): OneThingKind | null =>
  theOneThing({
    depth: 0,
    cpLoss: d.cpLoss!,
    chosenMove: d.chosenMove,
    bestMove: d.bestMove!,
    chosenWasBest: d.chosenMove === d.bestMove,
    confidence: d.confidence,
    confidenceScale: d.confidenceScale,
    statedUnknown: "",
    decisionsOnRecord: 1,
    candidatesConsidered: d.candidatesConsidered,
  })?.kind ?? null;

/**
 * The rule as it stood, in the ONE respect it differed: the two confidence cuts read the raw
 * stored level. Same branch order, same material threshold, same everything else -- quoted from
 * `shared/reveal.ts`'s own account of what it replaced.
 */
const CONFIDENT_RAW_THEN = 4;
const kindThen = (d: MixableDecision): OneThingKind | null => {
  if (d.candidatesConsidered.includes(d.bestMove!)) return "chose-past-it";
  if (d.confidence !== null && d.confidence >= CONFIDENT_RAW_THEN) return "confident-and-wrong";
  return "outplayed";
};

describe("the current reading of an old decision is not a record of what was shown", () => {
  it("classifies one unchanged stored decision two ways under two reveal semantics", () => {
    /*
     * THE COUNTEREXAMPLE. A decision stated at 5 of 7, on a move that cost material.
     *
     * Then: 5 cleared the raw cut of 4, so the player was shown "אמרת שאתה בטוח... והמהלך עלה".
     * Now: 5 of 7 asserts 65%, under `CONFIDENT_ENOUGH_TO_NAME`, so the same row reads `outplayed`
     * -- the branch `reveal.ts` files as `engine` evidence, the one an ordinary game review could
     * also have produced.
     *
     * Nothing about the decision changed. The reader did.
     */
    const decision = stored(5, CONFIDENCE_LEVELS);
    expect(kindThen(decision)).toBe("confident-and-wrong");
    expect(kindNow(decision)).toBe("outplayed");
    expect(kindNow(decision)).not.toBe(kindThen(decision));
  });

  it("moves the count the record page renders, not just one row's label", () => {
    /*
     * The same decision, thirty times, is thirty rows in one column then and thirty in another now.
     * A page that called this "what the tool told you" would be reporting a distribution the player
     * never saw -- and the number that moved is `confident-and-wrong`, the branch the product leads
     * on, in the direction that makes it look rarer than it was.
     */
    const record = Array.from({ length: 30 }, () => stored(5, CONFIDENCE_LEVELS));
    const mix = oneThingMix(record);
    expect(mix.counts.outplayed).toBe(30);
    expect(mix.counts["confident-and-wrong"]).toBe(0);
    expect(record.filter((d) => kindThen(d) === "confident-and-wrong")).toHaveLength(30);
  });

  it("still reads the stored decisions correctly under the rule in force, which is the claim it may make", () => {
    /*
     * THE POSITIVE CONTROL. This is not a finding that the mix is broken -- it is a finding about
     * which of two sentences it may carry. Under today's rule the classification is right, and one
     * branch is not even affected: `chose-past-it` fires on `candidatesConsidered.includes(bestMove)`
     * and that condition has never moved, so it reads the same then and now.
     */
    const onTheBoard: MixableDecision = { ...stored(5, CONFIDENCE_LEVELS), candidatesConsidered: ["d2d4"] };
    expect(kindNow(onTheBoard)).toBe("chose-past-it");
    expect(kindThen(onTheBoard)).toBe("chose-past-it");
    const mix = oneThingMix([onTheBoard, stored(5, CONFIDENCE_LEVELS)]);
    expect(mix.n).toBe(2);
    expect(mix.counts["chose-past-it"]).toBe(1);
    expect(mix.counts.outplayed).toBe(1);
  });

  it("leaves the record page unable to claim it is a transcript", () => {
    /*
     * THE HALF THAT SURVIVES A LATER EDIT. The two assertions above are about the reveal rule; this
     * one is about the surface, and it is a claim about what the module may CONTAIN -- the only
     * kind of claim a value can never carry, which is why `calibration-score.test.ts` reads its
     * source the same way.
     *
     * The block that renders the mix may not use the vocabulary of past presentation. It reads
     * stored rows with today's rules, and the sentence over it has to say so.
     */
    const source = readFileSync(
      resolve(__dirname, "../../client/src/components/RecordDashboard.tsx"),
      "utf8",
    );
    const start = source.indexOf("function MixBlock(");
    expect(start, "MixBlock was renamed; this assertion needs to follow it").toBeGreaterThan(0);
    const body = source.slice(start).split("\n}\n")[0].replace(/\/\*[\s\S]*?\*\//g, "");
    for (const claim of [/אמר לכם/, /אמרו לכם/, /נחשפו/, /הוצג לכם/, /הראה לכם/, /הציג לכם/]) {
      expect(body, `the mix block claims past presentation: ${claim}`).not.toMatch(claim);
    }
    // And says which of the two readings it is, rather than leaving the reader to choose.
    expect(body).toMatch(/לפי ההגדרות של היום/);
  });
});
