/**
 * The record's shape, independent of where it is stored.
 *
 * This interface used to live in server/record.ts alongside the Drizzle implementation, which
 * meant importing it dragged drizzle and @trpc/server into whatever imported it. The browser now
 * keeps a record too -- for a deployment with no sign-in configured, which is every deployment
 * until an OAuth portal exists -- so the contract has to be reachable from both sides without
 * carrying either side's dependencies. Types only: no runtime imports beyond other shared types.
 */
import type { Claim, DrillSpec, ProspectiveDrillResult } from "./claim.js";
import type {
  StoredBlitzDecision,
  StoredBlitzGame,
  StoredBlitzRecord,
} from "./blitz-record.js";
import type { PreregisteredHypothesis } from "./prereg.js";
import type { StoredImportDiagnostic } from "./import-diagnostic.js";
import type {
  DecisionAtom,
  DecisionResult,
  ProbeAssignment,
  StatedParts,
} from "./decision-atom.js";
import type {
  LearningRule,
  LearningTransfer,
  LearningTransferObservation,
  LearningTransferResult,
} from "./learning-record.js";
import type { Phase } from "./phase.js";
import type { DecisionPurpose } from "./confidence-asked.js";
import type { RevealTiming } from "./reveal-timing.js";
import type {
  AnalysisTiming,
  MeasurementProtocol,
} from "./measurement-protocol.js";

export interface CommitDecisionInput {
  decisionId: string;
  gameId: string;
  fen: string;
  ply: number;
  phase: Phase;
  clockMsRemaining: number | null;
  /**
   * Why this position was in front of the player. See shared/decision-atom.ts.
   *
   * NULL IS "NOBODY RECORDED THIS", not `play`. The purposes in an unstamped era are not all
   * ordinary moves -- the bank, the drills and the transfer checks are in there -- so a default
   * would file every drill of that era as free play.
   */
  purpose: DecisionPurpose | null;
  /**
   * The drill this decision belongs to, or null on every other purpose.
   *
   * NULLABLE RATHER THAN OPTIONAL, so that every write site has to say which it is. A field that
   * could be omitted would let a drill decision reach storage with no binding by forgetting a
   * line, which is precisely the failure the binding exists to close.
   */
  drillId: string | null;
  /**
   * The transfer check this decision belongs to, or null on every other purpose.
   *
   * NULLABLE RATHER THAN OPTIONAL for `drillId`'s reason: every write site has to say which it is,
   * so a transfer decision cannot reach storage unbound by forgetting a line.
   */
  transferId: string | null;
  /** Which grid the confidence level was stated on, or null on a row that did not say. */
  confidenceGridVersion?: number | null;
  secondsTaken: number;
  chosenMove: string;
  candidateMovesConsidered: string[];
  statedRead: string;
  statedUnknown: string;
  /**
   * How each read was said: the options tapped, and what was typed beside them.
   *
   * NULL IS "NOBODY RECORDED THIS", not "tapped nothing and typed nothing". Rows written before
   * this existed have a `statedRead` full of text and no parts at all, and reading them as an
   * empty answer would assert a silence that never happened.
   *
   * OPTIONAL ON THE TYPE, ENFORCED AT THE BOUNDARY -- the same shape `confidence_scale` already
   * uses, and for the same reason. A row that predates this has none, and a required field would
   * have made every fixture in the suite assert something about a vocabulary it is not testing.
   * What matters is that the LIVE path always fills it, and that is held by a test over the write
   * rather than by a type that cannot see which caller is the product.
   */
  statedReadParts?: StatedParts | null;
  statedUnknownParts?: StatedParts | null;
  /** Null when the question was never put -- see shared/confidence-asked.ts. Not "unanswered". */
  confidence: number | null;
  /** How many levels the scale had when it was stated. See shared/confidence.ts. */
  confidenceScale: number;
  /**
   * Which arm of the counterfactual probe this decision was randomised into.
   *
   * NULL MEANS "NOT IN THE EXPERIMENT", not "control". A decision committed by a client that
   * predates the probe was never randomised into anything, and reading it as an arm would enrol
   * it retrospectively into a group it was never part of.
   */
  probeAssignment: ProbeAssignment | null;
  /** Legal moves in the entry position. The covariate, not a filter. Null with the arm. */
  legalMoves: number | null;
  /** Which reveal timing was in force. Null on rows written before the deferred game existed. */
  revealTiming: RevealTiming | null;
  /** The conditions the decision was produced under. Null on rows written before it was recorded. */
  measurementProtocol: MeasurementProtocol | null;
  /** Which version of that protocol. Null wherever the protocol is. */
  protocolVersion: number | null;
  /** When the engine ran, which is not when the player was told. */
  analysisTiming: AnalysisTiming | null;
}

