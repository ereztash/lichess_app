/**
 * THE CONDITIONS AN OBSERVATION WAS PRODUCED UNDER. Not where it came from, and not what it says.
 *
 * Two rows with identical fields and different protocols are different measurements that happen to
 * share a schema. `purpose` already says why a decision existed; this says what the world was like
 * while it was being made -- whether a clock was running, whether an engine was running, whether
 * anybody was asked anything at all.
 *
 * WHY IT IS ITS OWN AXIS AND NOT A SEVENTH `DecisionPurpose`. A purpose and a protocol vary
 * independently: a `play` decision can be made in the untimed commitment loop or in a timed blitz
 * game, and those two are not comparable even though the player's intent was the same in both.
 * Folding one into the other would force a choice between losing the purpose and losing the
 * conditions, and the admission table needs both.
 *
 * THE SHAPE OF THIS FILE IS COPIED DELIBERATELY from `reveal-timing.ts` and the `LEGACY_CONTEXT`
 * argument in `evidence-policy.ts`, because this repository has already had this exact problem
 * twice and solved it the same way both times: a stored value whose meaning depends on a condition
 * nothing recorded is a value nobody can read back.
 */

/**
 * The protocols that exist. `lichess-board-api` is named in `docs/blitz/ADR-001` and is NOT here.
 *
 * An enum value nothing can produce is a branch nothing can test, and this repository would rather
 * pay for a migration later than carry a case that is unreachable now. Adding it is a schema change
 * whenever it arrives, so nothing is saved by declaring it early.
 */
export const MEASUREMENT_PROTOCOLS = [
  /**
   * A game played somewhere else and imported afterwards. Nothing was measured while it happened;
   * every field is reconstructed from the PGN.
   *
   * IT CANNOT CARRY A CALIBRATION GAP AND NEVER WILL. Nobody was asked how sure they were during a
   * game that was already over, and `shared/import-diagnostic.ts` refuses to compute a gap from one
   * in its own words: "There is no confidence in this data." The protocol is what lets a consumer
   * refuse it structurally rather than by remembering.
   */
  "historical-passive",
  /**
   * The commitment loop as it has always run: one position at a time, no clock, the player commits
   * before the engine speaks.
   */
  "instrumented-standard",
  /**
   * A timed game inside the product. Decision time measured to the commit, confidence sampled after
   * it, and no analysis at all until the game is over.
   */
  "instrumented-blitz",
] as const;

export type MeasurementProtocol = (typeof MEASUREMENT_PROTOCOLS)[number];

/**
 * WHEN THE ENGINE RAN -- which is not the same question as when the player was TOLD.
 *
 * This field exists because the two came apart, and the code that separated them says so plainly.
 * `Home.tsx` on the deferred game: *"THE ENGINE RUNS IN BOTH MODES; ONLY THE TELLING DIFFERS."*
 * The reasoning there is sound -- a deferred game that stored no evaluations would be forty
 * decisions nothing ever scored -- but it means `reveal_timing: "end-of-game"` does NOT say the
 * engine was quiet, and for a blitz game that distinction is the entire measurement.
 *
 * So a third field, rather than deriving this from the other two. It would be redundant if the
 * product had ever had a mode where the engine did not run during play. It never has.
 */
export const ANALYSIS_TIMINGS = [
  /** The engine ran while the game was in progress, whether or not the player was shown anything. */
  "during-play",
  /** The engine did not run until play was over. The only timing an instrumented blitz game may have. */
  "after-play",
] as const;

export type AnalysisTiming = (typeof ANALYSIS_TIMINGS)[number];

