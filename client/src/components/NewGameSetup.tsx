/**
 * Choosing a side, and how deep the opponent searches.
 *
 * "משחק חדש" used to start a game with nobody on the other side of the board, so there was
 * nothing to choose. Now there is: which colour is yours, and how hard the opponent looks.
 */
import { OPPONENT_DEPTHS, type OpponentDepth } from "@/lib/opponent";
import type { RevealTiming } from "@shared/reveal-timing";

/**
 * The two conditions, described by what they DO rather than by which is better.
 *
 * Nothing in this product measures which one produces a truer reading of a player, and R1 does
 * not allow a claim wider than its measurement -- so neither is recommended, neither is called
 * "accurate", and the difference is stated as a fact about when the engine talks.
 */
const TIMING_LABEL: Record<RevealTiming, string> = {
  "per-decision": "אחרי כל החלטה",
  "end-of-game": "בסוף המשחק",
};

const TIMING_NOTE: Record<RevealTiming, string> = {
  "per-decision":
    "אחרי כל החלטה תראו מה המנוע חשב. במשחק שלם, כל החלטה מהשנייה והלאה נעשית אחרי שהמנוע כבר תיקן אתכם.",
  "end-of-game": "המנוע שותק עד סוף המשחק. הכול נרשם ונמדד כרגיל, רק בלי לראות כלום עד הסוף.",
};

interface NewGameSetupProps {
  color: "w" | "b";
  depth: OpponentDepth;
  revealTiming: RevealTiming;
  onColor: (color: "w" | "b") => void;
  onDepth: (depth: OpponentDepth) => void;
  onRevealTiming: (timing: RevealTiming) => void;
  onStart: () => void;
  onCancel: () => void;
}

export function NewGameSetup({
  color,
  depth,
  revealTiming,
  onColor,
  onDepth,
  onRevealTiming,
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
        <p className="setup-note">עומק חיפוש של Stockfish, לא דירוג.</p>
      </fieldset>

      <fieldset className="setup-field">
        <legend>מתי המנוע מדבר</legend>
        <div className="color-toggle">
          {(Object.keys(TIMING_LABEL) as RevealTiming[]).map((timing) => (
            <button
              key={timing}
              className={revealTiming === timing ? "selected" : ""}
              aria-pressed={revealTiming === timing}
              onClick={() => onRevealTiming(timing)}
            >
              {TIMING_LABEL[timing]}
            </button>
          ))}
        </div>
        <p className="setup-note">{TIMING_NOTE[revealTiming]}</p>
        {/*
         * SAID HERE BECAUSE IT IS THE REASON THE CHOICE EXISTS, and because a person deciding
         * between two conditions is entitled to know the record keeps them apart.
         */}
        <p className="setup-note">הבחירה נרשמת על כל החלטה, ושתי האפשרויות לא מתערבבות בחישוב.</p>
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
