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
import {
  ACCURATE_CP_LOSS,
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
import { readRecord, type RecordReading } from "./record-dashboard.js";
import { readCounterfactuals } from "./counterfactual-reading.js";
import { oneThingMix } from "./reveal.js";
export type { RecordReading } from "./record-dashboard.js";
import { scoreDecisions, silenceReason, type ScoringSummary } from "./scoring.js";
import { isRegistrableBucket, isTestable, type PreregisteredHypothesis } from "./prereg.js";
import type { StoredImportDiagnostic } from "./import-diagnostic.js";

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
  known: string;
  unknown: string;
  decision: string;
  bounded_action: {
    seconds_taken: number;
    confidence: number;
    /** Which scale that confidence was stated on. Optional in the type, refused below if absent. */
    confidence_scale?: number;
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
    secondsTaken: Math.round(input.bounded_action.seconds_taken),
    chosenMove: input.decision,
    candidateMovesConsidered: input.bounded_action.candidate_moves_considered,
    statedRead: input.known,
    statedUnknown: input.unknown,
    confidence: input.bounded_action.confidence,
    confidenceScale,
    probeAssignment: probe?.assignment ?? null,
    legalMoves: probe?.legal_moves ?? null,
    revealTiming: input.reveal_timing,
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
    throw new RecordError("CONFLICT", "ההחלטה כבר נחשפה. הרשומה היא append-only.");
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
    throw new RecordError("FORBIDDEN", "אי אפשר לתקן קריאה לפני שראית את התוצאה.");
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

  const reflection = reflectionDraftSchema.parse(input.reflection);
  if (!atom.feedback) {
    await store.recordFeedback(input.rule.source_decision_id, {
      revisedRead: reflection.revised_read,
      wouldChooseAgain: reflection.would_choose_again,
    });
  } else if (
    atom.feedback.revised_read !== reflection.revised_read ||
    atom.feedback.would_choose_again !== reflection.would_choose_again
  ) {
    throw new RecordError("CONFLICT", "הרפלקציה על ההחלטה הזו היא append-only ואי אפשר לשנות אותה.");
  }

  const rule = formLearningRule(input.rule, now);
  await store.saveLearningRule(rule);
  return rule;
}

export async function learningRules(store: RecordStore) {
  return { rules: await store.listLearningRules() };
}

export async function beginLearningTransfer(
  store: RecordStore,
  input: { rule_id: string; candidate_fens: string[] },
  now: { transfer_id: string; started_at: string },
) {
  const rule = await store.getLearningRule(input.rule_id);
  if (!rule) throw new RecordError("NOT_FOUND", "אין כלל למידה עם המזהה הזה.");

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
      reason:
        "אי אפשר למדוד שליפה של הכלל הזה: הניסוח שלו קצר מדי או מורכב מסימונים בלבד. " +
        "כדי שהבדיקה תוכל להשוות את מה שתשלפו למה שכתבתם, הכלל צריך כמה מילים משלו.",
    };
  }

  const open = await store.getOpenLearningTransfer(rule.rule_id);
  if (open) return { transfer: open, reason: null };

  /*
   * NULL IS THE END OF THE SCHEDULE, NOT PERMISSION. `gradeLearningRule` sets `next_due_at` to
   * null when the last retrieval interval has passed, and this read it as "no date to wait for,
   * so go ahead" -- offering an unlimited supply of fresh tests to a rule that had finished,
   * while the row beside the button said "אין בדיקה נוספת".
   */
  if (!rule.next_due_at) {
    return {
      transfer: null,
      reason: "לוח החזרות של הכלל הזה הסתיים. אין בדיקה נוספת מתוזמנת עבורו.",
    };
  }
  if (new Date(now.started_at) < new Date(rule.next_due_at)) {
    return {
      transfer: null,
      reason: `הכלל הזה מתוזמן לחזרה מרווחת בתאריך ${rule.next_due_at}.`,
    };
  }

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
  for (const fen of input.candidate_fens) {
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
  return { transfer, reason: null };
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
  const position = already.length;
  if (position >= transfer.fens.length) {
    throw new RecordError("PRECONDITION_FAILED", "כל העמדות בבדיקה הזו כבר נרשמו.");
  }

  /*
   * The decision has to be the one this slot preregistered. Compared as POSITIONS, for the same
   * reason the candidates were: a decision recorded against the identical board later in a game is
   * the position that was written down.
   */
  const atom = await store.getAtom(input.observation.decision_id);
  if (!atom) throw new RecordError("PRECONDITION_FAILED", "ההחלטה הזו לא נרשמה.");
  if (!samePosition(atom.entry_state.fen, transfer.fens[position])) {
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
  const successes = atoms.filter((atom, index) => {
    const observation = observations[index];
    const recall = scoreRecall(observation.recalled_rule, transfer.rule_snapshot.action_rule);
    return recall.clearedFloor && atom!.result!.cp_loss <= ACCURATE_CP_LOSS;
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
  const rule = await store.getLearningRule(ruleId);
  if (!rule) throw new RecordError("NOT_FOUND", "כלל הלמידה נעלם לפני הדירוג.");
  const graded = gradeLearningRule(rule, await store.listLearningTransferResults(ruleId));
  await store.saveLearningRule(graded);
  return graded;
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
  const atoms = await store.listAtoms();
  const decidedFens = atoms.map((atom) => atom.entry_state.fen);
  const available = input.candidate_fens.map((fen, index) => ({ fen, ply: index }));
  const selection = selectDrillPositions(available, decidedFens);
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
): Promise<{ claim: Claim; verdict: ReturnType<typeof evaluateRefutation>; description: string }> {
  const stored = await store.getDrill(input.drill_id);
  if (!stored) throw new RecordError("NOT_FOUND", "אין דריל עם המזהה הזה.");
  const claim = await store.getClaim(stored.spec.claim_id);
  if (!claim) throw new RecordError("NOT_FOUND", "הטענה של הדריל אינה קיימת.");

  const atoms = await store.listAtoms();
  const ids = await store.listDecisionIds();
  const summary = scoreDecisions(atoms, ids);
  const drillSet = new Set(input.decision_ids);
  const drillDecisions: DrillDecision[] = summary.scored
    .filter((d) => drillSet.has(d.decision_id))
    .map((d) => ({ decision_id: d.decision_id, confidence: d.confidence, accurate: d.accurate }));
  if (drillDecisions.length === 0) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      "אף החלטה מהדריל לא נחשפה עדיין, ולכן אין מה למדוד.",
    );
  }
  const bucketing = BUCKETINGS.find((b) => claim.claim_id.endsWith(b.key));
  const baseline = summarise(
    summary.scored.filter(
      (d) => !drillSet.has(d.decision_id) && (!bucketing || !bucketing.predicate(d)),
    ),
  );
  const verdict = evaluateRefutation(drillDecisions, {
    // The whole summary, not just its gap: the baseline is an estimate with its own sampling
    // error, and a comparison that treats it as exactly known is too permissive by that much.
    baseline: baseline,
    predictsOverconfidence: true,
    // One bucket, named in advance, tested once -- the pre-registered multiplier, not the scan's.
    separabilityK: PREREGISTERED_SEPARABILITY_K,
  });
  const result: ProspectiveDrillResult = completeDrillAgainstBaseline(
    stored,
    drillDecisions,
    verdict,
    { recorded_at: now.recorded_at },
  );
  await store.saveDrillResult(result);

  // The ONLY path that changes a grade, and it accepts a prospective result only.
  const graded = evaluateClaim(claim, result);
  await store.saveClaim(graded);
  // Section 3.5: report the result even when it refutes -- especially then.
  return { claim: graded, verdict, description: describeResult(result) };
}

export type ClaimView = {
  claim: Claim | null;
  othersWithheld: number;
  reason: string | null;
  /** Always the WHOLE record, even when the claim was searched over a slice of it. */
  recorded: number;
  scored: number;
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
  const full = scoreDecisions(atoms, ids);

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
    ? scoreDecisions(atoms.slice(narrowing.decisions_before), ids.slice(narrowing.decisions_before))
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
      recorded: full.total,
      scored: full.scored.length,
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
        recorded: full.total,
        scored: full.scored.length,
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
    recorded: full.total,
    scored: full.scored.length,
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
      `הדלי "${input.bucket_key}" אינו אחד מהדליים שהגלאי החי יודע לבדוק, ולכן אי אפשר לרשום אותו מראש.`,
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
 * "החיפוש מצומצם לX — הדלי שהמשחקים המיובאים הצביעו עליו, שנרשם לפני שנרשמה כאן החלטה". The same
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
    `מפני שהדלי נרשם מראש, נבדק דלי אחד במקום שישה — ולכן דרושות ${required} החלטות חשופות ` +
    `במקום ${MIN_BUCKET_N * 2}. הרישום מקצר את ההמתנה, הוא לא מבטיח שיימצא בה משהו.`
  );
}