export interface FeedbackInput {
  revisedRead: string;
  wouldChooseAgain: boolean;
}

/** The narrow surface the router depends on, so tests run without a database. */
export interface RecordStore {
  commitDecision(input: CommitDecisionInput): Promise<void>;
  recordReveal(decisionId: string, result: DecisionResult): Promise<void>;
  recordFeedback(decisionId: string, feedback: FeedbackInput): Promise<void>;
  /**
   * The player's answer to "what would you have played instead". Append-only, and refused in
   * three cases: no such decision, an arm that was never asked, and a decision the engine has
   * already spoken on. `null` records an answered question with no move named, which is a
   * different fact from an unanswered one and must stay distinguishable.
   */
  recordCounterfactual(decisionId: string, alternative: string | null): Promise<void>;
  /** What the named alternative cost, measured at reveal. Refused when none was named. */
  scoreCounterfactual(decisionId: string, cpLoss: number): Promise<void>;
  hasReveal(decisionId: string): Promise<boolean>;
  getAtom(decisionId: string): Promise<DecisionAtom | null>;
  listAtoms(gameId?: string): Promise<DecisionAtom[]>;
  /** Decision ids in the SAME ORDER as listAtoms, so a scored row can name its decision. */
  listDecisionIds(gameId?: string): Promise<string[]>;
  countDecisions(): Promise<number>;

  // --- Layer B: claims and drills -------------------------------------------------------
  /** Store a claim, or update the grade of one that already exists. */
  saveClaim(claim: Claim): Promise<void>;
  /** Load a claim with its prospective test results attached. */
  getClaim(claimId: string): Promise<Claim | null>;
  /** Record a started drill. R5: written before the drill runs, condition included. */
  saveDrill(started: StoredDrill): Promise<void>;
  getDrill(drillId: string): Promise<StoredDrill | null>;
  /** Record a drill result. Append-only: a drill reports once. */
  saveDrillResult(result: ProspectiveDrillResult): Promise<void>;

  // --- Blitz, which is its own kind of record (docs/blitz/ADR-004) ----------------------
  /**
   * Store one finished, analysed blitz game and its decisions together.
   *
   * ONE CALL FOR BOTH, because a game whose decisions failed to write is worse than no game: the
   * conditions would be on record with nothing they describe, and a later count of games would
   * include it. Append-only -- a game is played once and analysed once.
   */
  saveBlitzRecord(record: StoredBlitzRecord): Promise<void>;
  /**
   * Fill in the engine's verdict on a game that is already stored.
   *
   * THE ONE PERMITTED UPDATE IN AN APPEND-ONLY RECORD, and it is narrow on purpose: it writes the
   * analysis columns and nothing else, once, and only over a game whose state is `pending`.
   * Nothing the player did is mutable -- the moves, the clocks, the think times and the stated
   * confidences are exactly as they were written when the game ended.
   *
   * It exists because the game is now stored BEFORE the engine runs, so that a tab closed during
   * analysis cannot lose it. Something has to be able to come back afterwards and say what the
   * engine found.
   */
  attachBlitzAnalysis(record: StoredBlitzRecord): Promise<void>;
  listBlitzGames(): Promise<StoredBlitzGame[]>;
  listBlitzDecisions(): Promise<StoredBlitzDecision[]>;

