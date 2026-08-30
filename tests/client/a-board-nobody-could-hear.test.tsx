// @vitest-environment jsdom
/**
 * The board, driven by a keyboard and read by a screen reader.
 *
 * WHAT WAS BROKEN, and this repository had already written half of it down. `game-data.ts` says
 * it against the shared piece silhouette: "It does NOT survive a screen reader, but that was
 * already true: the square's `aria-label` is the coordinate, and never named the piece." Every
 * gridcell carried `aria-label={square}`, and an `aria-label` BEATS the element's contents in the
 * accessible-name computation -- so a reader announced "e4" and never "e4, white knight". Sixty-
 * four coordinates and no pieces, on the surface the whole product is about.
 *
 * It could not fall back on the glyph either. Both colours render the SAME character and are
 * separated only by fill lightness, so contents would have given "♟" for a white pawn and "♟" for
 * a black one.
 *
 * AND THE SECOND HALF. `.board-grid` declares `role="grid"`, which promises a reader that the
 * arrow keys navigate. Nothing in the component handled a key. The squares are `<button>`s, so
 * they were always reachable -- a native button is in the tab order and activates on Enter and
 * Space -- but reaching h1 took sixty-four presses of Tab. A declared pattern that is not
 * implemented is worse than no pattern: assistive technology switches into grid mode on the
 * strength of the role and then finds nothing there.
 *
 * WHAT THESE TESTS ARE AND ARE NOT. jsdom does not speak, so none of this measures what a screen
 * reader says. It measures the two things a reader computes its output FROM -- the accessible
 * name, and what changes in a live region -- plus the navigation model, which is ordinary DOM and
 * is measured exactly. The rest was checked in a browser and is recorded in docs/FINDINGS.md.
 */
import { act, fireEvent, render } from "@testing-library/react";
import { Chess } from "chess.js";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ChessBoard, squareLabel } from "../../client/src/components/ChessBoard";

const game = new Chess();
const board = game.board();
const base = {
  board,
  orientation: "w" as const,
  legalTargets: [],
  onSelect: () => undefined,
  onMove: () => undefined,
};

const squares = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>(".board-square")];
const at = (c: HTMLElement, id: string) => c.querySelector<HTMLElement>(`[data-square="${id}"]`)!;
const announcer = (c: HTMLElement) => c.querySelector(".board-announcer")!;

/** Press a key on whichever square currently holds DOM focus. */
const press = (key: string, init: Partial<KeyboardEventInit> = {}) =>
  fireEvent.keyDown(document.activeElement!, { key, ...init });

/**
 * Focus a square the way a browser would, inside `act`.
 *
 * `.focus()` fires the component's `onFocus`, which sets the roving square -- a real state update
 * that React must be allowed to flush before the next assertion reads the DOM.
 */
const focus = (element: HTMLElement) => act(() => element.focus());

describe("a square says what is standing on it", () => {
  it("names the piece and its colour, not just the coordinate", () => {
    const { container } = render(<ChessBoard {...base} />);
    expect(at(container, "e1").getAttribute("aria-label")).toBe("e1, מלך לבן");
    expect(at(container, "b8").getAttribute("aria-label")).toBe("b8, פרש שחור");
    expect(at(container, "d8").getAttribute("aria-label")).toBe("d8, מלכה שחורה");
  });

  it("says an empty square is empty rather than saying only its name", () => {
    const { container } = render(<ChessBoard {...base} />);
    expect(at(container, "e4").getAttribute("aria-label")).toBe("e4, ריקה");
  });

  it("separates the two colours, which the glyph does not", () => {
    /*
     * The point of the whole change. PIECES.w.n and PIECES.b.n are the same character, so before
     * this the two knights were indistinguishable to anything that does not measure fill
     * lightness -- which is every screen reader.
     */
    const { container } = render(<ChessBoard {...base} />);
    const white = at(container, "b1").getAttribute("aria-label");
    const black = at(container, "b8").getAttribute("aria-label");
    expect(white).not.toBe(black);
    expect(white?.replace("b1", "")).not.toBe(black?.replace("b8", ""));
  });

  it("agrees the adjective with the noun, because this string is read aloud", () => {
    /*
     * Five of the six pieces are masculine in Hebrew and `מלכה` is feminine. A single colour word
     * gives "מלכה לבן" on the one square where a reader most needs to be sure what it heard.
     */
    const { container } = render(<ChessBoard {...base} />);
    expect(at(container, "d1").getAttribute("aria-label")).toBe("d1, מלכה לבנה");
    expect(at(container, "e1").getAttribute("aria-label")).toBe("e1, מלך לבן");
  });

  it("is a pure function of the square and the piece, so it can be asserted elsewhere", () => {
    expect(squareLabel("a1", { type: "r", color: "w" })).toBe("a1, צריח לבן");
    expect(squareLabel("d8", { type: "q", color: "b" })).toBe("d8, מלכה שחורה");
    expect(squareLabel("a1", null)).toBe("a1, ריקה");
  });
});

