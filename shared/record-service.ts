/**
 * The record loop, independent of transport and of storage.
 *
 * These functions used to be the bodies of the tRPC procedures in server/recordRouter.ts, which
 * meant the loop could only run against a signed-in server. The browser now runs the same loop
 * against a local store when no sign-in is configured, and the only way to keep the two honest is
 * for them to be the same code rather than two implementations that agree today.
 *
 * The rules live here, not in the router: `reveal` refuses a decision that was never committed
 * (R3), `startDrill` writes the refutation condition before a position is shown (R5), and
 * `completeDrill` is the only path that changes a grade. Moving them behind the transport would
 * make them bypassable by whichever caller skipped the router.
 */
import { evaluateClaim, type Claim, type DrillSpec, type ProspectiveDrillResult } from "./claim.js";
import { selectClaim } from "./claim-derivation.js";
import type { DecisionAtom, DecisionResult, ProbeAssignment } from "./decision-atom.js";
import { probeEligibility } from "./counterfactual.js";
import type { RevealTiming } from "./reveal-timing.js";
import type {
  AnalysisTiming,
  MeasurementProtocol,
} from "./measurement-protocol.js";
import {
  accurateDecision,
  BUCKETINGS,
  DEFAULT_THRESHOLDS,
  MIN_BUCKET_N,
  PREREGISTERED_SEPARABILITY_K,
  PREREGISTERED_THRESHOLDS,
  detect,
  summarise,
} from "./detector.js";
import {
  formLearningRule,
  gradeLearningRule,
  preregisterLearningTransfer,
  reflectionDraftSchema,
  retireLearningRule as retireRule,
  TRANSFER_POSITION_COUNT,
  type LearningRule,
  type LearningRuleDraft,
  type LearningTransferObservation,
  type LearningTransferResult,
  type ReflectionDraft,
} from "./learning-record.js";
import {
  completeDrillAgainstBaseline,
  createDrill,
  describeResult,
  evaluateRefutation,
  startDrill,
  type DrillDecision,
} from "./drill.js";
import { selectDrillPositions } from "./drill-positions.js";
import { classifyPhase } from "./phase.js";
import { plyFromFen, positionKey, samePosition } from "./position-key.js";
import { isScoreable, scoreRecall } from "./recall-score.js";
import type { CommitDecisionInput, FeedbackInput, RecordStore } from "./record-store.js";
import { storedBlitzRecordSchema, type StoredBlitzRecord } from "./blitz-record.js";
import type { DecisionPurpose } from "./confidence-asked.js";
import { readRecord, type RecordReading } from "./record-dashboard.js";
import type { StatedParts } from "./decision-atom.js";
import { readCounterfactuals } from "./counterfactual-reading.js";
import { oneThingMix } from "./reveal.js";
export type { RecordReading } from "./record-dashboard.js";
import { scoreDecisions, silenceReason, type ScoringSummary } from "./scoring.js";
import {
  admissionFor,
  discoverySearchPopulation,
  forAnchorReference,
  forDescriptiveHistory,
  forDiscovery,
  stratumId,
} from "./evidence-policy.js";
import { isAnchorFen } from "./anchor-set.js";
import { readsAreAsked } from "./confidence-asked.js";
import { isRegistrableBucket, isTestable, type PreregisteredHypothesis } from "./prereg.js";
import type { StoredImportDiagnostic } from "./import-diagnostic.js";
import { LEGACY_CONFIDENCE_LEVELS } from "./confidence.js";

/**
 * A refusal with a transport-neutral code.
 *
 * The server maps these onto TRPCError so the HTTP surface is unchanged; the browser shows the
 * message directly. The codes are the tRPC names because that is the mapping that already
 * existed, and renaming them would have changed the wire behaviour for no gain.
 */
export type RecordErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "CONFLICT"
  | "NOT_FOUND"
  | "PRECONDITION_FAILED"
  | "INTERNAL_SERVER_ERROR";

export class RecordError extends Error {
  constructor(
    readonly code: RecordErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RecordError";
  }
}

/** The commit event as it arrives: engine-free by construction (section 3.2). */
export type CommitEvent = {
  decision_id: string;
  entry_state: {
    game_id: string;
    fen: string;
    ply: number;
    phase: string;
    clock_ms_remaining: number | null;
  };
  /**
   * Why the position was in front of the player.
   *
   * OPTIONAL AND NULLABLE, WHICH ARE THE SAME THING HERE AND NEITHER IS `play`. A client that
   * predates this field sends nothing, and null is stored: its decisions are still perfectly good
   * calibration data, and refusing them would cost real measurements to gain a label. What is NOT
   * optional is the consequence -- an absent purpose cannot claim the first-decision exemption,
   * so an empty read arriving without one is refused below.
   */
  purpose?: DecisionPurpose | null;
  /**
   * The drill this decision belongs to, when it claims to be a drill decision.
   *
   * Optional so a client that predates it can still write; the price is paid in `commitDecision`,
   * which refuses a decision claiming `drill` without one rather than storing an unbindable claim.
   */
  drill_id?: string | null;
  /**
   * The transfer check this decision belongs to, when it claims to be one.
   *
   * Optional for `drill_id`'s reason and refused for `drill_id`'s reason: a client older than the
   * field can still write, and `commitDecision` refuses a decision claiming `transfer` without one
   * rather than storing an unbindable claim.
   */
  transfer_id?: string | null;
  known: string;
  unknown: string;
  /**
   * How each read was said. Optional on the type because a client older than this change sends
   * neither, and null is written for those -- "nobody recorded it", not "answered with silence".
   */
  known_parts?: StatedParts | null;
  unknown_parts?: StatedParts | null;
  decision: string;
  bounded_action: {
    seconds_taken: number;
    /** Null when the question was never put -- see shared/confidence-asked.ts. Not "unanswered". */
    confidence: number | null;
    /** Which scale that confidence was stated on. Optional in the type, refused below if absent. */
    confidence_scale?: number;
    /** Which grid that scale was. See `shared/confidence.ts`. */
    confidence_grid_version?: number;
    candidate_moves_considered: string[];
  };
  /**
   * The arm, assigned before the player was seen. Null from a client that predates the probe.
   *
   * `alternative` and `answered` are on the type because the atom carries them, and they are
   * refused below if a commit event arrives with either set: the commit happens BEFORE the
   * question is put, so an answer riding along means the client asked first -- which is how
   * naming an alternative turns into choosing it.
   */
  probe: {
    assignment: ProbeAssignment;
    legal_moves: number;
    alternative: string | null;
    answered: boolean;
    alternative_cp_loss: number | null;
  } | null;
  /** Which reveal timing produced this decision. Null from a client that predates the setting. */
  reveal_timing: RevealTiming | null;
  /**
   * The conditions this decision was produced under. Null from a client that predates the field.
   *
   * NOT DEFAULTED HERE, and that is the point. A server that filled in `instrumented-standard` for
   * an unstamped client would be manufacturing the very fact the field exists to record, and the
   * manufactured value is indistinguishable afterwards from one a client actually reported.
   */
  measurement_protocol: MeasurementProtocol | null;
  protocol_version: number | null;
  analysis_timing: AnalysisTiming | null;
  result: null;
  feedback: null;
};

export async function commitDecision(
  store: RecordStore,
  input: CommitEvent,
): Promise<{ decision_id: string }> {
  // Re-derive the phase from the FEN rather than trusting the caller's label.
  const phase = classifyPhase(input.entry_state.fen, input.entry_state.ply);
  if (phase !== input.entry_state.phase) {
    throw new RecordError(
      "BAD_REQUEST",
      `שלב המשחק שנשלח (${input.entry_state.phase}) אינו תואם את העמדה (${phase}).`,
    );
  }
  /*
   * A DECISION ARRIVING WITHOUT ITS SCALE IS REFUSED, and the asymmetry with stored rows is
   * deliberate. An old row's missing scale is resolved by its age -- it was written when there
   * were five levels, and that is a fact. An incoming one has no age to appeal to: it is a live
   * client that did not say which scale its player answered on, and reading a `4` as 0.75 or 0.50
   * would be a coin toss over what someone actually said. Refusing is the only honest option, and
   * it fails loudly at the boundary rather than quietly in the record.
   */
  const confidenceScale = input.bounded_action.confidence_scale;
  if (confidenceScale === undefined) {
    throw new RecordError(
      "BAD_REQUEST",
      "ההחלטה נשלחה בלי לציין על איזה סולם ביטחון היא נאמרה, ולכן אי אפשר לקרוא אותה.",
    );
  }
  /*
   * THE EXEMPTION IS ENFORCED HERE, WHERE BOTH LOOPS RUN THROUGH, and this check could not have
   * existed a commit ago.
   *
   * The two read fields are required on every purpose except `first`. That rule lived only in
   * `draftProblems`, on the client, because the record did not carry a purpose for anything else
   * to check against -- so the boundary had a choice between refusing every empty read and
   * accepting every empty read, and the HTTP path took the first while the browser path took the
   * second. The exemption shipped unreachable over the wire: `commitEventSchema` still carried
   * `min(1)`, so a first decision made against a server was refused with a validation error that
   * named a field the player had deliberately not been asked for.
   *
   * Now the purpose is on the event, one rule holds on both paths, and it is a REFUSAL rather
   * than a repair: nothing here fills the fields in or downgrades the purpose. A decision that
   * arrives empty without the standing to be empty is a client bug, and R2 says a bug is reported
   * rather than smoothed into a row that reads like a player who said nothing.
   */
  /*
   * THE ONE PROTOCOL BINDING THAT IS VERIFIABLE TODAY, and the reason it is only one.
   *
   * A purpose is a label the CLIENT supplies, and a label with nothing behind it is metadata from
   * the subject rather than provenance. `anchor` is the one this build can check without believing
   * anything it was told: bank membership is a property of the FEN, and the FEN is re-derived for
   * the phase check above anyway. So a decision claiming to be a bank answer must be on a bank
   * position, and the reading that compares players cannot be inflated with positions nobody else
   * ever answered.
   *
   * THE OTHER DIRECTION IS NOT CHECKED, DELIBERATELY. A decision on a bank FEN claiming `play`
   * would slip a bank answer into discovery, and refusing that here would ALSO refuse a drill or a
   * transfer check that legitimately uses a bank position -- `decisionPurposeFor` ranks both above
   * `anchor` precisely because what is being measured is the drill. Closing it needs the anchor
   * payload (set version and position) that section 2 of the constitution specifies, so that a
   * bank answer identifies its slot rather than being guessed at from the board.
   *
   * `drill` AND `transfer` ARE BOTH CHECKED NOW. Each event carries its id and each block below
   * resolves it against an object written down before the decision was made.
   */
  if (input.purpose === "anchor" && !isAnchorFen(input.entry_state.fen)) {
    throw new RecordError(
      "BAD_REQUEST",
      "ההחלטה נשלחה כאילו היא עמדה מהסט המשותף, אבל העמדה אינה בסט — ורק עמדות הסט נמדדות בו.",
    );
  }
  /*
   * WHY `drill` IS THE LABEL WORTH BINDING, out of six.
   *
   * It is the one that moves a decision ACROSS the wall `shared/evidence-policy.ts` draws. A
   * decision labelled `drill` is refused by discovery, because a drill selects positions BECAUSE
   * of a weakness and tells the player what is being tested before collecting the evidence -- so
   * reading its output as discovery lets the attempt to fix a weakness manufacture the next one.
   * A drill decision mislabelled `play` walks straight into that loop, and a free-play decision
   * mislabelled `drill` is quietly excluded from the population it belongs to. One field, both
   * directions, and until now nothing on the wire could tell either way.
   *
   * THREE THINGS ARE CHECKED, AND THE THIRD IS THE ONE THAT MATTERS. That an id was sent; that it
   * names a drill this record holds; and that THAT DRILL CONTAINS THIS POSITION. The first two
   * alone would let any drill id launder any decision -- a player could answer forty free-play
   * positions carrying a stale drill id and have every one of them excluded from discovery. The
   * third makes the claim a claim about a specific position that was written down, under R5,
   * before the decision was made.
   *
   * A DRILL DECISION IS REFUSED, NOT DOWNGRADED. Storing it as `play` because the binding failed
   * would put the drill's output into the discovery population, which is the exact harm; storing
   * it as `drill` with no binding would keep the trust this block exists to remove. Refusing is
   * the only outcome that does not quietly assert something nobody checked.
   */
  if (input.purpose === "drill") {
    if (!input.drill_id) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה כהחלטת תרגול אבל בלי לומר לאיזה תרגול — ותווית שאין מאחוריה תרגול אינה נבדקת.",
      );
    }
    const drill = await store.getDrill(input.drill_id);
    if (!drill) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה כהחלטת תרגול, אבל התרגול שהיא מצביעה עליו אינו ברשומה.",
      );
    }
    if (!drill.spec.fens.includes(input.entry_state.fen)) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה כהחלטת תרגול, אבל העמדה אינה אחת מהעמדות שהתרגול רשם לפני שהתחיל.",
      );
    }
  } else if (input.drill_id) {
    /*
     * TWO STATEMENTS THAT CANNOT BOTH BE TRUE, and refusing is cheaper than deciding which to
     * believe. Dropping the id would silently keep a decision that thought it was part of a drill;
     * keeping it would file a `play` decision under a drill and let a later reading scope it there.
     */
    throw new RecordError(
      "BAD_REQUEST",
      "ההחלטה מצביעה על תרגול אבל אינה מסומנת כהחלטת תרגול. שתי האמירות אינן יכולות להתקיים יחד.",
    );
  }
  /*
   * THE SAME BINDING FOR `transfer`, AND THE REASON IT WAITED WAS WRONG.
   *
   * It was called the smaller hole because "a transfer's observations are written through
   * `recordLearningTransferObservation`, which knows which transfer it is inside". That call does
   * resolve the transfer and does check the position -- but it is a SECOND call, made after this
   * one has already returned, and nothing obliges a client to make it. The decision was stored
   * carrying the label and no binding, and it is the DECISION that `EVIDENCE_POLICY` reads.
   *
   * BOTH DIRECTIONS, exactly as for `drill`. Discovery refuses a `transfer` decision -- "taken
   * while deliberately applying a rule; that is the intervention working" -- so a `play` decision
   * mislabelled `transfer` is dropped from the population it belongs to, and a transfer check
   * mislabelled `play` walks the intervention into the evidence meant to test it.
   *
   * AND IT ANSWERS THE QUESTION `scoped(to: "matching-transfer")` HAS BEEN ASKING. That cell says
   * a transfer's observations may decide that transfer and no other; until now nothing on the row
   * could say which transfer was the matching one.
   *
   * THREE CHECKS, AND THE THIRD IS AGAIN THE ONE THAT MATTERS: that an id was sent, that it names
   * a transfer this record holds, and that THAT TRANSFER NAMED THIS POSITION IN ADVANCE. The first
   * two alone would let one open transfer launder every decision a player takes while it is open.
   *
   * COMPARED AS POSITIONS, not as strings, for the reason `recordLearningTransferObservation`
   * already gives: a decision recorded against the identical board later in a game is the position
   * that was written down, and preregistration deduplicates by `positionKey` so the match is
   * unambiguous. Comparing raw FENs here and by position there would let a decision pass one check
   * and fail the other, which is worse than either rule alone.
   */
  if (input.purpose === "transfer") {
    if (!input.transfer_id) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה כבדיקת העברה אבל בלי לומר לאיזו בדיקה — ותווית שאין מאחוריה בדיקה אינה נבדקת.",
      );
    }
    const transfer = await store.getLearningTransfer(input.transfer_id);
    if (!transfer) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה כבדיקת העברה, אבל הבדיקה שהיא מצביעה עליה אינה ברשומה.",
      );
    }
    if (!transfer.fens.some((fen) => samePosition(fen, input.entry_state.fen))) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה כבדיקת העברה, אבל העמדה אינה אחת מהעמדות שהבדיקה רשמה מראש.",
      );
    }
  } else if (input.transfer_id) {
    /* Two statements that cannot both be true -- see the drill's `else if` above. */
    throw new RecordError(
      "BAD_REQUEST",
      "ההחלטה מצביעה על בדיקת העברה אבל אינה מסומנת כבדיקת העברה. שתי האמירות אינן יכולות להתקיים יחד.",
    );
  }
  /*
   * RE-DERIVED FROM THE EVENT, WHICH IS WHAT MAKES IT A RULE RATHER THAN A CLAIM. The first
   * version of this check read `purpose === "first"` -- a label the client supplies, which the
   * boundary had to take on trust. `readsAreAsked` is a pure function of the purpose, the game,
   * the position and the ply, and all four ride on the event, so the server works out for itself
   * whether this decision was required to carry the words.
   *
   * A DECISION WITH NO PURPOSE IS REQUIRED TO CARRY THEM. Nothing recorded why it existed, so
   * nothing can say the draw passed it over -- and an exemption claimable by omission would make
   * dropping the field the way to skip the questions.
   */
  const required =
    input.purpose == null
      ? true
      : readsAreAsked({
          purpose: input.purpose,
          gameId: input.entry_state.game_id,
          fen: input.entry_state.fen,
          ply: input.entry_state.ply,
        });
  if (required && (input.known.length === 0 || input.unknown.length === 0)) {
    throw new RecordError(
      "BAD_REQUEST",
      "ההחלטה נשלחה בלי מה שנקרא בעמדה ובלי מה שאי אפשר להעריך בה, אבל על ההחלטה הזאת הן נדרשות.",
    );
  }
  /*
   * THE ARM IS CHECKED AGAINST THE POSITION, exactly as the phase is on the line above, and for
   * the same reason: everything the record will later divide by has to be re-derived rather than
   * believed. A wrong legal-move count silently biases every estimate conditioned on it, and a
   * `probed` arm on a position that could never have carried the question puts a row in the
   * treatment group that no randomisation could have placed there.
   */
  const probe = input.probe;
  if (probe) {
    if (probe.answered || probe.alternative !== null) {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה נשלחה עם תשובה על השאלה החלופית, אבל השאלה נשאלת רק אחרי שהמהלך ננעל.",
      );
    }
    const { legalMoves, eligible } = probeEligibility(input.entry_state.fen);
    if (probe.legal_moves !== legalMoves) {
      throw new RecordError(
        "BAD_REQUEST",
        `מספר המהלכים החוקיים שנשלח (${probe.legal_moves}) אינו תואם את העמדה (${legalMoves}).`,
      );
    }
    if (probe.assignment !== "ineligible" && !eligible) {
      throw new RecordError(
        "BAD_REQUEST",
        "העמדה הזאת לא יכולה לשאת את השאלה החלופית, ולכן היא לא יכולה להיות באף אחת משתי הזרועות.",
      );
    }
    if (probe.assignment === "ineligible" && eligible) {
      throw new RecordError(
        "BAD_REQUEST",
        "העמדה הזאת יכולה לשאת את השאלה החלופית, ולכן סימונה כלא־כשירה יוציא אותה מהניסוי בלי סיבה.",
      );
    }
  }
  const row: CommitDecisionInput = {
    decisionId: input.decision_id,
    gameId: input.entry_state.game_id,
    fen: input.entry_state.fen,
    ply: input.entry_state.ply,
    phase,
    clockMsRemaining: input.entry_state.clock_ms_remaining,
    /*
     * Stored as sent, and NOT re-derived -- because it cannot be. The phase above is recomputed
     * from the FEN and the legal-move count from the position, precisely so a wrong label cannot
     * bias what the record is divided by later. Why a position was in front of a player is a fact
     * about the client's loop and nothing on the wire proves it, so this is a claim by the client
     * with the same standing as `reveal_timing`. `?? null` rather than a default: absent means
     * nobody recorded one.
     */
    purpose: input.purpose ?? null,
    /* Verified above, not taken on trust. Null on every purpose but `drill`. */
    drillId: input.drill_id ?? null,
    /* The same, for `transfer`. */
    transferId: input.transfer_id ?? null,
    secondsTaken: Math.round(input.bounded_action.seconds_taken),
    chosenMove: input.decision,
    candidateMovesConsidered: input.bounded_action.candidate_moves_considered,
    statedRead: input.known,
    statedUnknown: input.unknown,
    statedReadParts: input.known_parts ?? null,
    statedUnknownParts: input.unknown_parts ?? null,
    confidence: input.bounded_action.confidence,
    confidenceScale,
    /*
     * NOT REFUSED WHEN ABSENT, unlike the scale above, and the asymmetry is the same one
     * `normaliseConfidence` makes: a missing scale could be a live client that forgot, so reading
     * it either way would be a coin toss over what somebody said. A missing grid version cannot
     * be -- only one has ever shipped -- so absence dates the row rather than hiding a choice.
     */
    confidenceGridVersion: input.bounded_action.confidence_grid_version ?? null,
    probeAssignment: probe?.assignment ?? null,
    legalMoves: probe?.legal_moves ?? null,
    revealTiming: input.reveal_timing,
    measurementProtocol: input.measurement_protocol,
    protocolVersion: input.protocol_version,
    analysisTiming: input.analysis_timing,
  };
  await store.commitDecision(row);
  // Deliberately returns no engine field of any kind.
  return { decision_id: input.decision_id };
}

