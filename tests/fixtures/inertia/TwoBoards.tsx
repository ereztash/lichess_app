/**
 * CONTROL for GATE-ONE-BOARD-ONE-STORY. Not shipped, not imported by anything.
 *
 * `Blitz.tsx` rendered a second board inside its post-game review, so a position from the game the
 * player had just finished appeared on a different element in a different place from the one they
 * had played it on. Two boards is two answers to "where am I".
 *
 * ITS BOARDS DECLARE `authority="none"`, which is the one constant `GATE-BOARD-AUTHORITY` allows,
 * so that this fixture reddens its own gate and not the one beside it. A control red for another
 * control's reason proves nothing -- the same argument that split `GATE-ONE-PRIMARY-ACTION` from
 * `GATE-NO-DUPLICATE-ACTION`.
 */
import { ChessBoard } from "@/components/ChessBoard";

export function TwoBoards() {
  return (
    <div>
      <ChessBoard board={[]} orientation="w" authority="none" legalTargets={[]} onSelect={() => undefined} onMove={() => undefined} />
      <section className="review">
        <ChessBoard board={[]} orientation="w" authority="none" legalTargets={[]} onSelect={() => undefined} onMove={() => undefined} />
      </section>
    </div>
  );
}