/**
 * The version of the instrumented protocols, stamped on every decision that runs under one.
 *
 * A protocol whose rules change is a different protocol for analysis even when its name is the
 * same -- if the confidence sampling rate moves, or the moment the question appears moves, then
 * "instrumented-blitz" before and after are two populations. The version is what lets a later
 * reader tell them apart, and it is the same device `EVIDENCE_POLICY_VERSION` already is.
 *
 * BUMP THIS when anything changes about HOW a decision is produced. Not when a bug is fixed in
 * something that reads one.
 *
 * ---
 *
 * 1 -> 2: LAW 1's decision focus. The instrumented-standard loop used to render `<ClaimPanel>` and
 * `<LearningQueue>` on the branch a decision is made on, so a player stated how sure they were with
 * findings about their own past decisions -- their own calibration among them -- beside the
 * question. At the counterfactual stage the whole reveal column rendered, dashboard included. Both
 * are gone.
 *
 * IT IS THE STIMULUS THAT CHANGED, WHICH IS WHAT THIS FIELD IS FOR. The examples in the paragraph
 * above are a sampling rate and the moment a question appears; what is on screen while the answer
 * is given is the same kind of fact. A confidence stated in front of a panel describing that
 * player's calibration and a confidence stated in front of a board are two measurements, and
 * nothing in the row itself distinguishes them -- which is exactly why the version has to.
 *
 * WHICH DIRECTION IT MOVES THE NUMBERS IS NOT KNOWN, and this is not a claim that the old rows are
 * wrong. It is a claim that they are not the same population, which is a weaker and much safer
 * thing to say.
 */
/*
 * 2 -> 3: THE VISUAL PASS. Nothing was added to or removed from the pre-commit screen, no
 * measurement wording was rewritten, no question moved, no sampling rate changed and no control
 * changed position. What changed is SALIENCE, and this field's own 1 -> 2 note is the reason
 * that is enough:
 *
 *   "IT IS THE STIMULUS THAT CHANGED, WHICH IS WHAT THIS FIELD IS FOR. The examples in the
 *    paragraph above are a sampling rate and the moment a question appears; what is on screen
 *    while the answer is given is the same kind of fact."
 *
 * What is on screen while the answer is given, before and after:
 *
 *   - THE CONTROL THAT RECORDS THE DECISION IS LEGIBLE. `.commitment-submit` declares an opaque
 *     ground with a comment saying why; `.not-ready` -- the panel's DEFAULT state -- repealed it
 *     1,552 lines later with `background: transparent`. Photographed at 390x844, scrollY 400,
 *     with the instrument's own read chips rendering through the button's text. A player who
 *     could not read the control that ends the decision was being timed to it.
 *   - IT IS ALSO NOW THE PRIMARY CONTROL BY TREATMENT. It rendered in the secondary language --
 *     a cream fill and a hairline -- while `.primary-control`, which offers "take another
 *     decision" AFTER the reveal, rendered filled blue. The loudest button in the loop was the
 *     one that leaves it.
 *   - THE TASK OUTRANKS THE LABEL. The largest non-decorative text on the DECIDE screen was
 *     `עמדת פתיחה`, the position's NAME, at the region-heading rank; the question the panel asks
 *     was one rank below it. They have swapped: the name is a reading, the question is the
 *     region.
 *   - THE TYPE SCALE HAS RANKS. 91% of this product's font-size declarations resolved to 10, 11
 *     or 12px -- steps of 1.10x and 1.09x, which no eye orders. The values were re-spaced; the
 *     names, and every test that references them, did not change.
 *   - TWO SENTENCES BECAME LEGIBLE. `.board-note`, which states the task in as many words, was
 *     11px at a measured 2.81:1 against the 4.5:1 that 1.4.3 asks. `.record-mode` was a
 *     paragraph at the kicker rank.
 *   - ONE DUPLICATE RESOLVED. `תור / לבן` rendered twice, 400px apart, at one rank. The reading
 *     beside the board survives; the header's copy is gone. Nothing moved behind a disclosure.
 *
 * WHICH DIRECTION ANY OF THIS MOVES THE NUMBERS IS NOT KNOWN, and none of it is a claim that v2
 * rows are wrong. It is the same weaker and safer claim the last bump made: they are not the same
 * population. A decision taken in front of an unreadable commit control and a decision taken in
 * front of a readable one are two measurements, and nothing in the row itself tells them apart.
 *
 * WHAT DID NOT CHANGE, stated because a version bump is also a claim about scope: the commitment
 * requirements, the confidence collection, the candidate collection, the counterfactual probe and
 * its rate, the sampling, the reveal timing, the engine timing, the thresholds, the eligibility,
 * the scoring, the schema and the interpretation policy. LAW 9's three friction points are
 * untouched. The full reasoning, and the measurements behind every line above, are in
 * `docs/VISUAL_ARCHITECTURE_AUDIT.md`.
 */
