/**
 * CONTROL for GATE-ONE-BOARD-ONE-STORY. Not shipped, not imported by anything.
 *
 * `Blitz.tsx` rendered a second board inside its post-game review, so a position from the game the
 * player had just finished appeared on a different element in a different place from the one they
 * had played it on. Two boards is two answers to "where am I".
 */
import { ChessBoard } from "@/components/ChessBoard";

export function TwoBoards() {
  return (
    <div>
      <ChessBoard board={[]} orientation="w" onSelect={() => undefined} onMove={() => undefined} />
      <section className="review">
        <ChessBoard board={[]} orientation="w" onSelect={() => undefined} onMove={() => undefined} />
      </section>
    </div>
  );
}
