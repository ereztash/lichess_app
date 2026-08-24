/**
 * THE COMMITMENT SCREEN (section 4.1).
 *
 * The player states a move, what they can read in the position, what they cannot evaluate, and a
 * confidence 1-5. NOTHING from the engine is on screen, in the DOM, or in the network tab while
 * this is mounted.
 *
 * This is not a training gimmick. An engine knows what the position needed; it has no idea what
 * the player was choosing between, or why, or under what constraint. This screen is the only
 * moment that variable is observable, which is why R3 is the whole product.
 *
 * The two reads used to be free-text fields, both mandatory. Reported as "the move is blocked,
 * it asks me to fill in forms -- these should be options, not forced writing", and that is
 * right: it is roughly forty written sentences per game, which is why a game does not get
 * finished. They are selectable now, with writing kept as an addition rather than the price of
 * entry. What the requirement is FOR is the ordering -- a stated read before the engine speaks
 * -- and one tap states a read. Nothing measures the words: shared/detector.ts buckets on time,
 * phase and clock and never reads `known` or `unknown` at all, so this weakens no gate.
 *
 * Still required, though, and still with nothing preselected. A commitment with nothing stated
 * would make R3 decorative, and a default option would be the machine putting a read in the
 * player's mouth and then measuring them against it.
 */
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Pencil, Timer } from "lucide-react";
import {
  draftProblems,
  emptyDraft,
  isCommittable,
  type DraftDecision,
  type PositionUnderDecision,
} from "@/lib/decision-session";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS, type ReadOption } from "@/lib/read-options";
import { scrollIntoViewRespectingMotion } from "@/lib/motion";
import { foremostTension } from "@/lib/declared-tensions";
import type { CommitFailureText } from "@/lib/commit-error";

interface CommitmentScreenProps {
  position: PositionUnderDecision;
  /** The move the player has selected on the board, in UCI, or null. */
  chosenMove: string | null;
  /** Other moves the player looked at before choosing. */
  candidatesConsidered: string[];
  onCommit: (draft: DraftDecision, secondsTaken: number) => void;
  pending: boolean;
  error?: CommitFailureText;
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
  /*
   * The clock reading at the moment confidence was STATED, not the live one.
   *
   * A tension that says "you said 5/5 after six seconds" is about the moment they said it. Read
   * off the ticking counter instead, the sentence rewrites itself every second and then deletes
   * itself at ten -- a question that vanishes while it is being read.
   */
  const [confidenceStatedAt, setConfidenceStatedAt] = useState<number | null>(null);
  // Time-to-decide starts when the position is presented, not when typing starts.
  const startedAt = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    startedAt.current = Date.now();
    setDraft(emptyDraft());
    setShowProblems(false);
    setConfidenceStatedAt(null);
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
  /* Derived from what the player said and nothing else -- no engine input reaches this screen. */
  const tension = foremostTension(live, confidenceStatedAt ?? elapsed);

  /*
   * The refusal has to arrive somewhere the player is looking.
   *
   * Reported as "I still cannot complete the move", with a screenshot showing a chosen move, one
   * field filled, the second empty, and 34 seconds on the clock. The rule is right -- a partial
   * decision is not recorded, and that IS the product -- but the enforcement was invisible: the
   * button stayed enabled, clicking it only set a flag, and both the per-field messages and the
   * summary render BELOW the button, which on a laptop window is below the fold. The click looked
   * like nothing happened at all.
   */
  const firstProblem = useRef<HTMLDivElement>(null);
  const submit = () => {
    if (!ready) {
      setShowProblems(true);
      // Deliberate, and unlike the move-rail case this scroll is what the player asked for by
      // clicking: it happens on an explicit action, never on load.
      window.requestAnimationFrame(() => {
        const target = firstProblem.current;
        // Smooth unless the player asked their system for less motion; the CSS property does not
        // reach an explicit `behavior` argument, so the setting is read in lib/motion.ts. The
        // helper keeps main's optional call: jsdom has no scrollIntoView, and this path runs in
        // the commit-blocked tests.
        if (target) scrollIntoViewRespectingMotion(target, { block: "center" });
        target?.querySelector<HTMLElement>("button, textarea")?.focus();
      });
      return;
    }
    onCommit(live, (Date.now() - startedAt.current) / 1000);
  };

