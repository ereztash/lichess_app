/**
 * THE REVEAL (section 4.2). The order top to bottom is not negotiable:
 *
 *   1. what cannot be inferred here  -- first, always, before any number
 *   2. the one thing to work on      -- one, not a list
 *   3. the next question
 *   4. everything else               -- secondary disclosure, collapsed by default
 *
 * The evaluation number is the most visually attractive element on this screen and the least
 * useful one. It lives in step 4, inside a collapsed <details>. If it ever becomes the largest
 * thing here, this has been rebuilt into the tool the repo already was.
 */
import { useEffect } from "react";
import { AlertTriangle, ChevronDown, HelpCircle, Layers, Target } from "lucide-react";
import { formatEvaluation, sanPrincipalVariation } from "@/lib/game-data";
import {
  ACCUMULATION_HEADING,
  ACCUMULATION_LEAD,
  ACCUMULATION_NEXT,
  BUILD_LIMIT,
  CONTINUATION_CTA,
  ENGINE_NOISE_CP,
  EVIDENCE_LABEL,
  MATERIAL_LOSS_CP,
  ONE_THING_EVIDENCE,
  inferenceLimits,
  nextQuestion,
  revealAccumulation,
  silenceBasis,
  theOneThing,
  type OneThingMix,
  type RevealInputs,
} from "@shared/reveal";
import type { EngineLine } from "@/lib/engine-line";
import { primaryAction } from "@shared/primary-action";
import { recordTrialEvent, trialEventSeen } from "@/lib/progress-record";
import { NotMeasured, Value } from "./Value";

/*
 * The two constants alone, for a panel with no record to read. Not a `revealAccumulation` call
 * with an empty mix: that would be inventing a reading out of a number nobody measured, and the
 * whole point of the null is that the count is UNKNOWN here rather than zero.
 */
const FALLBACK = { lead: ACCUMULATION_LEAD, balance: null, next: ACCUMULATION_NEXT } as const;

interface RevealPanelProps {
  inputs: RevealInputs;
  analysis: EngineLine | null;
  /** The position the analysis was computed for. */
  fen: string;
  /**
   * The position on the board right now, so staleness is derived here rather than passed in.
   *
   * SECTION 4.3, THE RULE `GATE-STALE` STATES: a result rendered against an input it was not
   * computed for is marked stale. `EvaluationBar` derives it from `currentFen` for exactly this
   * reason -- *"so a caller cannot forget to mark it"* -- and this panel was the one result on the
   * screen that did not. Measured in Chromium: with the reveal up, one press on the move timeline
   * took the board four plies back, and the reveal went on saying `g5d8 עלה 484 ס״פ` about a
   * position no longer on screen, with the same sentence and the same number. Only the engine's
   * arrow was guarded.
   *
   * REQUIRED, and it was optional for one release. The docblock cited `EvaluationBar`'s
   * *"so a caller cannot forget to mark it"* as its authority and then made forgetting possible --
   * silently, since `GATE-STALE` is about `StockfishClient`'s superseded searches and never sees
   * this panel. An adversarial pass named the contradiction. `authority` on `ChessBoard` is
   * required for exactly this argument; so is this. A test rendering the panel in isolation passes
   * the same FEN twice, which is what "the board is on the decision's position" means.
   */
  boardFen: string;
  statedKnown: string;
  /**
   * The decision this reveal is about, or null when it is not being rendered for a real one.
   *
   * The trial's reveal events are keyed on it, and null means "do not record" rather than
   * "record without an id": a reveal that cannot say which decision it belongs to cannot be
   * joined to a commit, so it would enter the funnel as a stage with no denominator. Every test
   * that renders this panel in isolation passes null and records nothing, which is correct --
   * a test is not a reveal a player was shown.
   */
  decisionId?: string | null;
  /**
   * The branch mix over every population, for the accumulation block.
   *
   * NULL IS A STATE, NOT A ZERO, and the distinction is the whole reason this is nullable. The
   * record query can be in flight, can have failed, or the caller can be a test rendering the
   * panel in isolation; none of those is "the engine has answered nothing". `RecordReading.mixAll`
   * documents why it is the pooled mix and not `mix`.
   */
  mix?: OneThingMix | null;
  /**
   * Take another decision. Absent wherever there is not one to take.
   *
   * Optional because most callers of this panel are tests rendering it in isolation, and a reveal
   * with no way forward is a valid screen -- the transfer run has its own control, and a panel
   * shown for inspection has none.
   */
  onContinue?: () => void;
}