/**
 * Store the engine's verdict against an ALREADY COMMITTED decision, and hand back the atom.
 * Refuses when the decision was never recorded: that is R3, wherever the loop is running.
 */
/**
 * The player's answer to "what would you have played instead".
 *
 * A THIN WRAPPER OVER THE STORE ON PURPOSE. The three refusals -- no such decision, an arm that
 * was never asked, the engine has already spoken -- live in the store implementations because
 * each has to check them against its own reveal state, and both implementations are exercised by
 * the same test file. What belongs here is the one rule that is about the ANSWER rather than the
 * record: the alternative may not be the move that was committed.
 */
export async function recordCounterfactual(
  store: RecordStore,
  decisionId: string,
  alternative: string | null,
): Promise<{ decision_id: string }> {
  if (alternative !== null) {
    const atom = await store.getAtom(decisionId);
    /*
     * The committed move is not an answer to "what would you have played INSTEAD", and a board
     * interaction produces it easily -- the piece is already on that square. A row whose two
     * moves are the same would be classified on the strength of the chosen move alone, so it
     * would read as `both-good` or `neither` while measuring nothing.
     */
    if (atom && atom.decision === alternative) {
      throw new RecordError(
        "BAD_REQUEST",
        "המהלך החלופי זהה למהלך שנרשם, והשאלה היא מה היה נעשה במקומו.",
      );
    }
  }
  await store.recordCounterfactual(decisionId, alternative);
  return { decision_id: decisionId };
}

export async function reveal(
  store: RecordStore,
  decisionId: string,
  result: DecisionResult,
  /**
   * What the named alternative cost, out of the SAME search that scored the chosen move.
   *
   * Carried on the reveal rather than as its own call because it is measured at the same moment
   * and by the same tree: `cpLossFromMultiPv` reads both moves off one root search, so both
   * scores share a window, a depth and an iteration. A second round trip would let one land
   * without the other, and a record holding a chosen-move score and no alternative score is one
   * where the reading silently does not exist.
   */
  alternativeCpLoss?: number | null,
): Promise<DecisionAtom> {
  const existing = await store.getAtom(decisionId);
  if (!existing) {
    throw new RecordError(
      "FORBIDDEN",
      "אין החלטה רשומה למזהה הזה. המנוע אינו מדבר לפני שההחלטה נרשמה.",
    );
  }
  if (await store.hasReveal(decisionId)) {
    /*
     * A REPLAY COMPLETES THE RECORD; A DIFFERENT SECOND REVEAL IS STILL REFUSED.
     *
     * This threw unconditionally, and that is the third instance of the shape cycles 31 and 36
     * closed -- the gate written to protect append-only-ness being the thing that freezes a
     * half-written record. The two writes below are not atomic: the reveal can land and the
     * alternative's price fail, and `scoreCounterfactual` can refuse on its own (no answer row,
     * or an answer that named no move) AFTER the reveal has committed. The retry then re-entered
     * here, found `hasReveal` true, and threw -- and this line is the ONLY caller of
     * `scoreCounterfactual` in the product, so no other path could ever write that price.
     *
     * What the record loses is invisible: `readCounterfactuals` drops an unpriced pair, so the
     * decision counts in `asked` and `answered` and in none of the four readings. A row of the
     * probe's treatment arm leaves the denominator with no trace.
     *
     * COMPLETING A NULL IS NOT OVERWRITING A VALUE, and that distinction is the whole of the
     * safety here. A replay may fill the price if it is still null; it may not change the reveal,
     * the alternative move, or a price already stored. A second reveal carrying a DIFFERENT
     * verdict is a different claim about the same decision and stays a CONFLICT.
     */
    const sameVerdict =
      existing.result !== null &&
      existing.result.engine_eval_cp === result.engine_eval_cp &&
      existing.result.engine_best_move === result.engine_best_move &&
      existing.result.engine_depth === result.engine_depth &&
      existing.result.engine_source === result.engine_source &&
      /*
       * THE BUILD IS PART OF THE VERDICT, so a second reveal from a different binary is a CONFLICT
       * rather than a replay. The retry above re-sends the identical payload and still matches; what
       * this refuses is a row revealed once by one engine and again by another, which is two claims
       * about one decision and not one claim sent twice.
       */
      existing.result.engine_build === result.engine_build &&
      existing.result.cp_loss === result.cp_loss;
    if (!sameVerdict) {
      throw new RecordError("CONFLICT", "ההחלטה כבר נחשפה. הרשומה היא append-only.");
    }
    if (
      alternativeCpLoss !== undefined &&
      alternativeCpLoss !== null &&
      existing.probe?.answered === true &&
      existing.probe.alternative !== null &&
      existing.probe.alternative_cp_loss === null
    ) {
      await store.scoreCounterfactual(decisionId, alternativeCpLoss);
    }
    const replayed = await store.getAtom(decisionId);
    if (!replayed) throw new RecordError("INTERNAL_SERVER_ERROR", "רשומה נעלמה.");
    return replayed;
  }
  await store.recordReveal(decisionId, result);
  /*
   * AFTER the reveal is stored, and the order is the point. `scoreCounterfactual` refuses when no
   * alternative was named, and that refusal must not be able to lose the engine's verdict on the
   * chosen move -- which is the decision's own outcome and the thing every other measure reads.
   */
  if (alternativeCpLoss !== undefined && alternativeCpLoss !== null) {
    await store.scoreCounterfactual(decisionId, alternativeCpLoss);
  }
  const atom = await store.getAtom(decisionId);
  if (!atom) throw new RecordError("INTERNAL_SERVER_ERROR", "רשומה נעלמה.");
  return atom;
}

export async function feedback(
  store: RecordStore,
  decisionId: string,
  input: FeedbackInput,
): Promise<{ decision_id: string }> {
  if (!(await store.hasReveal(decisionId))) {
    /*
     * "לפני שהמנוע ענה" AND NOT "לפני שראית את התוצאה", which is what this said. The guard is
     * `hasReveal` -- a stored engine verdict -- and on a deferred game that verdict exists while
     * the player has been shown nothing. The rule is unchanged; the sentence now describes it.
     */
    throw new RecordError("FORBIDDEN", "אי אפשר לתקן קריאה לפני שהמנוע ענה.");
  }
  await store.recordFeedback(decisionId, input);
  return { decision_id: decisionId };
}