describe("the board is one tab stop", () => {
  it("puts exactly one square in the tab order", () => {
    const { container } = render(<ChessBoard {...base} />);
    const inOrder = squares(container).filter((e) => e.getAttribute("tabindex") === "0");
    expect(inOrder).toHaveLength(1);
    expect(squares(container).filter((e) => e.getAttribute("tabindex") === "-1")).toHaveLength(63);
  });

  it("starts at the top-left square of the board as displayed", () => {
    const white = render(<ChessBoard {...base} />);
    expect(
      squares(white.container).find((e) => e.getAttribute("tabindex") === "0"),
    ).toHaveAttribute("data-square", "a8");

    const black = render(<ChessBoard {...base} orientation="b" />);
    expect(
      squares(black.container).find((e) => e.getAttribute("tabindex") === "0"),
    ).toHaveAttribute("data-square", "h1");
  });
});

describe("the arrow keys move the focus the grid role promised", () => {
  const start = (id = "d4") => {
    const { container } = render(<ChessBoard {...base} />);
    focus(at(container, id));
    return container;
  };

  it("moves right, left, up and down in board terms", () => {
    const c = start();
    press("ArrowRight");
    expect(document.activeElement).toHaveAttribute("data-square", "e4");
    press("ArrowLeft");
    expect(document.activeElement).toHaveAttribute("data-square", "d4");
    press("ArrowUp");
    expect(document.activeElement).toHaveAttribute("data-square", "d5");
    press("ArrowDown");
    expect(document.activeElement).toHaveAttribute("data-square", "d4");
  });

  it("stops at the edge instead of wrapping to another rank", () => {
    /*
     * Wrapping would move focus a rank without saying so. On a board, where the edge is visible,
     * silence about a rank change is a worse failure than a key that does nothing.
     */
    const c = start("h4");
    press("ArrowRight");
    expect(document.activeElement).toHaveAttribute("data-square", "h4");
    focus(at(c, "a4"));
    press("ArrowLeft");
    expect(document.activeElement).toHaveAttribute("data-square", "a4");
    focus(at(c, "d8"));
    press("ArrowUp");
    expect(document.activeElement).toHaveAttribute("data-square", "d8");
    focus(at(c, "d1"));
    press("ArrowDown");
    expect(document.activeElement).toHaveAttribute("data-square", "d1");
  });

  it("takes Home and End to the ends of the rank, and Ctrl to the corners", () => {
    start("d4");
    press("Home");
    expect(document.activeElement).toHaveAttribute("data-square", "a4");
    press("End");
    expect(document.activeElement).toHaveAttribute("data-square", "h4");
    press("Home", { ctrlKey: true });
    expect(document.activeElement).toHaveAttribute("data-square", "a8");
    press("End", { ctrlKey: true });
    expect(document.activeElement).toHaveAttribute("data-square", "h1");
  });

  it("follows what is on screen when the board is flipped, not the coordinates", () => {
    /*
     * With black at the bottom, the square to the RIGHT of h1 on screen is g1. A handler written
     * against the coordinate system rather than the display would send focus off the board here
     * and clamp back to h1, which is the bug this asserts against.
     */
    const { container } = render(<ChessBoard {...base} orientation="b" />);
    focus(at(container, "h1"));
    press("ArrowRight");
    expect(document.activeElement).toHaveAttribute("data-square", "g1");
    press("ArrowDown");
    expect(document.activeElement).toHaveAttribute("data-square", "g2");
  });

  it("keeps the roving tabindex on the square focus actually reached", () => {
    const c = start("d4");
    press("ArrowRight");
    expect(at(c, "e4")).toHaveAttribute("tabindex", "0");
    expect(at(c, "d4")).toHaveAttribute("tabindex", "-1");
    expect(squares(c).filter((e) => e.getAttribute("tabindex") === "0")).toHaveLength(1);
  });

  it("does not swallow keys it has no business handling", () => {
    /*
     * The handler returns before preventDefault for anything unrecognised. If it did not, a
     * keyboard shortcut anywhere above this board would stop working while the board had focus.
     */
    start("d4");
    const event = new KeyboardEvent("keydown", { key: "k", bubbles: true, cancelable: true });
    document.activeElement!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

/**
 * The acceptance test: a legal move, from a cold render, with no pointer event at all.
 *
 * The harness is the smallest honest stand-in for the page -- it holds selection state and
 * computes legal targets with chess.js, exactly as the real caller does. Without it `onMove`
 * could never fire, because the component asks the CALLER what is legal.
 */
function KeyboardOnlyBoard({ onPlayed }: { onPlayed: (move: string) => void }) {
  const [selected, setSelected] = useState<string | undefined>();
  const chess = new Chess();
  const targets = selected
    ? chess.moves({ square: selected as never, verbose: true }).map((m) => m.to)
    : [];
  return (
    <ChessBoard
      board={chess.board()}
      orientation="w"
      legalTargets={targets}
      selectedSquare={selected}
      onSelect={setSelected}
      onMove={(from, to) => onPlayed(`${from}${to}`)}
    />
  );
}

describe("a player who never touches a pointer", () => {
  it("reaches a legal move using only keys", () => {
    const played: string[] = [];
    const { container } = render(<KeyboardOnlyBoard onPlayed={(m) => played.push(m)} />);

    // One Tab press lands on the board's single tab stop; jsdom does not run Tab, so focus it.
    const entry = squares(container).find((e) => e.getAttribute("tabindex") === "0")!;
    focus(entry);
    expect(entry).toHaveAttribute("data-square", "a8");

    // a8 -> e2, by arrows alone.
    for (let i = 0; i < 4; i += 1) press("ArrowRight");
    for (let i = 0; i < 6; i += 1) press("ArrowDown");
    expect(document.activeElement).toHaveAttribute("data-square", "e2");

    fireEvent.click(document.activeElement!); // what Enter fires on a native button
    expect(at(container, "e2")).toHaveAttribute("aria-selected", "true");

    press("ArrowUp");
    press("ArrowUp");
    expect(document.activeElement).toHaveAttribute("data-square", "e4");
    fireEvent.click(document.activeElement!);

    expect(played).toEqual(["e2e4"]);
  });
});

describe("the board says out loud what the player did", () => {
  it("is silent on mount, so a restored game is not read out on arrival", () => {
    const { container } = render(<ChessBoard {...base} lastMove={{ from: "e2", to: "e4" }} />);
    expect(announcer(container).textContent).toBe("");
  });

  it("announces a selection with the number of moves it opens", () => {
    const { container, rerender } = render(<ChessBoard {...base} />);
    rerender(<ChessBoard {...base} selectedSquare="e2" legalTargets={["e3", "e4"]} />);
    expect(announcer(container).textContent).toBe("נבחרה e2, רגלי לבן. 2 יעדים חוקיים.");
  });

  it("says so when a selected piece has nowhere to go", () => {
    const { container, rerender } = render(<ChessBoard {...base} />);
    rerender(<ChessBoard {...base} selectedSquare="c1" legalTargets={[]} />);
    expect(announcer(container).textContent).toBe("נבחרה c1, רץ לבן. אין ממנה מהלך חוקי.");
  });

  it("announces the move that landed on the board", () => {
    const { container, rerender } = render(<ChessBoard {...base} />);
    rerender(<ChessBoard {...base} lastMove={{ from: "e2", to: "e4" }} />);
    expect(announcer(container).textContent).toBe("על הלוח: e2 אל e4.");
  });

  it("announces a proposal as a proposal", () => {
    const { container, rerender } = render(<ChessBoard {...base} />);
    rerender(<ChessBoard {...base} chosenMove={{ from: "e2", to: "e4" }} />);
    expect(announcer(container).textContent).toBe("המהלך שהצעתם: e2 אל e4.");
  });

  it("says one thing per change, not three", () => {
    /*
     * Selecting, proposing and landing can all arrive in one render. A region that appended each
     * would queue three utterances for one key press, and the one that matters would be last.
     */
    const { container, rerender } = render(<ChessBoard {...base} />);
    rerender(
      <ChessBoard
        {...base}
        selectedSquare="e2"
        legalTargets={["e4"]}
        chosenMove={{ from: "e2", to: "e4" }}
        lastMove={{ from: "e2", to: "e4" }}
      />,
    );
    expect(announcer(container).textContent).toBe("על הלוח: e2 אל e4.");
  });

  it("NEVER speaks the engine's suggestion -- R3 has no fourth door", () => {
    /*
     * The arrow only exists after a reveal, so this is not about ordering. It is that a live
     * region is a path out of the component that no other test looks at, and the rule this
     * product rests on is that the machine does not answer before the decision is recorded. A
     * region that read `suggestedMove` would be exactly that, spoken.
     */
    const { container, rerender } = render(<ChessBoard {...base} />);
    rerender(<ChessBoard {...base} suggestedMove={{ from: "g1", to: "f3" }} />);
    expect(announcer(container).textContent).toBe("");

    rerender(
      <ChessBoard
        {...base}
        suggestedMove={{ from: "g1", to: "f3" }}
        lastMove={{ from: "e2", to: "e4" }}
      />,
    );
    const spoken = announcer(container).textContent ?? "";
    expect(spoken).toBe("על הלוח: e2 אל e4.");
    expect(spoken).not.toContain("g1");
    expect(spoken).not.toContain("f3");
  });

  it("is polite and out of the visual flow", () => {
    const { container } = render(<ChessBoard {...base} />);
    const region = announcer(container);
    expect(region).toHaveAttribute("aria-live", "polite");
    expect(region.className).toContain("sr-only");
  });
});