export function RevealPanel({
  inputs,
  analysis,
  fen,
  boardFen,
  statedKnown,
  decisionId = null,
  mix = null,
  onContinue,
}: RevealPanelProps) {
  /*
   * NOT A REASON TO HIDE ANY OF THE FOUR BLOCKS. Everything below is still true OF THE DECISION --
   * it was measured, it is on the record, and the record is not what moved. What is no longer true
   * is that the board in front of the reader is the position it is about, and that is one fact
   * about the whole panel rather than a fifth section inside it.
   */
  const elsewhere = boardFen !== fen;
  const limits = inferenceLimits(inputs);
  const oneThing = theOneThing(inputs);
  const question = nextQuestion(inputs);
  /*
   * FROM `oneThing`, NOT FROM A SECOND CLASSIFICATION. The kind counted here is the kind rendered
   * eighty lines above, so the count and the sentence it counts can never describe different
   * branches -- the same argument `reveal_kind_presented` is emitted from this component for.
   * `"silence"` is a kind here exactly as it is there: a branch, not an absence.
   */
  const accumulation = mix ? revealAccumulation(oneThing?.kind ?? "silence", mix) : null;
  const pv = analysis ? sanPrincipalVariation(fen, analysis.pv) : [];

  /*
   * THE REVEAL EVENTS ARE EMITTED FROM THE THING THAT RENDERS THE REVEAL, and that placement is
   * the whole of their validity.
   *
   * `reveal_kind_presented` has to answer "which branch did this player actually see". Computed
   * anywhere else -- in `Home`, in the ledger, in an analysis script -- it would be a SECOND
   * implementation of the branch conditions, and the two would part company the first time a
   * threshold moved: the panel would show one sentence and the trial would record another, with
   * nothing failing. Here, `oneThing` is the same value that is rendered five lines below.
   *
   * PRESENTED, NOT COMPUTED. The effect runs after the panel is in the document, which is the
   * distinction between this and "the engine finished": an analysis that completes into a failure
   * branch, a deferred game, or a player who has already navigated away is not a reveal anybody
   * saw.
   *
   * Keyed on the decision so a re-render, a StrictMode double-invoke or a parent update cannot
   * count one reveal twice -- every rate in the funnel has this as its denominator.
   */
  useEffect(() => {
    if (!decisionId) return;
    if (trialEventSeen("reveal_presented", decisionId)) return;
    const at = new Date().toISOString();
    recordTrialEvent({ name: "reveal_presented", at, decisionId });
    recordTrialEvent({
      name: "reveal_kind_presented",
      at,
      decisionId,
      // `silence` is a branch, not an absence: see the type's comment on why it has to be counted.
      kind: oneThing?.kind ?? "silence",
      });
  }, [decisionId, oneThing?.kind]);

  return (
    <section className={`reveal-panel${elsewhere ? " reveal-panel-elsewhere" : ""}`} aria-label="חשיפה">
      {elsewhere && (
        <p className="reveal-elsewhere" role="status">
          הלוח מציג עכשיו עמדה אחרת. מה שכתוב כאן נמדד על העמדה שבה החלטתם.
        </p>
      )}
      {/* 1 -- before any number */}
      <section className="reveal-block reveal-limits">
        <h2>
          <AlertTriangle size={14} /> מה ההחלטה הזאת עדיין לא אומרת
        </h2>
        <ul>
          {limits.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>
        {/*
         * Separated from the list above on purpose. Everything in that list is derived from
         * this position; this one is a property of the build and is true of every position, so
         * rendering it as a sibling of the others would put a constant among measurements.
         */}
        <p className="reveal-build-limit">{BUILD_LIMIT}</p>
      </section>

      {/* 2 -- one thing */}
      <section className="reveal-block reveal-one-thing">
        <h2>
          <Target size={14} /> מה קרה כאן
        </h2>
        {oneThing ? (
          <>
            <p className="one-thing-text">{oneThing.text}</p>
            {/*
              * The event above, what it points at here. Two elements rather than one sentence,
              * because they are not equally certain: the first is what the record holds, the
              * second is a reading of it. A branch with nothing to point at renders nothing.
              */}
            {oneThing.note && <p className="one-thing-note">{oneThing.note}</p>}
            {/*
              * WHICH OF TWO THINGS THIS IS, and the block was unreadable without it.
              *
              * Four branches render here in the same typeface at the same weight. Two of them read
              * something the player recorded before any evaluation existed and could not be
              * reconstructed from a PGN afterwards; `outplayed` is an engine comparison, which is
              * what every game report has always given. Undistinguished, a reader has no way to
              * answer "could an engine have told me this?" -- which is the question this whole
              * product's difference lives or dies on -- and neither does a trial that asks them.
              *
              * Derived from the branch already computed. No second classifier, and nothing stored:
              * `ONE_THING_EVIDENCE` is a statement about firing conditions that already exist, and
              * the ablation test proves it rather than restating it.
              */}
            <p className="one-thing-evidence" data-evidence={ONE_THING_EVIDENCE[oneThing.kind]}>
              {EVIDENCE_LABEL[ONE_THING_EVIDENCE[oneThing.kind]]}
            </p>
            <p className="one-thing-basis">מבוסס על: {oneThing.basis}</p>
          </>
        ) : (
          /*
           * Two reasons for silence, two sentences. The old single sentence claimed "you chose
           * inside the evaluation noise" on a band where the loss was 31-99cp -- above the noise
           * by the file's own constant -- and asserted the confidence matched even at 5/5, which
           * nothing had measured. Section 4.5: distinct states, distinct rendering.
           */
          <p className="one-thing-none">
            {silenceBasis(inputs) === "inside-noise" ? (
              <>
                אין כאן דבר שהמדידה תומכת באמירתו. בחרת בתוך רעש ההערכה, והביטחון שלך לא היה נמוך
                ממנו. זו תוצאה תקינה, לא מסך ריק.
              </>
            ) : (
              <>
                אין כאן דבר שהמדידה תומכת באמירתו. המהלך עלה {inputs.cpLoss} ס״פ — יותר מרעש
                ההערכה ({ENGINE_NOISE_CP}) ופחות מהסף שממנו הכלי הזה אומר משהו ({MATERIAL_LOSS_CP}).
                בטווח הזה החלטה בודדת לא נבדלת מהחלטה מוצלחת, ולכן אין כאן משפט. זו תוצאה תקינה,
                לא מסך ריק.
              </>
            )}
          </p>
        )}
      </section>

      {/* 3 -- the next question */}
      <section className="reveal-block reveal-question">
        <h2>
          <HelpCircle size={14} /> מה שווה לבדוק
        </h2>
        <p>{question}</p>
        {statedKnown.trim() && <p className="reveal-echo">הקריאה שלך הייתה: "{statedKnown}"</p>}
      </section>

      {/* 4 -- everything else, collapsed */}
      <details className="reveal-secondary">
        <summary>
          <ChevronDown size={14} /> פרטי הניתוח
        </summary>
        <div className="reveal-secondary-body">
          <div className="reveal-metric">
            <span>הערכת המנוע</span>
            {analysis ? (
              <Value provenance={{ kind: "engine", source: "local_sf18", depth: analysis.depth }}>
                {formatEvaluation(analysis.scoreCp, analysis.mate)}
              </Value>
            ) : (
              <NotMeasured reason="לא הושלם ניתוח לעמדה זו" />
            )}
          </div>
          {/*
            * Section 4.5: a measured cost and a cost measured against a ceiling are different
            * states, and "0 ס״פ" is where they look most alike. On a forced mate the number is
            * the distance from MATE_SCORE, so zero means "nothing was better than this" and not
            * "this move changed nothing" -- opposite readings, identical glyphs. The unit says
            * which one it is; the limits list above says what the clamp discarded.
            */}
          <div className="reveal-metric">
            <span>עלות ההחלטה</span>
            <Value provenance={{ kind: "engine", source: "local_sf18", depth: inputs.depth }}>
              {inputs.clampedMate ? `${inputs.cpLoss} ס״פ מול תקרת מט` : `${inputs.cpLoss} ס״פ`}
            </Value>
          </div>
          <div className="reveal-metric">
            <span>מהלך המנוע</span>
            <Value provenance={{ kind: "engine", source: "local_sf18", depth: inputs.depth }}>
              {inputs.bestMove}
            </Value>
          </div>
          <div className="reveal-metric">
            <span>המהלך שלך</span>
            <Value provenance={{ kind: "player", unit: "נרשם לפני החשיפה" }}>
              {inputs.chosenMove}
            </Value>
          </div>
          <div className="reveal-pv" dir="ltr">
            {pv.length ? pv.map((m, i) => <span key={`${m}-${i}`}>{m}</span>) : <span>—</span>}
          </div>
        </div>
      </details>

      {/*
        * WHY ANOTHER DECISION, ANSWERED RATHER THAN ASSERTED.
        *
        * WHAT WAS HERE. `CONTINUATION_PROPOSITION`: "החלטה אחת אומרת מה קרה בה, ולא יותר. החלטה
        * נוספת היא עמדה אחרת ורגע אחר -- וזה מה שמאפשר לשאול אם מה שקרה כאן חוזר." Every word true,
        * and a constant: byte-identical after decision one and after decision fifty. The product
        * offered to let a player ask whether something repeats and then never asked.
        *
        * WHAT THE MEASUREMENT SAID. Walked on the built app after three decisions: of fourteen
        * painted elements on this panel, ONE said anything about the record -- sixty characters of
        * seven hundred and fifty-four -- and it sat inside "מה ההחלטה הזאת עדיין לא אומרת", where
        * its function was to deny. The whole reveal was local, and the one sentence that promised
        * accumulation was the one that could never deliver it.
        *
        * SO IT IS REPLACED, NOT JOINED. A second block beside the proposition would have left the
        * screen saying the abstract thing and the concrete thing at once, which is two answers to
        * one question. `ACCUMULATION_LEAD` carries the proposition's limitation forward unchanged
        * in force -- one decision is not a pattern -- and `ACCUMULATION_NEXT` carries its reason to
        * continue. What is added between them is the count that makes both of them about this
        * player's record instead of about arithmetic.
        *
        * STILL A BLOCK AT THE FOOT AND STILL NOT ONE OF THE FOUR. Everything above is derived from
        * this position; this is derived from the record. It is last for the same reason the
        * proposition was, and its heading is the same weight as the other section heads: the
        * limits block is first, always, and a foot block that outranked it would inverse the order
        * this panel's docblock calls not negotiable.
        *
        * NULL MIX RENDERS THE CONSTANTS AND NO COUNT. The record query in flight, a failed read, or
        * a test rendering this panel alone are not "the engine has answered nothing", and a zero
        * would say they were.
        */}
      <section className="reveal-block reveal-accumulation">
        <h2>
          <Layers size={14} /> {ACCUMULATION_HEADING}
        </h2>
        <p className="accumulation-lead">{(accumulation ?? FALLBACK).lead}</p>
        {/*
          * THE COUNT IS ITS OWN ELEMENT because it is the only line here that is a measurement.
          * The two around it are constants and say so by never changing; putting all three in one
          * paragraph would make the reader work out which is which, and `OneThing` splits `text`
          * from `note` one block above for exactly that reason.
          */}
        {accumulation?.balance && <p className="accumulation-balance">{accumulation.balance}</p>}
        <p className="accumulation-next">{(accumulation ?? FALLBACK).next}</p>
      </section>
      {/*
        * THE BUTTON GOES WHERE THE REASON IS, and the measurement is why.
        *
        * The post-reveal control lived only in the page header, which is not sticky. Walked in
        * Chromium at 390x844: the proposition sits around y=1200 of a 2715px page and the header
        * button is at y=0. So the one sentence that says why another decision is worth taking was
        * twelve hundred pixels from the only way to take one, and everything between them is
        * engine analysis. A reason the reader cannot act on where they read it is a reason that
        * did not reach them.
        *
        * THE HEADER BUTTON STAYS, and the duplicate label is deliberate. It is the control that
        * exists while the panel is scrolled away, and -- the reason that decided it -- it is also
        * the only way forward in the window where the decision is committed but the engine has
        * not answered yet, where this panel does not render at all. Removing it there would turn
        * a slow analysis into a dead end.
        */}
      {onContinue && (
        <button
          type="button"
          className="primary-control reveal-continue"
          {...primaryAction("next-decision")}
          onClick={onContinue}
        >
          {CONTINUATION_CTA}
        </button>
      )}
    </section>
  );
}
