/**
 * THE COMMITMENT SCREEN (section 4.1).
 *
 * The player states a move, what they can read in the position, what they cannot evaluate, and a
 * confidence on the seven-level scale. NOTHING from the engine is on screen, in the DOM, or in the network tab while
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
 *
 * ONE QUESTION AT A TIME, and that is the second report this panel has answered.
 *
 * All four requirements used to open at once, which measured, in a browser, as a 952px panel
 * inside a 900px window -- so the button was at the very edge on a laptop and the strip under it
 * naming what was missing was clipped at every standard height. On a phone it was worse: the
 * board began at y=240 and the move field at y=1085, so the FIRST thing the player is asked to do
 * needed 241px of scrolling to see. A screen that shows a board and hides the question reads as a
 * board.
 *
 * So the four are an accordion: one open, the rest collapsed to a line that names the step and
 * shows the answer once there is one. Nothing is removed and nothing is hidden -- every step is a
 * button, every option is one tap away, and the whole shape of the ask is visible from the first
 * frame, which a wizard that reveals steps one by one would not be.
 *
 * NO CLOCK IS SHOWN WHILE THE DECISION IS BEING MADE, and that is a measurement rule rather
 * than a matter of taste.
 *
 * A running seconds counter used to sit in this header. `secondsTaken` is not incidental
 * telemetry -- it is a detector variable, and `fast-under-45s` (`shared/detector.ts`) is the
 * bucket the product's own worked example is written about. Showing a player the number being
 * read off them invites them to manage it, and a bucket whose members were told their time as
 * they decided is no longer a fact about the player: it is a fact about the player and the
 * counter. The README states the rule for the adaptation layer -- the interface may not react to
 * decision speed, because that puts the intervention inside the measurement -- and the screen
 * where the variable is actually generated has more reason to obey it than any other, not less.
 *
 * The clock is still READ: `startedAt` is stamped when the position is presented and the elapsed
 * time is computed at commit. What went is the display, not the recording -- nobody is told the
 * number while it is still theirs to change.
 *
 * WHAT DOES NOT AUTO-ADVANCE, and why the inconsistency is deliberate. Choosing a move is one
 * act, so the move step advances by itself. The two read steps are multi-select -- their own hint
 * says "choose as many as you like" -- and advancing on the first tap would make one tap the
 * normal amount. That is the same inducement that got a count next to the candidate moves
 * refused: the interface would be shaping the record rather than holding it. They advance on an
 * explicit "next", or on tapping any other step's header.
 */
import { CONFIDENCE_CHOICES, CONFIDENCE_LABELS } from "@shared/confidence";
import { recordAttempt } from "@/lib/progress-record";
import { confidenceIsAsked, readsAreAsked, type DecisionContext } from "@shared/confidence-asked";
import { useEffect, useRef, useState } from "react";
import { Check, CircleAlert, CircleDashed, Pencil } from "lucide-react";
import {
  draftProblems,
  emptyDraft,
  isCommittable,
  statedKnown,
  statedUnknown,
  type DraftDecision,
  type PositionUnderDecision,
} from "@/lib/decision-session";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS, type ReadOption } from "@/lib/read-options";
import { scrollIntoViewRespectingMotion } from "@/lib/motion";
import { foremostTension } from "@/lib/declared-tensions";
import type { CommitFailureText } from "@/lib/commit-error";
import { primaryAction } from "@shared/primary-action";

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

/** The four requirements, in the order the decision actually happens. */
type StepId = "chosenMove" | "known" | "unknown" | "confidence";
const ALL_STEPS: StepId[] = ["chosenMove", "known", "unknown", "confidence"];

/**
 * The steps THIS position asks for.
 *
 * The confidence question was on every decision, so a game against the app was forty of them --
 * reported as the reason a game does not get finished, and it is a measurement problem wearing a
 * UX complaint: an instrument too expensive to use produces no readings. It is asked now exactly
 * where a measurement reads the answer (`shared/confidence-asked.ts`), and everywhere else the
 * step is ABSENT rather than optional. Absent, because an optional question is answered by
 * whoever feels like answering, which makes the confidence data a sample the player curated on
 * the very variable being measured.
 */
