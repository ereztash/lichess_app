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
   * Files and ranks are labelled inside the squares (rank-label / file-label). Two further a-h
   * strips used to sit above and below the grid, so every file was named three times, and the
   * strips -- being separate elements -- could drift out of alignment with the squares they
   * labelled. The in-square labels cannot drift, so the strips are gone.
   */
  return (
    <div className="board-stage" aria-label="לוח שחמט אינטראקטיבי">
      <div className="board-grid" role="grid" aria-label="לוח שחמט" dir="ltr">
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
                role="gridcell"
                aria-label={square}
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
    </div>
  );
}
