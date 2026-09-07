// @vitest-environment jsdom
/**
 * The screen and the validator, held to each other.
 *
 * FOUR THINGS THIS BUILD SAID THAT THIS BUILD CONTRADICTED. None of them needed a person to find
 * and none of them could be found by the suite as it stood, because every existing test of the
 * commitment screen drives `purpose: "anchor"` -- the one purpose where all four steps really are
 * required and the intro really is accurate.
 *
 *   1. On a `first` decision the two read steps rendered with `חובה` and `draftProblems` required
 *      neither, so the submit read `רשמו את ההחלטה` with both still unanswered.
 *   2. The intro said "בחרו מהלך על הלוח וסמנו את הקריאה שלכם" in every state, including the ~6 in
 *      7 ordinary decisions whose only step is the move.
 *   3. The board told a first-time arrival they had come back to a game they had never seen.
 *   4. The help screen described a loop of four steps that runs on about one decision in seven.
 *
 * WHAT MAKES THIS MORE THAN FOUR REGRESSION TESTS. The first block below does not assert a step
 * list; it asserts that the step list and the refusal list are THE SAME SET, for every purpose in
 * the union. A screen cannot come to disagree with its validator again without this going red,
 * whichever of the two moves.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen, instructionFor } from "@/components/CommitmentScreen";
import { WhatThisIs } from "@/components/WhatThisIs";
import { restoreNotice } from "@/lib/adopt-position";
import { draftProblems, emptyDraft, type PositionUnderDecision } from "@/lib/decision-session";
import {
  ASK_RATE,
  DECISION_PURPOSES,
  confidenceIsAsked,
  drawForDecision,
  readsAreAsked,
  type DecisionPurpose,
} from "@shared/confidence-asked";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
/** Two plies chosen for what the draw does with them, asserted below rather than assumed. */
const DRAWN_PLY = 6;
const QUIET_PLY = 7;

const at = (purpose: DecisionPurpose, ply = QUIET_PLY): PositionUnderDecision => ({
  gameId: "g",
  fen: FEN,
  ply,
  clockMsRemaining: null,
  purpose,
});

const screenAt = (purpose: DecisionPurpose, ply = QUIET_PLY, chosenMove: string | null = null) =>
  render(
    <CommitmentScreen
      position={at(purpose, ply)}
      chosenMove={chosenMove}
      candidatesConsidered={[]}
      onCommit={vi.fn()}
      pending={false}
    />,
  ).container;

/** The steps on screen, other than the move, which is required everywhere and marks nothing. */
const askedFields = (container: HTMLElement): string[] =>
  [...container.querySelectorAll(".commitment-step")]
    .map((step) => step.querySelector(".step-legend")?.firstChild?.textContent?.trim() ?? "")
    .filter((legend) => legend !== "המהלך שבחרתם");

const LEGEND_OF: Record<string, string> = {
  known: "מה אתם קוראים בעמדה",
  unknown: "מה אתם לא יכולים להעריך",
  confidence: "כמה אתם בטוחים",
};

describe("the steps on screen are the steps the record will refuse without", () => {
  it("holds the two fixture plies to what they are named for", () => {
    expect(drawForDecision("g", FEN, DRAWN_PLY)).toBeLessThan(ASK_RATE);
    expect(drawForDecision("g", FEN, QUIET_PLY)).toBeGreaterThanOrEqual(ASK_RATE);
  });

  it.each(DECISION_PURPOSES.flatMap((p) => [[p, DRAWN_PLY] as const, [p, QUIET_PLY] as const]))(
    "renders exactly what draftProblems would refuse, for %s at ply %i",
    (purpose, ply) => {
      const position = at(purpose, ply);
      /*
       * The refusal list on a draft that has a move and nothing else. Everything it names is a
       * field this decision genuinely requires; everything it does not name, it does not.
       */
      const refused = draftProblems({ ...emptyDraft(), chosenMove: "g8f6" }, position)
        .map((problem) => LEGEND_OF[problem.field])
        .filter(Boolean);

      expect(
        askedFields(screenAt(purpose, ply)).sort(),
        `the screen and the validator disagree on ${purpose}`,
      ).toEqual(refused.sort());
    },
  );

  it("marks every rendered step required, because every rendered step is", () => {
    for (const purpose of DECISION_PURPOSES) {
      for (const ply of [DRAWN_PLY, QUIET_PLY]) {
        const container = screenAt(purpose, ply);
        const marked = [...container.querySelectorAll(".commitment-step")].filter((step) =>
          step.querySelector(".required-mark"),
        ).length;
        expect(marked, `${purpose} at ply ${ply} marks a step the validator does not require`).toBe(
          askedFields(container).length,
        );
      }
    }
  });

  it("does not ask a first decision for the two reads, which is the exemption confidence-asked.ts names", () => {
    const position = at("first");
    /* The exemption, stated as the two predicates rather than believed from the comment. */
    expect(confidenceIsAsked(position)).toBe(true);
    expect(readsAreAsked(position)).toBe(false);

    const container = screenAt("first", QUIET_PLY, "g8f6");
    expect(askedFields(container)).toEqual(["כמה אתם בטוחים"]);
    expect(container.querySelectorAll(".required-mark")).toHaveLength(1);
  });

  it("does not offer the reads as OPTIONAL there either, which would be the same bias with a truer label", () => {
    /*
     * `shared/confidence-asked.ts`: whoever skips a field skips it because of how they feel about
     * the position, so an optional instrument is a sample curated on the measured variable. Absent
     * is the fix; visibly-optional is the defect with better wording.
     */
    const container = screenAt("first", QUIET_PLY, "g8f6");
    expect(container.textContent).not.toContain("מה אתם קוראים בעמדה");
    expect(container.querySelector(".read-field")).toBeNull();
  });
});

