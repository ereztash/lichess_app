/**
 * WHAT TO DO NEXT, DERIVED FROM WHAT THE RECORD IS MISSING -- and from nothing else.
 *
 * THE LINE THIS MODULE HAS TO STAY ON THE NEAR SIDE OF, and `ContextRibbon` already wrote it:
 *
 *   A layer that recommended would be measuring the player and then changing what they see, which
 *   changes what is being measured.
 *
 * So every action below is justified by a fact about the RECORD -- a game nothing has scored, a
 * bucketing with too few decisions on one side, a run left half-finished -- and never by a
 * prediction about the player. Nothing here ranks options by expected value, nothing reads the
 * detector's verdict about a weakness, and nothing says what to work on. `readResume`'s existing
 * sentences walk the same line and say so: *"every `because` says what the next game MEASURES, not
 * what the player should do differently while playing it."*
 *
 * AND `docs/decisions/D21-feedback-exposure.md` IS WHY THAT LINE MATTERS MORE THAN IT LOOKS. The
 * audit found that decisions taken after a player has seen feedback are pooled with decisions taken
 * before, and that no field in the record could separate them. A layer that changed what a player
 * was shown based on their own measurements would be creating exactly the exposure the record
 * cannot represent.
 *
 * WHY A DISCRIMINATED UNION AND NOT A SENTENCE. The words belong to the screen and there are three
 * of them (`ResumeScreen`, `PostGame`, the front door), which is precisely how the product ended up
 * with `nothing-scored` telling a player to "play another game" while the thing blocking them was
 * an engine that had not run. One derivation, three renderings, and every rendering can be checked
 * against the same structure.
 *
 * IT DECIDES NOTHING YET. Nothing calls this. The plan's sequencing is derivation first, shadow
 * second, ownership third -- and the shadow pass exists because the honest thing to do with a
 * function that claims to know what a player should do next is to watch it disagree with the
 * screens for a while before believing it.
 */
import type { BlitzBlocker, BlitzShortfall, BlitzStanding } from "./blitz-reading.js";
import type { PrimaryAction } from "./primary-action.js";

/**
 * The actions. Every one names something the record needs, and carries what it needs to be rendered
 * without the screen re-deriving anything.
 */
export type NextAction =
  /**
   * Evidence exists and has not been scored yet. THE ACTION IS TO WAIT, and it is a real action:
   * this is the state where the product used to say "play another game", which adds to the backlog
   * that is already the blocker. `games` is what is pending, so the sentence can be specific enough
   * to be believed.
   */
  | { kind: "wait-analysis"; games: number; scoring: boolean }
  /** Nothing on the record at all. One decision is the whole of what is missing. */
  | { kind: "play-first-decision" }
  /** The blitz record needs more of itself before any bucketing has two sides. */
  | { kind: "play-blitz"; because: BlitzBlocker; needs: BlitzShortfall | null }
  /** One stored decision is worth looking at and has not been looked at. */
  | { kind: "review-event"; gameId: string; ply: number }
  /**
   * The standard loop's own shortfall: the anchor set is not finished.
   *
   * THE ANCHOR SET AND NOT A DECISION COUNT, because a threshold invented here would be a third
   * definition of "enough". `record-dashboard.ts` says what the anchor reading is for -- *"the one
   * that is comparable between players... two players who answered the same positions have the
   * same item difficulty"* -- so a record that has not finished it is missing a specific,
   * nameable thing rather than merely being small.
   */
  | { kind: "collect-more-evidence"; anchorAnswered: number; anchorTotal: number }
  /** A pattern was found retrospectively and needs a forward test that could come back negative. */
  | { kind: "test-hypothesis"; ruleId: string }
  /** A drill is half-finished. Finishing it is the only thing that makes its positions mean anything. */
  | { kind: "continue-drill"; drillId: string; done: number; total: number }
  /** A transfer run is half-finished. Same argument. */
  | { kind: "continue-transfer"; transferId: string; done: number; total: number }
  /** Nothing is blocked and nothing is half-done; the record is where the answer is. */
  | { kind: "return-record" }
  /**
   * NOTHING TO PROPOSE, AND IT IS A FIRST-CLASS ANSWER.
   *
   * A function that always has a suggestion is a function that will invent one, and the invented
   * one arrives exactly where the product has least to say. `none` is what the front door gets when
   * every question is open and none of them is nearer than the others.
   */
  | { kind: "none" };

export type NextActionKind = NextAction["kind"];

/**
 * What the record holds, as facts something already computes.
 *
 * NOTHING HERE IS NEW STATE. `pendingAnalyses` is `blitz-analysis-queue.ts`, `blitzStanding` is
 * `blitz-reading.ts`, the runs are `Home.tsx`'s, and `decisionsOnRecord` is the count the reveal
 * already carries. The value of gathering them is that the ORDER between them gets decided once.
 */
