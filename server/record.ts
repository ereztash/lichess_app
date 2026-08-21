/**
 * LAYER A -- THE RECORD. The only thing in this product that is ever "true".
 *
 * Append-only. The player's decision is written BEFORE any engine output is produced (R3), into
 * a table that cannot hold engine output at all (section 3.2).
 *
 * On storage being unavailable this THROWS. It does not no-op. `upsertUser` in server/db.ts
 * returns silently when getDb() is null, which means a caller cannot distinguish "written" from
 * "discarded" -- exactly the R2 failure, one layer below the interface. A decision that was not
 * stored must never look like one that was.
 */
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  claims,
  decisionFeedback,
  decisionReveals,
  decisions,
  drillResults,
  drills,
  type Decision,
  type InsertDecision,
} from "../drizzle/schema";
import type { Claim, ProspectiveDrillResult } from "../shared/claim";
import type { DrillSpec } from "../shared/claim";
import type { DecisionAtom, DecisionResult } from "../shared/decision-atom";
import { getDb } from "./db";

export interface CommitDecisionInput {
  decisionId: string;
  gameId: string;
  fen: string;
  ply: number;
  phase: Decision["phase"];
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
}

/** A drill as stored: the spec plus what was fixed before it ran. */
export interface StoredDrill {
  spec: DrillSpec;
  predicted: boolean;
  started_at: string;
}

const unavailable = () =>
  new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "אין חיבור למאגר ההחלטות, ולכן ההחלטה לא נשמרה. לא נמשיך לחשיפה — החלטה שלא נרשמה אינה החלטה.",
  });

/**
 * Assemble the atom from its three tables. This is the "session report" layer for GATE-ISO:
 * the field names here are the same names the screen and the API event use.
 */
function toAtom(
  decision: Decision,
  reveal: typeof decisionReveals.$inferSelect | undefined,
  feedback: typeof decisionFeedback.$inferSelect | undefined,
): DecisionAtom {
  return {
    entry_state: {
      game_id: decision.gameId,
      fen: decision.fen,
      ply: decision.ply,
      phase: decision.phase,
      clock_ms_remaining: decision.clockMsRemaining,
    },
    known: decision.statedRead,
    unknown: decision.statedUnknown,
    decision: decision.chosenMove,
    bounded_action: {
      seconds_taken: decision.secondsTaken,
      confidence: decision.confidence,
      candidate_moves_considered: decision.candidateMovesConsidered,
    },
    result: reveal
      ? {
          engine_eval_cp: reveal.engineEvalCp,
          engine_best_move: reveal.engineBestMove,
          engine_depth: reveal.engineDepth,
          engine_source: reveal.engineSource,
          cp_loss: reveal.cpLoss,
        }
      : null,
    feedback: feedback
      ? { revised_read: feedback.revisedRead, would_choose_again: feedback.wouldChooseAgain }
      : null,
  };
}

export class DrizzleRecordStore implements RecordStore {
  private async db() {
    const db = await getDb();
    if (!db) throw unavailable();
    return db;
  }

  async commitDecision(input: CommitDecisionInput): Promise<void> {
    const db = await this.db();
    const row: InsertDecision = {
      decisionId: input.decisionId,
      gameId: input.gameId,
      fen: input.fen,
      ply: input.ply,
      phase: input.phase,
      clockMsRemaining: input.clockMsRemaining,
      secondsTaken: input.secondsTaken,
      chosenMove: input.chosenMove,
      candidateMovesConsidered: input.candidateMovesConsidered,
      statedRead: input.statedRead,
      statedUnknown: input.statedUnknown,
      confidence: input.confidence,
    };
    // Append-only: no onDuplicateKeyUpdate. A repeated decision_id is a bug, not an update.
    await db.insert(decisions).values(row);
  }

  async recordReveal(decisionId: string, result: DecisionResult): Promise<void> {
    const db = await this.db();
    await db.insert(decisionReveals).values({
      decisionId,
      engineEvalCp: result.engine_eval_cp,
      engineBestMove: result.engine_best_move,
      engineDepth: result.engine_depth,
      engineSource: result.engine_source,
      cpLoss: result.cp_loss,
    });
  }

  async recordFeedback(decisionId: string, feedback: FeedbackInput): Promise<void> {
    const db = await this.db();
    await db.insert(decisionFeedback).values({
      decisionId,
      revisedRead: feedback.revisedRead,
      wouldChooseAgain: feedback.wouldChooseAgain,
    });
  }

