import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react";
import type { GameSnapshot } from "@/lib/game-data";
interface Props {
  moves: GameSnapshot[];
  currentPly: number;
  onNavigate: (ply: number) => void;
}
export function MoveTimeline({ moves, currentPly, onNavigate }: Props) {
  const go = (ply: number) => onNavigate(Math.min(Math.max(-1, ply), moves.length - 1));
  return (
    <section className="move-timeline" aria-label="ציר מהלכים">
      <div className="timeline-title">
        <span>מסילת מהלכים</span>
        <b>
          {currentPly >= 0
            ? `${Math.ceil((currentPly + 1) / 2)} / ${Math.ceil(moves.length / 2)}`
            : "תחילה"}
        </b>
      </div>
      <div className="timeline-controls" dir="ltr">
        <button onClick={() => go(-1)}>
          <SkipBack size={16} />
        </button>
        <button onClick={() => go(currentPly - 1)}>
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="moves-rail" dir="ltr">
        {moves.length ? (
          moves.map((move) => (
            <button
              key={`${move.ply}-${move.san}`}
              className={`move-cell ${move.color} ${move.ply === currentPly ? "active" : ""}`}
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
        <button onClick={() => go(currentPly + 1)}>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => go(moves.length - 1)}>
          <SkipForward size={16} />
        </button>
      </div>
    </section>
  );
}
