/**
 * Whether the reveal a player just read is something an engine could not have told them.
 *
 * THE DEFECT, AND IT IS NOT A COPY DEFECT. `theOneThing` has four branches and renders all four
 * into the same block, in the same typeface, at the same weight. Two of them read something the
 * player recorded before any evaluation existed and which a PGN plus an engine cannot reconstruct
 * afterwards -- the moves they actually placed on the board, and the confidence they stated.
 * `outplayed` reads neither: it is "this move cost 140 centipawns against that one", which is what
 * every game report has given players for a decade.
 *
 * Rendered identically, a reader cannot tell which one they received. So the product's entire
 * claimed difference is invisible at the exact moment it is being delivered -- and worse for the
 * trial, a participant who says "it just told me my move was worse" may be describing a correct
 * reconstruction of `outplayed` or a failure to understand `chose-past-it`, and the transcript
 * cannot distinguish those two. Arm B would be uninterpretable.
 *
 * WHAT IS ASSERTED HERE, AND WHY IT IS AN ABLATION RATHER THAN A TABLE READ-BACK. A test that
 * checked `ONE_THING_EVIDENCE["outplayed"] === "engine"` would assert that a constant equals
 * itself, and would keep passing forever after someone changed a firing condition. So the
 * classification is proved from the branches instead: strip the two pre-engine inputs from a
 * decision -- empty the candidate list, null the confidence -- and every `process` branch must
 * stop firing while every `engine` branch fires exactly as it did. That is what "rests on" means,
 * and it is a property of the code rather than of this file.
 */
import { describe, expect, it } from "vitest";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";
import {
  ENGINE_NOISE_CP,
  EVIDENCE_LABEL,
  MATERIAL_LOSS_CP,
  ONE_THING_EVIDENCE,
  theOneThing,
  type OneThingKind,
  type RevealInputs,
} from "../../shared/reveal";

const BASE: RevealInputs = {
  depth: 18,
  cpLoss: MATERIAL_LOSS_CP + 40,
  chosenMove: "e2e4",
  bestMove: "d2d4",
  chosenWasBest: false,
  confidence: null,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "",
  decisionsOnRecord: 40,
  candidatesConsidered: [],
};

/** One decision that produces each branch, and nothing else about them is assumed. */
const REACHES: Record<OneThingKind, RevealInputs> = {
  // The engine's move was among the ones placed on the board, and another was played.
  "chose-past-it": { ...BASE, candidatesConsidered: ["e2e4", "d2d4"] },
  // Said 7 of 7 -- above CONFIDENT_ENOUGH_TO_NAME -- and the move cost material.
  "confident-and-wrong": { ...BASE, confidence: CONFIDENCE_LEVELS },
  // Cost material, with nothing pre-engine to add.
  outplayed: BASE,
  // Chose inside the noise having said 1 of 7, below UNSURE_ENOUGH_TO_NAME.
  "trusted-it-too-little": { ...BASE, cpLoss: ENGINE_NOISE_CP - 5, confidence: 1 },
};

/**
 * The same decision with everything the engine cannot see removed.
 *
 * This is exactly what a PGN plus an engine leaves you holding: the moves played, the evaluation,
 * the depth. No candidate list, because nobody recorded which moves were placed on the board. No
 * confidence, because nobody was asked before the answer arrived.
 */
function withoutPreEngineEvidence(inputs: RevealInputs): RevealInputs {
  return { ...inputs, candidatesConsidered: [], confidence: null };
}

describe("every branch reaches the kind it is supposed to", () => {
  it.each(Object.keys(REACHES) as OneThingKind[])("%s fires", (kind) => {
    // Without this the ablation below would be vacuous: a branch that never fires cannot stop.
    expect(theOneThing(REACHES[kind])?.kind).toBe(kind);
  });

  it("classifies every kind, so a new branch cannot ship unlabelled", () => {
    for (const kind of Object.keys(REACHES) as OneThingKind[]) {
      expect(ONE_THING_EVIDENCE[kind], `${kind} has no evidence class`).toBeTruthy();
    }
    expect(Object.keys(ONE_THING_EVIDENCE).sort()).toEqual(Object.keys(REACHES).sort());
  });
});

