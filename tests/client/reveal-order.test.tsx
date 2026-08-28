// @vitest-environment jsdom
/**
 * Section 4.2's ordering is load-bearing, and the spec names inverting it as the single most
 * likely thing to do quietly while making the screen look better. These tests pin the order in
 * the rendered DOM, so an inversion fails the suite rather than passing review.
 */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevealPanel } from "@/components/RevealPanel";
import type { RevealInputs } from "@shared/reveal";
import type { EngineLine } from "@/lib/stockfish";
import { CONFIDENCE_LEVELS, EVEN_ODDS_LEVEL } from "@shared/confidence";

const FEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 4 4";
const INPUTS: RevealInputs = {
  depth: 20,
  cpLoss: 180,
  chosenMove: "g8f6",
  bestMove: "f8c5",
  chosenWasBest: false,
  confidence: CONFIDENCE_LEVELS,
  confidenceScale: CONFIDENCE_LEVELS,
  statedUnknown: "לא יודע אם d5 עובד",
  decisionsOnRecord: 120,
  candidatesConsidered: [],
};
const ANALYSIS: EngineLine = {
  scoreCp: 180,
  depth: 20,
  pv: ["f8c5", "e1g1"],
  bestMove: "f8c5",
  fen: FEN,
};

const renderPanel = (inputs = INPUTS, analysis: EngineLine | null = ANALYSIS) =>
  render(<RevealPanel inputs={inputs} analysis={analysis} fen={FEN} statedKnown="מרכז פתוח" />);

const headings = (container: HTMLElement) =>
  [...container.querySelectorAll("h3, summary")].map((el) => el.textContent?.trim() ?? "");

/**
 * The four blocks in the order they render, identified by what they ARE rather than by what they
 * are called.
 *
 * This used to read the heading text. The order is the invariant section 4.2 fixes -- limits
 * before any number -- and the wording of a heading is not: rewriting `מה אי אפשר להסיק מכאן` into
 * player language broke three assertions that had nothing to say about ordering. Keying on the
 * block class means the next rewrite cannot make these tests fail for the wrong reason, and
 * cannot make them pass while the blocks move either.
 */
const blocks = (container: HTMLElement) =>
  [...container.querySelectorAll(".reveal-block, details.reveal-secondary")].map((el) =>
    [...el.classList].find((name) => name.startsWith("reveal-") && name !== "reveal-block"),
  );

describe("the reveal order is what section 4.2 says it is", () => {
  it("puts what cannot be inferred first, before anything else", () => {
    const { container } = renderPanel();
    expect(blocks(container)[0]).toBe("reveal-limits");
  });

  it("orders limits, then one thing, then next question, then the numbers", () => {
    const { container } = renderPanel();
    expect(blocks(container)).toEqual([
      "reveal-limits",
      "reveal-one-thing",
      "reveal-question",
      "reveal-secondary",
    ]);
    // Four headings render, so no block is reachable without one to introduce it.
    expect(headings(container)).toHaveLength(4);
  });

  it("keeps the evaluation collapsed, not on the surface", () => {
    const { container } = renderPanel();
    const details = container.querySelector("details");
    expect(details).not.toBeNull();
    expect(details!.open, "the evaluation must not be open by default").toBe(false);
    // The evaluation must live inside the collapsed section, not outside it.
    expect(details!.textContent).toContain("+1.80");
    const outside = container.textContent!.replace(details!.textContent!, "");
    expect(outside).not.toContain("+1.80");
  });

  it("shows exactly one 'thing to work on', never a list", () => {
    const { container } = renderPanel();
    const block = container.querySelector(".reveal-one-thing")!;
    expect(block.querySelectorAll("li")).toHaveLength(0);
    expect(block.querySelectorAll(".one-thing-text")).toHaveLength(1);
  });

  it("renders an honest nothing rather than filling the space", () => {
    const quiet = { ...INPUTS, cpLoss: 4, chosenWasBest: true, confidence: EVEN_ODDS_LEVEL, bestMove: "g8f6" };
    const { container } = renderPanel(quiet);
    expect(container.querySelector(".one-thing-none")).not.toBeNull();
    expect(container.textContent).toContain("זו תוצאה תקינה, לא מסך ריק");
  });

  it("still leads with the limits when there is nothing to work on", () => {
    // `bestMove` matched to the chosen move, like the fixture above it. Saying the player chose
    // the best move while naming a different one is a state the product cannot produce, and a
    // fixture that describes an impossible record proves nothing about a real one.
    const quiet = { ...INPUTS, cpLoss: 4, chosenWasBest: true, confidence: EVEN_ODDS_LEVEL, bestMove: "g8f6" };
    expect(blocks(renderPanel(quiet).container)[0]).toBe("reveal-limits");
  });

  it("never renders a number without its provenance", () => {
    const { container } = renderPanel();
    for (const value of container.querySelectorAll(".value-number")) {
      const triple = value.closest(".value-triple")!;
      expect(triple.querySelector(".value-provenance")).not.toBeNull();
    }
  });

  it("says the record describes decisions, not the player, before any number", () => {
    const { container } = renderPanel();
    const text = container.textContent!;
    expect(text.indexOf("לא של השחקן")).toBeLessThan(text.indexOf("ס״פ"));
  });
});