  async hasReveal(decisionId: string): Promise<boolean> {
    const db = await this.db();
    const rows = await db
      .select()
      .from(decisionReveals)
      .where(eq(decisionReveals.decisionId, decisionId))
      .limit(1);
    return rows.length > 0;
  }

  async getAtom(decisionId: string): Promise<DecisionAtom | null> {
    const db = await this.db();
    const [decision] = await db
      .select()
      .from(decisions)
      .where(eq(decisions.decisionId, decisionId))
      .limit(1);
    if (!decision) return null;
    const [reveal] = await db
      .select()
      .from(decisionReveals)
      .where(eq(decisionReveals.decisionId, decisionId))
      .limit(1);
    const [feedback] = await db
      .select()
      .from(decisionFeedback)
      .where(eq(decisionFeedback.decisionId, decisionId))
      .limit(1);
    return toAtom(decision, reveal, feedback);
  }

  async listAtoms(gameId?: string): Promise<DecisionAtom[]> {
    const db = await this.db();
    const rows = gameId
      ? await db.select().from(decisions).where(eq(decisions.gameId, gameId))
      : await db.select().from(decisions);
    const reveals = await db.select().from(decisionReveals);
    const feedbacks = await db.select().from(decisionFeedback);
    const revealBy = new Map(reveals.map((r) => [r.decisionId, r]));
    const feedbackBy = new Map(feedbacks.map((f) => [f.decisionId, f]));
    return rows.map((row) =>
      toAtom(row, revealBy.get(row.decisionId), feedbackBy.get(row.decisionId)),
    );
  }

  async listDecisionIds(gameId?: string): Promise<string[]> {
    const db = await this.db();
    const rows = gameId
      ? await db.select().from(decisions).where(eq(decisions.gameId, gameId))
      : await db.select().from(decisions);
    return rows.map((row) => row.decisionId);
  }

  async countDecisions(): Promise<number> {
    const db = await this.db();
    return (await db.select().from(decisions)).length;
  }

  async saveClaim(claim: Claim): Promise<void> {
    const db = await this.db();
    const row = {
      claimId: claim.claim_id,
      statement: claim.statement,
      scope: claim.scope,
      supportingDecisionIds: claim.supporting_decision_ids,
      n: claim.n,
      grade: claim.grade,
      refutationCondition: claim.refutation_condition,
    };
    // The grade is the one field that legitimately changes, and only via evaluateClaim.
    await db
      .insert(claims)
      .values(row)
      .onDuplicateKeyUpdate({ set: { grade: claim.grade } });
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    const db = await this.db();
    const [row] = await db.select().from(claims).where(eq(claims.claimId, claimId)).limit(1);
    if (!row) return null;
    const results = await db.select().from(drillResults).where(eq(drillResults.claimId, claimId));
    return {
      claim_id: row.claimId,
      statement: row.statement,
      scope: row.scope,
      supporting_decision_ids: row.supportingDecisionIds,
      n: row.n,
      grade: row.grade,
      refutation_condition: row.refutationCondition,
      prospective_tests: results.map((r) => ({
        kind: "prospective_drill_result" as const,
        drill_id: r.drillId,
        claim_id: r.claimId,
        decision_ids: r.decisionIds,
        predicted: r.predicted,
        observed: r.observed,
        recorded_at: r.recordedAt.toISOString(),
      })),
      created_at: row.createdAt.toISOString(),
      last_evaluated_at: row.lastEvaluatedAt.toISOString(),
    };
  }

  async saveDrill(started: StoredDrill): Promise<void> {
    const db = await this.db();
    await db.insert(drills).values({
      drillId: started.spec.drill_id,
      claimId: started.spec.claim_id,
      fens: started.spec.fens,
      refutationCondition: started.spec.refutation_condition,
      predicted: started.predicted,
    });
  }

  async getDrill(drillId: string): Promise<StoredDrill | null> {
    const db = await this.db();
    const [row] = await db.select().from(drills).where(eq(drills.drillId, drillId)).limit(1);
    if (!row) return null;
    return {
      spec: {
        drill_id: row.drillId,
        claim_id: row.claimId,
        fens: row.fens,
        refutation_condition: row.refutationCondition,
      },
      predicted: row.predicted,
      started_at: row.startedAt.toISOString(),
    };
  }