describe("the intro names the steps this decision has, and the reason it always has", () => {
  it("names only the move where the draw passed the position over", () => {
    const intro = screenAt("play").querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro).toContain("בחרו מהלך על הלוח");
    expect(intro, "instructed a read that is not on the screen").not.toContain("סמנו את הקריאה");
    expect(intro, "instructed a confidence that is not on the screen").not.toContain(
      "אמרו כמה אתם בטוחים",
    );
  });

  it("names the move and the confidence on a first decision, and not the reads", () => {
    const intro = screenAt("first").querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro).toContain("אמרו כמה אתם בטוחים");
    expect(intro).not.toContain("סמנו את הקריאה");
  });

  it("names all three on a fully instrumented decision, the confidence included", () => {
    const intro = screenAt("anchor").querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro).toContain("בחרו מהלך על הלוח");
    expect(intro).toContain("סמנו את הקריאה שלכם");
    /* The old constant named two of four steps and left this one out of every state. */
    expect(intro).toContain("אמרו כמה אתם בטוחים");
  });

  it("keeps the reason in every state, which is what makes the ordering more than ceremony", () => {
    for (const purpose of DECISION_PURPOSES) {
      const intro = screenAt(purpose).querySelector(".commitment-intro")?.textContent ?? "";
      expect(intro, purpose).toContain("ההחלטה נרשמה");
      expect(intro, purpose).toMatch(/להפריד/);
      expect(intro, purpose).toMatch(/מה שרשמתם/);
    }
  });

  it("joins the phrases the way Hebrew joins a list", () => {
    expect(instructionFor(["chosenMove"])).toBe("בחרו מהלך על הלוח.");
    expect(instructionFor(["chosenMove", "confidence"])).toBe(
      "בחרו מהלך על הלוח ואמרו כמה אתם בטוחים.",
    );
    expect(instructionFor(["chosenMove", "known", "unknown", "confidence"])).toBe(
      "בחרו מהלך על הלוח, סמנו את הקריאה שלכם ואמרו כמה אתם בטוחים.",
    );
    /* The two read steps are one phrase: stating a read is one act with two halves. */
    expect(instructionFor(["chosenMove", "known"])).toBe(
      instructionFor(["chosenMove", "known", "unknown"]),
    );
  });
});

describe("the board does not claim a return that did not happen", () => {
  it("says a handed-over position is one, rather than a game the player left", () => {
    expect(restoreNotice("first-decision", 21)).toBe("עמדה ממשחק ששיחקתם — 21 חצאי־מהלכים.");
    expect(restoreNotice("anchor", 21)).toBe("עמדה מהסט המשותף — 21 חצאי־מהלכים.");
    for (const handover of ["first-decision", "anchor"] as const) {
      expect(restoreNotice(handover, 21), handover).not.toContain("חזרתם");
    }
  });

  it("keeps the return sentence for a position the player really was on", () => {
    expect(restoreNotice(null, 21)).toBe("חזרתם למשחק שהייתם בו — 21 חצאי־מהלכים.");
    expect(restoreNotice(null, 0)).toBe("חזרתם למשחק שהייתם בו.");
  });

  it("keeps the half-move count on every branch, because it is true however the position arrived", () => {
    for (const handover of ["first-decision", "anchor", null] as const) {
      expect(restoreNotice(handover, 21), String(handover)).toContain("21 חצאי־מהלכים");
    }
  });
});

describe("the help screen promises the ordering, not a fixed set of questions", () => {
  const helpText = () =>
    render(<WhatThisIs onClose={vi.fn()} />).container.textContent?.replace(/\s+/g, " ") ?? "";

  it("still gives the ordering and the reason for it", () => {
    const text = helpText();
    expect(text).toContain("קודם אתה בוחר מהלך");
    expect(text).toContain("רק אז המנוע עונה");
  });

  it("no longer describes every decision as carrying all four steps", () => {
    /*
     * The old sentence ran "קודם אתה בוחר מהלך, מסמן מה אתה קורא בעמדה ומה אתה לא מצליח להעריך,
     * ואומר כמה אתה בטוח" as one unbroken clause about every decision.
     */
    expect(helpText()).not.toContain("קודם אתה בוחר מהלך, מסמן מה אתה קורא בעמדה");
  });

  it("says which questions are asked is a draw, and says it is not the player's choice", () => {
    const text = helpText();
    expect(text).toContain("לא בכל החלטה נשאלות אותן שאלות");
    expect(text).toMatch(/הגרלה/);
    expect(text, "the one property that makes the sample worth anything").toContain("לא לפיך");
  });
});
