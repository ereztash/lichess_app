/**
 * Choosing a side, and how deep the opponent searches.
 *
 * "משחק חדש" used to start a game with nobody on the other side of the board, so there was
 * nothing to choose. Now there is: which colour is yours, and how hard the opponent looks.
 */
import { OPPONENT_DEPTHS, type OpponentDepth } from "@/lib/opponent";

interface NewGameSetupProps {
  color: "w" | "b";
  depth: OpponentDepth;
  onColor: (color: "w" | "b") => void;
  onDepth: (depth: OpponentDepth) => void;
  onStart: () => void;
  onCancel: () => void;
}

export function NewGameSetup({
  color,
  depth,
  onColor,
  onDepth,
  onStart,
  onCancel,
}: NewGameSetupProps) {
  return (
    <section className="new-game-setup">
      <h3>משחק חדש</h3>

      <fieldset className="setup-field">
        <legend>באיזה צבע אתם משחקים</legend>
        <div className="color-toggle">
          <button
            className={color === "w" ? "selected" : ""}
            aria-pressed={color === "w"}
            onClick={() => onColor("w")}
          >
            לבן
          </button>
          <button
            className={color === "b" ? "selected" : ""}
            aria-pressed={color === "b"}
            onClick={() => onColor("b")}
          >
            שחור
          </button>
        </div>
      </fieldset>

      <fieldset className="setup-field">
        <legend>עומק החיפוש של היריב</legend>
        <div className="depth-row">
          {OPPONENT_DEPTHS.map((value) => (
            <button
              key={value}
              className={depth === value ? "selected" : ""}
              aria-pressed={depth === value}
              onClick={() => onDepth(value)}
            >
              {value}
            </button>
          ))}
        </div>
        {/*
         * A depth, stated as a depth. Nothing here measures what rating a given depth plays at,
         * and R1 does not allow a claim wider than its measurement -- so this says how far the
         * engine looks and stops there.
         */}
        <p className="setup-note">
          זהו עומק חיפוש של Stockfish, לא דירוג. אין כאן מדידה שקושרת עומק לרייטינג, ולכן לא
          נאמר לכם באיזו רמה היריב משחק.
        </p>
      </fieldset>

      <div className="setup-actions">
        <button className="primary-control" onClick={onStart}>
          התחילו לשחק
        </button>
        <button className="ghost-control" onClick={onCancel}>
          ביטול
        </button>
      </div>
    </section>
  );
}
