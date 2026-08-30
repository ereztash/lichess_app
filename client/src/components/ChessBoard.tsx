import { useEffect, useRef, useState } from "react";

import { PIECES, type Orientation } from "@/lib/game-data";
type BoardPiece = { type: string; color: "w" | "b" } | null;
interface ChessBoardProps {
  board: BoardPiece[][];
  orientation: Orientation;
  selectedSquare?: string;
  legalTargets: string[];
  lastMove?: { from: string; to: string };
  /**
   * The ENGINE's recommendation, drawn as an arrow. Only ever set after a reveal.
   */
  suggestedMove?: { from: string; to: string };
  /**
   * The PLAYER's own proposed move, while deciding.
   *
   * Rendered deliberately unlike suggestedMove. Choosing a move used to change nothing on the
   * board -- the piece stayed put and a line of text appeared in a side panel -- so the board
   * read as frozen, which is what "the game does not work" turned out to mean. Marking it with
   * the engine's arrow instead would be worse than silence: two different causes, your guess and
   * the machine's answer, would produce one identical mark on the board.
   */
  chosenMove?: { from: string; to: string };
  onSelect: (square?: string) => void;
  onMove: (from: string, to: string) => void;
}
const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

/**
 * What a square is called out loud.
 *
 * THE DEFECT THIS CLOSES, which this repository had already written down and not fixed.
 * `game-data.ts` says it against the shared piece silhouette: "It does NOT survive a screen
 * reader, but that was already true: the square's `aria-label` is the coordinate, and never named
 * the piece." Every gridcell carried `aria-label={square}`, and an `aria-label` beats the
 * element's contents in the accessible-name computation -- so a screen reader announced "e4" and
 * never "e4, white knight". The glyph rendered, was not `aria-hidden`, and was still never
 * spoken. Sixty-four coordinates and no pieces.
 *
 * It is worse than one missing word, because both colours draw the SAME glyph and are separated
 * only by fill lightness. There was no fallback: a reader that did announce the contents would
 * have got "♟" for a white pawn and "♟" for a black one.
 *
 * THE COORDINATE COMES FIRST, and that ordering is load-bearing rather than stylistic. a1, a8 and
 * the first rank carry visible file and rank labels, and axe's label-content-name-mismatch asks
 * that an element's visible text appear in its accessible name. "a1, צריח לבן" contains "a1";
 * "צריח לבן ב-a1" does not.
 */
const PIECE_NAMES: Record<string, { noun: string; feminine?: true }> = {
  p: { noun: "רגלי" },
  n: { noun: "פרש" },
  b: { noun: "רץ" },
  r: { noun: "צריח" },
  q: { noun: "מלכה", feminine: true },
  k: { noun: "מלך" },
};
const COLOUR_NAMES: Record<"w" | "b", { m: string; f: string }> = {
  w: { m: "לבן", f: "לבנה" },
  b: { m: "שחור", f: "שחורה" },
};

/**
 * THE ADJECTIVE AGREES WITH THE NOUN, because this string is read ALOUD.
 *
 * Five of the six pieces are masculine in Hebrew and `מלכה` is feminine, so a single colour word
 * produces "מלכה לבן" on the one square where it matters most. A label that is only ever seen in
 * a DOM inspector could get away with that; this one is the entire output of the board for anyone
 * using a screen reader, and ungrammatical speech is harder to parse, not merely untidy.
 */
export function squareLabel(square: string, piece: BoardPiece): string {
  if (!piece) return `${square}, ריקה`;
  const named = PIECE_NAMES[piece.type];
  if (!named) return `${square}, ${piece.type} ${COLOUR_NAMES[piece.color].m}`;
  const colour = COLOUR_NAMES[piece.color][named.feminine ? "f" : "m"];
  return `${square}, ${named.noun} ${colour}`;
}