export async function createLearningRule(
  store: RecordStore,
  input: { reflection: ReflectionDraft; rule: LearningRuleDraft },
  now: { rule_id: string; created_at: string },
) {
  const atom = await store.getAtom(input.rule.source_decision_id);
  if (!atom?.result) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      "אפשר לנסח כלל למידה רק אחרי החשיפה.",
    );
  }

  /*
   * THE RULE IS VALIDATED BEFORE THE REFLECTION IS WRITTEN, because the write used to come first.
   *
   * `formLearningRule` runs a schema parse that can throw, and it ran BETWEEN the two writes, so a
   * draft it refused left a reflection on the record and no rule. Building the rule first makes
   * that throw free: nothing has been written when it fires.
   *
   * NARROWER THAN THE FIRST VERSION OF THIS NOTE CLAIMED. An adversarial check of the finding
   * established that the parse is dead on the SERVER path -- `learningRuleEventSchema` parses both
   * halves with `.strict()` in the router before this function is reached -- so it survives only on
   * the browser path, where `record-api` calls the service directly. And on that path the store
   * write cannot fail either, because `LocalRecordStore.write` swallows a quota error and
   * downgrades to memory. The two ways to reach a half-written record are therefore disjoint: this
   * throw on the browser, and a genuine driver failure on the signed-in MySQL path.
   */
  const rule = formLearningRule(input.rule, now);
  const reflection = reflectionDraftSchema.parse(input.reflection);

  /*
   * A REFLECTION ALREADY ON THE RECORD STANDS, AND THAT NO LONGER REFUSES THE RULE.
   *
   * This threw CONFLICT whenever the incoming reflection differed from the stored one, which
   * discarded the rule as well -- and the rule is a different thing, the one the player was
   * actually trying to record.
   *
   * It matters because the two writes are not atomic. Lose the rule write and the record holds a
   * reflection and no rule; the retry then succeeds only if the reflection is BYTE-IDENTICAL.
   *
   * AND THE PLAIN RETRY DOES SUCCEED -- checked rather than assumed. The composer keeps every field
   * on screen after a failure, so a re-click without touching anything sends the same bytes, passes
   * the gate and writes the rule. An adversarial check proved that empirically against the pre-fix
   * code. What traps the decision is EDITING the revised-read box first, which is a plausible
   * response to "הכלל לא נשמר" rather than an automatic one -- and once edited, the stored text is
   * no longer on screen to be retyped. `LearningRuleComposer` is the only path that authors a rule,
   * so from there that decision carried none.
   *
   * WHAT WAS BEING PROTECTED IS STILL PROTECTED. The stored reflection is not rewritten: what you
   * said before seeing more cannot be retroactively improved, and that is the whole of the
   * append-only claim. What changes is that refusing to overwrite it no longer refuses everything
   * else. The caller is TOLD which happened rather than left to assume its text was stored --
   * silently keeping one version while the screen shows another is the thing this product exists
   * not to do.
   */
  let reflectionOutcome: "recorded" | "kept-earlier" = "recorded";
  if (!atom.feedback) {
    await store.recordFeedback(input.rule.source_decision_id, {
      revisedRead: reflection.revised_read,
      wouldChooseAgain: reflection.would_choose_again,
    });
  } else if (
    atom.feedback.revised_read !== reflection.revised_read ||
    atom.feedback.would_choose_again !== reflection.would_choose_again
  ) {
    reflectionOutcome = "kept-earlier";
  }

  await store.saveLearningRule(rule);
  return { rule, reflection: reflectionOutcome, storedReflection: atom.feedback ?? null };
}

/**
 * The learning queue, GRADED FROM THE RECORD rather than read off the stored columns.
 *
 * WHY IT CHANGED. `grade`, `retrieval_step`, `next_due_at` and `last_evaluated_at` are a
 * materialized projection: `gradeFromRecord` folds them from the results and writes them back when
 * they differ. But it only runs when a transfer touches the rule, so a rule nobody is drilling
 * keeps whatever projection it last had, indefinitely -- and the learning queue is precisely the
 * surface that lists the rules nobody is drilling.
 *
 * Four read sites in `LearningQueue.tsx` consumed the stored values: the retired filter, the
 * due-ness computation, the grade badge, and the button that is hidden on `refuted`. All four are
 * fixed here rather than there, because the read authority is a service boundary and not a
 * component: the same function feeds the local store and the tRPC route, so both paths get the same
 * answer, and a fifth surface added tomorrow gets it without knowing to ask.
 *
 * THIS IS NOT "DERIVE EVERYTHING". `gradeLearningRule` returns a `retired` rule unchanged, because
 * retirement is an act of the player's and no fold produces it. That exemption is the whole reason
 * the stored column still exists, and it is the store -- all three implementations -- that refuses
 * to take a rule off `retired`.
 *
 * NO WRITE-BACK. A read that repairs is a read that can fail, and this one is on the path that
 * renders a list. The projection stays stale in storage until the next transfer runs
 * `gradeFromRecord`, and nothing downstream can see the difference because nothing downstream reads
 * the columns any more. `tests/shared/the-queue-that-showed-a-refuted-rule.test.ts` holds the
 * disagreement open on purpose and proves which side wins.
 *
 * COST. One result query per rule. The alternative is a batched read the store interface does not
 * have, and for a queue holding one player's rules the N+1 is smaller than the machinery to avoid
 * it. If that stops being true, the fix is a batch method on `RecordStore`, not a return to reading
 * a projection nothing repairs.
 */
export async function learningRules(store: RecordStore) {
  const stored = await store.listLearningRules();
  const rules = await Promise.all(
    stored.map(async (rule) =>
      gradeLearningRule(rule, await store.listLearningTransferResults(rule.rule_id)),
    ),
  );
  return { rules };
}

export async function beginLearningTransfer(
  store: RecordStore,
  input: { rule_id: string; candidate_fens: string[] },
  now: { transfer_id: string; started_at: string },
) {
  const exists = await store.getLearningRule(input.rule_id);
  if (!exists) throw new RecordError("NOT_FOUND", "אין כלל למידה עם המזהה הזה.");
  /*
   * THE GRADE IS RE-DERIVED BEFORE ANYTHING IS DECIDED ON IT.
   *
   * The cycle-31 fold repaired the WRITE path and left every read serving the stored grade. Lose
   * one grade write on a sitting that refutes a rule -- and the player abandons the retry, which a
   * closed tab does -- and the record holds two failing results on two days while this function
   * reads `hypothesis` and preregisters a NEW transfer. `preregisterLearningTransfer` throws on a
   * refuted rule, and that throw is bypassed because it is handed the stale rule. The player then
   * sits a three-position retrieval test on a rule the record has already closed.
   *
   * Grading here is idempotent -- the fold over the same results returns the same rule -- so on
   * the ordinary path it costs a query and changes nothing, and on the damaged path it repairs the
   * record before the decision that would have been wrong.
   */
  const rule = await gradeFromRecord(store, input.rule_id);

  /*
   * ONE TEST IN FLIGHT PER RULE, AND IT IS RESUMED RATHER THAN REFUSED.
   *
   * The started transfer lived here on the server while the knowledge that one was running lived
   * only in React state -- so a reload orphaned it, and nothing stopped a second preregistration
   * over the same rule. A player could look at three positions, dislike them, refresh, and draw
   * three more: choosing their own evidence under a stamp that says they did not.
   *
   * Handing back the open one rather than erroring, because losing a tab is not misconduct, and a
   * rule whose test can be started but never finished can only ever be refuted by accident. The
   * positions come back identical because they are the ones that were written down.
   */
  /*
   * A TERMINAL GRADE ENDS THE TESTING, INCLUDING FOR A TRANSFER ALREADY IN FLIGHT.
   *
   * `preregisterLearningTransfer` throws on a refuted or retired rule, and that throw was
   * unreachable whenever an open transfer existed -- the resume path returned before it. So a
   * rule that had just been refuted, or one the player had deliberately retired, still handed
   * back a live test. An adversarial review reproduced both.
   *
   * Checked BEFORE the resume, not after: the question is whether this rule should be under test
   * at all, and it is not.
   */
  if (rule.grade === "refuted" || rule.grade === "retired") {
    return {
      transfer: null,
      observed: 0,
      reason:
        rule.grade === "refuted"
          ? "הכלל הזה הופרך, ולכן אין עליו בדיקות נוספות."
          : "הכלל הזה הוצא מתור הלמידה.",
    };
  }

  /*
   * AN UNSCOREABLE RULE IS NEVER TESTED, because the test it would get is unwinnable.
   *
   * `action_rule = "f7 f2"` is an ordinary way to write a chess rule and has no token the recall
   * measure can see. A review ran it end to end: perfect verbatim recall on all three positions,
   * zero centipawns lost, scored 0/3, and the rule came out refuted with a message blaming the
   * retrieval schedule. Refusing here means the unwinnable test is never created, and the reason
   * names the real cause instead.
   */
  if (!isScoreable(rule.action_rule)) {
    return {
      transfer: null,
      observed: 0,
      reason:
        "אי אפשר למדוד שליפה של הכלל הזה: הניסוח שלו קצר מדי או מורכב מסימונים בלבד. " +
        "כדי שהבדיקה תוכל להשוות את מה שתשלפו למה שכתבתם, הכלל צריך כמה מילים משלו.",
    };
  }

  const open = await store.getOpenLearningTransfer(rule.rule_id);
  /*
   * AN ORPHAN IS NOT RESUMED, and telling one from a legitimate resume takes both halves.
   *
   * `beginLearningTransfer` is check-then-act with no uniqueness -- it reads the open transfer and
   * later writes a new one, with nothing between them and no unique index on `rule_id`. Two tabs
   * are enough: the queue's button is disabled on `busy`, and `busy` only becomes true after the
   * first mutation RESOLVES. Both calls select from the same candidates by the same deterministic
   * rule, so the two preregistrations cover the IDENTICAL three positions.
   *
   * Reproduced end to end: sit one of them, and at the next due date the OTHER is resumed over the
   * same three boards. Decide them again -- fresh decision ids, so the spent-decision guard does
   * not fire, and `finishLearningTransfer`'s position check passes because the board IS the one
   * that was written down -- and two success days grade the rule `replicated`. Three positions
   * have become evidence that a rule held up across sittings, which is precisely what that guard
   * exists to prevent, and results are append-only so the fold reads two success days forever.
   *
   * ZERO OBSERVATIONS AND EVERY BOARD ALREADY DECIDED is what makes it an orphan. Neither half
   * alone is enough: a run the player got halfway through has some boards decided and is a
   * legitimate resume, and a run they COMPLETED but could not report has all of them decided --
   * by itself, with observations to show for it -- and must be handed back so it can be reported.
   *
   * Refusing at the report instead would leave the orphan open and the rule frozen, which is the
   * deadlock this path was fixed for one cycle ago.
   */
  const openObserved = open
    ? (await store.listLearningTransferObservations(open.transfer_id)).length
    : 0;
  if (open && openObserved === 0) {
    const decided = new Set(
      (await store.listAtoms()).map((atom) => positionKey(atom.entry_state.fen)),
    );
    if (open.fens.every((fen) => decided.has(positionKey(fen)))) {
      // Left in the table -- nothing in the store contract deletes one -- but never resumed again:
      // `getOpenLearningTransfer` hands back the NEWEST open transfer, so the fresh preregistration
      // below supersedes it instead of queueing behind it forever.
      return preregisterFreshTransfer(store, rule, input.candidate_fens, now);
    }
  }
  if (open) {
    /*
     * THE RESUME CARRIES HOW FAR THE RUN GOT, because the client cannot know and used to assume.
     *
     * It reset its index to 0 on every resume, and nothing exposed the observation count -- so a
     * returning player was served a board they had already decided and seen the engine's verdict
     * for. The server no longer breaks when that happens (the slot is derived from the board), but
     * re-serving a decided position is the thing per-position writes were introduced to prevent,
     * and not doing it is better than surviving it.
     */
    return {
      transfer: open,
      observed: (await store.listLearningTransferObservations(open.transfer_id)).length,
      reason: null,
    };
  }

  /*
   * NULL IS THE END OF THE SCHEDULE, NOT PERMISSION. `gradeLearningRule` sets `next_due_at` to
   * null when the last retrieval interval has passed, and this read it as "no date to wait for,
   * so go ahead" -- offering an unlimited supply of fresh tests to a rule that had finished,
   * while the row beside the button said "אין בדיקה נוספת".
   */
  if (!rule.next_due_at) {
    return {
      transfer: null,
      observed: 0,
      reason: "לוח החזרות של הכלל הזה הסתיים. אין בדיקה נוספת מתוזמנת עבורו.",
    };
  }
  if (new Date(now.started_at) < new Date(rule.next_due_at)) {
    return {
      transfer: null,
      observed: 0,
      reason: `הכלל הזה מתוזמן לחזרה מרווחת בתאריך ${rule.next_due_at}.`,
    };
  }

  return preregisterFreshTransfer(store, rule, input.candidate_fens, now);
}

/**
 * Select the positions and write the preregistration. Extracted so the orphan branch above can
 * reach it without duplicating the selection rule -- two copies of "which boards may be tested"
 * is how the two of them would drift.
 */
async function preregisterFreshTransfer(
  store: RecordStore,
  rule: LearningRule,
  candidateFens: string[],
  now: { transfer_id: string; started_at: string },
) {
  /*
   * NOVELTY IS A PROPERTY OF THE BOARD, NOT OF THE FEN STRING. The halfmove clock and fullmove
   * number record the GAME, so knights out and back produce a different string for an identical
   * position -- and this compared whole strings, which let a board the player had already decided
   * (and been shown the answer for) enter the test as unseen. The same hole was in the
   * deduplication: three spellings of one board would have filled a three-position test with one
   * decision.
   */
  /*
   * No separate fetch of the rule's source position. It used to be added to this set explicitly,
   * which was dead: `listAtoms()` returns every committed decision unfiltered, and a rule cannot
   * exist without its source having been committed AND revealed -- `createLearningRule` refuses
   * otherwise. A positive control deleted the line and nothing failed. It also cost a query.
   */
  const decided = new Set((await store.listAtoms()).map((atom) => positionKey(atom.entry_state.fen)));
  const byPosition = new Map<string, string>();
  for (const fen of candidateFens) {
    const key = positionKey(fen);
    if (!decided.has(key) && !byPosition.has(key)) byPosition.set(key, fen);
  }

  /*
   * NOT THE OPENING, AND NOT THREE IN A ROW.
   *
   * The candidates arrive in game order and this used to take the first three unseen. On a fresh
   * game that is plies 0, 1 and 2 -- the first of them the STARTING POSITION OF CHESS. A review
   * ran it and got exactly that.
   *
   * Two things are wrong with it. The opening is where this product's own baseline puts accuracy
   * at 70.3% against 60.2% everywhere else, so `cp_loss <= 30` is very nearly free there and half
   * the success criterion stops discriminating. And three consecutive plies are close to the same
   * board, so a test of whether a rule TRANSFERS is run on one position three times.
   *
   * The ply comes from the FEN's own fullmove number, so nothing extra has to be threaded through
   * a candidate list that is only strings.
   */
  const eligible = [...byPosition.values()].filter(
    (fen) => classifyPhase(fen, plyFromFen(fen)) !== "opening",
  );
  if (eligible.length < TRANSFER_POSITION_COUNT) {
    return {
      transfer: null,
      observed: 0,
      reason:
        `נדרשות ${TRANSFER_POSITION_COUNT} עמדות מחוץ לפתיחה שלא הכרעתם בהן; זמינות ${eligible.length}. ` +
        "בפתיחה הדיוק גבוה יותר אצל כולם, ולכן בדיקה שם כמעט לא מפרידה בין כלל שעבד לכלל שלא.",
    };
  }

  /*
   * Spread across what is available rather than the first three: a stride keeps the boards far
   * enough apart in the game to be different decisions, which is the only way three of them can
   * say anything about transfer.
   */
  const stride = Math.floor(eligible.length / TRANSFER_POSITION_COUNT);
  const unseen = Array.from(
    { length: TRANSFER_POSITION_COUNT },
    (_, index) => eligible[index * stride],
  );
  const transfer = preregisterLearningTransfer(rule, unseen.slice(0, TRANSFER_POSITION_COUNT), now);
  // R5 for learning: persist the snapshot and refutation condition before returning any FEN.
  await store.saveLearningTransfer(transfer);
  return { transfer, observed: 0, reason: null };
}