const stepsFor = (context: DecisionContext): StepId[] =>
  confidenceIsAsked(context)
    ? ALL_STEPS
    : /*
       * A DECISION IS FULLY INSTRUMENTED OR IT IS A MOVE. When the draw passes a position over,
       * nothing will read a confidence stated on it and nothing will read the words either -- so
       * asking for the words anyway charges two of the three steps for nothing. Reported from
       * actual play as the reason a game is not worth finishing, which is a measurement problem
       * wearing a complaint: an instrument nobody completes produces no readings.
       */
      ALL_STEPS.filter((step) => step === "chosenMove" || readsAreAsked(context));

const STEP_LEGEND: Record<StepId, string> = {
  chosenMove: "המהלך שבחרתם",
  known: "מה אתם קוראים בעמדה",
  unknown: "מה אתם לא יכולים להעריך",
  confidence: "כמה אתם בטוחים",
};

/** What the button says instead of "record" while something is missing. */
const MISSING_LABEL: Record<StepId, string> = {
  chosenMove: "בחרו מהלך על הלוח",
  known: "סמנו מה אתם קוראים בעמדה",
  unknown: "סמנו מה אי אפשר להעריך",
  confidence: "בחרו רמת ביטחון",
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
  const [openStep, setOpenStep] = useState<StepId | null>("chosenMove");
  /*
   * Time-to-decide starts when the position is presented, not when typing starts.
   *
   * Read at commit for `secondsTaken` and by the attempt log, and rendered never. Nothing on this
   * screen branches on it either -- see the module note on why the clock is neither shown to the
   * player nor read by the question layer.
   */
  const startedAt = useRef<number>(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    setDraft(emptyDraft());
    setShowProblems(false);
    setOpenStep("chosenMove");
  }, [position.fen, position.ply]);

  const live: DraftDecision = { ...draft, chosenMove, candidatesConsidered };
  /* What this position asks for. Absent steps are not optional ones -- see `stepsFor`. */
  const STEPS = stepsFor(position);
  /*
   * DERIVED FROM THE LIST, not asked of the rule a second time.
   *
   * These were two independent gates -- the list filtered by `stepsFor`, the block rendered behind
   * its own `confidenceIsMeasured` call -- and a positive control caught it: deleting the filter
   * from `stepsFor` changed nothing observable, because the second gate still hid the block. A
   * rule with a redundant enforcement point has one that is dead, and dead enforcement is worse
   * than none: it reads like a guard while guarding nothing, and the day the live one moves it
   * will not catch anything either.
   */
  const asksConfidence = STEPS.includes("confidence");
  /*
   * THE SAME DERIVATION FOR THE TWO READ FIELDS, and they did not have one.
   *
   * `confidence` was gated in both places -- the list and the markup -- while `known` and
   * `unknown` were rendered unconditionally. So when `stepsFor` stopped listing them, the
   * navigation list dropped them and the screen went on drawing all three steps: the player still
   * answered them, and only the trial log knew they were not supposed to be there. That is the
   * two-gate defect this file already carries a test for, found again from the other side.
   */
  const asksReads = STEPS.includes("known");
  const problems = draftProblems(live, position);
  const ready = isCommittable(live, position);
  /* Derived from what the player said and nothing else -- not the engine, and not the clock. */
  const tension = foremostTension(live);

  const done: Record<StepId, boolean> = {
    chosenMove: Boolean(chosenMove),
    known: statedKnown(live).length > 0,
    unknown: statedUnknown(live).length > 0,
    confidence: draft.confidence !== null,
  };

  /*
   * HOW FAR THIS PASS GOT, for the trial rather than for the record.
   *
   * A tester who fills three steps and leaves is, in every record this app keeps, identical to a
   * tester who never opened the screen. That is the one thing a five-person trial cannot afford
   * not to see. Nothing here reaches the decision path: it is written and never read back, and a
   * test holds that over the imports.
   *
   * The step ids come from `STEPS` above rather than from a list of their own, so a step that
   * leaves the screen -- a confidence question that stops being asked in free play, say -- leaves
   * this too, instead of being reported as permanently unanswered.
   */
  /*
   * ONE COMMIT PER GESTURE, AND THE GUARD IS SYNCHRONOUS. The button is `disabled={pending}`, but
   * `pending` arrives through a state update, so the second press of a double-tap lands before
   * React has re-rendered and `onCommit` runs twice -- two decisions, two ids, one gesture.
   * `tests/layout/a-stranger-takes-their-first-decision.layout.test.ts` clicks twice in one task
   * and had two decisions on c848f244. A ref is read in the same tick it was written.
   */
  const inFlight = useRef(false);
  useEffect(() => {
    if (!pending) inFlight.current = false;
  }, [pending]);
  const attempt = useRef({ done, open: openStep, startedAt: startedAt.current, refusals: 0, closed: false });
  attempt.current.done = done;
  attempt.current.open = openStep;
  attempt.current.startedAt = startedAt.current;

  const closeAttempt = (outcome: "recorded" | "left") => {
    if (attempt.current.closed) return;
    attempt.current.closed = true;
    recordAttempt({
      done: STEPS.filter((step) => attempt.current.done[step]),
      open: attempt.current.open,
      seconds: Math.floor((Date.now() - attempt.current.startedAt) / 1000),
      refusals: attempt.current.refusals,
      outcome,
    });
  };

  /*
   * The cleanup fires on BOTH things that end a pass without a commit: the position changing
   * under the player, and the screen going away entirely. One effect covers both because React
   * runs the cleanup for a dependency change and for an unmount identically.
   */
  useEffect(() => {
    attempt.current.closed = false;
    attempt.current.refusals = 0;
    inFlight.current = false;
    return () => closeAttempt("left");
    // The closure reads everything it needs through the ref, so it must not re-run on state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position.fen, position.ply]);
  const nextIncomplete = (after?: StepId) => {
    const from = after ? STEPS.indexOf(after) + 1 : 0;
    return STEPS.slice(from).find((s) => !done[s]) ?? STEPS.find((s) => !done[s]) ?? null;
  };

  /*
   * The move arrives from the BOARD, not from this panel, so the step it satisfies has to notice.
   * Choosing a move is one act and cannot be added to, which is why this one advances by itself
   * and the two multi-select steps below do not.
   */
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!chosenMove || openStep !== "chosenMove") return;
    setOpenStep(nextIncomplete("chosenMove"));
    /*
     * AND ON A PHONE, TAKE THE PLAYER TO THE QUESTION.
     *
     * A 370px board on a 390x844 screen is 537px tall and cannot be made smaller: eight squares
     * across 370px is 46px each, and the tap floor is 44. So the board fills the first screen by
     * arithmetic, and the panel begins at y=706 -- correct, because the move is made ON the board
     * and it has to be visible while you choose. What is wrong is being left there afterwards.
     *
     * This is a scroll caused by an action the player just took, which is the same rule the
     * refused-commit scroll follows: never on load, only on something they did. It is skipped
     * when the panel is already on screen, so nothing moves on a desktop.
     */
    const node = panel.current;
    if (!node) return;
    window.requestAnimationFrame(() => {
      const box = node.getBoundingClientRect();
      const offScreen = box.top > window.innerHeight * 0.7;
      if (offScreen) scrollIntoViewRespectingMotion(node, { block: "start" });
    });
    // Only on the arrival of a move; re-running on every keystroke would fight the player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosenMove]);

  /*
   * The refusal has to arrive somewhere the player is looking.
   *
   * Reported as "I still cannot complete the move", with a screenshot showing a chosen move, one
   * field filled, the second empty, and 34 seconds on the clock. The rule is right -- a partial
   * decision is not recorded, and that IS the product -- but the enforcement was invisible: the
   * button stayed enabled, clicking it only set a flag, and both the per-field messages and the
   * summary render BELOW the button, which on a laptop window is below the fold.
   *
   * With one step open the answer is no longer a scroll: the refused click OPENS the step that is
   * missing. The scroll is kept for the case where the panel itself is off screen.
   */
  const openBody = useRef<HTMLDivElement>(null);
  const submit = () => {
    if (inFlight.current) return;
    if (!ready) {
      // A player who WANTED to finish and was stopped reads nothing like one who wandered off.
      attempt.current.refusals += 1;
      setShowProblems(true);
      const missingStep = problems[0].field as StepId;
      setOpenStep(missingStep);
      window.requestAnimationFrame(() => {
        const target = openBody.current;
        // Smooth unless the player asked their system for less motion; the CSS property does not
        // reach an explicit `behavior` argument, so the setting is read in lib/motion.ts.
        if (target) scrollIntoViewRespectingMotion(target, { block: "center" });
        target?.querySelector<HTMLElement>("button, textarea")?.focus();
      });
      return;
    }
    inFlight.current = true;
    closeAttempt("recorded");
    onCommit(live, (Date.now() - startedAt.current) / 1000);
  };

  const missing = problems[0];
  const problemFor = (field: StepId) =>
    showProblems ? problems.find((p) => p.field === field)?.message : undefined;

  /** The one line a collapsed step shows: what was answered, or nothing yet. */
  const answerFor = (step: StepId): string | null => {
    switch (step) {
      case "chosenMove":
        return chosenMove;
      case "known":
        return statedKnown(live) || null;
      case "unknown":
        return statedUnknown(live) || null;
      case "confidence":
        return draft.confidence === null
          ? null
          : `${draft.confidence} · ${CONFIDENCE_LABELS[draft.confidence - 1]}`;
    }
  };

  /*
   * The number a step shows is its place in THIS decision's list, not a literal written at the
   * call site. With the reads absent, a hard-coded `3` on the confidence step made a two-step
   * screen count "1" and then "4" -- the numbering describing a screen the player was not looking
   * at. Deriving it from `STEPS` means the ordering cannot disagree with what is rendered.
   */
  const step = (id: StepId, body: React.ReactNode) => {
    const index = STEPS.indexOf(id);
    const open = openStep === id;
    const answer = answerFor(id);
    const problem = problemFor(id);
    return (
      <div
        key={id}
        className={`commitment-field commitment-step ${problem ? "has-problem" : ""}`}
        data-state={done[id] ? "done" : open ? "open" : "todo"}
      >
        <h3 className="step-heading">
          <button
            type="button"
            className="step-head"
            aria-expanded={open}
            aria-controls={`step-body-${id}`}
            onClick={() => setOpenStep(open ? null : id)}
          >
            <span className="step-index" aria-hidden="true">
              {done[id] ? <Check size={14} /> : index + 1}
            </span>
            <span className="step-legend">
              {STEP_LEGEND[id]}
              {/*
                * The required mark stays on every step and stays visible when the step is
                * collapsed. What is required has to be knowable before the click, which is the
                * whole finding this panel already carries a test for.
                */}
              {id !== "chosenMove" && <span className="required-mark">חובה</span>}
            </span>
            {/* dir=auto: a UCI move is Latin, a read is Hebrew, and they share this slot. */}
            <span className="step-answer" dir="auto">
              {answer ?? ""}
            </span>
          </button>
        </h3>
        <div
          className="step-body"
          id={`step-body-${id}`}
          hidden={!open}
          ref={open ? openBody : undefined}
        >
          {body}
        </div>
        {problem && <p className="commitment-problem">{problem}</p>}
      </div>
    );
  };

  /** Move on. Not a gate -- every step header is also a button. */
  const NextStep = ({ from }: { from: StepId }) => (
    <button type="button" className="step-next" onClick={() => setOpenStep(nextIncomplete(from))}>
      הבא
    </button>
  );

  return (
    <section className="commitment-screen" aria-label="מסך התחייבות" ref={panel}>
      <header className="commitment-header">
        <div>
          <p className="commitment-kicker">החלטה</p>
          <h2>מה העמדה הזו דורשת?</h2>
        </div>
      </header>

      {/*
        * THE RULE WAS HERE AND THE REASON WAS NOT.
        *
        * It read "המנוע לא ידבר לפני שההחלטה נרשמה — זו כל הנקודה". The first clause is the one
        * invariant this whole product rests on. The second is an assertion that it matters, which
        * is not a reason, and a rule given without one reads as ceremony -- a hoop before the
        * analysis, resented in proportion to how much the player wants the analysis.
        *
        * The reason is short and it is the entire justification for the ordering: after the engine
        * has spoken there is no way to separate what the player wrote from what the engine added.
        * Not a policy, not a preference -- an information fact about the record, and one a player
        * can check against their own experience of reading an engine line.
        *
        * SAID WITHOUT CLAIMING A MIND. "מה שרשמתם" is what the record holds. Any version reaching
        * for what they thought, saw or considered would be making the exact over-claim the reveal
        * spends its own sentences refusing.
        */}
      <p className="commitment-intro">
        בחרו מהלך על הלוח וסמנו את הקריאה שלכם. המנוע לא ידבר לפני שההחלטה נרשמה, כי אחרי שהוא
        דיבר כבר אי אפשר להפריד בין מה שרשמתם לבין מה שהוא הוסיף.
      </p>

      {step(
        "chosenMove",
        <>
          <output id="commit-move" className={`commitment-move ${chosenMove ? "set" : "unset"}`}>
            {chosenMove ?? "בחרו מהלך על הלוח"}
          </output>

          {/*
            * WHAT IS BEING RECORDED, said out loud. Disclosure, not instruction.
            *
            * Every distinct move put on the board while deciding is appended to
            * `candidate_moves_considered`, and that array is the only reason this product can
            * ever say "the engine's move was already on your board" -- the one sentence no other
            * chess tool can write, because no other tool makes you commit first. The component
            * received the array and rendered nothing. So the product's single differentiator was
            * collecting its input silently, and a player had no way to know that trying a move
            * left a trace.
            *
            * A product that records something and never says so is the defect here. Fixing it is
            * disclosure. What it must NOT become is a prompt: there is no count, no target, no
            * progress, no praise, and nothing that reads as "put more moves down". Inducing the
            * behaviour would make the array an artifact of the interface rather than a record of
            * what happened -- the same contamination that got pre-filled read chips refused.
            *
            * It renders from the first move rather than from the second, deliberately. Appearing
            * at two would make two a threshold, and a threshold that appears is a reward.
            *
            * The sentence states the asymmetry the array actually has, in the direction it runs:
            * a move here WAS in front of the player; a move absent may still have been considered.
            */}
          {candidatesConsidered.length > 0 && (
            <div className="commitment-candidates">
              <span className="candidates-label">מהלכים שהנחתם על הלוח</span>
              <ul className="candidates-list">
                {candidatesConsidered.map((move) => (
                  <li key={move} dir="ltr">
                    {move}
                  </li>
                ))}
              </ul>
              <p className="candidates-note">
                נרשמים כחלק מההחלטה. מהלך ששקלתם בראש ולא הנחתם על הלוח <strong>אינו נרשם</strong> —
                ולכן הרשומה יכולה להראות שמהלך היה מולכם, אף פעם לא שהוא לא היה.
              </p>
            </div>
          )}
        </>,
      )}

      {asksReads &&
        step(
        "known",
        <ReadField
          hint="בחרו כמה שרוצים"
          options={KNOWN_OPTIONS}
          selected={draft.knownTags}
          onToggle={(label) => setDraft((d) => ({ ...d, knownTags: toggle(d.knownTags, label) }))}
          text={draft.known}
          onText={(known) => setDraft((d) => ({ ...d, known }))}
          textPlaceholder="למשל: היתרון שלי הוא בכנף המלכה"
          pending={pending}
          id="known"
          next={<NextStep from="known" />}
        />,
      )}

      {asksReads &&
        step(
        "unknown",
        <ReadField
          hint="בחרו כמה שרוצים"
          options={UNKNOWN_OPTIONS}
          selected={draft.unknownTags}
          onToggle={(label) =>
            setDraft((d) => ({ ...d, unknownTags: toggle(d.unknownTags, label) }))
          }
          text={draft.unknown}
          onText={(unknown) => setDraft((d) => ({ ...d, unknown }))}
          textPlaceholder="למשל: לא יודע אם הקורבן על f7 עובד"
          pending={pending}
          id="unknown"
          next={<NextStep from="unknown" />}
        />,
      )}

      {/*
        * ABSENT, NOT DISABLED AND NOT OPTIONAL, where nothing measures the answer.
        *
        * A greyed-out step still costs a reader a glance and an explanation; an optional one is
        * answered by whoever feels like answering, which curates the confidence data on the very
        * variable being measured. On an ordinary decision the question simply is not part of this
        * screen, and the decision is complete without it.
        */}
      {asksConfidence &&
        step(
        "confidence",
        <fieldset className="commitment-confidence" disabled={pending}>
          <legend className="sr-only">כמה אתם בטוחים</legend>
          {/*
            * THE SAME SCALE RAN IN OPPOSITE DIRECTIONS ON THE TWO SCREENS THAT COLLECT IT.
            *
            * This carried `dir="ltr"` inside an otherwise fully RTL panel, so `1 ניחוש` sat at the
            * LEFT edge and `7 ודאי` at the right; `Blitz.tsx` declares no direction at all, so the
            * same seven buttons run right to left there. Measured in Chromium at 1440: x=52 for
            * option 1 here, and option 7 at the left edge on `/blitz`. A player who reaches for
            * "the third box" means two different confidences depending on which loop they are in,
            * and nothing in either row tells them apart.
            *
            * THIS IS THE INSTRUMENT, not a layout. The direction is removed rather than copied to
            * the other screen, because the labels under the digits are Hebrew and the document is
            * Hebrew: the low end belongs at the reading start. Single digits need no direction of
            * their own -- the reason `3+0` and `7. Bb3` are marked `ltr` elsewhere is that they
            * are RUNS of Latin characters, and `1` is not a run.
            *
            * It is one of the eleven changes that took `CURRENT_PROTOCOL_VERSION` to 4.
            */}
          <div className="confidence-row">
            {CONFIDENCE_CHOICES.map((level) => (
              <button
                key={level}
                type="button"
                className={draft.confidence === level ? "selected" : ""}
                /*
                 * The name CONTAINS the visible text, which is what WCAG 2.5.3 asks and what axe
                 * reports as label-content-name-mismatch when it fails. The button reads "1" over
                 * "ניחוש"; the name has to have that pair in it, in that order, spelled the same.
                 * The em dash used to sit between them and broke the match, so someone using
                 * voice control could say what they saw and not be understood.
                 */
                aria-label={`ביטחון ${level} ${CONFIDENCE_LABELS[level - 1]}`}
                aria-pressed={draft.confidence === level}
                onClick={() => {
                  setDraft((d) => ({ ...d, confidence: level }));
                  /*
                   * Closes rather than advancing: this is the last requirement, so what comes
                   * next is the record button and nothing should sit between the player and it.
                   * A single choice, so nothing is cut short by moving on.
                   */
                  setOpenStep(null);
                }}
              >
                <b>{level}</b>{" "}
                <small>{CONFIDENCE_LABELS[level - 1]}</small>
              </button>
            ))}
          </div>
        </fieldset>,
      )}

      {/*
        * A question about what the player just said, not a verdict and not a blocker: the submit
        * control below is unaffected, and a decision that states a tension records exactly as it
        * stands. `role="status"` rather than `alert` for the same reason -- nothing is wrong.
        */}
      {tension && (
        <aside className="commitment-tension" role="status" aria-label="שאלה על ההצהרה שלך">
          <p className="commitment-tension-question">{tension.question}</p>
          <p className="commitment-tension-basis">{tension.basis} · לא חוסם רישום</p>
        </aside>
      )}

      {error && (
        /*
         * A `div`, not a `p`, and that is a correctness fix rather than a preference. `<p>` holds
         * phrasing content only: given the `<details>` below, the parser closes the paragraph and
         * re-parents it, so the DOM differs from what React rendered and React warns on
         * hydration -- on the one panel whose whole job is to be trustworthy when everything else
         * has failed. `tests/client/valid-html-in-the-render-path.test.ts` scans for the shape.
         */
        <div className="commitment-error" role="alert">
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
        </div>
      )}

      {/*
        * Not `disabled`. A disabled button explains nothing, cannot be focused, and gives a
        * screen reader nothing to read -- so the label carries the reason instead, and it is
        * there BEFORE the first click rather than only after one.
        */}
      <button
        type="button"
        className={`commitment-submit ${ready ? "" : "not-ready"}`}
        /* The one act of `DECIDE`: recording the decision that is open. */
        {...primaryAction("commit-decision")}
        onClick={submit}
        /* PENDING ACTION LOCK (section 4.3): disabled while the write is in flight. */
        disabled={pending}
        aria-describedby={ready ? undefined : "commit-blocked"}
      >
        {/*
          * THE ICON FOLLOWS THE STATE, and it did not.
          *
          * `<Check />` rendered unconditionally, so the button that says *"חסר: בחרו מהלך על הלוח"*
          * wore a TICK -- the one glyph that means the opposite. On the screen it sits directly
          * under the last unanswered step, so the icon and the position both said "done" while the
          * words said "missing", and a reader resolves that contradiction in favour of the picture.
          *
          * `CircleDashed` rather than `CircleAlert`: nothing is broken, and the sentence below this
          * button says so in as many words -- *"החלטה חלקית לא נרשמת — זה הכלל, לא תקלה"*. An outline
          * not yet filled is what is true.
          *
          * NO TEST SAW IT, and the reason is worth keeping: `commit-blocked.test.tsx` asserts
          * `button.textContent` matches `/חסר:/`, which was true throughout. An icon contributes no
          * text, so a test that reads the string is blind to half of what the button says.
          */}
        {ready || pending ? <Check size={16} /> : <CircleDashed size={16} />}{" "}
        {pending
          ? "רושם החלטה…"
          : ready
            ? "רשמו את ההחלטה"
            : `חסר: ${MISSING_LABEL[missing.field as StepId] ?? "פרט"}`}
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
  hint: string;
  options: ReadOption[];
  selected: string[];
  onToggle: (label: string) => void;
  text: string;
  onText: (value: string) => void;
  textPlaceholder: string;
  pending: boolean;
  id: string;
  next: React.ReactNode;
}

/**
 * One read: options to tap, and a box to write in if the options do not cover it.
 *
 * The writing box starts collapsed. Open by default it would read as the real field with the
 * chips as a shortcut, which is the arrangement that made a game unfinishable; collapsed, it is
 * what it should be -- available for the position the menu cannot describe.
 *
 * The legend moved out to the step header, which is where the name of the step now lives. Every
 * option is still here and none is behind a "more" control: a shorter list is a shorter thing the
 * player is able to say, and the record then holds less.
 */
function ReadField({
  hint,
  options,
  selected,
  onToggle,
  text,
  onText,
  textPlaceholder,
  pending,
  id,
  next,
}: ReadFieldProps) {
  // Stays open once opened, and once something is typed it cannot hide the text it holds.
  const [writing, setWriting] = useState(false);
  const open = writing || text.length > 0;

  return (
    <fieldset className="read-field" disabled={pending}>
      <legend className="read-hint">{hint}</legend>
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
          <Pencil size={14} /> להוסיף במילים שלכם
        </button>
      )}

      <div className="read-field-foot">{next}</div>
    </fieldset>
  );
}
