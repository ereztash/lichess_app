import { Chess } from "chess.js";

export type Orientation = "w" | "b";

export interface GameSnapshot {
  ply: number;
  san: string;
  from: string;
  to: string;
  color: "w" | "b";
  fen: string;
}

export const DEFAULT_PGN = `[Event "Studio demo"]
[Site "Chess Studio"]
[Date "2026.08.21"]
[Round "1"]
[White "לבן"]
[Black "שחור"]
[Result "*"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 *`;

/**
 * ONE SILHOUETTE PER PIECE TYPE, both colours. Colour is carried by fill, never by shape.
 *
 * This used to be the Unicode pair the code points were designed for: hollow glyphs for White
 * (♙♘♗) and solid for Black (♟♞♝). Reported as costing attention -- "it takes longer to
 * notice them" -- and that is right, because a hollow rook and a solid rook are two shapes to
 * learn for one piece. Every physical set and every board on lichess or chess.com uses one shape
 * per type and distinguishes the sides by fill alone; the pairing here was a property of the
 * font, not a decision anyone made.
 *
 * WHY THIS DOES NOT COST CONTRAST. A hollow glyph's interior is the square showing through, so
 * what the eye traced was already the outline, not a fill. Measured against the squares these sit
 * on: white fill on a light square is 1.37:1, black fill on a dark square 2.32:1 -- both far under
 * anything readable, in the OLD rendering as much as this one. The ring in `.piece` / `.piece-w`
 * is what has always carried the shape, and going solid does not touch it. What it removes is an
 * asymmetry: the hollow shape was the one sitting on its worst-contrast square.
 *
 * THE SIDE-EFFECT TO BE HONEST ABOUT. With a shared silhouette, colour is now the only visual
 * channel separating the sides. That is a LIGHTNESS difference (15.55:1 between the two fills),
 * not a hue one, so it survives every form of colour blindness and greyscale -- which is why
 * chess sets have always been allowed to do it. It does NOT survive a screen reader, but that was
 * already true: the square's `aria-label` is the coordinate, and never named the piece.
 */
export const PIECES: Record<"w" | "b", Record<string, string>> = {
  w: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};

export const INITIAL_FEN = new Chess().fen();

export function buildHistory(pgn: string): GameSnapshot[] {
  const game = new Chess();
  game.loadPgn(pgn);
  const moves = game.history({ verbose: true });
  const replay = new Chess();
  return moves.map((move, index) => {
    const completed = replay.move(move.san);
    return {
      ply: index,
      san: completed.san,
      from: completed.from,
      to: completed.to,
      color: completed.color,
      fen: replay.fen(),
    };
  });
}

export function uciToSquares(move?: string) {
  if (!move || move.length < 4 || move === "(none)") return undefined;
  return { from: move.slice(0, 2), to: move.slice(2, 4) };
}

/**
 * A UCI line replayed into SAN, stopping at the first move that is illegal here.
 *
 * `limit` used to be a hard-coded 8 inside the loop, which meant a longer line was silently cut
 * and the screen could not tell a line that ENDED from a line that was trimmed to fit. Callers
 * now state their own cap, and the one that cares reports what it dropped.
 */
export function sanPrincipalVariation(fen: string, moves: string[], limit = 8) {
  const replay = new Chess(fen);
  const sanMoves: string[] = [];
  for (const uci of moves.slice(0, limit)) {
    if (uci.length < 4) continue;
    try {
      const move = replay.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: (uci[4] || "q") as "q" | "r" | "b" | "n",
      });
      sanMoves.push(move.san);
    } catch {
      break;
    }
  }
  return sanMoves;
}

export function formatEvaluation(scoreCp: number, mate?: number) {
  if (mate !== undefined) return `#${mate > 0 ? "+" : ""}${mate}`;
  const score = scoreCp / 100;
  return `${score > 0 ? "+" : ""}${score.toFixed(2)}`;
}

/**
 * ONE MOVE APPLIED TO A NAMED PLY OF A GAME, as a value rather than as three state setters.
 *
 * WHY IT LIVES HERE. `Home.tsx` held this inline and closed over `currentPly` and `activeFen`, so
 * "the ply the decision was taken at" and "the ply the board is on" were the same expression --
 * which is how the continuation came to play a committed move four plies back. It takes the ply
 * and the position as arguments now, and this is the whole of the transform: the caller does
 * nothing but store what comes out.
 *
 * NULL IS AN ILLEGAL MOVE, and it is the only reason this returns null. The board is the thing
 * that decides whether a gesture may be made at all (`shared/board-authority.ts`); this decides
 * only whether it is a move.
 */
export function applyMoveAt(
  history: readonly GameSnapshot[],
  at: { ply: number; fen: string },
  from: string,
  to: string,
): { history: GameSnapshot[]; ply: number; san: string } | null {
  const game = new Chess(at.fen);
  try {
    const move = game.move({ from, to, promotion: "q" });
    const ply = at.ply + 1;
    return {
      history: [
        ...history.slice(0, ply),
        { ply, san: move.san, from: move.from, to: move.to, color: move.color, fen: game.fen() },
      ],
      ply,
      san: move.san,
    };
  } catch {
    return null;
  }
}

/** What the board is worth, per side, counted from the pieces standing on it. */
export interface Material {
  white: number;
  black: number;
}

/**
 * COUNTED FROM THE BOARD, NOT FROM THE ENGINE, and that is the whole point of it living here.
 *
 * `AnalysisPanel` labels this value's provenance "נספר מהלוח" -- a player-side count, not an
 * evaluation -- so it must stay derivable with no search, no wasm and no network. Keeping it in
 * the same file as the position itself is what makes that checkable at a glance.
 *
 * The values are the textbook ones. They are not a claim about the position: two rooks against a
 * queen is not a decided game, and nothing downstream reads this as an assessment.
 */
export function countMaterial(board: ReturnType<Chess["board"]>): Material {
  const values: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  return board.flat().reduce<Material>(
    (total, piece) => {
      if (piece) total[piece.color === "w" ? "white" : "black"] += values[piece.type];
      return total;
    },
    { white: 0, black: 0 },
  );
}