/**
 * Record one position's observation, at the moment it is made.
 *
 * WHY THIS IS A SERVER CALL AND NOT A PIECE OF REACT STATE. These were held in the component for
 * the whole run and sent only at completion, and three defects came out of that: a reload lost
 * them and the resume re-served positions whose engine verdict the player had already seen; a
 * failed reveal write stranded the run with no control that could advance it; and the client was
 * the sole holder, so completion had to believe whatever it sent.
 *
 * It is the same rule the decision layer already follows. An observation is data.
 */
export async function recordLearningTransferObservation(
  store: RecordStore,
  input: { transfer_id: string; observation: LearningTransferObservation },
) {
  const transfer = await store.getLearningTransfer(input.transfer_id);
  if (!transfer) throw new RecordError("NOT_FOUND", "אין בדיקת העברה עם המזהה הזה.");

  const already = await store.listLearningTransferObservations(transfer.transfer_id);

  /*
   * THE SLOT COMES FROM THE BOARD, NOT FROM A COUNT ONLY THE SERVER CAN SEE.
   *
   * This took `already.length` as the slot being answered, and that deadlocked the rule. The
   * client resets its index to 0 on every resume and no route exposes the count -- so after ONE
   * interruption past the first position, the board re-served `fens[0]`, this computed slot 1,
   * compared the decision against `fens[1]`, and refused. The count never changes, so every retry
   * repeated the identical refusal.
   *
   * What that costs is not the run, it is the rule. The transfer can never reach `fens.length`
   * observations, so it can never be reported; `getOpenLearningTransfer` therefore returns it
   * forever and `beginLearningTransfer` never issues another. The rule sits at `hypothesis` with a
   * due date, a test button and no path that can complete a test. The only escape in the product
   * is Archive, which kills the rule rather than repairing it.
   *
   * It is the same failure the per-position write was introduced to prevent -- "a reload lost them
   * and the resume re-served positions whose engine verdict the player had already seen". The
   * observations survived the reload; the POINTER INTO THEM did not, because it was never stored,
   * only counted.
   *
   * Deriving it from the position makes this write idempotent and independent of what the client
   * believes: the same decision on the same board answers the same slot however many times it
   * arrives, and a client that has lost its place cannot be told a wrong one.
   */
  const atom = await store.getAtom(input.observation.decision_id);
  if (!atom) throw new RecordError("PRECONDITION_FAILED", "ההחלטה הזו לא נרשמה.");
  /*
   * Compared as POSITIONS, for the same reason the candidates were: a decision recorded against
   * the identical board later in a game is the position that was written down. The candidate set
   * is deduplicated by `positionKey` at preregistration, so no two slots share a board and this
   * match is unambiguous.
   */
  const position = transfer.fens.findIndex((fen) => samePosition(atom.entry_state.fen, fen));
  if (position === -1) {
    throw new RecordError("PRECONDITION_FAILED", "ההחלטה נרשמה לעמדה אחרת מזו שבתור.");
  }

  /*
   * ALREADY ANSWERED IS A REPLAY, NOT AN ERROR -- and the answer that stands is the first one.
   *
   * A resumed client re-serves a board it has already decided; the honest response is to say that
   * slot is done so it can move on, not to write a second answer over the preregistered one. The
   * decision the player just made is a decision like any other and stays on the record; it is
   * simply not this slot's observation.
   */
  if (position < already.length) {
    return { position, remaining: transfer.fens.length - position - 1 };
  }
  /*
   * And out of order is still refused. `finishLearningTransfer` pairs observation i with `fens[i]`,
   * so the slots must fill in sequence; answering position 2 while 1 is empty would put the run in
   * a state nothing downstream can read.
   */
  if (position > already.length) {
    throw new RecordError("PRECONDITION_FAILED", "ההחלטה נרשמה לעמדה אחרת מזו שבתור.");
  }

  await store.saveLearningTransferObservation(transfer.transfer_id, position, input.observation);
  return { position, remaining: transfer.fens.length - position - 1 };
}

export async function finishLearningTransfer(
  store: RecordStore,
  input: { transfer_id: string },
  now: { completed_at: string },
) {
  const transfer = await store.getLearningTransfer(input.transfer_id);
  if (!transfer) throw new RecordError("NOT_FOUND", "אין בדיקת העברה עם המזהה הזה.");

  /*
   * THE OBSERVATIONS COME FROM THE RECORD, NOT FROM THE REQUEST.
   *
   * They used to arrive in the completion payload, which meant the client was their only holder
   * and this function had to believe them. Each one is now written when it is made, so the caller
   * sends a transfer id and nothing else -- there is no longer a shape of request that can report
   * a test the player did not sit.
   */
  const observations = await store.listLearningTransferObservations(transfer.transfer_id);
  if (observations.length !== transfer.fens.length) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      `נרשמו ${observations.length} תצפיות מתוך ${transfer.fens.length}. הבדיקה לא הושלמה.`,
    );
  }

  const priorResults = await store.listLearningTransferResults(transfer.rule_id);

  /*
   * REPORTING TWICE RETURNS THE FIRST REPORT, it does not raise.
   *
   * The Drizzle store's insert hit a bare primary-key violation, which `toTrpc` rethrew unmapped
   * as a 500 -- carrying the SQL, the column layout, the decision ids and THE PLAYER'S RECALL TEXT
   * in the response body. The owner gate goes to some length to keep record content out of a
   * refusal; this put it into one, with a worse status code.
   *
   * And it is reachable by design rather than by accident: a failed completion returns the player
   * to `running` so reporting can be retried, so a lost response means retrying forever against a
   * 500, with the verdict never shown and `next_due_at` already moved forward.
   *
   * Idempotent rather than an error, because a retry after a lost response is the honest case. The
   * second call must return what the first one recorded -- not a second, differently-timed verdict.
   */
  const already = priorResults.find((result) => result.transfer_id === transfer.transfer_id);
  /*
   * The retry GRADES, it does not just fetch. Returning `getLearningRule` was what turned a lost
   * grade write into a permanent one: the result row exists, so this branch fires forever, and the
   * rule it handed back was the ungraded one. Grading here is free when nothing was lost -- the
   * fold over the same results returns the same rule -- and repairs the record when something was.
   */
  if (already) return { result: already, rule: await gradeFromRecord(store, transfer.rule_id) };

  /*
   * A DECISION IS SPENT ONCE. This is the hole that let one sitting replicate itself.
   *
   * `beginLearningTransfer` is check-then-act with no uniqueness, so two concurrent starts -- a
   * double click is enough, since the queue's `busy` flag only flips when the first mutation
   * RESOLVES -- produced two preregistrations over the identical three positions. Play them once,
   * report the same three `decision_id`s under transfer A on one day and transfer B on the next,
   * and `gradeLearningRule` reads two results on two calendar days and writes `replicated`. It
   * filters priors by `transfer_id`, so nothing looked at whether the DECISIONS were the same.
   *
   * Three decisions cannot be evidence that a rule held up across sittings, whatever the transfer
   * ids say. Checked here rather than at `begin`, because it is the reporting that makes the
   * claim.
   */
  const spent = new Set(priorResults.flatMap((result) => result.decision_ids));
  const reused = observations.filter((o) => spent.has(o.decision_id));
  if (reused.length > 0) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      "החלטות מהבדיקה הזו כבר נספרו בבדיקת העברה קודמת של אותו כלל. " +
        "אותה ישיבה אינה יכולה לשמש כשתי בדיקות.",
    );
  }
  const atoms = await Promise.all(observations.map((o) => store.getAtom(o.decision_id)));
  for (let index = 0; index < atoms.length; index += 1) {
    const atom = atoms[index];
    if (!atom?.result) {
      throw new RecordError(
        "PRECONDITION_FAILED",
        "כל החלטה בבדיקת ההעברה חייבת להירשם ולהיחשף.",
      );
    }
    // Compared as POSITIONS, for the same reason the candidates were: a decision recorded against
    // the identical board later in a game is the position that was preregistered, and a
    // whole-string mismatch here would reject an honest answer.
    if (!samePosition(atom.entry_state.fen, transfer.fens[index])) {
      throw new RecordError(
        "PRECONDITION_FAILED",
        "החלטה בבדיקת ההעברה נרשמה לעמדה אחרת.",
      );
    }
  }

  /*
   * WHAT COUNTS AS A SUCCESS, AND WHAT WAS REMOVED FROM IT.
   *
   * This used to require three things: non-empty recalled text, a self-reported "I applied it",
   * and a low cp loss. A reviewer typed `banana`, ticked the box, played well, and got 3/3 with a
   * verdict of "the rule transferred". Two of the three were not measurements.
   *
   * `applied_rule` IS GONE FROM THE CRITERION. It is still collected -- uncontaminated now, before
   * the reveal -- and still stored, because it is worth having. It is not evidence. Reed, Ernst &
   * Banerji (1974, Exp. 3) found self-rated use of a prior solution did not correlate with
   * transfer performance in a case where transfer demonstrably occurred, and Craig et al. (2020),
   * meta-analysing 37 studies, put self-report against measured behaviour at r = 0.22 [0.14, 0.31].
   * A single binary tick is the weakest form on that scale, and "did I apply a rule in my head" is
   * the covert kind self-report handles worst.
   *
   * THE RECALL IS SCORED AGAINST THE RULE THE PLAYER AUTHORED, from the snapshot written down
   * before the test ran -- not against the rule as it stands now, which may have been edited.
   * `scoreRecall` is word overlap and says so; it is a floor against unrelated text, not a memory
   * measure. Its coverage is not stored because `recalled_rules` is, and the score is a pure
   * function of that text and the snapshot: derived beats duplicated.
   */
  /*
   * ACCURACY IS THE RECORD'S RULE, NOT A RAW CENTIPAWN CUT.
   *
   * This read `cp_loss <= ACCURATE_CP_LOSS`, which `shared/detector.ts` documents as the rule the
   * product abandoned: thirty centipawns is 2.76 points of winning chances at a level position and
   * 0.28 at +10.00, so it made "accurate" mean something different depending on how the game stood.
   * `scoreDecisions` migrated to win-probability loss; this line did not, and it had the evaluation
   * sitting on the atom the whole time.
   *
   * MEASURED at HEAD before the fix -- what the record calls accurate and this line called failure:
   *
   *     at eval   300: up to  38cp        at eval   500: up to  58cp
   *     at eval  1000: up to 212cp
   *
   * AND IT IS TERMINAL. Two sittings inside that band grade the rule `refuted`, `next_due_at` goes
   * null, and `beginLearningTransfer` refuses every later test -- on decisions the profile screen
   * is simultaneously showing as accurate. Reproduced: a player who recalls their own rule verbatim
   * and plays moves the record scores accurate had that rule killed by the evidence supporting it.
   */
  const successes = atoms.filter((atom, index) => {
    const observation = observations[index];
    const recall = scoreRecall(observation.recalled_rule, transfer.rule_snapshot.action_rule);
    return (
      recall.clearedFloor &&
      accurateDecision(atom!.result!.engine_eval_cp, atom!.result!.cp_loss)
    );
  }).length;
  const result: LearningTransferResult = {
    kind: "learning_transfer_result",
    transfer_id: transfer.transfer_id,
    rule_id: transfer.rule_id,
    decision_ids: observations.map((o) => o.decision_id),
    recalled_rules: observations.map((o) => o.recalled_rule.trim()),
    applied_rule: observations.map((o) => o.applied_rule),
    successes,
    observed: successes >= transfer.minimum_successes,
    completed_at: now.completed_at,
  };
  await store.saveLearningTransferResult(result);
  return { rule: await gradeFromRecord(store, transfer.rule_id), result };
}

/**
 * Read every result for the rule and write the grade they add up to.
 *
 * THE RESULTS ARE RE-READ RATHER THAN ASSEMBLED FROM WHAT THIS CALL HAPPENS TO HOLD. That costs a
 * query and buys the property the whole change is for: the grade is a function of the record, so
 * whoever runs this -- the call that wrote the result, or a retry an hour later -- gets the same
 * answer, and a run that dies between the two writes is repaired by the next one rather than
 * frozen by it.
 *
 * The missing rule raises instead of returning null. The completion path already raised here; the
 * retry path returned the null on, so a vanished rule surfaced as a scored sitting attached to
 * nothing. One behaviour for one condition.
 */
async function gradeFromRecord(store: RecordStore, ruleId: string) {
  /*
   * THE RESULTS ARE READ FIRST AND THE RULE LAST, which is the opposite of the obvious order and
   * the reason is the window between them.
   *
   * Reading the rule first and then awaiting the results left a gap in which the player could
   * archive the rule -- the Archive button has no disabled state -- and the write that followed
   * overwrote `retired`, the one grade nothing can re-derive. Reversing it leaves one statement
   * between the read and the write instead of a query.
   *
   * The remainder is closed in the store: `saveLearningRule` refuses to take a rule off `retired`
   * in all three implementations. If that guard fires, this call raises and the completion is
   * retried -- and the retry finds the result already recorded, re-reads the now-retired rule, and
   * returns it unchanged. Self-healing rather than lost.
   */
  const results = await store.listLearningTransferResults(ruleId);
  const rule = await store.getLearningRule(ruleId);
  if (!rule) throw new RecordError("NOT_FOUND", "כלל הלמידה נעלם לפני הדירוג.");
  const graded = gradeLearningRule(rule, results);
  /*
   * WRITTEN ONLY WHEN IT CHANGES SOMETHING. The fold is idempotent, so on the ordinary path -- and
   * `beginLearningTransfer` now runs this on every start -- it would otherwise rewrite an
   * identical row on a hot path, adding a failure surface that buys nothing. The write happens
   * when this is actually repairing.
   */
  if (!sameLearningRule(rule, graded)) await store.saveLearningRule(graded);
  return graded;
}

