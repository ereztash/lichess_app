import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef } from "react";
import type { GameSnapshot } from "@/lib/game-data";
interface Props {
  moves: GameSnapshot[];
  currentPly: number;
  onNavigate: (ply: number) => void;
}
export function MoveTimeline({ moves, currentPly, onNavigate }: Props) {
  const go = (ply: number) => onNavigate(Math.min(Math.max(-1, ply), moves.length - 1));

  /*
   * Keep the move you are on inside the rail.
   *
   * The rail scrolls horizontally and never scrolled itself: measured on a 390px phone with a
   * nine-move game, scrollWidth 1260 against a 242px window and scrollLeft pinned at 0, so the
   * active move sat about a thousand pixels out of view. The rail was showing the opening of a
   * game while the board showed move seven, and nothing on screen said so.
   */
  const activeRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const cell = activeRef.current;
    const rail = railRef.current;
    if (!cell || !rail) return;
    /*
     * Scroll the RAIL, never the page.
     *
     * scrollIntoView was the obvious call and it is the wrong one: it walks up every scrollable
     * ancestor, so the document itself scrolled to bring the rail into view. Measured on load:
     * 122px down on a desktop and 646px on a phone, which opened the app below its own header
     * with most of the board above the fold. Adjusting scrollLeft touches one element.
     */
    const railBox = rail.getBoundingClientRect();
    const cellBox = cell.getBoundingClientRect();
    rail.scrollLeft += cellBox.left + cellBox.width / 2 - (railBox.left + railBox.width / 2);
  }, [currentPly, moves.length]);
  return (
    <section className="move-timeline" aria-label="ציר מהלכים">
      <div className="timeline-title">
        <span>מסילת מהלכים</span>
        {/* dir="ltr": in an RTL container a bare "7 / 9" renders as "9 / 7", which reads as
            the wrong move number entirely. */}
        <b dir="ltr">
          {currentPly >= 0
            ? `${Math.ceil((currentPly + 1) / 2)} / ${Math.ceil(moves.length / 2)}`
            : "תחילה"}
        </b>
      </div>
      <div className="timeline-controls" dir="ltr">
        <button aria-label="לתחילת המשחק" title="לתחילת המשחק" onClick={() => go(-1)}>
          <SkipBack size={16} />
        </button>
        <button aria-label="המהלך הקודם" title="המהלך הקודם" onClick={() => go(currentPly - 1)}>
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="moves-rail" dir="ltr" ref={railRef}>
        {moves.length ? (
          moves.map((move) => (
            <button
              key={`${move.ply}-${move.san}`}
              ref={move.ply === currentPly ? activeRef : undefined}
              className={`move-cell ${move.color} ${move.ply === currentPly ? "active" : ""}`}
              aria-current={move.ply === currentPly ? "true" : undefined}
              onClick={() => go(move.ply)}
            >
              {move.color === "w" && (
                <span className="move-number">{Math.ceil((move.ply + 1) / 2)}.</span>
              )}
              <span>{move.san}</span>
            </button>
          ))
        ) : (
          <span className="empty-moves">הלוח מוכן למהלך הראשון.</span>
        )}
      </div>
      <div className="timeline-controls" dir="ltr">
        <button aria-label="המהלך הבא" title="המהלך הבא" onClick={() => go(currentPly + 1)}>
          <ChevronRight size={18} />
        </button>
        <button aria-label="לסוף המשחק" title="לסוף המשחק" onClick={() => go(moves.length - 1)}>
          <SkipForward size={16} />
        </button>
      </div>
    </section>
  );
}
