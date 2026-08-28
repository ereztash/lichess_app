// @vitest-environment jsdom
/**
 * The player sees chess. The code keeps the laboratory. Neither side loses information.
 *
 * WHAT THIS FILE IS FOR, and what it is emphatically not for. A copy rewrite is the easiest way in
 * this product to commit its worst defect: a sentence that reads better because it claims more. A
 * description becomes a pattern, a pattern becomes a trait, board interaction becomes seeing, and
 * nothing fails -- the numbers are unchanged, the modules are unchanged, and the only thing that
 * moved is what the reader is entitled to believe.
 *
 * So these tests do not check that the copy is nice. They check the ceiling: for each surface
 * rewritten into player language, that the new sentence still says no more than the module behind
 * it measured.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealPanel } from "@/components/RevealPanel";
import { ClaimCard } from "@/components/ClaimCard";
import { WhatThisIs } from "@/components/WhatThisIs";
import { theOneThing, type RevealInputs } from "@shared/reveal";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "@shared/confidence";
import { STEP_LABELS } from "@/lib/loop-position";
import { N1_HYPOTHESIS } from "../fixtures/claim-render-assertions";
import { evaluateClaim, type ProspectiveDrillResult } from "@shared/claim";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";

const BASE: RevealInputs = {
  cpLoss: 180,
  depth: 18,
  confidence: EVEN_ODDS_LEVEL,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "",
  chosenMove: "f8c5",
  chosenWasBest: false,
  candidatesConsidered: ["f8c5", "g8f6"],
  decisionsOnRecord: 12,
  clampedMate: false,
  bestMove: "g8f6",
};

/** The engine's move was never put on the board. Same numbers, different record. */
const NEVER_PLACED: RevealInputs = { ...BASE, candidatesConsidered: ["f8c5", "d7d6"] };

const panel = (inputs: RevealInputs) =>
  render(<RevealPanel inputs={inputs} analysis={null} fen={FEN} statedKnown="" />).container;

/**
 * Words that assert something about the player's MIND.
 *
 * The record holds moves placed on a board, a stated confidence, and an engine verdict. It does
 * not hold what anyone saw, noticed, considered or understood, and no rewrite may quietly promote
 * board interaction into any of them.
 */
const MIND_WORDS = /ראית|לא ראית|שמת לב|חשבת על|הבנת|ידעת ש|שקלת/;

describe("the reveal says what the board recorded and not what the player saw", () => {
  it("reports the engine's move as placed, never as seen", () => {
    /*
     * THE CORRECTION THIS FILE EXISTS FOR. The sentence used to read `ראית את המהלך` while the
     * comment three lines above it said the phrasing must be "you recorded it" rather than "you
     * saw it". What the record holds is that the move was put on the board before the commit --
     * strictly less than seeing it, and much less than judging it. A player who drags a piece to
     * a square and drags it back has recorded the move without having looked at it properly.
     */
    const one = theOneThing(BASE)!;
    expect(one.kind).toBe("chose-past-it");
    expect(one.text).toContain("הנחת על הלוח");
    expect(one.text, "board interaction was rendered as seeing").not.toMatch(MIND_WORDS);
    expect(one.note ?? "", "the reading claimed something about the mind").not.toMatch(MIND_WORDS);
  });

  it("never says the player failed to see a move that was simply not recorded", () => {
    /*
     * THE INVERSE OVER-CLAIM, and the more dangerous one. Absence from the candidate list means
     * the move was not put on the board. It does NOT mean it was not seen -- the record has no
     * way to know, and `inferenceLimits` says so in as many words on this exact branch.
     */
    const one = theOneThing(NEVER_PLACED)!;
    expect(`${one.text} ${one.note ?? ""}`).not.toMatch(MIND_WORDS);
    expect(panel(NEVER_PLACED).textContent).not.toMatch(/לא ראית|פספסת/);
  });

  it("keeps the event and the reading in separate elements", () => {
    // One distinction per sentence: what happened is a record, what it points at is a reading.
    const container = panel(BASE);
    const text = container.querySelector(".one-thing-text");
    const note = container.querySelector(".one-thing-note");
    expect(text).not.toBeNull();
    expect(note, "the reading was folded back into the event sentence").not.toBeNull();
    expect(text!.textContent).not.toBe(note!.textContent);
  });

  it("still renders the basis under every sentence it makes", () => {
    // R1 survives the rewrite: no sentence without the measurement that produced it.
    const basis = panel(BASE).querySelector(".one-thing-basis");
    expect(basis, "a sentence rendered with no basis").not.toBeNull();
    expect(basis!.textContent).toContain("18");
  });

  it("says nothing about confidence on a decision that was never asked for one", () => {
    /*
     * `confidence: null` means the question was never put. Both confidence branches are ABOUT a
     * stated confidence, so neither may fire -- "you trusted yourself too little" on a question
     * nobody asked would be the product inventing the player's answer and then reading it.
     */
    const unasked = theOneThing({ ...NEVER_PLACED, confidence: null });
    expect(unasked?.kind).toBe("outplayed");
    expect(`${unasked?.text} ${unasked?.note ?? ""}`).not.toMatch(/בטוח|סמכת|ביטחון/);
  });

  it("keeps silence a result rather than an apology or a to-do", () => {
    const quiet = { ...BASE, cpLoss: 4, chosenWasBest: true, bestMove: "f8c5" };
    expect(theOneThing(quiet)).toBeNull();
    const text = panel(quiet).textContent ?? "";
    expect(text).toContain("זו תוצאה תקינה");
    expect(text, "silence was turned into advice").not.toMatch(/כדאי לך|תתאמן|נסה שוב|מומלץ/);
  });
});

