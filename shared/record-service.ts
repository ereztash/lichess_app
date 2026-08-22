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
import { BUCKETINGS, MIN_BUCKET_N, MIN_GAP_DIFFERENCE, detect, summarise } from "./detector.js";
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
export type { RecordReading } from "./record-dashboard.js";
import { scoreDecisions, silenceReason } from "./scoring.js";

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
    baselineGap: baseline.gap,
    predictsOverconfidence: true,
    minGapDifference: MIN_GAP_DIFFERENCE,
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
  recorded: number;
  scored: number;
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
  const summary = scoreDecisions(atoms, ids);
  const reason = silenceReason(summary, MIN_BUCKET_N * 2);
  if (reason) {
    return {
      claim: null,
      othersWithheld: 0,
      reason,
      recorded: summary.total,
      scored: summary.scored.length,
    };
  }
  const patterns = detect(summary.scored);
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
        recorded: summary.total,
        scored: summary.scored.length,
      };
    }
    await store.saveClaim(selection.claim);
  }
  return {
    claim: selection?.claim ?? null,
    othersWithheld: selection?.othersWithheld ?? 0,
    reason: selection
      ? null
      : `נבדקו ${summary.scored.length} החלטות חשופות ולא נמצא דפוס שעובר את הסף. זו תשובה תקינה — הסף קיים כדי שלא נדווח על רעש.`,
    recorded: summary.total,
    scored: summary.scored.length,
  };
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
  return readRecord(scoreDecisions(atoms, ids).scored);
}
