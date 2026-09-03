// @vitest-environment jsdom
/**
 * The screen at the moment the product's difference is either delivered or not.
 *
 * WHAT A PLAYER COULD NOT TELL. `theOneThing` has four branches. Two read something recorded
 * before the engine spoke -- the moves placed on the board, the confidence stated -- and no PGN
 * plus engine can reconstruct either. `outplayed` reads neither; it is the comparison every game
 * report has always made. All four rendered into the same block, same typeface, same weight, with
 * nothing on screen saying which had happened.
 *
 * That is the failure exactly where it costs most. The reveal is where "this is not another
 * accuracy report" is either true and legible or true and invisible, and invisible is
 * indistinguishable from false to the person reading it.
 *
 * IT ALSO BROKE THE TRIAL, WHICH IS THE HARDER HALF. Arm B asks players what they got. A response
 * coded `generic_engine_value` is a CORRECT reconstruction from someone who received `outplayed`
 * and a comprehension failure from someone who received `chose-past-it` -- and with the two
 * rendered identically, no transcript could separate them. `ONE_THING_EVIDENCE` is what makes the
 * coding scheme interpretable at all.
 *
 * `tests/shared/what-a-reveal-rests-on.test.ts` proves the classification by ablation. This file
 * only asserts that the reader is told.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealPanel } from "@/components/RevealPanel";
import {
  ENGINE_NOISE_CP,
  EVIDENCE_LABEL,
  MATERIAL_LOSS_CP,
  ONE_THING_EVIDENCE,
  theOneThing,
  type OneThingKind,
  type RevealInputs,
} from "@shared/reveal";
import { CONFIDENCE_LEVELS } from "@shared/confidence";
import type { EngineLine } from "@/lib/stockfish";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
const BASE: RevealInputs = {
  depth: 20,
  cpLoss: MATERIAL_LOSS_CP + 40,
  chosenMove: "g8f6",
  bestMove: "f8c5",
  chosenWasBest: false,
  confidence: null,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "",
  decisionsOnRecord: 120,
  candidatesConsidered: [],
};

/** One decision per branch, plus the two silent bands, so all five outcomes are rendered here. */
const REACHES: Record<OneThingKind, RevealInputs> = {
  "chose-past-it": { ...BASE, candidatesConsidered: ["g8f6", "f8c5"] },
  "confident-and-wrong": { ...BASE, confidence: CONFIDENCE_LEVELS },
  outplayed: BASE,
  "trusted-it-too-little": { ...BASE, cpLoss: ENGINE_NOISE_CP - 5, confidence: 1 },
};
const SILENT: RevealInputs = { ...BASE, cpLoss: ENGINE_NOISE_CP - 5, confidence: 4 };

const ANALYSIS: EngineLine = { scoreCp: 180, depth: 20, pv: ["f8c5"], bestMove: "f8c5", fen: FEN };
const panel = (inputs: RevealInputs) =>
  render(<RevealPanel inputs={inputs} analysis={ANALYSIS} fen={FEN} boardFen={FEN} statedKnown="מרכז פתוח" />)
    .container;

describe("every finding says which kind of evidence it rests on", () => {
  it.each(Object.keys(REACHES) as OneThingKind[])("%s carries its label", (kind) => {
    // The fixture reaches the branch it claims to; otherwise the assertion below is about nothing.
    expect(theOneThing(REACHES[kind])?.kind).toBe(kind);
    const label = panel(REACHES[kind]).querySelector(".one-thing-evidence");
    expect(label, "a finding rendered with no statement of what it rests on").not.toBeNull();
    expect(label?.textContent).toBe(EVIDENCE_LABEL[ONE_THING_EVIDENCE[kind]]);
  });

  it("tells the two apart on screen, which is the only thing this changes", () => {
    /*
     * The assertion that would have failed before this existed, and the one that fails again if
     * somebody unifies the two sentences to make the block read more evenly.
     */
    const unique = panel(REACHES["chose-past-it"]).querySelector(".one-thing-evidence")?.textContent;
    const generic = panel(REACHES.outplayed).querySelector(".one-thing-evidence")?.textContent;
    expect(unique).not.toBe(generic);
  });

  it("keeps the label under the finding rather than in front of it", () => {
    /*
     * ORDER, BECAUSE THE LABEL IS ABOUT THE SENTENCE AND NOT THE OTHER WAY ROUND. A player reads
     * what happened, then what it may mean, then what it rests on. Putting the classification
     * first would make the reader's first contact with their own decision a piece of product
     * vocabulary.
     */
    const container = panel(REACHES["chose-past-it"]);
    const order = [...container.querySelectorAll(".reveal-one-thing p")].map(
      (el) => [...el.classList][0],
    );
    expect(order.indexOf("one-thing-evidence")).toBeGreaterThan(order.indexOf("one-thing-text"));
    expect(order.indexOf("one-thing-evidence")).toBeGreaterThan(order.indexOf("one-thing-note"));
  });

  it("does not weight one class louder than the other", () => {
    /*
     * One rule, one size, no variant selector. If `process` were styled larger or brighter, the
     * classification would stop being information and start being a reward -- and a player would
     * learn to want a branch that fires only when their own record happens to contain the evidence
     * for it, which is a thing no build can promise them.
     */
    const styles = readFileSync(resolve(__dirname, "../../client/src/index.css"), "utf8").replace(
      /\/\*[\s\S]*?\*\//g,
      "",
    );
    expect(styles).toContain(".one-thing-evidence {");
    expect(
      styles,
      "the two evidence classes are styled differently, which makes one of them a prize",
    ).not.toMatch(/\.one-thing-evidence\[data-evidence/);
  });
});

describe("silence is still a valid outcome and is not labelled as a lesser one", () => {
  it("renders no evidence label, because there is no finding for one to be about", () => {
    expect(theOneThing(SILENT)).toBeNull();
    const container = panel(SILENT);
    expect(container.querySelector(".one-thing-none")).not.toBeNull();
    expect(
      container.querySelector(".one-thing-evidence"),
      "a screen with nothing to say was told what its nothing rests on",
    ).toBeNull();
  });

  it("keeps saying that an honest nothing is a correct screen", () => {
    expect(panel(SILENT).textContent).toContain("זו תוצאה תקינה, לא מסך ריק");
  });
});