export function ChessBoard({
  board,
  orientation,
  selectedSquare,
  legalTargets,
  lastMove,
  suggestedMove,
  chosenMove,
  onSelect,
  onMove,
}: ChessBoardProps) {
  const displayFiles = orientation === "w" ? files : [...files].reverse();
  const displayRanks = orientation === "w" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const getPiece = (square: string) => {
    const file = files.indexOf(square[0]);
    const rank = Number(square[1]);
    return board[8 - rank]?.[file] ?? null;
  };
  const point = (square: string) => {
    const file = files.indexOf(square[0]);
    const rank = Number(square[1]);
    const x = orientation === "w" ? file : 7 - file;
    const y = orientation === "w" ? 8 - rank : rank - 1;
    return { x: (x + 0.5) * 12.5, y: (y + 0.5) * 12.5 };
  };
  const arrowStart = suggestedMove ? point(suggestedMove.from) : undefined;
  const arrowEnd = suggestedMove ? point(suggestedMove.to) : undefined;
  const selectSquare = (square: string) => {
    if (selectedSquare && legalTargets.includes(square)) {
      onMove(selectedSquare, square);
      return;
    }
    onSelect(selectedSquare === square ? undefined : square);
  };

  /*
   * ONE TAB STOP, NOT SIXTY-FOUR.
   *
   * The squares are `<button>` elements, so they were always reachable by keyboard -- a native
   * button is in the tab order and activates on Enter and Space with no `tabIndex` at all. That
   * is not the defect. The defect is that reaching h1 took sixty-four presses of Tab, on a
   * container that declares `role="grid"` and therefore PROMISES a reader that the arrow keys
   * work. Announcing a pattern and not implementing it is worse than not announcing it: assistive
   * technology switches into grid mode on the strength of the role and then finds nothing to
   * navigate.
   *
   * So: a roving tabindex. Exactly one square is in the tab order, the arrows move it, and the
   * board costs one Tab press to enter and one to leave.
   *
   * The roving square is state rather than derived from `selectedSquare`, because focus and
   * selection are different things in this pattern and the grid may be read without anything
   * being selected. Every square exists in every orientation, so flipping the board can never
   * leave this pointing at a square that is not rendered.
   */
  const [focusSquare, setFocusSquare] = useState(`${displayFiles[0]}${displayRanks[0]}`);
  const cells = useRef(new Map<string, HTMLButtonElement>());

  const squareAt = (row: number, col: number) => `${displayFiles[col]}${displayRanks[row]}`;
  const moveFocus = (square: string) => {
    setFocusSquare(square);
    cells.current.get(square)?.focus();
  };

  /**
   * Arrow keys, Home and End, on the WAI-ARIA grid pattern.
   *
   * Clamped rather than wrapped. A board has edges a player can see, and focus that reappears on
   * the far file after ArrowRight on h4 is focus that has silently changed rank.
   *
   * Enter and Space are deliberately absent: a native button already fires `onClick` for both,
   * and re-implementing them here would be a second activation path to keep in step with the
   * first. Anything not handled returns before `preventDefault`, so typing is never swallowed.
   */
  const onSquareKeyDown = (event: React.KeyboardEvent, square: string) => {
    const row = displayRanks.indexOf(Number(square[1]));
    const col = displayFiles.indexOf(square[0]);
    const clamp = (n: number) => Math.min(7, Math.max(0, n));
    let next: string;
    switch (event.key) {
      case "ArrowRight":
        next = squareAt(row, clamp(col + 1));
        break;
      case "ArrowLeft":
        next = squareAt(row, clamp(col - 1));
        break;
      case "ArrowUp":
        next = squareAt(clamp(row - 1), col);
        break;
      case "ArrowDown":
        next = squareAt(clamp(row + 1), col);
        break;
      case "Home":
        next = event.ctrlKey ? squareAt(0, 0) : squareAt(row, 0);
        break;
      case "End":
        next = event.ctrlKey ? squareAt(7, 7) : squareAt(row, 7);
        break;
      default:
        return;
    }
    event.preventDefault();
    moveFocus(next);
  };

  /*
   * WHAT THE BOARD SAYS OUT LOUD, AND WHAT IT MAY NEVER SAY.
   *
   * A sighted player sees the piece move. Without this region a screen-reader user pressed Enter
   * and got silence -- there is exactly one other `aria-live` in this entire client, and it is
   * not on the board.
   *
   * THE CONSTRAINT. R3 is that the machine does not answer before the decision is recorded, and a
   * region that spoke an evaluation would be a fourth path around it. So this announces what the
   * PLAYER did and what is on the board, and never anything the engine knows. `suggestedMove` --
   * the arrow, which only exists after a reveal -- is not read here at all, and a test holds that
   * shut.
   *
   * IT ANNOUNCES CHANGES, NOT STATE. A live region that spoke its contents on mount would read
   * the last move of a restored game to someone who just opened the page. The first pass only
   * records what it saw.
   */
  const [announcement, setAnnouncement] = useState("");
  const seen = useRef<{ selected?: string; chosen: string; last: string } | null>(null);
  const chosenKey = chosenMove ? `${chosenMove.from}${chosenMove.to}` : "";
  const lastKey = lastMove ? `${lastMove.from}${lastMove.to}` : "";
  const targetCount = legalTargets.length;
  useEffect(() => {
    const was = seen.current;
    seen.current = { selected: selectedSquare, chosen: chosenKey, last: lastKey };
    if (!was) return;
    /*
     * Precedence, because two of these can change in one render: a move that landed outranks the
     * proposal that produced it, which outranks the selection that produced that. Announcing all
     * three would queue three utterances for one key press.
     */
    if (lastKey && lastKey !== was.last && lastMove) {
      setAnnouncement(`על הלוח: ${lastMove.from} אל ${lastMove.to}.`);
      return;
    }
    if (chosenKey && chosenKey !== was.chosen && chosenMove) {
      setAnnouncement(`המהלך שהצעתם: ${chosenMove.from} אל ${chosenMove.to}.`);
      return;
    }
    if (selectedSquare !== was.selected) {
      if (!selectedSquare) {
        setAnnouncement("הבחירה בוטלה.");
        return;
      }
      const name = squareLabel(selectedSquare, getPiece(selectedSquare));
      setAnnouncement(
        targetCount === 0
          ? `נבחרה ${name}. אין ממנה מהלך חוקי.`
          : `נבחרה ${name}. ${targetCount} יעדים חוקיים.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSquare, chosenKey, lastKey, targetCount]);

  /*
   * Files and ranks are labelled inside the squares (rank-label / file-label). Two further a-h
   * strips used to sit above and below the grid, so every file was named three times, and the
   * strips -- being separate elements -- could drift out of alignment with the squares they
   * labelled. The in-square labels cannot drift, so the strips are gone.
   */
  return (
    <div className="board-stage" aria-label="לוח שחמט אינטראקטיבי">
      <div
        className="board-grid"
        role="grid"
        aria-label="לוח שחמט. חצים להזזת המיקוד, Enter לבחירה."
        dir="ltr"
      >
        {/*
          * One `role="row"` per rank.
          *
          * `role="grid"` requires rows between it and its cells; 64 gridcells hanging directly
          * off the grid is what axe reports as aria-required-children on the grid and
          * aria-required-parent on every square. A screen reader in grid mode navigates by row,
          * so without them there is nothing to navigate.
          *
          * `display: contents` keeps the eight-column CSS grid exactly as it was -- the row
          * elements generate no boxes, so the squares remain direct grid items. The role
          * survives it: axe reads these rows in Chromium, which is the browser the audit runs.
          */}
        {displayRanks.map((rank, row) => (
          <div className="board-row" role="row" key={rank}>
            {displayFiles.map((file, col) => {
            const square = `${file}${rank}`;
            const piece = getPiece(square);
            const dark = (files.indexOf(file) + rank) % 2 === 0;
            const isLast = lastMove?.from === square || lastMove?.to === square;
            const isTarget = legalTargets.includes(square);
            const isSelected = selectedSquare === square;
            const isChosenFrom = chosenMove?.from === square;
            const isChosenTo = chosenMove?.to === square;
            return (
              <button
                className={`board-square ${dark ? "dark-square" : "light-square"} ${isLast ? "last-square" : ""} ${isTarget ? "legal-square" : ""} ${isSelected ? "selected-square" : ""} ${isChosenFrom ? "chosen-from" : ""} ${isChosenTo ? "chosen-to" : ""}`}
                key={square}
                ref={(el) => {
                  if (el) cells.current.set(square, el);
                  else cells.current.delete(square);
                }}
                role="gridcell"
                /*
                 * `data-square` is the square's IDENTITY; `aria-label` is what it is called out
                 * loud. They were the same string until the label had to name the piece, and
                 * tests that queried by label were really asking for identity. Splitting them
                 * means the wording can improve without a test rewrite each time.
                 */
                data-square={square}
                aria-label={squareLabel(square, piece)}
                /*
                 * PRESENT ONLY WHEN TRUE, and that is a reading decision rather than a tidiness
                 * one. `aria-selected="false"` on all sixty-three other squares makes a reader
                 * append "not selected" to every square it moves over, which is sixty-three
                 * repetitions of a fact the player can infer from the one square that does say
                 * "selected". The attribute is supported on `gridcell` and its default is
                 * undefined, so leaving it off where it is false is the specified state, not a
                 * gap.
                 */
                aria-selected={isSelected || undefined}
                tabIndex={square === focusSquare ? 0 : -1}
                onFocus={() => setFocusSquare(square)}
                onKeyDown={(e) => onSquareKeyDown(e, square)}
                onClick={() => selectSquare(square)}
                draggable={Boolean(piece)}
                onDragStart={(e) => e.dataTransfer.setData("text/plain", square)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData("text/plain");
                  if (from) onMove(from, square);
                }}
              >
                {/*
                  * FILE BEFORE RANK, and the order is the whole point.
                  *
                  * Both labels are `position: absolute`, so DOM order costs nothing visually --
                  * the rank still paints top-left and the file bottom-right. But a1 is the one
                  * square that carries both, and with rank first its visible text read "1a"
                  * while its name read "a1". axe reports that as label-content-name-mismatch,
                  * and it is a real failure: someone driving the board by voice says what they
                  * see. Now the text reads "a1" too.
                  *
                  * `aria-hidden` because the name already says the square. It does NOT fix the
                  * mismatch -- axe measures text visible to the eye, which aria-hidden content
                  * still is -- the ordering does.
                  */}
                {row === 7 && (
                  <span className="file-label" aria-hidden="true">
                    {file}
                  </span>
                )}
                {col === 0 && (
                  <span className="rank-label" aria-hidden="true">
                    {rank}
                  </span>
                )}
                {piece && (
                  <span className={`piece piece-${piece.color}`}>
                    {PIECES[piece.color][piece.type]}
                  </span>
                )}
                {isTarget && <span className="legal-dot" aria-hidden="true" />}
                {isChosenTo && <span className="chosen-marker" aria-hidden="true" />}
              </button>
              );
            })}
          </div>
        ))}
        {arrowStart && arrowEnd && (
          <svg className="board-vectors" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <marker
                id="suggestion-arrow"
                markerWidth="5"
                markerHeight="5"
                refX="4"
                refY="2.5"
                orient="auto"
              >
                <path d="M0,0 L5,2.5 L0,5 Z" fill="#1e5b72" />
              </marker>
            </defs>
            <line
              x1={arrowStart.x}
              y1={arrowStart.y}
              x2={arrowEnd.x}
              y2={arrowEnd.y}
              markerEnd="url(#suggestion-arrow)"
            />
            <circle cx={arrowEnd.x} cy={arrowEnd.y} r="5.2" />
          </svg>
        )}
      </div>
      <p className="sr-only board-announcer" role="status" aria-live="polite">
        {announcement}
      </p>
    </div>
  );
}
