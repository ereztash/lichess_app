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
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  claims,
  decisionCounterfactuals,
  decisionFeedback,
  decisionReveals,
  decisions,
  drillResults,
  drills,
  learningRules,
  learningTransferObservations,
  learningTransferResults,
  learningTransfers,
  importReadings,
  preregisteredHypotheses,
  type Decision,
  type InsertDecision,
} from "../drizzle/schema.js";
import type { Claim, ProspectiveDrillResult } from "../shared/claim.js";
import type { DrillSpec } from "../shared/claim.js";
import type { DecisionAtom, DecisionResult } from "../shared/decision-atom.js";
import { assembleProbe } from "../shared/counterfactual.js";
import { RecordError } from "../shared/record-service.js";
import type { PreregisteredHypothesis } from "../shared/prereg.js";
import type { StoredImportDiagnostic } from "../shared/import-diagnostic.js";
import type {
  LearningRule,
  LearningTransfer,
  LearningTransferObservation,
  LearningTransferResult,
} from "../shared/learning-record.js";
import { getDb } from "./db.js";

/**
 * The contract now lives in shared/record-store.ts so the browser can implement it too.
 * Re-exported here because the server and its tests have always imported it from this module.
 */
export type {
  CommitDecisionInput,
  FeedbackInput,
  RecordStore,
  StoredDrill,
} from "../shared/record-store.js";
import type {
  CommitDecisionInput,
  FeedbackInput,
  RecordStore,
  StoredDrill,
} from "../shared/record-store.js";

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
  counterfactual?: typeof decisionCounterfactuals.$inferSelect | undefined,
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
      ...(decision.confidenceScale === null ? {} : { confidence_scale: decision.confidenceScale }),
      candidate_moves_considered: decision.candidateMovesConsidered,
    },
    probe: assembleProbe(
      decision,
      counterfactual && {
        alternative: counterfactual.alternativeMove,
        cpLoss: counterfactual.alternativeCpLoss,
      },
    ),
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

/**
 * One row of `learning_transfers`, as the shared type.
 *
 * Extracted because two queries now read this table and a second hand-written mapping is a second
 * place for a field to be dropped -- which is how `refutation_condition` would quietly become
 * undefined on the resume path while the original path stayed correct.
 */
function toLearningTransfer(row: {
  transferId: string;
  ruleId: string;
  fens: string[];
  ruleSnapshot: LearningTransfer["rule_snapshot"];
  refutationCondition: string;
  minimumSuccesses: number;
  retrievalStep: number;
  scheduledFor: Date;
  startedAt: Date;
}): LearningTransfer {
  return {
    transfer_id: row.transferId,
    rule_id: row.ruleId,
    fens: row.fens,
    rule_snapshot: row.ruleSnapshot,
    refutation_condition: row.refutationCondition,
    minimum_successes: row.minimumSuccesses,
    retrieval_step: row.retrievalStep,
    scheduled_for: row.scheduledFor.toISOString(),
    started_at: row.startedAt.toISOString(),
  };
}

/**
 * How long the availability probe is allowed to take before it answers "no".
 *
 * A refused connection is immediate; a firewalled host is not, and mysql2 would wait out its own
 * connectTimeout. The serverless function has 30 seconds in total and a monitor needs an answer,
 * so an unreachable host must produce one rather than a stall. Answering "no" on timeout is the
 * honest direction: what the caller asked is whether it can store a decision HERE, NOW.
 */
export const AVAILABILITY_PROBE_MS = 3_000;

/**
 * Resolve `work`, or reject once `ms` have passed -- whichever happens first.
 *
 * Exported and separate because it is the only part of the probe that a test can actually
 * measure. A control that lengthened the deadline to ten minutes SURVIVED the first version of
 * this file: every unreachable address available in the test environment refuses the connection
 * in under 25ms, so the race never needed the timer and the bound was never exercised. An
 * assertion satisfied by the fixture rather than by the code is not an assertion.
 */
export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