/**
 * Nothing cleared the threshold. Which search came up empty is part of the answer.
 *
 * Trimmed for the same reason as the two above. `loopPosition()` already says, at the top of the
 * page, "יש מספיק החלטות, ואף דפוס לא עבר את הסף. זו תשובה ולא שתיקה", with "{scored} החלטות
 * חשופות · אין דפוס מעל הסף" as its basis -- so the count and the it-is-an-answer line were both
 * second copies. What is kept is why the threshold is there at all, which the ribbon does not say
 * and which is the difference between a silence a player trusts and one they work around.
 */
function emptySearchReason(hypothesis: PreregisteredHypothesis | null): string {
  if (hypothesis) {
    return `הייבוא אמר איפה לחפש, לא מה יימצא. בדלי הזה לא נמצא פער כיול שעובר את הסף.`;
  }
  return (
    `הסף קיים כדי שלא נדווח על רעש: פער שנראה גדול בדלי קטן מצטמצם לאפס ככל שנוספות אליו ` +
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
export async function recordReading(store: RecordStore): Promise<RecordReading> {
  const atoms = await store.listAtoms();
  const ids = await store.listDecisionIds();
  /*
   * The branch mix is assembled HERE and not inside `readRecord`, because it needs fields that
   * `ScoredDecision` deliberately does not carry: the moves that were on the board, the chosen
   * move, the engine's move and the centipawn loss. `readRecord` sees only what a bucket may look
   * at, which is the reason the two are separate types in the first place.
   */
  const mix = oneThingMix(
    atoms.map((atom) => ({
      confidence: atom.bounded_action.confidence,
      candidatesConsidered: atom.bounded_action.candidate_moves_considered,
      chosenMove: atom.decision,
      cpLoss: atom.result?.cp_loss ?? null,
      bestMove: atom.result?.engine_best_move ?? null,
    })),
  );
  return readRecord(scoreDecisions(atoms, ids).scored, mix, readCounterfactuals(atoms));
}