/** Field-by-field, over exactly what the fold may change. */
function sameLearningRule(a: LearningRule, b: LearningRule): boolean {
  return (
    a.grade === b.grade &&
    a.retrieval_step === b.retrieval_step &&
    a.next_due_at === b.next_due_at &&
    a.last_evaluated_at === b.last_evaluated_at
  );
}

export async function retireLearningRule(
  store: RecordStore,
  input: { rule_id: string },
  now: { retired_at: string },
) {
  const rule = await store.getLearningRule(input.rule_id);
  if (!rule) throw new RecordError("NOT_FOUND", "אין כלל למידה עם המזהה הזה.");
  const retired = retireRule(rule, now.retired_at);
  await store.saveLearningRule(retired);
  return retired;
}

export async function countDecisions(store: RecordStore): Promise<{ decisions: number }> {
  return { decisions: await store.countDecisions() };
}

/**
 * Start a drill for a claim. THIS IS WHERE R5 BINDS.
 *
 * The refutation condition is copied from the claim and written to storage before a single
 * position is shown. Positions come from plies the player has NOT decided on: re-showing a
 * position whose verdict they have already seen is not a forward test.
 */
export async function beginDrill(
  store: RecordStore,
  input: { claim_id: string; candidate_fens: string[] },
  now: { drill_id: string; started_at: string },
): Promise<{ drill: DrillSpec | null; reason: string | null }> {
  const claim = await store.getClaim(input.claim_id);
  if (!claim) throw new RecordError("NOT_FOUND", "אין טענה עם המזהה הזה.");
  if (claim.grade === "refuted") {
    throw new RecordError(
      "PRECONDITION_FAILED",
      "הטענה כבר הופרכה. הפרכה סופית — לא בודקים אותה שוב.",
    );
  }
  /*
   * THE DRILL HAS TO BE OF THE KIND THE CLAIM PROMISED.
   *
   * The stored refutation condition says "בדריל של עמדות מ-{scope}", and nothing enforced it. The
   * client offers every position of the loaded game in ply order (Home.tsx) and selection took
   * the first fresh ones, which are its opening. Measured: a `claim-phase-endgame` whose promise
   * names החלטות בסיום produced a drill of eight positions that classify `opening, opening,
   * opening, opening, opening, opening, opening, opening`. It was then graded against a baseline
   * that EXCLUDES the endgame (see `finishDrill`), so a terminal verdict about endgame play was
   * decided by opening play measured against middlegame play.
   */
  /*
   * WHERE EACH KIND OF SCOPE CAN BE ENFORCED, AND IT IS NOT THE SAME PLACE.
   *
   * Three of the six buckets are properties of a POSITION -- the phases -- so membership is fixed
   * the moment the positions are chosen, and here is the only place it can be got right. The
   * other three are properties of the DECISION EVENT: how long the player took, what the clock
   * said. No selection of positions can decide those, but the drill itself does, and `finishDrill`
   * checks them there against the same predicate. Refusing them here as well was the first thing
   * tried and it was too blunt -- `tests/server/drill-route.test.ts` drills a `fast-under-45s`
   * claim with 12-second decisions, which is a genuine test of that claim, and refusing it would
   * have withdrawn a capability that works.
   */
  const bucketing = BUCKETINGS.find((b) => claim.claim_id.endsWith(b.key));
  const atoms = await store.listAtoms();
  const decidedFens = atoms.map((atom) => atom.entry_state.fen);
  const inScope = bucketing?.drillPhase
    ? input.candidate_fens.filter(
        (fen) => classifyPhase(fen, plyFromFen(fen)) === bucketing.drillPhase,
      )
    : input.candidate_fens;
  const available = inScope.map((fen, index) => ({ fen, ply: index }));
  const selection = selectDrillPositions(
    available,
    decidedFens,
    bucketing?.drillPhase ? claim.scope : undefined,
  );
  if (selection.reason) return { drill: null, reason: selection.reason };

  const spec = createDrill(claim, selection.fens, { drill_id: now.drill_id });
  const started = startDrill(spec, { predicted: true, started_at: now.started_at });
  await store.saveDrill(started);
  return { drill: started.spec, reason: null };
}

/**
 * Close a drill and grade the claim -- in either direction.
 *
 * The verdict is computed from the condition the drill STORED, not from a fresh rule. A drill
 * that writes down one condition and tests another has pre-registered nothing.
 */
export async function finishDrill(
  store: RecordStore,
  input: { drill_id: string; decision_ids: string[] },
  now: { recorded_at: string },
): Promise<{
  claim: Claim;
  /**
   * Null on a replay, and that is the honest answer rather than a recomputed one.
   *
   * The verdict's numbers are a measurement of this drill AGAINST THE BASELINE AS IT STOOD when
   * the drill was reported. That baseline is every other scored decision in the record, and it
   * grows. Recomputing it on a retry would return different numbers under the same drill id --
   * a second, differently-measured verdict for one sitting. The stored result carries `predicted`
   * and `observed`, which is what the grade and the description are made of, and those come back.
   *
   * Nothing reads this field today: `useCompleteDrill` returns it and `Home.tsx` uses only
   * `description` and `claim.grade`. It is kept because it is the measured detail an operator
   * would want, and narrowed rather than fabricated.
   */
  verdict: ReturnType<typeof evaluateRefutation> | null;
  description: string;
}> {
  const stored = await store.getDrill(input.drill_id);
  if (!stored) throw new RecordError("NOT_FOUND", "אין דריל עם המזהה הזה.");
  const claim = await store.getClaim(stored.spec.claim_id);
  if (!claim) throw new RecordError("NOT_FOUND", "הטענה של הדריל אינה קיימת.");

  /*
   * REPORTING TWICE RETURNS THE FIRST REPORT, it does not raise.
   *
   * `finishLearningTransfer` learned this in cycle 31 and this path had not. `saveDrillResult` is
   * append-only in both stores -- Memory throws "append-only: drill already reported", Drizzle
   * violates the `drill_results` primary key -- so the retry that a lost response makes inevitable
   * raised, forever, and the verdict was unreachable.
   *
   * AND THE FIRST VERSION OF THIS COMMENT WAS WRONG ABOUT WHY IT IS REACHED. It said "the runner
   * returns the player to the drill so reporting can be retried" -- which is what the TRANSFER
   * runner does. `DrillRunner` sets the stage to "done" and renders no control at all, so nothing
   * retried and this branch could not run. `advanceDrill` now sends the same payload twice, which
   * is what makes the repair below reachable rather than theoretical.
   *
   * `prospective_tests` is read from the result rows by both `getClaim` implementations, so this
   * is a read the function was already doing. And it grades before returning, because the write
   * that was lost may have been the CLAIM write rather than the response.
   */
  const already = claim.prospective_tests.find((result) => result.drill_id === input.drill_id);
  if (already) {
    return {
      claim: await gradeClaimFromRecord(store, claim.claim_id),
      verdict: null,
      description: describeResult(already),
    };
  }

  const atoms = await store.listAtoms();
  const ids = await store.listDecisionIds();
  const summary = scoreDecisions(atoms, ids);
  const drillSet = new Set(input.decision_ids);
  const drillScored = summary.scored.filter((d) => drillSet.has(d.decision_id));
  const drillDecisions: DrillDecision[] = drillScored.map((d) => ({
    decision_id: d.decision_id,
    confidence: d.confidence,
    accurate: d.accurate,
  }));
  /*
   * R5: THE VERDICT IS DECIDED OVER THE POSITIONS THAT WERE WRITTEN DOWN, OR IT IS NOT DECIDED.
   *
   * This guarded only against zero, and silently graded whatever survived the intersection above.
   * A five-position pre-registered drill whose third reveal write was lost came back as a
   * four-decision result -- `describeResult` reporting the smaller n as the test's size,
   * `evaluateRefutation` computing its standard error from the survivors, and nothing anywhere
   * recording that a registered position went unmeasured, because `ProspectiveDrillResult` has no
   * field for it. And it is terminal: a false `observed` grades the claim `refuted`, refutation
   * cannot be revisited, and `beginDrill` then refuses to test that claim again. A run that lost a
   * position could close a question permanently.
   *
   * WHAT WAS INTENDED IS SETTLED BY THE SIBLING IN THIS FILE. `finishLearningTransfer` refuses when
   * `observations.length !== transfer.fens.length`, and refuses any decision that was not revealed.
   * Both are pre-registered tests. Only one of them checked that the test it graded was the test it
   * registered.
   */
  if (drillDecisions.length !== stored.spec.fens.length) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      `נרשמו ${drillDecisions.length} החלטות מדודות מתוך ${stored.spec.fens.length} שנרשמו מראש. ` +
        "הדריל לא הושלם, ופסק על חלק מהעמדות אינו הבדיקה שנרשמה.",
    );
  }
  /*
   * And they have to be the positions this drill preregistered, not merely the right NUMBER of
   * revealed decisions. Compared as boards for the same reason the transfer's are: a decision
   * recorded against the identical position later in a game is the position that was written down.
   * Without this the completion believes whatever the client sends, which is the thing the
   * per-position write was introduced to stop on the sibling path.
   */
  const registered = [...stored.spec.fens];
  for (const decision of drillScored) {
    const slot = registered.findIndex((fen) => samePosition(decision.fen, fen));
    if (slot === -1) {
      throw new RecordError(
        "PRECONDITION_FAILED",
        "החלטה בדריל נרשמה לעמדה שלא נרשמה מראש עבורו.",
      );
    }
    // Removed so two decisions cannot both answer one registered position.
    registered.splice(slot, 1);
  }
  const bucketing = BUCKETINGS.find((b) => claim.claim_id.endsWith(b.key));
  /*
   * AND THEY HAVE TO BE DECISIONS OF THE KIND THE CLAIM IS ABOUT.
   *
   * The stored refutation condition promises "בדריל של עמדות מ-{scope}", and until now nothing
   * anywhere held the drill to it. The client offers every position of the loaded game in ply
   * order, so a `claim-phase-endgame` was measured to produce a drill of eight positions that
   * every one classified `opening` -- then graded against a baseline that EXCLUDES the endgame,
   * which makes the verdict opening play compared with middlegame play, settling a question
   * about the endgame. `refuted` is terminal and `beginDrill` refuses the claim afterwards.
   *
   * `beginDrill` now selects phase positions by phase, so for those buckets this is a second net.
   * For the time and clock buckets it is the ONLY net, because no choice of positions can put a
   * player under time pressure -- the drill itself decides that, and this is where it is known.
   * One predicate for both, the same one that defines the bucket, so selection and grading cannot
   * drift apart.
   *
   * All of them, not a majority: the drill registered these positions as the test. A verdict over
   * the subset that happened to qualify is a test chosen after the fact from its own results.
   */
  const outOfScope = bucketing ? drillScored.filter((d) => !bucketing.predicate(d)) : [];
  if (outOfScope.length > 0) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      `${outOfScope.length} מתוך ${drillScored.length} ההחלטות בדריל אינן ${claim.scope}, ` +
        `והטענה היא עליהן בלבד. הדריל הזה לא בדק אותה, ולכן אין ממנו פסק. ` +
        `אפשר לרוץ דריל נוסף.`,
    );
  }
  const baseline = summarise(
    summary.scored.filter(
      (d) => !drillSet.has(d.decision_id) && (!bucketing || !bucketing.predicate(d)),
    ),
  );
  const verdict = evaluateRefutation(drillDecisions, {
    // The whole summary, not just its gap: the baseline is an estimate with its own sampling
    // error, and a comparison that treats it as exactly known is too permissive by that much.
    baseline: baseline,
    /*
     * THE DIRECTION THE DRILL REGISTERED, not a constant.
     *
     * This was `true`. `evaluateRefutation` is a one-sided test -- `directional =
     * predictsOverconfidence ? gapDifference : -gapDifference` -- so the constant graded every
     * claim as if it named overconfidence. For the other half it inverted the verdict: a player
     * who behaved exactly as an underconfidence claim described produced `observed: false`, the
     * claim graded `refuted`, refutation is terminal, `beginDrill` then refuses that claim
     * forever, and `drill_results` is append-only so the fold reproduces it on every replay.
     * No fault was needed; it fired on the ordinary path, and `shared/bucket-variable.ts` records
     * underconfidence as the COMMON direction rather than the rare one.
     *
     * Read from the stored spec rather than from the claim, so the sign is the one written down
     * before the first position was shown (R5) -- the same rule that makes the condition itself
     * come from `stored.spec`.
     */
    predictsOverconfidence: stored.spec.predicts_overconfidence,
    // One bucket, named in advance, tested once -- the pre-registered multiplier, not the scan's.
    separabilityK: PREREGISTERED_SEPARABILITY_K,
  });
  /*
   * A DRILL THAT MEASURED NOTHING DOES NOT GET TO GRADE ANYTHING.
   *
   * `evaluateRefutation` returns `standardError: null` when the comparison could not be made at
   * all -- fewer than two decisions on a side, or no variation on either. Its own comment already
   * says what that means: "A drill that cannot produce a standard error has not observed anything,
   * in either direction. It must not read as a confirmation." It was not a confirmation. It was
   * `observed: false`, which `applyDrillResult` reads as `survived === false` and writes as
   * `refuted` -- terminal by design, kept forever, and `beginDrill` refuses the claim afterwards.
   *
   * `gapDifferenceStandardError` HAS FOUR CALLERS AND THIS WAS THE ONLY ONE THAT DID THIS.
   * `stability.ts` sets `readable: false` on null. `crossing.ts` sets `silence: "too-few"`.
   * `detector.ts` skips the bucket. Three of four treat null as unreadable; the fourth wrote a
   * permanent grade from it.
   *
   * Reproduced, five decisions with no variation:
   *
   *     verdict  {"observed":false,"standardError":null,"n":5}
   *     GRADE AFTER A DRILL THAT MEASURED NOTHING: refuted
   *     AFTER a later drill that genuinely confirms it: refuted
   *
   * That second line is the whole reason this is the guard rather than a nicer sentence: the
   * result row is append-only and refutation is terminal, so a claim killed by a measurement that
   * never happened cannot be revived by one that did.
   *
   * Nothing is written. The drill is spent and the claim stays a hypothesis, which is the same
   * trade the two guards above make -- a run lost is recoverable, and `refuted` is not.
   */
  if (verdict.standardError === null) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      `הדריל רץ על ${drillDecisions.length} החלטות, אבל אי אפשר היה למדוד מהן פער בר-השוואה — ` +
        `אין די שונות בין ההחלטות כדי לחשב שגיאת תקן. לכן אין מכאן פסק, והטענה נשארת השערה. ` +
        `אפשר לרוץ דריל נוסף.`,
    );
  }
  const result: ProspectiveDrillResult = completeDrillAgainstBaseline(
    stored,
    drillDecisions,
    verdict,
    { recorded_at: now.recorded_at },
  );
  await store.saveDrillResult(result);

  // Section 3.5: report the result even when it refutes -- especially then.
  return {
    claim: await gradeClaimFromRecord(store, claim.claim_id),
    verdict,
    description: describeResult(result),
  };
}