export class DrizzleRecordStore implements RecordStore {
  /**
   * Whether the database can actually be reached, asked by reaching it.
   *
   * THIS USED TO BE `Boolean(await getDb())`, WHICH MEASURED NOTHING. `drizzle(url)` builds a
   * mysql2 POOL, and a pool does not connect -- the connection happens on first use. Pointed at a
   * closed port it returned **true in 4ms**, and the first real query then threw. It was a test
   * of whether a string was set in the environment wearing the name of a test of whether the
   * database was up.
   *
   * `useRecordMode` exists for exactly one reason, in its own words: "The server is used only
   * when it says it can store." Against an unreachable database the server said it could, so the
   * client abandoned a working browser-local record and every commit failed -- the failure the
   * local path was built to prevent, delivered by the check meant to prevent it.
   *
   * Not cached. A cached "yes" during an outage is a stale claim of exactly the kind this
   * replaces, and the client already holds the answer for 60 seconds.
   */
  async isAvailable(): Promise<boolean> {
    const db = await getDb();
    if (!db) return false;
    try {
      await withDeadline(db.execute(sql`select 1`), AVAILABILITY_PROBE_MS);
      return true;
    } catch {
      // Every failure means the same thing to the caller: do not send a decision here.
      return false;
    }
  }

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
      confidenceScale: input.confidenceScale,
      probeAssignment: input.probeAssignment,
      legalMoves: input.legalMoves,
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

  async recordCounterfactual(decisionId: string, alternative: string | null): Promise<void> {
    const db = await this.db();
    const [decision] = await db
      .select()
      .from(decisions)
      .where(eq(decisions.decisionId, decisionId))
      .limit(1);
    if (!decision) throw new RecordError("NOT_FOUND", "אין החלטה כזאת ברשומה.");
    if (decision.probeAssignment !== "probed") {
      throw new RecordError(
        "BAD_REQUEST",
        "ההחלטה הזאת לא נשאלה את השאלה החלופית, ולכן אי אפשר לרשום עליה תשובה.",
      );
    }
    /*
     * R3 in the direction it is usually not written -- see the note on the in-memory store. An
     * alternative named after the evaluation is on screen is a reading of the engine's candidate.
     */
    if (await this.hasReveal(decisionId)) {
      throw new RecordError("BAD_REQUEST", "המנוע כבר דיבר על ההחלטה הזאת.");
    }
    // Append-only, like every other event table: no onDuplicateKeyUpdate.
    await db.insert(decisionCounterfactuals).values({ decisionId, alternativeMove: alternative });
  }

  async scoreCounterfactual(decisionId: string, cpLoss: number): Promise<void> {
    const db = await this.db();
    const [answer] = await db
      .select()
      .from(decisionCounterfactuals)
      .where(eq(decisionCounterfactuals.decisionId, decisionId))
      .limit(1);
    if (!answer) throw new RecordError("NOT_FOUND", "אין תשובה חלופית לתת לה ציון.");
    if (answer.alternativeMove === null) {
      throw new RecordError("BAD_REQUEST", "לא נאמר מהלך חלופי, ולכן אין מה לתמחר.");
    }
    await db
      .update(decisionCounterfactuals)
      .set({ alternativeCpLoss: cpLoss })
      .where(eq(decisionCounterfactuals.decisionId, decisionId));
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
    const [counterfactual] = await db
      .select()
      .from(decisionCounterfactuals)
      .where(eq(decisionCounterfactuals.decisionId, decisionId))
      .limit(1);
    return toAtom(decision, reveal, feedback, counterfactual);
  }

  /**
   * ORDER BY is not decoration here, and its absence was a real defect.
   *
   * `listDecisionIds` promises ids "in the SAME ORDER as listAtoms", and the in-memory store
   * keeps that promise for free because a Map iterates in insertion order. MySQL promises no
   * order at all without an ORDER BY, so against a real database these two methods could return
   * the same rows in different orders and a scored decision would be labelled with another
   * decision's id. Nothing caught it because nothing had ever run this class against a database.
   *
   * `createdAt` first, `decisionId` to break ties: two decisions committed inside the same
   * second must still come back in one stable order, or the same record reads differently twice.
   */
  async listAtoms(gameId?: string): Promise<DecisionAtom[]> {
    const db = await this.db();
    const rows = gameId
      ? await db
          .select()
          .from(decisions)
          .where(eq(decisions.gameId, gameId))
          .orderBy(decisions.createdAt, decisions.decisionId)
      : await db.select().from(decisions).orderBy(decisions.createdAt, decisions.decisionId);
    const reveals = await db.select().from(decisionReveals);
    const feedbacks = await db.select().from(decisionFeedback);
    const counterfactuals = await db.select().from(decisionCounterfactuals);
    const revealBy = new Map(reveals.map((r) => [r.decisionId, r]));
    const feedbackBy = new Map(feedbacks.map((f) => [f.decisionId, f]));
    const counterfactualBy = new Map(counterfactuals.map((c) => [c.decisionId, c]));
    return rows.map((row) =>
      toAtom(
        row,
        revealBy.get(row.decisionId),
        feedbackBy.get(row.decisionId),
        counterfactualBy.get(row.decisionId),
      ),
    );
  }