/*
 * 3 -> 3. THE FRONTEND EXCELLENCE PASS ASKED FOR A BUMP AND DID NOT GET ONE, AND THE REASONING IS
 * HERE RATHER THAN NOWHERE, because "we thought about it and decided no" and "nobody asked" are
 * indistinguishable in a file that only records the yeses.
 *
 * THE RULE THIS FILE ALREADY SETS: *"BUMP THIS when anything changes about HOW a decision is
 * produced. Not when a bug is fixed in something that reads one."* And the 2 -> 3 note widened it
 * correctly: what is on screen while the answer is given is the same kind of fact as a sampling
 * rate.
 *
 * SO THE QUESTION WAS ASKED AS A MEASUREMENT RATHER THAN AS AN OPINION. Every class the pass
 * touched -- twenty-seven of them -- was searched for on the built app at 1440x900, on `DECIDE`
 * cold, on `ANSWER_INSTRUMENT` with a move played, and again with every instrument step answered
 * and nothing committed. Exactly one of the twenty-seven paints on any of those three:
 *
 *   .empty-moves   "הלוח מוכן למהלך הראשון."   16px, unchanged in size, colour and position
 *
 * and what changed about it is that it was given `dir="rtl"` inside a rail that is `dir="ltr"` for
 * chess notation, which moves ONE bidi-neutral full stop from the beginning of the sentence to the
 * end of it. No word was added, removed or reworded. No control moved. No size, weight or colour on
 * that screen changed. It is the move rail's empty-state status line, and it is not part of the
 * instrument.
 *
 * WHAT THAT LEAVES, AND IT IS NOT ON THE DECISION SCREEN. Two changes land on `/` -- the front
 * door, seen before any decision exists: `.first-decision-note` moved from the scale's floor rank
 * to its body rank, and the selected import-source toggle stopped wearing the primary action's
 * fill. Both are pre-loop rather than pre-commit.
 *
 * THE ONE THAT GIVES PAUSE, STATED RATHER THAN OMITTED. `.first-decision-note` says how positions
 * are chosen -- *"the position is chosen without looking at what came of your move; no engine ran
 * on it"* -- which is framing, and making it 27% larger changes the probability it is read. The
 * 2 -> 3 bump listed "two sentences became legible" among its reasons, so there is a precedent
 * pointing the other way. What separates them: both of those sentences were on the DECIDE screen,
 * on screen while the answer was being given. This one is on a different route, read once, before
 * the loop is entered, and it was already legible -- `--muted` at 11px, over 4.5:1 -- rather than
 * unreadable, which is what the v3 cases were.
 *
 * THE DECISION: NO BUMP, because nothing changed about how a decision is produced, and a version
 * split is not free -- it fragments the population that later analysis can pool, so a bump that is
 * not warranted costs evidence rather than protecting it.
 *
 * WHAT WOULD HAVE FORCED ONE, so the next reader can check this rather than trust it: any change to
 * a class that paints on `DECIDE` or `ANSWER_INSTRUMENT` and is part of the instrument -- the
 * board, the read chips, the confidence row, the step heads, `.commitment-summary`,
 * `.commitment-submit`, `.board-note`, `.record-mode`, `.context-loop`. The probe that establishes
 * this is `audit.local/probe-stimulus.ts` in the pass's working notes and the method is three
 * lines: list the touched classes, render the pre-commit states, ask which are on screen.
 */
