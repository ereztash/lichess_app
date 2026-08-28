// @vitest-environment jsdom
/**
 * The one rule this product cannot bend, and the reason it never gave for it.
 *
 * WHAT THE COMMITMENT SCREEN SAID. *"המנוע לא ידבר לפני שההחלטה נרשמה — זו כל הנקודה."* The first
 * clause is the invariant everything here rests on. The second is an assertion that it matters,
 * which is not a reason -- and a rule stated without one reads as ceremony: a hoop between the
 * player and the analysis they came for, resented exactly in proportion to how much they want it.
 *
 * That is the whole of Lens 3. A player who cannot say WHY the engine waits has no way to
 * distinguish this product from one that simply makes them work first, and no reason to believe
 * the ordering buys them anything.
 *
 * THE REASON, AND IT IS AN INFORMATION FACT RATHER THAN A POLICY. Once the engine has spoken there
 * is no way to separate what the player wrote from what the engine added. That is checkable
 * against anybody's own experience of reading an engine line, and it is the entire justification
 * for the ordering.
 *
 * WHAT IT MAY NOT SAY WHILE SAYING IT. The record holds a stated confidence, two written reads and
 * the moves placed on a board. It does not hold what anyone saw, considered, noticed or
 * understood, and the sentence that explains the ordering is the easiest place in the product to
 * quietly promote board interaction into a claim about a mind.
 */
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommitmentScreen } from "@/components/CommitmentScreen";

/** The record holds board interaction and written text. It does not hold a mind. */
const MIND_WORDS = /ראית|ראיתם|לא ראית|שמת לב|חשבת|הבנת|ידעת ש|שקלת|שקלתם/;

/** `anchor`, because that is the purpose where every step of the screen is actually asked. */
const POSITION = {
  gameId: "g",
  fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4",
  ply: 7,
  clockMsRemaining: null,
  purpose: "anchor" as const,
};

const screenFor = (candidatesConsidered: string[] = []) =>
  render(
    <CommitmentScreen
      position={POSITION}
      chosenMove={candidatesConsidered[0] ?? null}
      candidatesConsidered={candidatesConsidered}
      onCommit={vi.fn()}
      pending={false}
    />,
  ).container;

describe("the screen gives the reason, not only the rule", () => {
  it("says why the engine waits rather than that it does", () => {
    const intro = screenFor().querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro, "the ordering is stated with no reason").toMatch(/כי |כדי |אחרת |מפני ש/);
    expect(intro, "the reason is the assertion that it matters").not.toContain("זו כל הנקודה");
  });

  it("names the separation that becomes impossible afterwards", () => {
    /*
     * The specific reason, not a generic one. "It keeps the measurement honest" would be a claim
     * about the product; this is a claim about information, and it is the one a player can check.
     */
    const intro = screenFor().querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro).toMatch(/להפריד|להבדיל/);
    expect(intro).toMatch(/מה שרשמתם|מה שכתבתם/);
  });

  it("keeps the reason pre-commit, where the ordering is actually being asked for", () => {
    /*
     * A reason that arrives at the reveal explains a rule the player has already obeyed. It has to
     * be on the screen that imposes it, which is this one, before the button.
     */
    expect(screenFor().querySelector(".commitment-intro")).not.toBeNull();
  });
});

describe("the explanation claims nothing about a mind", () => {
  it("uses none of the words the record cannot support", () => {
    const intro = screenFor().querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro).not.toMatch(MIND_WORDS);
  });

  it("keeps the candidate-list asymmetry in the direction the record runs", () => {
    /*
     * ALREADY TRUE, ASSERTED HERE BECAUSE IT IS HALF OF LENS 3. A move in the list WAS in front of
     * the player. A move absent may still have been considered and simply never placed. The record
     * can show that a move was there; it can never show that one was not.
     */
    const note = screenFor(["e2e4", "d2d4"]).querySelector(".candidates-note")?.textContent ?? "";
    expect(note).toContain("אינו נרשם");
    expect(note).toMatch(/יכולה להראות שמהלך היה מולכם, אף פעם לא שהוא לא היה/);
    /*
     * AND `MIND_WORDS` IS DELIBERATELY NOT APPLIED HERE, which the first draft of this file got
     * wrong. The note reads "מהלך ששקלתם בראש ולא הנחתם על הלוח אינו נרשם" and so contains
     * "שקלתם" -- and it is the safest sentence on the screen, because it is the product DECLINING
     * to claim a mind. The prohibition is on asserting what someone saw or considered, never on
     * the word appearing; a scan that could not tell those apart would push the product toward
     * silence about exactly the limit it most needs to state.
     */
    expect(note).not.toMatch(/ראינו ש|אנחנו יודעים מה|זיהינו שחשבת/);
  });

  it("acknowledges the input without evaluating it, anywhere before the commit", () => {
    /*
     * THE STANDING CONSTRAINT THIS SCREEN EXISTS UNDER. Pre-commit feedback may say what was
     * recorded and may not say anything about whether it was good -- a hint, a warning, a nudge
     * toward a better move all contaminate the very thing being measured, and the contamination is
     * invisible afterwards.
     */
    const text = screenFor(["e2e4", "d2d4"]).textContent ?? "";
    expect(text).not.toMatch(/מהלך טוב|בחירה טובה|כדאי לשקול|נסו מהלך אחר|שגיאה|מצוין|כל הכבוד/);
  });
});

describe("the unit on screen is the decision, not the move", () => {
  it("does not offer to record moves where it records decisions", () => {
    /*
     * The distinction the front door leads with -- an engine says which move was better, this
     * records the decision -- has to survive onto the screen where the decision is made. A
     * commitment screen that talked about recording moves would be describing the other product.
     */
    const intro = screenFor().querySelector(".commitment-intro")?.textContent ?? "";
    expect(intro).toContain("ההחלטה נרשמה");
  });
});