/**
 * Read every drill result the claim holds and write the grade they add up to.
 *
 * THE CLAIM IS RE-READ RATHER THAN GRADED FROM THE COPY THIS CALL ALREADY HAS. That costs a query
 * and buys the property the whole change is for: the grade is a function of the record, so whoever
 * runs this -- the call that wrote the result, or a retry an hour later -- gets the same answer,
 * and a run that dies between the two writes is repaired by the next one rather than frozen by it.
 *
 * It is also the only way the fresh path can see the result it just wrote: `prospective_tests`
 * comes from the `drill_results` rows, not from anything held in memory here.
 */
async function gradeClaimFromRecord(store: RecordStore, claimId: string): Promise<Claim> {
  const claim = await store.getClaim(claimId);
  if (!claim) throw new RecordError("NOT_FOUND", "הטענה של הדריל אינה קיימת.");
  // The ONLY path that changes a grade, and it accepts prospective results only.
  const graded = evaluateClaim(claim, claim.prospective_tests);
  await store.saveClaim(graded);
  return graded;
}

/**
 * Store one finished, analysed blitz game.
 *
 * THE JOIN ALREADY HAPPENED ON THE CLIENT (`toStoredRecord`), and this validates the result rather
 * than trusting it -- an assembled object is one a caller could have assembled wrongly. What it
 * adds beyond the schema is the one thing a schema cannot see: whether this game is already on
 * record. The stores are append-only and both raise on a repeat, and a lost response makes a retry
 * inevitable, so the repeat is reported as the no-op it is rather than as a failure.
 */
export async function saveBlitzGame(
  store: RecordStore,
  input: StoredBlitzRecord,
): Promise<{ stored: boolean; decisions: number }> {
  const parsed = storedBlitzRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new RecordError("BAD_REQUEST", `המשחק לא נשמר: ${parsed.error.issues[0]?.message}`);
  }
  const already = await store.listBlitzGames();
  if (already.some((g) => g.gameId === input.game.gameId)) {
    return { stored: false, decisions: input.decisions.length };
  }
  await store.saveBlitzRecord(input);
  return { stored: true, decisions: input.decisions.length };
}

/**
 * Attach the engine's verdict to a game that is already on the record.
 *
 * REFUSES ANYTHING THAT IS NOT A PENDING GAME, and the three refusals are different facts. A game
 * nobody stored cannot be scored; a game already scored must not be re-scored, because a second
 * verdict over the same decisions is a second measurement wearing the first one's timestamp; and a
 * record that fails the wire schema is refused here exactly as it is on the way in.
 */
export async function attachBlitzAnalysis(
  store: RecordStore,
  input: StoredBlitzRecord,
): Promise<{ attached: boolean; reason?: string }> {
  const parsed = storedBlitzRecordSchema.safeParse(input);
  if (!parsed.success) {
    throw new RecordError("BAD_REQUEST", `הניתוח לא נשמר: ${parsed.error.issues[0]?.message}`);
  }
  if (input.game.analysisState !== "complete") {
    throw new RecordError("BAD_REQUEST", "הניתוח לא נשמר: המשחק לא סומן כמנותח.");
  }
  const stored = (await store.listBlitzGames()).find((g) => g.gameId === input.game.gameId);
  if (!stored) return { attached: false, reason: "no-such-game" };
  /*
   * ALREADY SCORED IS A NO-OP AND NOT AN ERROR, for the reason `saveBlitzGame` gives about repeats:
   * a retry after a lost response is the ordinary case, and it must not read as a failure.
   */
  if (stored.analysisState !== "pending") return { attached: false, reason: "not-pending" };
  await store.attachBlitzAnalysis(input);
  return { attached: true };
}

export type ClaimView = {
  claim: Claim | null;
  othersWithheld: number;
  reason: string | null;
  /** Always the WHOLE record, even when the claim was searched over a slice of it. */
  recorded: number;
  scored: number;
  /**
   * Why the rest of `recorded` is not in `scored`, split the way `scoreDecisions` splits it.
   *
   * CARRIED SO NOBODY SUBTRACTS. `recorded - scored` was being computed in two places -- the loop
   * strip and the context ribbon -- and both spent the difference on "ממתינות לחשיפה". Since the
   * ask rule became a sample that is mostly wrong: those decisions were revealed, and no amount
   * of waiting will make them scoreable, because the question was never put on them. One number
   * cannot answer two questions, and the summary this view is built from already answers both.
   */
  awaitingReveal: number;
  withoutConfidence: number;
  /**
   * Revealed decisions whose verdict names no engine build, so nothing can read it.
   *
   * SEPARATE FROM `readElsewhere`, and the ribbon says so in different words. `readElsewhere`
   * means a decision is counted under another heading with its own denominator -- the shared bank,
   * a drill, an imported game. This means the decision belongs to this reading and cannot be used
   * by it: `engine_source` names a family, B1 measured 13.61% of verdicts flipping between two
   * engines inside one family, and "accurate" is undefined for a row that cannot say which spoke.
   * Folding it into `readElsewhere` would tell the player their decision is being read somewhere,
   * which is the one thing that is not true of it.
   */
  withoutInstrument: number;
  /**
   * Decisions on the record that this reading does not cover, because another one does.
   *
   * THE THIRD REASON, and it only became visible when the front door started handing cold
   * arrivals a bank position. `recorded` is the whole record and `scored` is the discovery
   * population -- free play and nothing else -- so a player whose only decision was a bank answer
   * saw "0 נמדדו מתוך 0 שנרשמו" and a front door still offering them their first decision. They
   * had made one, it had been revealed, and a branch of the reveal had fired.
   *
   * `separate` in `shared/evidence-policy.ts` is precisely this state: not unreadable, not
   * waiting, not passed over -- read under another heading with its own denominator. Carried as a
   * count so the strip can say so instead of leaving a gap the player has to explain to
   * themselves.
   */
  readElsewhere: number;
  /**
   * The hypothesis that narrowed this search, or null when the ordinary six-bucket scan ran.
   *
   * Non-null is a statement about HOW the answer was reached, and the screen has to say so: a
   * claim from one pre-named bucket at n = 20 and a claim from the full scan at n = 30 are not
   * the same kind of finding, and must not render as though they were.
   */
  prereg: PreregisteredHypothesis | null;
  /**
   * Revealed decisions the NARROWED search is measuring over -- those recorded after the
   * registration -- or null when the ordinary scan is running.
   *
   * `scored` above is the whole record and is the wrong number under a narrowed search: it counts
   * decisions the hypothesis is forbidden to be tested on. A caller reporting the distance to a
   * claim needs the count in the same units as the floor it is comparing against, or it will
   * announce a wait the detector is not actually running.
   */
  preregScored: number | null;
};

/**
 * The single claim to show, or an honest silence.
 *
 * A bucket needs MIN_BUCKET_N decisions inside it AND outside it, so the floor before any claim
 * is possible is twice that. Below it this returns null with a REASON rather than an empty
 * screen, and the reason separates "too few decisions" from "too few revealed decisions".
 */
export async function currentClaim(
  store: RecordStore,
  now: { created_at: string },
): Promise<ClaimView> {
  const atoms = await store.listAtoms();
  const ids = await store.listDecisionIds();
  /*
   * THE POPULATION THE DETECTOR MAY SEARCH, AND THE ORDER OF THESE TWO STEPS IS LOAD-BEARING.
   *
   * This used to be `scoreDecisions(atoms, ids)` over the whole record, so an anchor answer, a
   * drill decision, a transfer check, a position from a game already played and a row that never
   * recorded why it existed all competed to become the next finding about the player. The drill
   * case is the one that matters most: the product could take a player through an exercise built
   * to fix a weakness, read the decisions that exercise produced, and announce the next weakness
   * from them. Evidence generated while trying to CHANGE the player, reused as evidence about how
   * the player behaved.
   *
   * `shared/evidence-policy.ts` is the only authority on which of those may be read here, and the
   * filter is applied AFTER the prereg slice below rather than before it: `decisions_before`
   * counts raw rows as they stood at registration, so slicing a filtered array by it would take
   * the wrong prefix and silently move the boundary a registered hypothesis is measured from.
   */
  /*
   * ONE STRATUM, NOT THE WHOLE ADMITTED SET. `forDiscovery` now returns populations grouped by the
   * conditions that make decisions comparable -- protocol and reveal timing -- and there is no
   * function that flattens them back. A record with a single regime, which is every record written
   * before reveal timing existed, yields one stratum and behaves exactly as before.
   */
  const wideStrata = forDiscovery(atoms, ids);
  const wide = discoverySearchPopulation(wideStrata);
  const full = scoreDecisions(wide.chosen?.atoms ?? [], wide.chosen?.ids ?? []);
  /*
   * WAITING IS COUNTED ACROSS EVERY STRATUM, and only this one number is.
   *
   * An unrevealed decision has no verdict, so nothing yet says which engine will score it -- it
   * sits in the `legacy` build stratum, which is almost never the one the detector searches. Taken
   * from `full` this number would read 0 on a healthy record, and the ribbon's "N already recorded
   * and waiting to be revealed" would vanish exactly when it is the thing the player should act on.
   *
   * Every OTHER count here stays scoped to the searched stratum on purpose: `scored`,
   * `withoutConfidence` and `withoutInstrument` describe the population a claim would come from,
   * and summing them across regimes would describe a population nothing is allowed to search.
   */
  const awaitingAnywhere = wideStrata.reduce(
    (n, s) => n + s.atoms.reduce((m, a) => m + (a.result ? 0 : 1), 0),
    0,
  );

  /*
   * THE BRIDGE, AND THE RULE THAT KEEPS IT FROM COMPOUNDING (shared/prereg.ts).
   *
   * A registered hypothesis narrows the search to one bucket, which is what makes n = 20 legal
   * instead of 30. It does that ONLY while the record is still too small for the ordinary
   * six-bucket scan. The moment there are enough scored decisions for the default thresholds,
   * the ordinary scan runs over the whole record and the hypothesis stops filtering anything.
   *
   * Exactly one search runs at any record size, and that is the point. Running the narrowed
   * search AND falling back to the wide one would be two chances to clear -- the multiplicity
   * this whole mechanism exists to avoid -- and their false-positive rates would add. The
   * measured 1.3% and 0.7% are each for one search, not for a procedure that tries both.
   *
   * It also means a hypothesis cannot suppress a finding forever. It shortens the silence and
   * then gets out of the way.
   */
  const hypothesis = await store.getPreregisteredHypothesis();
  const wideEnough = full.scored.length >= MIN_BUCKET_N * 2;
  const narrowing =
    hypothesis && !wideEnough && isTestable(hypothesis, atoms.length) ? hypothesis : null;

  /*
   * Under the narrowed search, only decisions recorded AFTER registration count. A hypothesis
   * tested on the decisions that suggested it is not a hypothesis. `listAtoms` and
   * `listDecisionIds` are ordered and append-only, so the prefix is exactly what existed then.
   */
  const summary = narrowing
    ? (() => {
        // Slice the raw record by the raw count it was taken against, THEN admit. See above.
        const after = discoverySearchPopulation(
          forDiscovery(
            atoms.slice(narrowing.decisions_before),
            ids.slice(narrowing.decisions_before),
          ),
        );
        return scoreDecisions(after.chosen?.atoms ?? [], after.chosen?.ids ?? []);
      })()
    : full;
  const thresholds = narrowing ? PREREGISTERED_THRESHOLDS : DEFAULT_THRESHOLDS;

  const reason = narrowing
    ? preregSilenceReason(summary)
    : silenceReason(full, MIN_BUCKET_N * 2);
  if (reason) {
    return {
      claim: null,
      othersWithheld: 0,
      reason,
      recorded: atoms.length,
      scored: full.scored.length,
      awaitingReveal: awaitingAnywhere,
      withoutConfidence: full.withoutConfidence,
      withoutInstrument: full.withoutInstrument,
      readElsewhere: atoms.length - full.total,
      prereg: narrowing,
      preregScored: narrowing ? summary.scored.length : null,
    };
  }

  const patterns = detect(summary.scored, thresholds, narrowing?.bucket_key ?? null);
  /*
   * THE ID IS NOT BUILT HERE ANY MORE. It used to read `claim-${patterns[0].key}` -- the
   * detector's own ordering -- while `selectClaim` chose which pattern to speak about. Once those
   * two stopped agreeing, a claim carried one bucket's id and another bucket's statement:
   * `getClaim` below would find a stored claim about a different phase and return it, and a drill
   * result would attach to the wrong hypothesis. `selectClaim` derives it from the pattern it
   * selected, so the two cannot diverge.
   */
  const selection = selectClaim(patterns, { created_at: now.created_at });
  if (selection) {
    // Persist, then read back: a claim already graded by a past drill must keep that grade
    // rather than being re-derived as a fresh hypothesis every query.
    const existing = await store.getClaim(selection.claim.claim_id);
    if (existing) {
      return {
        claim: existing,
        othersWithheld: selection.othersWithheld,
        reason: null,
        recorded: atoms.length,
        scored: full.scored.length,
        awaitingReveal: awaitingAnywhere,
        withoutConfidence: full.withoutConfidence,
        withoutInstrument: full.withoutInstrument,
        readElsewhere: atoms.length - full.total,
        prereg: narrowing,
        preregScored: narrowing ? summary.scored.length : null,
      };
    }
    await store.saveClaim(selection.claim);
  }
  return {
    claim: selection?.claim ?? null,
    othersWithheld: selection?.othersWithheld ?? 0,
    reason: selection ? null : emptySearchReason(narrowing),
    recorded: atoms.length,
    scored: full.scored.length,
    awaitingReveal: awaitingAnywhere,
    withoutConfidence: full.withoutConfidence,
    withoutInstrument: full.withoutInstrument,
    readElsewhere: atoms.length - full.total,
    prereg: narrowing,
    preregScored: narrowing ? summary.scored.length : null,
  };
}