/*
 * 3 -> 4: THE PRE-COMMIT SCREEN'S COLOUR SEMANTICS.
 *
 * WHAT CHANGED, AND IT IS EXACTLY THE LIST THE 2 -> 3 NOTE ABOVE SAYS WOULD FORCE A BUMP. Every
 * one of these paints on `DECIDE` or `ANSWER_INSTRUMENT` and is part of the instrument:
 *
 *   .commitment-submit        ready: filled `--blue` -> filled `--action` (the page's own ink).
 *                             not-ready: `--warn` text on a dashed `--warn` edge -> `--muted` on
 *                             a dashed `--edge`.
 *   .commitment-summary       `--warn` -> `--muted`.
 *   .required-mark            `--warn` -> `--muted`.
 *   .read-chip.selected       filled `--blue` -> filled `--selected`; state separation against the
 *                             unselected chip 5.21:1 -> 11.4:1.
 *   .confidence-row button    edge `--hairline-strong` (1.64:1) -> `--edge` (3.22:1).
 *   .step-index (open step)   filled `--blue` -> filled `--ink`.
 *   .commitment-field textarea  `background: transparent` -> `--surface-recessed`.
 *   .context-loop, .record-mode  given a measure: 116 characters on one line -> 58.
 *   .record-mode.session-only `--warn` -> `--edge` / `--ink`.
 *   .board-note > i, button   `--blue` -> `--muted` / `--ink`.
 *   the board itself          `.selected-square` and `.legal-square::before` moved off the
 *                             engine's hue onto the board's own family, and the focus ring
 *                             gained a halo so it is visible on a dark square.
 *
 * THE ONE THAT SETTLES IT ON ITS OWN. On a cold `DECIDE` before this change, the ONLY saturated
 * colour on the screen was `--warn`, on the submit's dashed edge and on the required marks --
 * an alarm about something the player had not yet had the chance to do. A decision taken in front
 * of that screen and one taken in front of a screen with no evaluative colour on it are two
 * measurements, and nothing in the row itself tells them apart. Decision time is measured to the
 * commit, so what the control that ends it looks like is not cosmetic.
 *
 * THIS IS NOT A CLAIM THAT v3 ROWS ARE WRONG. Only that they are not the same population. A
 * version split is not free -- it fragments what a later analysis may pool -- and that cost is
 * paid here on purpose rather than avoided by calling a stimulus change a repaint.
 *
 * WHAT REMAINED IDENTICAL: commitment requirements, confidence collection and its sampling, the
 * candidate list, the counterfactual probe and its rate, reveal timing, engine timing, thresholds,
 * eligibility, scoring, the measurement schema, the interpretation policy, every word of
 * measurement wording, the order the questions are asked in, and the position of every control.
 * `LAW 9`'s three friction points are untouched. `deriveInteractionMode`, `MODE_CONTRACT`,
 * `makingEvidence`, `engineMayRun` and `next-action.ts` were not edited.
 */
/*
 * 4, SECOND ROUND: THE PANEL'S SIDE AND ITS STEP MARKS, ON THE SAME UNRELEASED VERSION.
 *
 * WHAT CHANGED. Two of these three are on the list the 2 -> 3 note says would force a bump, and
 * the first contradicts a sentence the 3 -> 4 note above wrote:
 *
 *   .workbench                the task column moved from track 3 to track 1. On a right-to-left
 *                             page that puts `.commitment-screen` at the reading start rather than
 *                             at the far left -- measured at 1440x900, x=24..354 before. The note
 *                             above lists "the position of every control" among what stayed
 *                             identical. It is not identical any more, and this is that sentence
 *                             being corrected rather than left standing.
 *   .step-index               a filled circle badge -> a mono ordinal, ruled once its step is
 *                             answered. Three states before and three after, none of them colour
 *                             alone; what goes is the wizard-step form, on the one screen whose
 *                             contract is that it is RECORDING rather than collecting.
 *   .commitment-step[open]    lost its border. `--raise` now travels 0.186 in luminance from the
 *                             page rather than 0.040, which is the work the border was doing.
 *   .commitment-step + ...    the four steps are ruled into a register: one hairline between
 *                             consecutive rows, 6px either side, against the 12px that separates
 *                             the panel's regions. The open step is lifted out of it rather than
 *                             ruled into it, so the rhythm does not change when a step opens.
 *                             The panel's total height moves; no control moves relative to the
 *                             ones around it, and none is added or removed.
 *   @media forced-colors      the open step takes a `Highlight` border. This is the one change
 *                             that ADDS a signal rather than moving one, and it is a repair: in
 *                             that mode the open state was said only by a background, which the
 *                             mode replaces with the system's Canvas, so there was no indicator
 *                             for the open step in this build OR the one before it. A reader in
 *                             forced colours is a different stimulus population already; this
 *                             makes their screen say what everyone else's says.
 *
 * WHY THIS IS NOT 5, AND THE REASONING IS NARROW ON PURPOSE. A version number separates
 * populations, and version 4 has never stamped a row: `CURRENT_PROTOCOL_VERSION` is written in
 * exactly one place, `shared/blitz-record.ts`, by whichever build is running, and 4 exists only on
 * an unmerged branch that has not been deployed. Splitting 4 from 5 here would produce two
 * versions, one of them permanently empty, and then ask every later analysis to pool them back
 * together: the fragmentation cost of a bump with none of its discrimination benefit. The rule
 * this file states is about a stimulus that changed UNDER MEASUREMENT. Nothing was measured under
 * either half of 4.
 *
 * THIS EXPIRES THE MOMENT A BUILD STAMPING 4 REACHES A PLAYER. After that the next change to the
 * same list is 5, whatever else is in flight, and no argument of this shape applies again.
 *
 * WHAT REMAINED IDENTICAL: every word on the screen, every question, the order they are asked in,
 * the confidence scale and its sampling, the counterfactual probe and its rate, reveal timing,
 * engine timing, thresholds, eligibility, scoring, and the measurement schema.
 *
 * AND ONE THING THAT DID NOT COME APART. The DOM order moved with the visual order in `Home.tsx`,
 * so the sequence a keyboard player walks is the sequence a sighted player sees. A layout change
 * that had left those two disagreeing would have changed the instrument for one population and
 * not the other, which is a worse problem than a version number.
 */