  async saveDrillResult(result: ProspectiveDrillResult): Promise<void> {
    const db = await this.db();
    const [drill] = await db
      .select()
      .from(drills)
      .where(eq(drills.drillId, result.drill_id))
      .limit(1);
    await db.insert(drillResults).values({
      drillId: result.drill_id,
      claimId: result.claim_id,
      decisionIds: result.decision_ids,
      refutationCondition: drill?.refutationCondition ?? "",
      predicted: result.predicted,
      observed: result.observed,
    });
  }
}

/** In-memory store. Used by tests; never wired into a deployment. */
export class MemoryRecordStore implements RecordStore {
  private readonly rows = new Map<string, CommitDecisionInput>();
  private readonly reveals = new Map<string, DecisionResult>();
  private readonly feedbacks = new Map<string, FeedbackInput>();

  async commitDecision(input: CommitDecisionInput): Promise<void> {
    if (this.rows.has(input.decisionId)) throw new Error("append-only: decision_id already exists");
    this.rows.set(input.decisionId, input);
  }

  async recordReveal(decisionId: string, result: DecisionResult): Promise<void> {
    if (!this.rows.has(decisionId)) throw new Error("no such decision");
    if (this.reveals.has(decisionId)) throw new Error("append-only: already revealed");
    this.reveals.set(decisionId, result);
  }

  async recordFeedback(decisionId: string, feedback: FeedbackInput): Promise<void> {
    if (!this.rows.has(decisionId)) throw new Error("no such decision");
    this.feedbacks.set(decisionId, feedback);
  }

  async hasReveal(decisionId: string): Promise<boolean> {
    return this.reveals.has(decisionId);
  }

  async getAtom(decisionId: string): Promise<DecisionAtom | null> {
    const row = this.rows.get(decisionId);
    if (!row) return null;
    return this.assemble(row);
  }

  async listAtoms(gameId?: string): Promise<DecisionAtom[]> {
    return [...this.rows.values()]
      .filter((row) => !gameId || row.gameId === gameId)
      .map((row) => this.assemble(row));
  }

  async listDecisionIds(gameId?: string): Promise<string[]> {
    return [...this.rows.values()]
      .filter((row) => !gameId || row.gameId === gameId)
      .map((row) => row.decisionId);
  }

  async countDecisions(): Promise<number> {
    return this.rows.size;
  }

  private readonly claimRows = new Map<string, Claim>();
  private readonly drillRows = new Map<string, StoredDrill>();
  private readonly drillResultRows: ProspectiveDrillResult[] = [];

  async saveClaim(claim: Claim): Promise<void> {
    this.claimRows.set(claim.claim_id, { ...claim });
  }

  async getClaim(claimId: string): Promise<Claim | null> {
    const claim = this.claimRows.get(claimId);
    if (!claim) return null;
    return {
      ...claim,
      prospective_tests: this.drillResultRows.filter((r) => r.claim_id === claimId),
    };
  }

  async saveDrill(started: StoredDrill): Promise<void> {
    if (this.drillRows.has(started.spec.drill_id)) {
      throw new Error("append-only: drill already started");
    }
    this.drillRows.set(started.spec.drill_id, started);
  }

  async getDrill(drillId: string): Promise<StoredDrill | null> {
    return this.drillRows.get(drillId) ?? null;
  }

  async saveDrillResult(result: ProspectiveDrillResult): Promise<void> {
    if (this.drillResultRows.some((r) => r.drill_id === result.drill_id)) {
      throw new Error("append-only: drill already reported");
    }
    this.drillResultRows.push(result);
  }

  private assemble(row: CommitDecisionInput): DecisionAtom {
    const result = this.reveals.get(row.decisionId) ?? null;
    const feedback = this.feedbacks.get(row.decisionId);
    return {
      entry_state: {
        game_id: row.gameId,
        fen: row.fen,
        ply: row.ply,
        phase: row.phase,
        clock_ms_remaining: row.clockMsRemaining,
      },
      known: row.statedRead,
      unknown: row.statedUnknown,
      decision: row.chosenMove,
      bounded_action: {
        seconds_taken: row.secondsTaken,
        confidence: row.confidence,
        candidate_moves_considered: row.candidateMovesConsidered,
      },
      result,
      feedback: feedback
        ? { revised_read: feedback.revisedRead, would_choose_again: feedback.wouldChooseAgain }
        : null,
    };
  }
}

export const recordStore: RecordStore = new DrizzleRecordStore();