  /** Same ordering as `listAtoms`, for the reason stated there. */
  async listDecisionIds(gameId?: string): Promise<string[]> {
    const db = await this.db();
    const rows = gameId
      ? await db
          .select()
          .from(decisions)
          .where(eq(decisions.gameId, gameId))
          .orderBy(decisions.createdAt, decisions.decisionId)
      : await db.select().from(decisions).orderBy(decisions.createdAt, decisions.decisionId);
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

  async saveLearningRule(rule: LearningRule): Promise<void> {
    const db = await this.db();
    const [existingRow] = await db
      .select()
      .from(learningRules)
      .where(eq(learningRules.ruleId, rule.rule_id))
      .limit(1);
    if (existingRow && !sameLearningRuleAuthorship(toLearningRule(existingRow), rule)) {
      throw new Error("append-only: authored learning rule cannot change");
    }
    await db
      .insert(learningRules)
      .values({
        ruleId: rule.rule_id,
        sourceDecisionId: rule.source_decision_id,
        trigger: rule.trigger,
        mechanismClass: rule.mechanism_class,
        missedSignal: rule.missed_signal,
        actionRule: rule.action_rule,
        exceptionRule: rule.exception_rule,
        predictedOutcome: rule.predicted_outcome,
        refutationCondition: rule.refutation_condition,
        authoredBy: rule.authored_by,
        grade: rule.grade,
        retrievalStep: rule.retrieval_step,
        nextDueAt: rule.next_due_at ? new Date(rule.next_due_at) : null,
        createdAt: new Date(rule.created_at),
        lastEvaluatedAt: new Date(rule.last_evaluated_at),
      })
      .onDuplicateKeyUpdate({
        set: {
          grade: rule.grade,
          retrievalStep: rule.retrieval_step,
          nextDueAt: rule.next_due_at ? new Date(rule.next_due_at) : null,
          lastEvaluatedAt: new Date(rule.last_evaluated_at),
        },
      });
  }

  async getLearningRule(ruleId: string): Promise<LearningRule | null> {
    const db = await this.db();
    const [row] = await db
      .select()
      .from(learningRules)
      .where(eq(learningRules.ruleId, ruleId))
      .limit(1);
    return row ? toLearningRule(row) : null;
  }

  async listLearningRules(): Promise<LearningRule[]> {
    const db = await this.db();
    return (await db.select().from(learningRules)).map(toLearningRule);
  }

  async saveLearningTransfer(transfer: LearningTransfer): Promise<void> {
    const db = await this.db();
    await db.insert(learningTransfers).values({
      transferId: transfer.transfer_id,
      ruleId: transfer.rule_id,
      fens: transfer.fens,
      ruleSnapshot: transfer.rule_snapshot,
      refutationCondition: transfer.refutation_condition,
      minimumSuccesses: transfer.minimum_successes,
      retrievalStep: transfer.retrieval_step,
      scheduledFor: new Date(transfer.scheduled_for),
      startedAt: new Date(transfer.started_at),
    });
  }

  async getLearningTransfer(transferId: string): Promise<LearningTransfer | null> {
    const db = await this.db();
    const [row] = await db
      .select()
      .from(learningTransfers)
      .where(eq(learningTransfers.transferId, transferId))
      .limit(1);
    return row ? toLearningTransfer(row) : null;
  }

  /**
   * Preregistered and not yet reported, oldest first.
   *
   * A LEFT JOIN with the result table rather than two queries filtered in memory: "has this
   * transfer reported" is the join, and expressing it as one makes it impossible for the two
   * halves to be read at different moments.
   */
  async getOpenLearningTransfer(ruleId: string): Promise<LearningTransfer | null> {
    const db = await this.db();
    const [row] = await db
      .select({ transfer: learningTransfers })
      .from(learningTransfers)
      .leftJoin(
        learningTransferResults,
        eq(learningTransferResults.transferId, learningTransfers.transferId),
      )
      .where(
        and(eq(learningTransfers.ruleId, ruleId), isNull(learningTransferResults.transferId)),
      )
      .orderBy(learningTransfers.startedAt)
      .limit(1);
    return row ? toLearningTransfer(row.transfer) : null;
  }

  /**
   * One position's observation, written when it is made.
   *
   * The composite primary key on (transfer_id, position) is what makes this append-only, so a
   * second write for the same slot is refused by the database rather than by a check somebody has
   * to remember to add.
   */
  async saveLearningTransferObservation(
    transferId: string,
    position: number,
    observation: LearningTransferObservation,
  ): Promise<void> {
    const db = await this.db();
    await db.insert(learningTransferObservations).values({
      transferId,
      position,
      decisionId: observation.decision_id,
      recalledRule: observation.recalled_rule,
      appliedRule: observation.applied_rule,
    });
  }

  async listLearningTransferObservations(
    transferId: string,
  ): Promise<LearningTransferObservation[]> {
    const db = await this.db();
    const rows = await db
      .select()
      .from(learningTransferObservations)
      .where(eq(learningTransferObservations.transferId, transferId))
      .orderBy(learningTransferObservations.position);
    return rows.map((row) => ({
      decision_id: row.decisionId,
      recalled_rule: row.recalledRule,
      applied_rule: row.appliedRule,
    }));
  }

  async saveLearningTransferResult(result: LearningTransferResult): Promise<void> {
    const db = await this.db();
    await db.insert(learningTransferResults).values({
      transferId: result.transfer_id,
      ruleId: result.rule_id,
      decisionIds: result.decision_ids,
      recalledRules: result.recalled_rules,
      appliedRule: result.applied_rule,
      successes: result.successes,
      observed: result.observed,
      completedAt: new Date(result.completed_at),
    });
  }

  async listLearningTransferResults(ruleId: string): Promise<LearningTransferResult[]> {
    const db = await this.db();
    const rows = await db
      .select()
      .from(learningTransferResults)
      .where(eq(learningTransferResults.ruleId, ruleId));
    return rows.map((row) => ({
      kind: "learning_transfer_result" as const,
      transfer_id: row.transferId,
      rule_id: row.ruleId,
      decision_ids: row.decisionIds,
      recalled_rules: row.recalledRules,
      applied_rule: row.appliedRule,
      successes: row.successes,
      observed: row.observed,
      completed_at: row.completedAt.toISOString(),
    }));
  }

  /*
   * Rates are stored as PER-MILLE INTEGERS, not floats.
   *
   * A calibration rate is a ratio of small counts, and MySQL's float columns would round it to
   * something that no longer reproduces the comparison it came from. Three digits is finer than
   * any n this product will ever have, and an integer round-trips exactly.
   */
  async savePreregisteredHypothesis(hypothesis: PreregisteredHypothesis): Promise<void> {
    const db = await this.db();
    const registeredAt = new Date(hypothesis.registered_at);
    await db.insert(preregisteredHypotheses).values({
      hypothesisId: `prereg-${hypothesis.bucket_key}-${hypothesis.registered_at}`,
      bucketKey: hypothesis.bucket_key,
      scope: hypothesis.scope,
      decisionsBefore: hypothesis.decisions_before,
      evidenceAccurateRate: Math.round(hypothesis.evidence.accurate_rate * 1000),
      evidenceN: hypothesis.evidence.n,
      evidenceRunnerUpKey: hypothesis.evidence.runner_up_key,
      evidenceSeparation: Math.round(hypothesis.evidence.separation * 1000),
      evidenceThreshold: Math.round(hypothesis.evidence.threshold * 1000),
      evidenceGames: hypothesis.evidence.games,
      refutationCondition: hypothesis.refutation_condition,
      registeredAt,
    });
  }

  /*
   * The scan's reading, kept whole.
   *
   * `readingId` is derived from the username and the scan timestamp rather than generated, so a
   * retried write of the SAME scan collides instead of silently producing two rows that differ
   * only by id -- which would make "the newest reading" ambiguous at exactly the moment a reader
   * is trusting it.
   */
  async saveImportDiagnostic(reading: StoredImportDiagnostic): Promise<void> {
    const db = await this.db();
    await db.insert(importReadings).values({
      readingId: `import-${reading.username}-${reading.scanned_at}`,
      username: reading.username,
      games: reading.games,
      diagnostic: reading.diagnostic,
      scannedAt: new Date(reading.scanned_at),
    });
  }

  async getImportDiagnostic(): Promise<StoredImportDiagnostic | null> {
    const db = await this.db();
    const rows = await db
      .select()
      .from(importReadings)
      .orderBy(desc(importReadings.scannedAt), desc(importReadings.readingId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      diagnostic: row.diagnostic,
      username: row.username,
      games: row.games,
      scanned_at: row.scannedAt.toISOString(),
    };
  }

  async getPreregisteredHypothesis(): Promise<PreregisteredHypothesis | null> {
    const db = await this.db();
    const rows = await db
      .select()
      .from(preregisteredHypotheses)
      .orderBy(desc(preregisteredHypotheses.registeredAt), desc(preregisteredHypotheses.hypothesisId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      bucket_key: row.bucketKey,
      scope: row.scope,
      registered_at: row.registeredAt.toISOString(),
      decisions_before: row.decisionsBefore,
      evidence: {
        accurate_rate: row.evidenceAccurateRate / 1000,
        n: row.evidenceN,
        runner_up_key: row.evidenceRunnerUpKey,
        separation: row.evidenceSeparation / 1000,
        threshold: row.evidenceThreshold / 1000,
        games: row.evidenceGames,
      },
      refutation_condition: row.refutationCondition,
    };
  }

}

function toLearningRule(row: typeof learningRules.$inferSelect): LearningRule {
  return {
    rule_id: row.ruleId,
    source_decision_id: row.sourceDecisionId,
    trigger: row.trigger,
    mechanism_class: row.mechanismClass,
    missed_signal: row.missedSignal,
    action_rule: row.actionRule,
    exception_rule: row.exceptionRule,
    predicted_outcome: row.predictedOutcome,
    refutation_condition: row.refutationCondition,
    authored_by: row.authoredBy,
    grade: row.grade,
    retrieval_step: row.retrievalStep,
    next_due_at: row.nextDueAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    last_evaluated_at: row.lastEvaluatedAt.toISOString(),
  };


}

/** In-memory store. Used by tests; never wired into a deployment. */
export class MemoryRecordStore implements RecordStore {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  private readonly rows = new Map<string, CommitDecisionInput>();
  private readonly reveals = new Map<string, DecisionResult>();
  private readonly feedbacks = new Map<string, FeedbackInput>();
  /** Present iff the question was answered. The value is null when no move was named. */
  private readonly counterfactuals = new Map<string, { alternative: string | null; cpLoss: number | null }>();
  private readonly preregRows: PreregisteredHypothesis[] = [];

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
    if (this.feedbacks.has(decisionId)) throw new Error("append-only: feedback already exists");
    this.feedbacks.set(decisionId, feedback);
  }

  async recordCounterfactual(decisionId: string, alternative: string | null): Promise<void> {
    const row = this.rows.get(decisionId);
    if (!row) throw new Error("no such decision");
    if (row.probeAssignment !== "probed") throw new Error("this decision was never asked");
    /*
     * R3 IN THE DIRECTION IT IS USUALLY NOT WRITTEN. The rule normally stops the engine speaking
     * before a commitment; here it stops the player's answer arriving after the engine has. An
     * alternative named with an evaluation already on screen is a reading of the engine's
     * candidate, not a self-generated one, and the two are indistinguishable once stored.
     */
    if (this.reveals.has(decisionId)) throw new Error("the engine has already spoken");
    if (this.counterfactuals.has(decisionId)) throw new Error("append-only: already answered");
    this.counterfactuals.set(decisionId, { alternative, cpLoss: null });
  }

  async scoreCounterfactual(decisionId: string, cpLoss: number): Promise<void> {
    const answer = this.counterfactuals.get(decisionId);
    if (!answer) throw new Error("no answer to score");
    // A score with no move behind it came from somewhere other than this decision.
    if (answer.alternative === null) throw new Error("no alternative was named");
    this.counterfactuals.set(decisionId, { ...answer, cpLoss });
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
  private readonly learningRuleRows = new Map<string, LearningRule>();
  private readonly learningTransferRows = new Map<string, LearningTransfer>();
  private readonly learningTransferResultRows: LearningTransferResult[] = [];
  /** Keyed `transferId#position`, mirroring the composite primary key in the database. */
  private readonly learningObservationRows = new Map<string, LearningTransferObservation>();

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

  async saveLearningRule(rule: LearningRule): Promise<void> {
    const existing = this.learningRuleRows.get(rule.rule_id);
    if (existing && !sameLearningRuleAuthorship(existing, rule)) {
      throw new Error("append-only: authored learning rule cannot change");
    }
    this.learningRuleRows.set(rule.rule_id, structuredClone(rule));
  }

  async getLearningRule(ruleId: string): Promise<LearningRule | null> {
    const rule = this.learningRuleRows.get(ruleId);
    return rule ? structuredClone(rule) : null;
  }

  async listLearningRules(): Promise<LearningRule[]> {
    return [...this.learningRuleRows.values()].map((rule) => structuredClone(rule));
  }

  async saveLearningTransfer(transfer: LearningTransfer): Promise<void> {
    if (this.learningTransferRows.has(transfer.transfer_id)) {
      throw new Error("append-only: learning transfer already started");
    }
    this.learningTransferRows.set(transfer.transfer_id, structuredClone(transfer));
  }

  async getLearningTransfer(transferId: string): Promise<LearningTransfer | null> {
    const transfer = this.learningTransferRows.get(transferId);
    return transfer ? structuredClone(transfer) : null;
  }

  async getOpenLearningTransfer(ruleId: string): Promise<LearningTransfer | null> {
    const reported = new Set(this.learningTransferResultRows.map((row) => row.transfer_id));
    const open = [...this.learningTransferRows.values()]
      .filter((row) => row.rule_id === ruleId && !reported.has(row.transfer_id))
      .sort((a, b) => a.started_at.localeCompare(b.started_at));
    return open[0] ? structuredClone(open[0]) : null;
  }

  async saveLearningTransferObservation(
    transferId: string,
    position: number,
    observation: LearningTransferObservation,
  ): Promise<void> {
    const key = `${transferId}#${position}`;
    if (this.learningObservationRows.has(key)) {
      throw new Error("append-only: transfer observation already recorded for that position");
    }
    this.learningObservationRows.set(key, structuredClone(observation));
  }

  async listLearningTransferObservations(
    transferId: string,
  ): Promise<LearningTransferObservation[]> {
    return [...this.learningObservationRows.entries()]
      .filter(([key]) => key.startsWith(`${transferId}#`))
      .sort((a, b) => Number(a[0].split("#")[1]) - Number(b[0].split("#")[1]))
      .map(([, observation]) => structuredClone(observation));
  }

  async saveLearningTransferResult(result: LearningTransferResult): Promise<void> {
    if (this.learningTransferResultRows.some((row) => row.transfer_id === result.transfer_id)) {
      throw new Error("append-only: learning transfer already reported");
    }
    this.learningTransferResultRows.push(structuredClone(result));
  }

  async listLearningTransferResults(ruleId: string): Promise<LearningTransferResult[]> {
    return this.learningTransferResultRows
      .filter((result) => result.rule_id === ruleId)
      .map((result) => structuredClone(result));
  }


  async savePreregisteredHypothesis(hypothesis: PreregisteredHypothesis): Promise<void> {
    // Append-only, same as the table: the newest wins, the older ones stay readable.
    this.preregRows.push(structuredClone(hypothesis));
  }

  private readonly importReadingRows: StoredImportDiagnostic[] = [];

  async saveImportDiagnostic(reading: StoredImportDiagnostic): Promise<void> {
    // Append-only, same as the table: the newest wins, the older ones stay readable.
    this.importReadingRows.push(structuredClone(reading));
  }

  async getImportDiagnostic(): Promise<StoredImportDiagnostic | null> {
    const newest = this.importReadingRows[this.importReadingRows.length - 1];
    return newest ? structuredClone(newest) : null;
  }

  async getPreregisteredHypothesis(): Promise<PreregisteredHypothesis | null> {
    const newest = this.preregRows[this.preregRows.length - 1];
    return newest ? structuredClone(newest) : null;
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
        ...(row.confidenceScale === null ? {} : { confidence_scale: row.confidenceScale }),
        candidate_moves_considered: row.candidateMovesConsidered,
      },
      probe: assembleProbe(row, this.counterfactuals.get(row.decisionId)),
      result,
      feedback: feedback
        ? { revised_read: feedback.revisedRead, would_choose_again: feedback.wouldChooseAgain }
        : null,
    };
  }
}


function sameLearningRuleAuthorship(left: LearningRule, right: LearningRule): boolean {
  const mutable = new Set(["grade", "retrieval_step", "next_due_at", "last_evaluated_at"]);
  return Object.entries(left).every(
    ([key, value]) =>
      mutable.has(key) ||
      JSON.stringify(value) === JSON.stringify(right[key as keyof LearningRule]),
  );
}

export const recordStore: RecordStore = new DrizzleRecordStore();