export const CURRENT_PROTOCOL_VERSION = 4;

/**
 * What analysis timing a protocol is allowed to have.
 *
 * `instrumented-blitz` may only ever be `after-play`, and that is INV-4 expressed as data rather
 * than as a rule somebody has to remember. A row that claims otherwise is a bug that shows up in
 * the record, where a query can find it, rather than only in the code, where it cannot.
 */
export const REQUIRED_ANALYSIS_TIMING: Readonly<
  Partial<Record<MeasurementProtocol, AnalysisTiming>>
> = {
  "historical-passive": "after-play",
  "instrumented-blitz": "after-play",
  /* `instrumented-standard` is genuinely both: the engine runs during play in either reveal mode. */
};

/**
 * True when a decision's protocol and analysis timing contradict each other.
 *
 * NULL IS NOT A CONTRADICTION. An unstamped row is not claiming anything, and the whole point of
 * leaving it null is that it makes no claim -- see `protocolOf` below.
 */
export function contradictsProtocol(
  protocol: MeasurementProtocol | null,
  timing: AnalysisTiming | null,
): boolean {
  if (protocol === null || timing === null) return false;
  const required = REQUIRED_ANALYSIS_TIMING[protocol];
  return required !== undefined && required !== timing;
}

/**
 * A row that never recorded its conditions.
 *
 * NOT A PROTOCOL, which is why it is a separate key rather than a fourth member of the union --
 * exactly the argument `evidence-policy.ts` makes for `LEGACY_CONTEXT`, and `reveal-timing`'s
 * schema makes for a nullable enum.
 *
 * THE TEMPTING BACKFILL IS `instrumented-standard`, AND IT IS A LIE. Every decision written before
 * this field existed was in fact made in the untimed commitment loop, because that was the only
 * loop there was -- so the backfill would even be FACTUALLY right. It is still forbidden, for the
 * reason `reveal_timing` gives about its own: it would assert that a condition was RECORDED when
 * nobody recorded one, and the first comparison between protocols would show a standard arm that
 * is enormous and perfectly measured. A fact nobody wrote down is not a fact the record may claim.
 */
export const LEGACY_PROTOCOL = "legacy" as const;
export type ProtocolKey = MeasurementProtocol | typeof LEGACY_PROTOCOL;

/** The protocol key of one decision: what it recorded, or `legacy` when it recorded nothing. */
export function protocolOf(protocol: MeasurementProtocol | null | undefined): ProtocolKey {
  return protocol ?? LEGACY_PROTOCOL;
}