/**
 * Register a bucket named by an import, before the live loop tests it.
 *
 * THE BOUNDARY IS THE STORE'S COUNT, NEVER THE CALLER'S. `decisions_before` is what makes the
 * word "pre-registered" true: only decisions after it are ever tested. A caller that could
 * choose it could choose zero, and then the hypothesis would be tested on the decisions that
 * suggested it -- which is the one thing this mechanism exists to prevent. So whatever arrives
 * is discarded and the count is read here.
 */
export async function registerHypothesis(
  store: RecordStore,
  input: Omit<PreregisteredHypothesis, "decisions_before">,
): Promise<PreregisteredHypothesis> {
  if (!isRegistrableBucket(input.bucket_key)) {
    throw new RecordError(
      "BAD_REQUEST",
      `הסוג "${input.bucket_key}" אינו אחד מהסוגים שהגלאי החי יודע לבדוק, ולכן אי אפשר לרשום אותו מראש.`,
    );
  }
  const hypothesis: PreregisteredHypothesis = {
    ...input,
    decisions_before: await store.countDecisions(),
  };
  await store.savePreregisteredHypothesis(hypothesis);
  return hypothesis;
}

/**
 * Keep a scan's reading, so that closing the overlay stops throwing it away.
 *
 * `scanned_at` is stamped HERE and whatever the caller sent is discarded, for the same reason
 * `registerHypothesis` refuses the caller's `decisions_before`: the scan date is the one field
 * that decides whether a rate on screen reads as a measurement or as a standing claim about the
 * player, and a caller that could choose it could keep a months-old reading looking current.
 *
 * No validation of the diagnostic itself. It is produced by `diagnoseImportedGames` and never by
 * a user, so a schema check here would assert against this codebase rather than against input.
 */
export async function saveImportReading(
  store: RecordStore,
  input: Omit<StoredImportDiagnostic, "scanned_at">,
  now: () => Date = () => new Date(),
): Promise<StoredImportDiagnostic> {
  const reading: StoredImportDiagnostic = { ...input, scanned_at: now().toISOString() };
  await store.saveImportDiagnostic(reading);
  return reading;
}

/** The newest kept reading, or null when no scan has ever run against this record. */
export async function getImportReading(store: RecordStore): Promise<StoredImportDiagnostic | null> {
  return store.getImportDiagnostic();
}

/**
 * Why the narrowed search cannot speak yet. A DIFFERENT sentence from the ordinary one, because
 * it is a different fact: the wait is shorter, it is counted only from the import onward, and it
 * is about one named bucket rather than about the record in general (section 4.5).
 */
/**
 * Why the narrowed search is still silent -- the RULE, and only the part nothing else says.
 *
 * This used to open with "המשחקים שייבאת הצביעו על X כמקום לבדוק בו, וזה נרשם מראש", which is
 * word for word what `ClaimPanel` already renders one paragraph above it in `.claim-prereg`:
 * "החיפוש מצומצם לX — הסוג שהמשחקים המיובאים הצביעו עליו, שנרשם לפני שנרשמה כאן החלטה". The same
 * fact, twice, inside one panel. It then closed with "מאז הייבוא נחשפו N, חסרות עוד M", which is
 * the distance the context ribbon carries at the top of the page.
 *
 * What is left is the only thing neither of those says: that the registration bought a SMALLER
 * FLOOR, and how much smaller. That number is the whole point of the mechanism and appears
 * nowhere else on the screen.
 */
function preregSilenceReason(since: ScoringSummary): string | null {
  const required = PREREGISTERED_THRESHOLDS.minBucketN * 2;
  if (since.scored.length >= required) return null;
  return (
    `מפני שהסוג נרשם מראש, נבדק סוג אחד במקום שישה — ולכן דרושות ${required} החלטות מדודות ` +
    `במקום ${MIN_BUCKET_N * 2}. הרישום מקצר את ההמתנה, הוא לא מבטיח שיימצא בה משהו.`
  );
}

/**
 * Nothing cleared the threshold. Which search came up empty is part of the answer.
 *
 * Trimmed for the same reason as the two above. `loopPosition()` already says, at the top of the
 * page, "יש מספיק החלטות, ואף דפוס לא עבר את הסף. זו תשובה ולא שתיקה", with "{scored} החלטות
 * נמדדו · אין דפוס מעל הסף" as its basis -- so the count and the it-is-an-answer line were both
 * second copies. What is kept is why the threshold is there at all, which the ribbon does not say
 * and which is the difference between a silence a player trusts and one they work around.
 */
function emptySearchReason(hypothesis: PreregisteredHypothesis | null): string {
  if (hypothesis) {
    return `הייבוא אמר איפה לחפש, לא מה יימצא. בסוג הזה לא נמצא פער כיול שעובר את הסף.`;
  }
  return (
    `הסף קיים כדי שלא נדווח על רעש: פער שנראה גדול בסוג קטן מצטמצם לאפס ככל שנוספות אליו ` +
    `החלטות, והסף הוא בדיוק הגודל שרעש כזה לא עובר.`
  );
}

/**
 * The record dashboard's numbers.
 *
 * Separate from `currentClaim` on purpose: a claim is ONE finding with a grade and a refutation
 * condition, and this is the whole record laid out. Both read the same scored decisions, so they
 * cannot drift into disagreeing about the same player.
 */
/**
 * One answer per bank position, keeping the first, with the repeats counted.
 *
 * THE PRECONDITION THIS ENFORCES IS THE READING'S OWN. `forAnchorReference` states it: *"the bank
 * is the only reading this product claims is comparable BETWEEN players, and the whole of that
 * claim is that the item difficulty is held fixed."* A player who answered thirty distinct
 * positions and a player who answered twenty-five plus five repeats have not met the same set, and
 * a number that compares them says they have. That is true whatever the repeat scored, so this
 * rule is about the item set and not about the answer.
 *
 * THE REPEAT IS ALSO LIKELY TO BE BIASED, which is why the defect is worth this much. It is
 * reachable by a gesture: take a bank decision, read the reveal, reload `/play`. The board comes
 * back -- `session-position.ts` persists it so a reload does not lose the game -- and the reveal
 * does not, because it is component state. The screen keeps the position, drops the only thing that
 * said it had been decided, re-arms the commitment and accepts a second answer, this time with the
 * engine's verdict already read. Browser Back, and the brand lockup out and `ללוח` back, arrive at
 * the same screen. Measured at the service level: five answers over four positions moved the
 * observed accuracy from 0/4 to 1/5.
 *
 * THE FIRST, AND IT IS NOT A PREFERENCE. It is the only answer the record can place before any
 * verdict on that position existed. The store contract makes that well founded: the database orders
 * by `createdAt, decisionId`, the in-memory store by Map insertion, the browser store by append,
 * and `listDecisionIds` promises the same order as `listAtoms` for exactly this class of reason.
 *
 * A POSITION WHOSE FIRST ANSWER CANNOT BE SCORED CONTRIBUTES NOTHING, and that is the conservative
 * reading rather than an oversight: reaching past it to a later answer would be choosing the row by
 * something that happened after the fact, which is the property `regimeInForceFirst` is careful to
 * keep out of the regime choice and has no more business here.
 *
 * PER STRATUM, NEVER ACROSS THEM. Whether a bank answer taken under a retired protocol should be
 * re-asked is an open OWNER question -- `docs/PRE_HUMAN_CEILING.md` files it -- and deduplicating
 * across regimes would answer it by dropping the re-answer. Within one regime there is no such
 * question: the same position, twice, under the same conditions.
 */
function firstAnswerPerPosition(
  atoms: readonly DecisionAtom[],
  ids: readonly string[],
): { atoms: DecisionAtom[]; ids: string[]; repeated: number } {
  const seen = new Set<string>();
  const kept: DecisionAtom[] = [];
  const keptIds: string[] = [];
  let repeated = 0;
  atoms.forEach((atom, index) => {
    /*
     * `positionKey` AND NOT THE FEN STRING. The halfmove clock and fullmove number record the GAME,
     * so knights out and back produce a different string for an identical board -- the same hole
     * `preregisterFreshTransfer` names, which let a position the player had already decided enter a
     * test as unseen.
     *
     * AND ON THIS POPULATION IT IS CURRENTLY INERT, which is worth saying rather than leaving as an
     * unexamined guard. `isAnchorFen` matches the bank by EXACT FEN, so every `anchor`-purpose row
     * carries a verbatim bank string, and the sixty bank positions produce sixty distinct keys with
     * no collisions -- so no record reachable today distinguishes this from comparing the raw FEN.
     * Reverting it to the raw string leaves every test green. It stays because the day the bank
     * admits a position reached by a different move order, comparing strings is the defect
     * `preregisterFreshTransfer` had; it is a rule kept ahead of its population, and it is labelled
     * as one rather than read as enforcement.
     */
    const key = positionKey(atom.entry_state.fen);
    if (seen.has(key)) {
      repeated += 1;
      return;
    }
    seen.add(key);
    kept.push(atom);
    keptIds.push(ids[index] ?? `decision-${index}`);
  });
  return { atoms: kept, ids: keptIds, repeated };
}

/**
 * The regime a reading describes: the one in force as soon as it can be read, the largest until then.
 *
 * ONE FUNCTION, TWO CONSUMERS, AND THAT IS THE POINT OF IT. This rule was written for the described
 * reading, copied to the bank reading in the commit whose own message said *"`readRecord` computes
 * two readings and the first commit walled only one of them"* -- and then, one commit later, the
 * falsification round replaced it with this and again reached only one of them. The bank went on
 * sorting by size. A rule that lives in two places gets repaired in one; this is the lowest layer
 * that can stop that happening a third time.
 *
 * "THE LARGEST" ALONE WAS FALSIFIED BY MEASUREMENT. Largest is not latest: a bump to
 * `CURRENT_PROTOCOL_VERSION` -- already at 4, so three have happened -- starts a stratum at zero
 * while the retired one holds the player's whole history. Measured at 120 decisions under version 4
 * against 40 under version 5, the described page reported n=120 at 100% accuracy from a protocol no
 * longer running, and would have gone on for 81 more decisions. The staleness is automatic, it fires
 * for every player on every bump, and it lasts in proportion to how much history the player has.
 *
 * AND IT IS WORSE ON THE BANK THAN ON THE PAGE IT WAS FIXED FOR. The bank is the only reading this
 * product claims is comparable BETWEEN players, and its whole argument is that the item difficulty
 * and the scoring are held fixed -- `docs/ACTION_PLAN.md` B1 measured 13.61% of verdicts flipping
 * between two engine builds. A stale regime there is not a stale description of one player, it is a
 * comparison across the exact change the stratification exists to wall off.
 *
 * `MIN_BUCKET_N` RATHER THAN A NEW CONSTANT, and it is the floor these readings already answer
 * nothing below: switching to a regime the page could not read yet would trade a stale number for
 * silence, which is not the trade. Staleness is bounded by 30 decisions instead of by the length of
 * the record.
 *
 * IT IS ANSWER-BLIND, which is the property that must not be lost. Both terms -- how many rows a
 * regime has scored, and which regime the record is currently appending to -- are decided before
 * anything is read, from counts and arrival order. Neither can select the regime that happens to
 * contain a flattering number. Ties by id, so the same record always yields the same reading rather
 * than one that depends on write order.
 */
export function regimeInForceFirst<T>(
  strata: readonly T[],
  idOf: (stratum: T) => string,
  scoredCount: (stratum: T) => number,
  currentId: string | null,
): T[] {
  /*
   * MEASURED IN SCORED ROWS AND NOT IN ROWS. An unrevealed decision has no verdict, so nothing yet
   * says which engine will score it and it sits in the `legacy` build stratum. Ordering by rows
   * would hand a page a stratum that scores to nothing on any record whose unrevealed backlog
   * outnumbers its revealed decisions.
   */
  const largestFirst = [...strata].sort(
    (a, b) => scoredCount(b) - scoredCount(a) || idOf(a).localeCompare(idOf(b)),
  );
  const current = strata.find((stratum) => idOf(stratum) === currentId);
  return current && scoredCount(current) >= MIN_BUCKET_N
    ? [current, ...largestFirst.filter((stratum) => idOf(stratum) !== currentId)]
    : largestFirst;
}