describe("the claim surface stays exactly as strong as its grade", () => {
  const graded = (survived: boolean) => {
    const result: ProspectiveDrillResult = {
      kind: "prospective_drill_result",
      drill_id: "d1",
      claim_id: N1_HYPOTHESIS.claim_id,
      decision_ids: ["x1", "x2"],
      predicted: true,
      observed: survived,
      recorded_at: "2026-02-01T00:00:00Z",
    };
    return evaluateClaim(N1_HYPOTHESIS, [result]);
  };

  it("keeps a hypothesis visibly different from something that was tested", () => {
    const hypothesis = render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={0} />).container;
    expect(hypothesis.textContent).toContain("השערה");
    expect(hypothesis.textContent, "a hypothesis borrowed the tested wording").not.toContain(
      "שוחזר",
    );
    // And it says what would move it: new decisions, not more of the same ones.
    expect(hypothesis.textContent).toMatch(/החלטות חדשות/);
  });

  it("keeps n and the scope on screen after the rewrite", () => {
    const { container } = render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={0} />);
    expect(container.textContent, "n vanished").toContain(`n=${N1_HYPOTHESIS.n}`);
    expect(container.textContent, "the scope vanished").toContain(N1_HYPOTHESIS.scope);
  });

  it("does not soften a refutation into evidence of absence", () => {
    /*
     * BLOCKED ON PURPOSE. Until the tri-state verdict exists -- supports / contradicts /
     * inconclusive -- a test that merely fails to support a claim marks it refuted. So "it did not
     * come back" or "the pattern is gone" would read as clean evidence of absence, which is
     * stronger than the mechanism can support. The wording stays as it was, and this holds it.
     */
    const { container } = render(<ClaimCard claim={graded(false)} othersWithheld={0} />);
    const text = container.textContent ?? "";
    expect(text).toContain("נבדק קדימה ונכשל");
    expect(text, "a refutation was rewritten as absence of the pattern").not.toMatch(
      /לא חזר|נעלם|כבר לא קיים|אין את זה/,
    );
  });

  it("describes a forward test as forward and never as more of the same record", () => {
    const { container } = render(<ClaimCard claim={graded(true)} othersWithheld={0} />);
    expect(container.textContent).toMatch(/החלטות חדשות/);
    expect(container.textContent, "prospective evidence was described as retrospective").not.toMatch(
      /מההחלטות שכבר|מהרשומה הקיימת/,
    );
  });
});

describe("the primary interface speaks chess, not method", () => {
  /**
   * Words that belong to the laboratory. They may live in code, in comments, and in an explicit
   * methodological disclosure -- not in the sentences a player reads to find out what happened.
   */
  const LAB_WORDS = ["תצפית", "אינסטרומנט", "אופרציונליזציה", "קונסטרקט", "דרגת טענה", "דריל", "תצפית"];

  it("keeps them off the reveal and the claim card", () => {
    const surfaces = [
      panel(BASE).textContent ?? "",
      render(<ClaimCard claim={N1_HYPOTHESIS} othersWithheld={2} />).container.textContent ?? "",
    ];
    for (const surface of surfaces) {
      for (const word of LAB_WORDS) {
        expect(surface, `"${word}" is on a primary surface`).not.toContain(word);
      }
    }
  });

  it("names the loop's steps in a player's words", () => {
    // The steps themselves are untouched: record -> detect -> drill -> grade still runs the loop.
    expect(Object.values(STEP_LABELS)).toEqual(["מהלכים", "מה חוזר", "בדיקה", "תשובה"]);
  });

  it("explains what is measured without teaching the word for it", () => {
    render(<WhatThisIs onClose={() => {}} />);
    expect(screen.getByText(/כמה שהיית בטוח/)).toBeTruthy();
    expect(
      screen.queryByText(/בשחמט קוראים לזה/),
      "the help text still teaches the internal term",
    ).toBeNull();
  });
});