  /** Which field the refusal should take you to, and what the button should say instead. */
  const missing = problems[0];
  const MISSING_LABEL: Record<string, string> = {
    chosenMove: "בחרו מהלך על הלוח",
    known: "סמנו מה אתם קוראים בעמדה",
    unknown: "סמנו מה אי אפשר להעריך",
    confidence: "בחרו רמת ביטחון",
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
        בחרו מהלך על הלוח וסמנו את הקריאה שלכם. המנוע לא ידבר לפני שההחלטה נרשמה — זו כל הנקודה.
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

      <ReadField
        legend="מה אתם קוראים בעמדה"
        hint="בחרו כמה שרוצים"
        options={KNOWN_OPTIONS}
        selected={draft.knownTags}
        onToggle={(label) =>
          setDraft((d) => ({ ...d, knownTags: toggle(d.knownTags, label) }))
        }
        text={draft.known}
        onText={(known) => setDraft((d) => ({ ...d, known }))}
        textPlaceholder="למשל: היתרון שלי הוא בכנף המלכה"
        problem={problemFor("known")}
        containerRef={missing?.field === "known" ? firstProblem : undefined}
        pending={pending}
        id="known"
      />

      <ReadField
        legend="מה אתם לא יכולים להעריך"
        hint="בחרו כמה שרוצים"
        options={UNKNOWN_OPTIONS}
        selected={draft.unknownTags}
        onToggle={(label) =>
          setDraft((d) => ({ ...d, unknownTags: toggle(d.unknownTags, label) }))
        }
        text={draft.unknown}
        onText={(unknown) => setDraft((d) => ({ ...d, unknown }))}
        textPlaceholder="למשל: לא יודע אם הקורבן על f7 עובד"
        problem={problemFor("unknown")}
        containerRef={missing?.field === "unknown" ? firstProblem : undefined}
        pending={pending}
        id="unknown"
      />

      <fieldset className="commitment-field commitment-confidence" disabled={pending}>
        <legend>
          כמה אתם בטוחים <span className="required-mark">חובה</span>
        </legend>
        <div className="confidence-row" dir="ltr">
          {[1, 2, 3, 4, 5].map((level) => (
            <button
              key={level}
              type="button"
              className={draft.confidence === level ? "selected" : ""}
              /*
               * The name CONTAINS the visible text, which is what WCAG 2.5.3 asks and what axe
               * reports as label-content-name-mismatch when it fails. The button reads "1" over
               * "ניחוש"; the name has to have that pair in it, in that order, spelled the same.
               * The em dash used to sit between them and broke the match, so someone using voice
               * control could say what they saw and not be understood.
               */
              aria-label={`ביטחון ${level} ${CONFIDENCE_LABELS[level]}`}
              aria-pressed={draft.confidence === level}
              onClick={() => {
                setConfidenceStatedAt((Date.now() - startedAt.current) / 1000);
                setDraft((d) => ({ ...d, confidence: level }));
              }}
            >
              <b>{level}</b>{" "}
              <small>{CONFIDENCE_LABELS[level]}</small>
            </button>
          ))}
        </div>
        {problemFor("confidence") && (
          <p className="commitment-problem">{problemFor("confidence")}</p>
        )}
      </fieldset>

      {/*
        * A question about what the player just said, not a verdict and not a blocker: the submit
        * control below is unaffected, and a decision that states a tension records exactly as it
        * stands. `role="status"` rather than `alert` for the same reason -- nothing is wrong.
        */}
      {tension && (
        <aside className="commitment-tension" role="status" aria-label="שאלה על ההצהרה שלך">
          <p className="commitment-tension-question">{tension.question}</p>
          <p className="commitment-tension-basis">
            {tension.basis} · לא חוסם רישום
          </p>
        </aside>
      )}

      {error && (
        <p className="commitment-error" role="alert">
          <CircleAlert size={14} /> {error.message}
          {/*
            * Kept and demoted, as ErrorBoundary does with a stack. Removing it would leave a
            * failure nobody can report; leading with it puts English technical text at the top
            * of a Hebrew screen.
            */}
          {error.detail && (
            <details>
              <summary>פרטים טכניים</summary>
              <code dir="ltr">{error.detail}</code>
            </details>
          )}
        </p>
      )}

      {/*
        * Not `disabled`. A disabled button explains nothing, cannot be focused, and gives a
        * screen reader nothing to read -- so the label carries the reason instead, and it is
        * there BEFORE the first click rather than only after one.
        */}
      <button
        type="button"
        className={`commitment-submit ${ready ? "" : "not-ready"}`}
        onClick={submit}
        /* PENDING ACTION LOCK (section 4.3): disabled while the write is in flight. */
        disabled={pending}
        aria-describedby={ready ? undefined : "commit-blocked"}
      >
        <Check size={16} />{" "}
        {pending
          ? "רושם החלטה…"
          : ready
            ? "רשמו את ההחלטה"
            : `חסר: ${MISSING_LABEL[missing.field] ?? "פרט"}`}
      </button>

      {!ready && !pending && (
        <p className="commitment-summary" id="commit-blocked">
          {problems.length === 1
            ? "חסר פרט אחד. החלטה חלקית לא נרשמת — זה הכלל, לא תקלה."
            : `חסרים ${problems.length} פרטים. החלטה חלקית לא נרשמת — זה הכלל, לא תקלה.`}
        </p>
      )}
    </section>
  );
}

