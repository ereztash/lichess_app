/**
 * CONTROL for GATE-BOARD-AUTHORITY. Not shipped, not imported by anything.
 *
 * The defect it reproduces is the one measured on `Home.tsx`: a board that accepts a gesture in
 * every state. It typechecks -- the prop is present and its value is a member of the vocabulary --
 * which is exactly why the compiler cannot be the whole gate. A constant authority is a board that
 * will accept a move for either side after the decision is on the record.
 */
import { ChessBoard } from "@/components/ChessBoard";

export function BoardThatAlwaysAccepts() {
  return (
    <ChessBoard
      board={[]}
      orientation="w"
      authority="propose"
      legalTargets={[]}
      onSelect={() => undefined}
      onMove={() => undefined}
    />
  );
}
