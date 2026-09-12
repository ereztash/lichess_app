// @vitest-environment jsdom
/**
 * THE ONE AXIS THIS PRODUCT EXPOSES, AND THE THREE IT DOES NOT.
 *
 * "How hard is the opponent" is at least four different questions and they come apart:
 *
 *   - OPPONENT STRENGTH -- how well it plays;
 *   - HUMAN-LIKENESS -- whether its move selection resembles plausible human play;
 *   - PLAYER-RELATIVE CHALLENGE -- how difficult it is for THIS player;
 *   - PEDAGOGICAL TARGETING -- whether it creates positions relevant to an active learning object.
 *
 * A single "difficulty" control that meant all four would be an evidential alias: a player choosing
 * "harder" would be choosing a different POPULATION, and every reading taken afterwards would be
 * conditioned on a variable nothing recorded the meaning of. The product exposes exactly one axis,
 * and the note under the control says which: `עומק חיפוש של Stockfish, לא דירוג`.
 *
 * WHY THIS FILE EXISTS WHEN THE COPY IS ALREADY RIGHT. It was right and unheld. A rename to `רמה`
 * or a helpful `≈1400` beside a depth would ship green through 3,200 tests and 44 gates, and it is
 * the single most natural "improvement" somebody would make to this screen -- every other chess
 * product in the world labels this control with a rating. Stockfish's search depth has no
 * established rating equivalent at these depths on this hardware, nothing in this repository
 * measures one, and a number presented as one would be a claim with no evidence behind it on the
 * control that selects the opponent every later reading is taken against.
 *
 * WHAT IT DOES NOT CHECK: that the depths offered are well chosen, or that any of them is pleasant
 * to play. Those are OWNER and FIELD. This holds one claim boundary and nothing else.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewGameSetup } from "@/components/NewGameSetup";
import { REVEAL_TIMINGS } from "@shared/reveal-timing";

const setup = () =>
  render(
    <NewGameSetup
      color="w"
      depth={8}
      revealTiming={REVEAL_TIMINGS[0]}
      onColor={() => {}}
      onDepth={() => {}}
      onRevealTiming={() => {}}
      onStart={() => {}}
      onCancel={() => {}}
    />,
  ).container;

/**
 * Words that would turn a search depth into a strength claim.
 *
 * `דירוג` IS EXCLUDED FROM THE SEARCH AND THAT IS NOT AN OVERSIGHT: the honest note says the word,
 * in a denial -- "Stockfish search depth, NOT a rating". Banning the word outright would fail the
 * sentence that exists to make the distinction. What is refused is the word used as a LABEL for the
 * control, and a number in rating range beside a depth.
 */
const RATING_SHAPED = /\bELO\b|\belo\b|אלו\b|\bFIDE\b|\bUSCF\b/;

describe("the opponent control says which axis it is", () => {
  it("names the axis it actually varies", () => {
    expect(setup().textContent).toContain("עומק חיפוש של Stockfish, לא דירוג");
  });

  it("puts no rating scale on the screen", () => {
    const text = setup().textContent ?? "";
    expect(text, "a rating system is named beside a search depth").not.toMatch(RATING_SHAPED);
    /*
     * NO FOUR-DIGIT NUMBER ANYWHERE. A depth is one or two digits; anything in rating range on this
     * screen is either a rating or is going to be read as one, and the reader has no way to tell
     * which. This is the assertion that catches the helpful `≈1400`.
     */
    expect(text, "a number in rating range is on the opponent control").not.toMatch(/\d{4}/);
  });

  it("does not call the control a level, which is the word that means all four axes at once", () => {
    /*
     * `רמה` is the natural Hebrew label and it is exactly the alias: it reads as strength, as
     * difficulty-for-me, and as how-much-this-will-teach-me, all at once and with no denominator.
     * The product may add those axes later; what it may not do is let one word stand for the set.
     */
    expect(setup().textContent ?? "", "the control is labelled with the word that means all four").not.toMatch(
      /רמת יריב|רמה של היריב|בחרו רמה/,
    );
  });
});