/** Add or remove one label, preserving the order they were chosen in. */
function toggle(current: string[], label: string): string[] {
  return current.includes(label) ? current.filter((l) => l !== label) : [...current, label];
}

interface ReadFieldProps {
  legend: string;
  hint: string;
  options: ReadOption[];
  selected: string[];
  onToggle: (label: string) => void;
  text: string;
  onText: (value: string) => void;
  textPlaceholder: string;
  problem?: string;
  containerRef?: React.Ref<HTMLDivElement>;
  pending: boolean;
  id: string;
}

/**
 * One read: options to tap, and a box to write in if the options do not cover it.
 *
 * The writing box starts collapsed. Open by default it would read as the real field with the
 * chips as a shortcut, which is the arrangement that made a game unfinishable; collapsed, it is
 * what it should be -- available for the position the menu cannot describe.
 */
function ReadField({
  legend,
  hint,
  options,
  selected,
  onToggle,
  text,
  onText,
  textPlaceholder,
  problem,
  containerRef,
  pending,
  id,
}: ReadFieldProps) {
  // Stays open once opened, and once something is typed it cannot hide the text it holds.
  const [writing, setWriting] = useState(false);
  const open = writing || text.length > 0;

  return (
    <div className={`commitment-field ${problem ? "has-problem" : ""}`} ref={containerRef}>
      <fieldset className="read-field" disabled={pending}>
        <legend>
          {legend} <span className="required-mark">חובה</span>
          <small>{hint}</small>
        </legend>
        <div className="read-options">
          {options.map((option) => {
            const on = selected.includes(option.label);
            return (
              <button
                key={option.id}
                type="button"
                className={`read-chip ${on ? "selected" : ""}`}
                aria-pressed={on}
                onClick={() => onToggle(option.label)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {open ? (
          <>
            <label className="read-write-label" htmlFor={`commit-${id}`}>
              במילים שלכם
            </label>
            <textarea
              id={`commit-${id}`}
              maxLength={200}
              rows={2}
              value={text}
              placeholder={textPlaceholder}
              onChange={(e) => onText(e.target.value)}
            />
            <span className="commitment-count">{text.length}/200</span>
          </>
        ) : (
          <button type="button" className="read-write-toggle" onClick={() => setWriting(true)}>
            <Pencil size={12} /> להוסיף במילים שלכם
          </button>
        )}
      </fieldset>
      {problem && <p className="commitment-problem">{problem}</p>}
    </div>
  );
}