describe("the classification is derived from the branches, not asserted next to them", () => {
  const kinds = Object.keys(REACHES) as OneThingKind[];
  const process = kinds.filter((kind) => ONE_THING_EVIDENCE[kind] === "process");
  const engine = kinds.filter((kind) => ONE_THING_EVIDENCE[kind] === "engine");

  it("has both classes, so neither assertion below is vacuously satisfied", () => {
    expect(process.length).toBeGreaterThan(0);
    expect(engine.length).toBeGreaterThan(0);
  });

  it.each(process)("%s cannot fire once the pre-engine record is gone", (kind) => {
    /*
     * THE WHOLE CLAIM, IN ONE LINE. If this branch still fired without the candidate list and
     * without the stated confidence, then a PGN and an engine could have produced it, and calling
     * it process evidence would be a false statement to the player at the moment they are being
     * asked to believe the product is different from what they already have.
     */
    expect(theOneThing(withoutPreEngineEvidence(REACHES[kind]))?.kind).not.toBe(kind);
  });

  it.each(engine)("%s fires identically with or without it", (kind) => {
    /*
     * The other direction, and it is not decoration. A branch labelled `engine` that CHANGED when
     * the pre-engine record was removed would be reading it after all, and the label would be
     * understating the product rather than overstating it -- still a false statement, and still
     * one that makes Arm B uninterpretable.
     */
    const before = theOneThing(REACHES[kind]);
    const after = theOneThing(withoutPreEngineEvidence(REACHES[kind]));
    expect(after?.kind).toBe(kind);
    expect(after?.text).toBe(before?.text);
  });

  it("does not call the chosen move pre-engine evidence, because a PGN holds it", () => {
    /*
     * The line this classification could most easily be drawn in the wrong place. The chosen move
     * IS a player action recorded before the engine spoke -- and it is also the first thing in any
     * PGN. What makes evidence unreconstructable is not that the player produced it but that
     * nothing else stores it, and only two fields on `RevealInputs` clear that bar.
     */
    const different = theOneThing({ ...BASE, chosenMove: "g1f3" });
    expect(different?.kind).toBe("outplayed");
    expect(ONE_THING_EVIDENCE.outplayed).toBe("engine");
  });
});

describe("what the label is allowed to say", () => {
  it("names the ordinary case without apologising for it", () => {
    /*
     * `outplayed` is not a miss, a failure, or a lesser result. It is the honest report that on
     * this decision the record held nothing the engine did not already have -- and saying so
     * plainly is what makes the other label believable. Apology language would teach the player to
     * want a branch the instrument cannot promise, and every reveal they did not get it would then
     * read as the product failing them.
     */
    expect(EVIDENCE_LABEL.engine).not.toMatch(/מצטער|לצערנו|לא הצלחנו|הפעם רק|אין מה לעשות/);
    expect(EVIDENCE_LABEL.engine).toMatch(/מנוע/);
  });

  it("states the difference as an information difference, not as a boast", () => {
    expect(EVIDENCE_LABEL.process).toMatch(/לפני שהמנוע דיבר/);
    expect(EVIDENCE_LABEL.process).not.toMatch(/ייחודי|בלעדי|היחיד|אף כלי אחר|מהפכ/);
  });

  it("claims nothing about what the player saw, considered or knew", () => {
    /*
     * The same rule the reveal sentences live under. What the record holds is a confidence and a
     * list of moves placed on a board; absence from that list means the move was not placed, never
     * that it was not seen, and a label printed under every finding may not blur the two.
     */
    for (const label of Object.values(EVIDENCE_LABEL)) {
      expect(label).not.toMatch(/ראית|ראיתם|חשבת|חשבתם|שקלת|שקלתם|ידעת/);
    }
  });

  it("gives the two classes different sentences, which is the entire point", () => {
    expect(EVIDENCE_LABEL.process).not.toBe(EVIDENCE_LABEL.engine);
  });
});
