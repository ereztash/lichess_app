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
  decisionFeedback,
  decisionReveals,
  decisions,
  type Decision,
  type InsertDecision,
} from "../drizzle/schema";
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
  countDecisions(): Promise<number>;
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
    return rows.map((row) => toAtom(row, revealBy.get(row.decisionId), feedbackBy.get(row.decisionId)));
  }

  async countDecisions(): Promise<number> {
    const db = await this.db();
    return (await db.select().from(decisions)).length;
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

  async countDecisions(): Promise<number> {
    return this.rows.size;
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