export interface ProductState {
  /** Stored blitz games the engine has not scored. */
  pendingAnalyses: number;
  /** True while the queue is actually working on one, as opposed to merely having a backlog. */
  analysisRunning: boolean;
  /** A drill in progress, or null. */
  drill: { drillId: string; done: number; total: number } | null;
  /** A transfer run in progress, or null. */
  transfer: { transferId: string; done: number; total: number } | null;
  /**
   * One stored decision worth showing that the player has not seen, or null.
   *
   * "HAS NOT SEEN" IS THE PART THAT MATTERS. An event the product keeps re-offering is not a next
   * action, it is a nag -- and re-showing a finding is exposure, which D21 says the record cannot
   * represent. The caller owns the seen-set; this module only asks whether one is outstanding.
   */
  unseenEvent: { gameId: string; ply: number } | null;
  /** A rule saved as a hypothesis and never tested forward, or null. */
  untestedRule: string | null;
  /**
   * Where the blitz record stands, or NULL WHEN IT HAS NOT BEEN READ YET.
   *
   * `BlitzStanding` ITSELF RATHER THAN A FLATTENED COPY, so `may: false` cannot exist without a
   * blocker naming why -- the union already guarantees that and a hand-rolled `{ may, because }`
   * would not. The shortfall comes off the same value for the same reason: two fields that must
   * agree are one field.
   *
   * NULL IS NOT "NOTHING IS BLOCKING". The front door renders before the reading resolves, and a
   * derivation that treated an unread record as an unblocked one would tell a player with eleven
   * unscored games that there is nothing to do.
   */
  blitzStanding: BlitzStanding | null;
  /** How many decisions the standard commitment loop has recorded. */
  decisionsOnRecord: number;
  /**
   * Anchor positions answered, and how many there are.
   *
   * PASSED IN RATHER THAN COUNTED HERE. `ANCHOR_POSITIONS.length` is a constant this module could
   * import, and importing it would make the shortfall depend on the CURRENT set rather than on the
   * set the record was answering. `ANCHOR_SET_VERSION` exists because that distinction is real.
   */
  anchor: { answered: number; total: number };
}

/**
 * THE ONE DERIVATION. The order is the argument, and each step is a rule rather than a preference.
 *
 * 1. A RUN IN PROGRESS OUTRANKS EVERYTHING (LAW 4). A drill is a pre-registered set: eight
 *    positions chosen in advance to test one thing, and four of them tests nothing. Abandoning it
 *    does not lose the decisions -- they are all committed -- it loses the only thing that made
 *    them a test.
 *
 * 2. UNSCORED EVIDENCE OUTRANKS MAKING MORE OF IT. This is the correction the product most needed:
 *    `nothing-scored` used to render "play another game", which grows the backlog that is itself
 *    the blocker. It is also honest in a way the old sentence was not -- since LAW 4's queue, the
 *    analysis really does finish on its own, from any page load, so waiting is a thing that works.
 *
 * 3. A FINDING NOBODY HAS SEEN OUTRANKS COLLECTING MORE. The product's whole argument is that a
 *    measured event is worth more than another measurement; leaving one unread while asking for
 *    more games contradicts it.
 *
 * 4. A HYPOTHESIS OUTRANKS EVIDENCE-GATHERING, because a rule saved and never tested is the shape
 *    this product exists to refuse. §23: nothing is coaching until it could have come back negative.
 *
 * 5. AN EMPTY RECORD IS ITS OWN CASE, and it is checked here rather than first because a player
 *    with no decisions and a half-finished drill is in the drill.
 *
 * 6. THEN THE BLOCKER DECIDES WHICH KIND OF EVIDENCE. `no-games`, `nothing-asked`,
 *    `too-few-readable` and `no-split-yet` are all answered by playing; the standard loop's
 *    shortfall is answered by deciding. `nothing-scored` never reaches here -- step 2 took it.
 *
 * 7. AND WHEN NOTHING IS BLOCKED, the record is where the answer is, not another game.
 */
export function deriveNextAction(state: ProductState): NextAction {
  if (state.drill !== null) {
    return { kind: "continue-drill", ...state.drill };
  }
  if (state.transfer !== null) {
    return { kind: "continue-transfer", ...state.transfer };
  }
  if (state.pendingAnalyses > 0) {
    return {
      kind: "wait-analysis",
      games: state.pendingAnalyses,
      scoring: state.analysisRunning,
    };
  }
  if (state.unseenEvent !== null) {
    return { kind: "review-event", ...state.unseenEvent };
  }
  if (state.untestedRule !== null) {
    return { kind: "test-hypothesis", ruleId: state.untestedRule };
  }
  /*
   * NOT READ YET IS NOT UNBLOCKED. Everything above this line is a fact the caller holds
   * synchronously -- a run in progress, a backlog it counted, an event it is holding -- and
   * everything below depends on a reading that arrives late. `none` is the honest answer in
   * between, and it is why `none` exists.
   */
  if (state.blitzStanding === null) return { kind: "none" };
  if (state.decisionsOnRecord === 0 && !state.blitzStanding.may && state.blitzStanding.because === "no-games") {
    return { kind: "play-first-decision" };
  }
  if (!state.blitzStanding.may) {
    return {
      kind: "play-blitz",
      because: state.blitzStanding.because,
      needs: state.blitzStanding.needs,
    };
  }
  /*
   * THE BLITZ RECORD MAY SPEAK. Whether the STANDARD loop still needs decisions is a separate
   * question over a separate population, and this is the only place this module answers it.
   */
  if (state.decisionsOnRecord === 0) return { kind: "play-first-decision" };
  if (state.anchor.answered < state.anchor.total) {
    return {
      kind: "collect-more-evidence",
      anchorAnswered: state.anchor.answered,
      anchorTotal: state.anchor.total,
    };
  }
  return { kind: "return-record" };
}