export async function recordReading(store: RecordStore): Promise<RecordReading> {
  const allAtoms = await store.listAtoms();
  const allIds = await store.listDecisionIds();
  /*
   * TWO CONSUMERS, TWO POPULATIONS, and until now they were one.
   *
   * This page carries a description of what the player did AND the shared bank's between-player
   * reading, and both were computed from the whole record: the description pooled bank answers,
   * drill decisions, transfer checks, imported positions and rows that never recorded a context
   * into one calibration number, and the bank reading was recovered from it by filtering on the
   * FEN. So a drill decision counted twice -- once diluting the description of free play, once
   * entering the comparison against other players.
   *
   * `shared/evidence-policy.ts` decides both. The descriptive population is free play and the
   * front door's handoff; everything else is `separate` there, which means readable under its own
   * heading rather than averaged into this one. The bank population is decisions taken FOR the
   * bank, which is a different question from decisions taken ON a bank position.
   */
  /*
   * AND TWO REGIMES ARE NOT ONE POPULATION EITHER, which is the wall this reading did not have.
   *
   * `forDescriptiveHistory` now returns STRATA, for the reason `forDiscovery` already did: purpose
   * is a property of a row and the table can answer it row by row, but protocol, its version,
   * reveal timing and the engine build that passed the verdict describe an incompatibility BETWEEN
   * rows. No single decision is pooled; a set is. Asked row by row every `play` decision is
   * individually fine, and thirty-five taken with the verdict shown after each move plus thirty
   * taken with it held to the end of the game are not one record of how this player decides.
   *
   * The recording had happened -- every decision carries its timing -- and the reading flattened it
   * back the moment `scoreDecisions` produced a `ScoredDecision`, which carries no provenance at all.
   */
  const describedStrata = forDescriptiveHistory(allAtoms, allIds);
  /*
   * THE BANK IS STRATIFIED TOO, and it is the reading where a regime boundary matters most.
   *
   * `anchor` is the only between-player comparison this product has: two players who answered the
   * same positions have the same item difficulty, so whatever separates their scores is the thing
   * being measured. That argument holds only while the answers were produced under one regime --
   * B1 measured 13.61% of verdicts flipping between two engine builds, and every live decision is
   * stamped `instrumented-standard` at `CURRENT_PROTOCOL_VERSION`, which will move.
   *
   * WHICH POSITIONS HAVE BEEN ANSWERED IS NOT STRATIFIED, and `readRecord` takes the two
   * separately for that reason: progress through the set decides what the front door serves next,
   * and narrowing it to one regime would re-ask a player a position they have already answered
   * because a version moved underneath them.
   */
  const bankStrata = forAnchorReference(allAtoms, allIds).map((stratum) => {
    const once = firstAnswerPerPosition(stratum.atoms, stratum.ids);
    return {
      id: stratumId(stratum.key),
      /*
       * EVERY BANK ANSWER IN THIS REGIME, for progress through the set and for nothing else.
       * `anchorAnswered` decides which position the front door serves next, and narrowing it would
       * re-serve a position the player has already answered -- the defect `comparable` exists to
       * keep out of the reading, arriving from the other direction.
       */
      scored: scoreDecisions(stratum.atoms, stratum.ids).scored,
      /** One answer per position: the only population the between-player claim holds over. */
      comparable: scoreDecisions(once.atoms, once.ids).scored,
    };
  });
  /*
   * FLATTENED FOR THE PER-DECISION READINGS AND FOR THE COUNTS, AND FOR NOTHING ELSE.
   *
   * The branch mix and the counterfactual reading are per-decision tallies that carry their own
   * denominators -- "which of its four sentences did this record produce", not "how accurate is
   * this player" -- and the three exclusion counts are sums over a partition, so they are the same
   * numbers whichever order the strata come in. None of them is a comparison between decisions,
   * which is the only operation a stratum boundary forbids.
   */
  const atoms = describedStrata.flatMap((s) => s.atoms);
  const ids = describedStrata.flatMap((s) => s.ids);
  /*
   * The branch mix is assembled HERE and not inside `readRecord`, because it needs fields that
   * `ScoredDecision` deliberately does not carry: the moves that were on the board, the chosen
   * move, the engine's move and the centipawn loss. `readRecord` sees only what a bucket may look
   * at, which is the reason the two are separate types in the first place.
   */
  /*
   * ONE MAPPING, TWO POPULATIONS. The described atoms answer "what does free play produce"; every
   * atom answers "what has this instrument produced for this player at all". The reveal needs the
   * second, because the product's own front door hands over a bank position and those are
   * `separate` from the first -- so a reveal reading `mix` would report zero to every player who
   * has only done what they were first offered.
   */
  const mixable = (atom: DecisionAtom) => ({
    confidence: atom.bounded_action.confidence,
    // The scale the level was stated on. `?? LEGACY_CONFIDENCE_LEVELS` matches shared/scoring.ts:
    // a row written before the field existed was written on the five-level scale by definition.
    confidenceScale: atom.bounded_action.confidence_scale ?? LEGACY_CONFIDENCE_LEVELS,
    candidatesConsidered: atom.bounded_action.candidate_moves_considered,
    chosenMove: atom.decision,
    cpLoss: atom.result?.cp_loss ?? null,
    bestMove: atom.result?.engine_best_move ?? null,
    /*
     * WHICH REGIME DECIDED WHETHER THE PLAYER SAW IT. `result` says the engine answered and
     * nothing more; on a deferred game it answers during play and the verdict is held back. The
     * mix is what four sentences on this page are counted from, and without this field every one
     * of them was a claim about exposure derived from producer state.
     *
     * CARRIED BY BOTH POPULATIONS, not only the described one: `mixAll` is read by the reveal, and
     * a withheld verdict is withheld whichever population the decision is counted in.
     */
    revealTiming: atom.reveal_timing,
  });
  const mix = oneThingMix(atoms.map(mixable));
  const mixAll = oneThingMix(allAtoms.map(mixable));
  /*
   * ONE CALL, THREE NUMBERS. `scoreDecisions` was being called for its `scored` array and its two
   * counts thrown away on the same line -- which is how "waiting for the engine" came to be
   * rebuilt downstream by subtracting `scored` from the recorded total. The counts are about the
   * DESCRIBED population, the same one the reading is computed over, so a decision the policy
   * files as `separate` is neither waiting nor passed over here: it is in another reading.
   */
  const scoredStrata = describedStrata.map((stratum) => ({
    id: stratumId(stratum.key),
    summary: scoreDecisions(stratum.atoms, stratum.ids),
  }));
  /*
   * WHICH REGIME THE RECORD IS STILL WRITING INTO. `listAtoms` and `listDecisionIds` are ordered
   * and append-only, so the regime of the last admitted decision is the one in force -- a fact
   * about the record rather than a policy.
   */
  const admitted = new Set(ids);
  const order = new Map(allIds.map((id, index) => [id, index]));
  const latestId = [...allIds].reverse().find((id) => admitted.has(id));
  const currentRegime = describedStrata.find((stratum) => stratum.ids.includes(latestId ?? ""));
  const currentId = currentRegime ? stratumId(currentRegime.key) : null;
  /*
   * A CLEAN SUCCESSION, WHICH IS NOT THE SAME AS BEING LATEST, and the difference is the whole of
   * the second repair to this chooser.
   *
   * `current` was the regime of the LAST ADMITTED ROW, and reveal timing is chosen per game -- so a
   * player who alternates modes moved it on every decision. Measured on 200 coached decisions all
   * accurate beside 30 deferred ones none accurate, one further decision at a time: n=30 at 0%,
   * n=201 at 100%, n=31 at 0%, n=202 at 100%. Every number on the page swinging between two
   * populations, forever, because both were being written into.
   *
   * A PROTOCOL BUMP RETIRES THE OLD REGIME and a mode switch does not. That is the fact the record
   * already holds: after a bump no row lands in the old protocol again, so every one of its
   * decisions precedes the first of the new one. Two modes in alternating use interleave. Arrival
   * order is guaranteed -- `listAtoms` and `listDecisionIds` are ordered and append-only -- so this
   * needs no window, no constant, and nothing about outcomes.
   */
  const firstOf = (stratum: { ids: string[] }) =>
    Math.min(...stratum.ids.map((id) => order.get(id) ?? Infinity));
  const lastOf = (stratum: { ids: string[] }) =>
    Math.max(...stratum.ids.map((id) => order.get(id) ?? -Infinity));
  const currentBegan = currentRegime ? firstOf(currentRegime) : Infinity;
  const succeedsCleanly =
    currentRegime !== undefined &&
    describedStrata.every(
      (stratum) => stratum === currentRegime || lastOf(stratum) < currentBegan,
    );

  /*
   * THE CURRENT REGIME AS SOON AS IT CAN BE READ, AND THE LARGEST UNTIL THEN.
   *
   * "THE LARGEST" ALONE WAS FALSIFIED HERE, and the measurement is the reason this rule differs
   * from `discoverySearchPopulation`'s. Largest is not latest: a bump to
   * `CURRENT_PROTOCOL_VERSION` -- already at 4, so three have happened -- starts a stratum at zero
   * while the retired one holds the player's whole history. Measured at 120 decisions under
   * version 4 against 40 under version 5, this page reported n=120 at 100% accuracy from a
   * protocol that was no longer running, and would have gone on for 81 more decisions. The
   * staleness is automatic, it fires for every player on every bump, and it lasts in proportion to
   * how much history the player has -- worst for the players with most reason to trust the number.
   *
   * WHY THIS CONSUMER DIFFERS FROM DISCOVERY. `discoverySearchPopulation` chooses a population to
   * SEARCH for a hypothesis, and a contrast found under a retired protocol is still a hypothesis.
   * This page answers "what does my record say", which is a description of a player under
   * conditions that hold. A retired protocol is a worse answer than a smaller current one.
   *
   * IT IS STILL ANSWER-BLIND, which is the property that must not be lost. Both terms -- how many
   * rows a regime has scored, and which regime the record is currently appending to -- are decided
   * before anything is read, from counts and arrival order. Neither can select the regime that
   * happens to contain a flattering number.
   *
   * `MIN_BUCKET_N` RATHER THAN A NEW CONSTANT, and it is the floor this reading already answers
   * nothing below: switching to a regime the page could not read yet would trade a stale number
   * for silence, which is not the trade. So the staleness is bounded by 30 decisions instead of by
   * the length of the record, and `regime.current` says which of the two states the reader is in.
   *
   * AND ONLY ON A CLEAN SUCCESSION, per `succeedsCleanly` above. When two regimes are both being
   * written into, neither is "in force", every choice between them is arbitrary, and choosing by
   * recency makes the page oscillate. The largest is then the stable answer and the one that does
   * not depend on which mode the player happened to open last.
   */
  /*
   * THE BANK TAKES THE LARGEST, AND `null` IS HOW IT SAYS SO THROUGH THE SHARED RULE.
   *
   * THIS WAS "THE REGIME IN FORCE ONCE IT CLEARS `MIN_BUCKET_N`", CARRIED OVER FROM THE DESCRIBED
   * READING, AND IT WAS FALSIFIED HERE BY MEASUREMENT. That rule's whole claim is that staleness is
   * bounded by thirty decisions instead of by the length of the record. On the bank there is no such
   * bound, because the bank is not an open stream of decisions:
   *
   *   - `ANCHOR_POSITIONS` is SIXTY items and no more;
   *   - `anchorAnswered` is deliberately cross-regime, and `nextAnchor` serves the first position
   *     NOT in it, so a bump does not re-offer positions already answered;
   *   - so after a bump a player can supply at most `60 - answered` distinct answers in the new
   *     regime, and any player who had answered 31 or more can NEVER reach `MIN_BUCKET_N` in it.
   *
   * Measured: 40 positions answered accurately under one build, a build change, then every remaining
   * position -- 20 -- answered inaccurately under the next. The reading stayed at `n=40` and 100%
   * accuracy from a build no longer running, permanently, with the set exhausted. That is the
   * sentence the in-force rule exists to prevent, reproduced by it.
   *
   * AND THE PLAYERS IT DID REACH PAID A CLIFF NOTHING NAMED. On the thirtieth distinct answer in the
   * new regime the reading fell from `n=40` to `n=30`, and `stability.n` from 20/20 to 15/15 -- a
   * count this product prints -- while `setAside` and `regime` stayed empty and null, because both
   * are computed from the DESCRIBED strata. The described reading makes the same trade and renders
   * those two fields to explain it. The bank made it silently.
   *
   * SO THE SELECTION GOES BACK, THROUGH THIS FUNCTION RATHER THAN AROUND IT. `null` says "no regime
   * is in force for this reading", which is the true statement, and it keeps ONE implementation of
   * the ordering -- the duplication that let a repair reach one of two callers is still gone.
   *
   * WHAT REPLACES IT IS AN OWNER QUESTION AND NOT A RULE: on a finite item set whose progress is
   * cross-regime, what should a between-player comparison do when the regime in force can never
   * accumulate enough items? `N-11`. Nothing here answers it.
   */
  const [bankChosen] = regimeInForceFirst(
    bankStrata,
    (s) => s.id,
    /*
     * SIZED BY THE POPULATION THE READING IS OVER. Choosing a regime by a count that includes rows
     * the reading will then drop would pick a stratum on the strength of its repeats.
     */
    (s) => s.comparable.length,
    null,
  );
  /*
   * `succeedsCleanly ? currentId : null` RATHER THAN `currentId`, which is the S2 repair expressed
   * through the shared rule instead of beside it.
   *
   * `regimeInForceFirst` asks only whether the regime it is handed can be read, and that is the
   * right division: WHICH regime is in force is a fact about this reading's own arrival order, and
   * the bank -- whose `null` above says no regime is in force for it -- proves the helper must not
   * decide it. Passing `null` when two regimes are both being written into says exactly what is
   * true, and the largest is what comes back.
   */
  const [chosen, ...rest] = regimeInForceFirst(
    scoredStrata,
    (s) => s.id,
    (s) => s.summary.scored.length,
    succeedsCleanly ? currentId : null,
  );
  /*
   * The counts stay over the WHOLE described record, and a sum over a partition is the number it
   * was before. They answer "why is the rest of what you recorded not in this reading", which is a
   * question about the record and not about one regime -- and scoping them to the chosen stratum
   * would make a decision waiting for the engine disappear because it was taken in the other mode.
   */
  const total = (of: (s: ScoringSummary) => number) =>
    scoredStrata.reduce((n, s) => n + of(s.summary), 0);
  return readRecord(
    chosen?.summary.scored ?? [],
    mix,
    readCounterfactuals(atoms),
    {
      measured: bankChosen?.comparable ?? [],
      answered: bankStrata.flatMap((s) => s.scored),
    },
    {
      awaitingReveal: total((s) => s.awaitingReveal),
      withoutConfidence: total((s) => s.withoutConfidence),
      /*
       * COUNTED OFF THE ADMISSION, NOT BY SUBTRACTING THE POPULATION FROM THE RECORD.
       *
       * `allAtoms.length - atoms.length` gives the same number today and would go on giving it
       * silently after it stopped being true. The sentence this feeds says those decisions are
       * READ SOMEWHERE ELSE, and only `separate` means that: every non-admitted cell of
       * `descriptive-history` is `separate` right now, and `refused` -- which the `discovery`
       * consumer uses five times -- means read nowhere. The day someone refuses a context here,
       * a subtraction would count it as read under another heading and the player would be
       * pointed at a section that does not hold it.
       *
       * Computed here rather than in `readRecord` for the reason the mix is: `readRecord` only
       * ever sees the described population, so it cannot see what is missing from it.
       */
      readElsewhere: allAtoms.filter(
        (atom) => admissionFor("descriptive-history", atom).kind === "separate",
      ).length,
    },
    /*
     * FROM THE STRATUM THE READING IS OVER, not from the whole record: this number exists to
     * explain the `n` on the screen, and repeats in a regime nobody is reading explain nothing.
     */
    (bankChosen?.scored.length ?? 0) - (bankChosen?.comparable.length ?? 0),
    /*
     * The regimes this reading is NOT over, named and counted rather than dropped.
     *
     * R1's rule for any denominator that shrank: it has to be able to say what it left out. These
     * decisions are not waiting, not passed over and not read under another heading -- they are the
     * player's own free play, in a measurement regime this page is not currently reading, and a
     * screen that simply showed a smaller `n` would be a number that changed for a reason nobody
     * could name. Empty on every record with one regime.
     */
    rest.filter((s) => s.summary.scored.length > 0).map((s) => ({
      id: s.id,
      n: s.summary.scored.length,
    })),
    chosen ? { id: chosen.id, current: chosen.id === currentId } : null,
    mixAll,
  );
}
