// @vitest-environment jsdom
/**
 * Two marks on the board that must never be one mark.
 *
 * `chosenMove` is what the PLAYER proposed and has not committed yet. `suggestedMove` is what
 * the ENGINE answered, after the reveal. They are different facts about the position, and the
 * rule this codebase runs on is that identical output must never erase different causes -- so
 * rendering a guess with the engine's arrow would be worse than rendering nothing.
 *
 * The reason chosenMove exists at all: choosing a move used to change NOTHING on the board. The
 * piece stayed where it was and a sentence appeared in a panel off to the side, so the board
 * read as frozen -- verified in a browser against the deployed build, where picking a move left
 * all sixty-four squares byte-identical. That is what "the game does not work" meant.
 */
import { render } from "@testing-library/react";
import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { ChessBoard } from "../../client/src/components/ChessBoard";

const board = new Chess().board();
const base = {
  board,
  orientation: "w" as const,
  legalTargets: [],
  onSelect: () => undefined,
  onMove: () => undefined,
};
const squareNamed = (container: HTMLElement, name: string) =>
  container.querySelector(`[data-square="${name}"]`)!;

describe("the player's proposed move", () => {
  it("is visible on the board", () => {
    const { container } = render(<ChessBoard {...base} chosenMove={{ from: "e2", to: "e4" }} />);
    expect(squareNamed(container, "e2").className).toContain("chosen-from");
    expect(squareNamed(container, "e4").className).toContain("chosen-to");
  });

  it("marks only its own two squares", () => {
    const { container } = render(<ChessBoard {...base} chosenMove={{ from: "e2", to: "e4" }} />);
    const marked = [...container.querySelectorAll(".chosen-from, .chosen-to")].map((e) =>
      e.getAttribute("data-square"),
    );
    expect(marked.sort()).toEqual(["e2", "e4"]);
  });

  it("draws no arrow -- an arrow is the engine's answer, and there is no answer yet", () => {
    const { container } = render(<ChessBoard {...base} chosenMove={{ from: "e2", to: "e4" }} />);
    expect(container.querySelectorAll(".board-vectors")).toHaveLength(0);
  });

  it("leaves the board unmarked when nothing has been proposed", () => {
    const { container } = render(<ChessBoard {...base} />);
    expect(container.querySelectorAll(".chosen-from, .chosen-to")).toHaveLength(0);
  });
});

describe("the engine's suggestion", () => {
  it("draws an arrow", () => {
    const { container } = render(<ChessBoard {...base} suggestedMove={{ from: "e2", to: "e4" }} />);
    expect(container.querySelectorAll(".board-vectors")).toHaveLength(1);
  });

  it("does NOT wear the player's mark", () => {
    const { container } = render(<ChessBoard {...base} suggestedMove={{ from: "e2", to: "e4" }} />);
    expect(container.querySelectorAll(".chosen-from, .chosen-to")).toHaveLength(0);
  });
});

describe("the two are distinguishable", () => {
  it("produce different DOM for the same move", () => {
    const asChosen = render(<ChessBoard {...base} chosenMove={{ from: "e2", to: "e4" }} />);
    const asSuggested = render(<ChessBoard {...base} suggestedMove={{ from: "e2", to: "e4" }} />);
    // Same move, same board, two different renderings. If these ever match, one of the two
    // facts has become unreadable.
    expect(asChosen.container.innerHTML).not.toBe(asSuggested.container.innerHTML);
  });
});

describe("squares say which square they are", () => {
  /*
   * These used to read the coordinate off `aria-label`, which conflated two things: which square
   * this IS, and what it is CALLED OUT LOUD. They are now separate attributes, and the assertions
   * below split with them -- identity from `data-square`, naming from `aria-label`.
   */
  it("gives all sixty-four a distinct identity", () => {
    const { container } = render(<ChessBoard {...base} />);
    const ids = [...container.querySelectorAll(".board-square")].map((e) =>
      e.getAttribute("data-square"),
    );
    expect(ids).toHaveLength(64);
    expect(new Set(ids).size).toBe(64);
    expect(ids).toContain("a1");
    expect(ids).toContain("h8");
  });

  it("opens every accessible name with the square's own coordinate", () => {
    /*
     * Stronger than the two spot checks it replaces, and it is the property axe's
     * label-content-name-mismatch depends on: a1 and the first rank carry VISIBLE file and rank
     * text, so the name has to contain it. Leading with the coordinate guarantees that for all
     * sixty-four rather than for the two that happened to be asserted.
     */
    const { container } = render(<ChessBoard {...base} />);
    const squares = [...container.querySelectorAll(".board-square")];
    expect(squares).toHaveLength(64);
    for (const square of squares) {
      const id = square.getAttribute("data-square")!;
      expect(square.getAttribute("aria-label")).toMatch(new RegExp(`^${id}[,\\s]`));
    }
    expect(new Set(squares.map((e) => e.getAttribute("aria-label"))).size).toBe(64);
  });

  it("keeps its names when the board is flipped", () => {
    const white = render(<ChessBoard {...base} />);
    const black = render(<ChessBoard {...base} orientation="b" />);
    const read = (c: HTMLElement) =>
      new Set([...c.querySelectorAll(".board-square")].map((e) => e.getAttribute("aria-label")));
    expect(read(black.container)).toEqual(read(white.container));
  });
});