/**
 * Whether an action asks the player to produce evidence.
 *
 * SEPARATE FROM THE DERIVATION because it is what binds this module to LAW 1: an action that
 * produces evidence lands the player in a mode where no reading of the record may be on screen, so
 * a screen that offers one alongside its own findings is offering a route into a contaminated
 * measurement. Exported so the binding can be asserted rather than remembered.
 */
export function producesEvidence(action: NextAction): boolean {
  switch (action.kind) {
    case "play-first-decision":
    case "play-blitz":
    case "collect-more-evidence":
    case "test-hypothesis":
    case "continue-drill":
    case "continue-transfer":
      return true;
    case "wait-analysis":
    case "review-event":
    case "return-record":
    case "none":
      return false;
  }
}

/**
 * The screens a shadow of this derivation may be taken on.
 *
 * IT LIVES HERE AND NOT IN THE TRIAL LEDGER. It was in `acquisition-evidence.ts`, which made
 * `next-action-shadow.ts` import that module for a type -- and §30's import-graph rule is that
 * nothing choosing a position, computing a reading or rendering a finding may name the telemetry
 * module at all. The rule is right and the type was in the wrong file: which screens exist is a
 * fact about the product, and the ledger is one of its readers.
 *
 * THREE, AND ONLY ONE OF THEM IS INSTRUMENTED LIVE. See `docs/decisions/D22-next-action-ownership.md`
 * for why the other two are measured by a test instead of by a hook.
 */
export const SHADOW_SURFACES = ["resume", "post-game", "record"] as const;
export type ShadowSurface = (typeof SHADOW_SURFACES)[number];

/**
 * THE ACT A CONTROL WOULD HAVE TO NAME to be offering what the derivation proposes.
 *
 * WHY IT LIVES HERE AND NOT IN THE SHADOW. The shadow wrote this correspondence by hand, in one
 * surface, as `kind === "play-first-decision" || kind === "play-blitz"` -- a disjunction that is
 * true for the front door, invisible to every other screen, and silent if a kind is added. The
 * comparison the shadow exists to make is exactly this mapping, so the mapping is the thing that
 * should be stated once and checked.
 *
 * `null` IS A REAL ANSWER AND THE INTERESTING ONE. Two proposals correspond to no control at all:
 *
 *   `wait-analysis`  the act is to WAIT, and there is no button for waiting. A screen offering
 *                    anything here is offering something the derivation did not propose -- which is
 *                    precisely the defect P1.5 fixed on the front door, where `nothing-scored` used
 *                    to render "play another game" and grow the backlog that was the blocker.
 *   `none`           the derivation has nothing to say. A control here would be the screen
 *                    deciding, which is the thing the shadow is watching for.
 *
 * TWO KINDS SHARE ONE ACT, and that is correct rather than a collision: `continue-run` is the act
 * for a drill and for a transfer alike, because from the player's side finishing a pre-registered
 * set is one act whichever kind of set it is. The kinds stay apart because the SENTENCE differs.
 *
 * `collect-more-evidence` MAPS TO AN ACT WHOSE NAME IS NARROWER THAN THE ACT. `play-first-decision`
 * is the control that opens a position, and the anchor set is unfinished on records that already
 * have decisions -- so the act is right and the word "first" in its name is not. Written down here
 * rather than renamed: the name is in the closed vocabulary three gates read, and a rename that
 * touches them to fix a word is a change with more risk than the word has cost.
 */
export function actFor(kind: NextActionKind): PrimaryAction | null {
  switch (kind) {
    case "wait-analysis":
    case "none":
      return null;
    case "play-first-decision":
    case "collect-more-evidence":
      return "play-first-decision";
    case "play-blitz":
      return "play-blitz";
    case "review-event":
      return "review-event";
    case "test-hypothesis":
      return "test-hypothesis";
    case "continue-drill":
    case "continue-transfer":
      return "continue-run";
    case "return-record":
      return "return-record";
  }
}

/**
 * Whether a surface offering `offered` is offering what the derivation proposed.
 *
 * `null` OFFERED MEANS THE SCREEN OFFERS NO PRIMARY ACT, which agrees with exactly the two
 * proposals that are not acts. A screen that goes quiet where the derivation wanted a button
 * disagrees, and so does one that shows a button where the derivation wanted quiet: both are
 * disagreements and neither is a near miss.
 */
export function agreesWith(kind: NextActionKind, offered: PrimaryAction | null): boolean {
  return actFor(kind) === offered;
}