  // --- Verified learning ---------------------------------------------------------------
  saveLearningRule(rule: LearningRule): Promise<void>;
  getLearningRule(ruleId: string): Promise<LearningRule | null>;
  listLearningRules(): Promise<LearningRule[]>;
  saveLearningTransfer(transfer: LearningTransfer): Promise<void>;
  getLearningTransfer(transferId: string): Promise<LearningTransfer | null>;
  /**
   * The transfer already in flight for this rule -- preregistered, not yet reported -- or null.
   *
   * WITHOUT THIS THERE IS NO PREREGISTRATION. A started transfer lived on the server while the
   * fact that one was running lived only in React state, so a reload orphaned it and nothing
   * stopped a second one being registered over the same rule. A player could look at three
   * positions, dislike them, refresh, and draw three more -- choosing their own evidence, under a
   * stamp that says they did not.
   *
   * Returns the transfer rather than a boolean because the caller has to be able to RESUME it.
   * Losing a tab is not misconduct, and a rule whose test can be started but never finished is a
   * rule that can only be refuted by accident.
   */
  getOpenLearningTransfer(ruleId: string): Promise<LearningTransfer | null>;
  /**
   * Record one position's observation, at the moment it is made.
   *
   * APPEND-ONLY PER POSITION. These used to be held in React state for the whole run and reach the
   * server only at completion, and three defects came out of that one choice: a reload lost them
   * and the resume re-served positions whose answer the player had already seen; a failed reveal
   * write stranded the run with no control that could advance it; and the client was the only
   * holder, so completion had to trust whatever it sent.
   *
   * Throws on a second write for the same slot, the way every other append-only surface here does.
   */
  saveLearningTransferObservation(
    transferId: string,
    position: number,
    observation: LearningTransferObservation,
  ): Promise<void>;
  /** Everything recorded for this transfer so far, in position order. */
  listLearningTransferObservations(transferId: string): Promise<LearningTransferObservation[]>;
  saveLearningTransferResult(result: LearningTransferResult): Promise<void>;
  listLearningTransferResults(ruleId: string): Promise<LearningTransferResult[]>;

  // --- The import -> live-loop bridge (shared/prereg.ts) --------------------------------
  /**
   * Store a bucket named in advance. Append-only: a new import registers a NEW hypothesis rather
   * than editing the old one, so what was believed and when stays auditable.
   */
  savePreregisteredHypothesis(hypothesis: PreregisteredHypothesis): Promise<void>;
  /** The newest registered hypothesis, or null when the record has never had one. */
  getPreregisteredHypothesis(): Promise<PreregisteredHypothesis | null>;

  // --- The imported reading, kept (shared/import-diagnostic.ts) -------------------------
  /**
   * Keep a scan's reading. Append-only for the same reason as the hypothesis above: a second
   * import writes a new row, so which rates were on screen when a hypothesis was registered
   * stays recoverable instead of being overwritten by the next scan.
   */
  saveImportDiagnostic(reading: StoredImportDiagnostic): Promise<void>;
  /** The newest kept reading, or null when no scan has ever been run on this record. */
  getImportDiagnostic(): Promise<StoredImportDiagnostic | null>;

  /**
   * Can this store actually hold a decision right now?
   *
   * Not a health check for its own sake: the client chooses its backing from this. A store that
   * exists but cannot write must say so BEFORE a decision is taken, not by throwing after.
   */
  isAvailable(): Promise<boolean>;
}

/** A drill as stored: the spec plus what was fixed before it ran. */
export interface StoredDrill {
  spec: DrillSpec;
  predicted: boolean;
  started_at: string;
}
