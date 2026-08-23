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

export const PIECES: Record<"w" | "b", Record<string, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
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
