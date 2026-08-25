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
import type { DecisionAtom, DecisionResult } from "./decision-atom.js";
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
import type { CommitDecisionInput, FeedbackInput, RecordStore } from "./record-store.js";
import { readRecord, type RecordReading } from "./record-dashboard.js";
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
    candidate_moves_considered: string[];
  };
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
  };
  await store.commitDecision(row);
  // Deliberately returns no engine field of any kind.
  return { decision_id: input.decision_id };
}

/**
 * Store the engine's verdict against an ALREADY COMMITTED decision, and hand back the atom.
 * Refuses when the decision was never recorded: that is R3, wherever the loop is running.
 */
export async function reveal(
  store: RecordStore,
  decisionId: string,
  result: DecisionResult,
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
  if (rule.next_due_at && new Date(now.started_at) < new Date(rule.next_due_at)) {
    return {
      transfer: null,
      reason: `הכלל הזה מתוזמן לחזרה מרווחת בתאריך ${rule.next_due_at}.`,
    };
  }
  const source = await store.getAtom(rule.source_decision_id);
  const decided = new Set((await store.listAtoms()).map((atom) => atom.entry_state.fen));
  if (source) decided.add(source.entry_state.fen);
  const unseen = [...new Set(input.candidate_fens)].filter((fen) => !decided.has(fen));
  if (unseen.length < TRANSFER_POSITION_COUNT) {
    return {
      transfer: null,
      reason: `נדרשות ${TRANSFER_POSITION_COUNT} עמדות שלא נראו; זמינות רק ${unseen.length}.`,
    };
  }
  const transfer = preregisterLearningTransfer(rule, unseen.slice(0, TRANSFER_POSITION_COUNT), now);
  // R5 for learning: persist the snapshot and refutation condition before returning any FEN.
  await store.saveLearningTransfer(transfer);
  return { transfer, reason: null };
}

export async function finishLearningTransfer(
  store: RecordStore,
  input: { transfer_id: string; observations: LearningTransferObservation[] },
  now: { completed_at: string },
) {
  const transfer = await store.getLearningTransfer(input.transfer_id);
  if (!transfer) throw new RecordError("NOT_FOUND", "אין בדיקת העברה עם המזהה הזה.");
  if (input.observations.length !== transfer.fens.length) {
    throw new RecordError(
      "PRECONDITION_FAILED",
      "לכל עמדה בבדיקת ההעברה נדרשת תצפית אחת.",
    );
  }
  const atoms = await Promise.all(input.observations.map((o) => store.getAtom(o.decision_id)));
  for (let index = 0; index < atoms.length; index += 1) {
    const atom = atoms[index];
    if (!atom?.result) {
      throw new RecordError(
        "PRECONDITION_FAILED",
        "כל החלטה בבדיקת ההעברה חייבת להירשם ולהיחשף.",
      );
    }
    if (atom.entry_state.fen !== transfer.fens[index]) {
      throw new RecordError(
        "PRECONDITION_FAILED",
        "החלטה בבדיקת ההעברה נרשמה לעמדה אחרת.",
      );
    }
  }

  const successes = atoms.filter((atom, index) => {
    const observation = input.observations[index];
    return (
      observation.recalled_rule.trim().length > 0 &&
      observation.applied_rule &&
      atom!.result!.cp_loss <= ACCURATE_CP_LOSS
    );
  }).length;
  const result: LearningTransferResult = {
    kind: "learning_transfer_result",
    transfer_id: transfer.transfer_id,
    rule_id: transfer.rule_id,
    decision_ids: input.observations.map((o) => o.decision_id),
    recalled_rules: input.observations.map((o) => o.recalled_rule.trim()),
    applied_rule: input.observations.map((o) => o.applied_rule),
    successes,
    observed: successes >= transfer.minimum_successes,
    completed_at: now.completed_at,
  };
  await store.saveLearningTransferResult(result);

  const rule = await store.getLearningRule(transfer.rule_id);
  if (!rule) throw new RecordError("NOT_FOUND", "כלל הלמידה נעלם לפני הדירוג.");
  const prior = (await store.listLearningTransferResults(rule.rule_id)).filter(
    (candidate) => candidate.transfer_id !== result.transfer_id,
  );
  const graded = gradeLearningRule(rule, prior, result);
  await store.saveLearningRule(graded);
  return { rule: graded, result };
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
  const selection = selectClaim(patterns, {
    // Stable across queries, so a drill result can attach to the same claim.
    claim_id: patterns.length ? `claim-${patterns[0].key}` : "claim-none",
    created_at: now.created_at,
  });
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
  return readRecord(scoreDecisions(atoms, ids).scored, mix);
}
