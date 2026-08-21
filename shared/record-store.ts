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
import type { DecisionAtom, DecisionResult } from "./decision-atom.js";
import type { Phase } from "./phase.js";

export interface CommitDecisionInput {
  decisionId: string;
  gameId: string;
  fen: string;
  ply: number;
  phase: Phase;
  clockMsRemaining: number | null;
  secondsTaken: number;
  chosenMove: string;
  candidateMovesConsidered: string[];
  statedRead: string;
  statedUnknown: string;
  confidence: number;
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
