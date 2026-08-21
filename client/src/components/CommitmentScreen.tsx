/**
 * THE COMMITMENT SCREEN (section 4.1).
 *
 * The player enters a move, a one-line read of what the position needs, what they cannot
 * evaluate here, and a confidence 1-5. NOTHING from the engine is on screen, in the DOM, or in
 * the network tab while this is mounted.
 *
 * This is not a training gimmick. An engine knows what the position needed; it has no idea what
 * the player was choosing between, or why, or under what constraint. This screen is the only
 * moment that variable is observable, which is why R3 is the whole product.
 */
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Timer } from "lucide-react";
import {
  draftProblems,
  emptyDraft,
  isCommittable,
  type DraftDecision,
  type PositionUnderDecision,
} from "@/lib/decision-session";

interface CommitmentScreenProps {
  position: PositionUnderDecision;
  /** The move the player has selected on the board, in UCI, or null. */
  chosenMove: string | null;
  /** Other moves the player looked at before choosing. */
  candidatesConsidered: string[];
  onCommit: (draft: DraftDecision, secondsTaken: number) => void;
  pending: boolean;
  error?: string;
}

const CONFIDENCE_LABELS: Record<number, string> = {
  1: "ניחוש",
  2: "נוטה",
  3: "סביר",
  4: "בטוח",
  5: "ודאי",
};

export function CommitmentScreen({
  position,
  chosenMove,
  candidatesConsidered,
  onCommit,
  pending,
  error,
}: CommitmentScreenProps) {
  const [draft, setDraft] = useState<DraftDecision>(emptyDraft);
  const [showProblems, setShowProblems] = useState(false);
  // Time-to-decide starts when the position is presented, not when typing starts.
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startedAt.current = Date.now();
    setDraft(emptyDraft());
    setShowProblems(false);
    setElapsed(0);
  }, [position.fen, position.ply]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const live: DraftDecision = { ...draft, chosenMove, candidatesConsidered };
  const problems = draftProblems(live);
  const ready = isCommittable(live);

  const submit = () => {
    if (!ready) {
      setShowProblems(true);
      return;
    }
    onCommit(live, (Date.now() - startedAt.current) / 1000);
  };

  const problemFor = (field: keyof DraftDecision) =>
    showProblems ? problems.find((p) => p.field === field)?.message : undefined;

  return (
    <section className="commitment-screen" aria-label="מסך התחייבות">
      <header className="commitment-header">
        <div>
          <p className="commitment-kicker">החלטה</p>
          <h2>מה העמדה הזו דורשת?</h2>
        </div>
        <span className="commitment-timer" aria-label={`זמן שחלף ${elapsed} שניות`}>
          <Timer size={14} /> {elapsed}s
        </span>
      </header>

      <p className="commitment-intro">
        בחרו מהלך על הלוח וכתבו את הקריאה שלכם. המנוע לא ידבר לפני שההחלטה נרשמה — זו כל הנקודה.
      </p>

      <div className="commitment-field">
        <label htmlFor="commit-move">המהלך שבחרתם</label>
        <output id="commit-move" className={`commitment-move ${chosenMove ? "set" : "unset"}`}>
          {chosenMove ?? "בחרו מהלך על הלוח"}
        </output>
        {problemFor("chosenMove") && (
          <p className="commitment-problem">{problemFor("chosenMove")}</p>
        )}
      </div>

      <div className="commitment-field">
        <label htmlFor="commit-known">מה אתם כן יכולים לקרוא כאן</label>
        <textarea
          id="commit-known"
          maxLength={200}
          rows={2}
          value={draft.known}
          disabled={pending}
          placeholder="למשל: המרכז סגור, היתרון שלי הוא בכנף המלכה"
          onChange={(e) => setDraft((d) => ({ ...d, known: e.target.value }))}
        />
        <span className="commitment-count">{draft.known.length}/200</span>
        {problemFor("known") && <p className="commitment-problem">{problemFor("known")}</p>}
      </div>

      <div className="commitment-field">
        <label htmlFor="commit-unknown">מה אתם לא יכולים להעריך כאן</label>
        <textarea
          id="commit-unknown"
          maxLength={200}
          rows={2}
          value={draft.unknown}
          disabled={pending}
          placeholder="למשל: לא יודע אם הקורבן על f7 עובד"
          onChange={(e) => setDraft((d) => ({ ...d, unknown: e.target.value }))}
        />
        <span className="commitment-count">{draft.unknown.length}/200</span>
        {problemFor("unknown") && <p className="commitment-problem">{problemFor("unknown")}</p>}
      </div>

      <fieldset className="commitment-field commitment-confidence" disabled={pending}>
        <legend>כמה אתם בטוחים</legend>
        <div className="confidence-row" dir="ltr">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              className={draft.confidence === level ? "selected" : ""}
              aria-label={`ביטחון ${level} — ${CONFIDENCE_LABELS[level]}`}
              aria-pressed={draft.confidence === level}
              onClick={() => setDraft((d) => ({ ...d, confidence: level }))}
            >
              <b>{level}</b>
              <small>{CONFIDENCE_LABELS[level]}</small>
            </button>
          ))}
        </div>
        {problemFor("confidence") && (
          <p className="commitment-problem">{problemFor("confidence")}</p>
        )}
      </fieldset>

      {error && (
        <p className="commitment-error" role="alert">
          <CircleAlert size={14} /> {error}
        </p>
      )}

      <button
        type="button"
        className="commitment-submit"
        onClick={submit}
        /* PENDING ACTION LOCK (section 4.3): disabled while the write is in flight. */
        disabled={pending}
      >
        <Check size={16} /> {pending ? "רושם החלטה…" : "רשמו את ההחלטה"}
      </button>

      {showProblems && problems.length > 0 && (
        <p className="commitment-summary">חסרים {problems.length} פרטים. החלטה חלקית לא נרשמת.</p>
      )}
    </section>
  );
}
