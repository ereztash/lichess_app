import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { CLAIM_GRADES } from "../shared/claim.js";
import { ENGINE_SOURCES, PHASES } from "../shared/decision-atom.js";
import { LEARNING_RULE_GRADES, MECHANISM_CLASSES } from "../shared/learning-record.js";
import type { ImportDiagnostic } from "../shared/import-diagnostic.js";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * LAYER A, TABLE 1 -- THE RECORD (section 3.2).
 *
 * Append-only. One row per decision, written BEFORE any engine output is rendered (R3).
 * This table holds only what the PLAYER produced. Nothing the engine said may be added to it.
 */
export const decisions = mysqlTable(
  "decisions",
  {
    decisionId: varchar("decision_id", { length: 36 }).primaryKey(),
    gameId: varchar("game_id", { length: 64 }).notNull(),
    fen: varchar("fen", { length: 200 }).notNull(),
    ply: int("ply").notNull(),
    phase: mysqlEnum("phase", PHASES).notNull(),
    clockMsRemaining: int("clock_ms_remaining"),
    secondsTaken: int("seconds_taken").notNull(),
    chosenMove: varchar("chosen_move", { length: 6 }).notNull(),
    candidateMovesConsidered: json("candidate_moves_considered").$type<string[]>().notNull(),
    statedRead: varchar("stated_read", { length: 200 }).notNull(),
    /** Atom `unknown`. See the deviation note in shared/decision-atom.ts. */
    statedUnknown: varchar("stated_unknown", { length: 200 }).notNull(),
    confidence: int("confidence").notNull(),
    /**
     * How many levels the scale had when that confidence was stated.
     *
     * NULLABLE ON PURPOSE, and it is not a missing value. Rows written before the scale moved to
     * seven have no scale to record; NULL is the honest representation of "stated on the
     * five-level scale", which is what a row of that age means. Backfilling it with a 5 would
     * assert that someone recorded it, and nobody did.
     */
    confidenceScale: int("confidence_scale"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("decisions_game_idx").on(table.gameId)],
);
export type Decision = typeof decisions.$inferSelect;
export type InsertDecision = typeof decisions.$inferInsert;

/**
 * LAYER A, TABLE 2 -- THE REVEAL (section 3.2).
 *
 * SEPARATE TABLE ON PURPOSE. DO NOT MERGE INTO `decisions`.
 *
 * A single row holding both the player's read and the engine's verdict makes it structurally
 * possible to express "the player understood" as "the engine agreed", and those are different
 * things. Keeping them apart makes the conflation impossible to write down, which is stronger
 * than making it discouraged.
 */
export const decisionReveals = mysqlTable("decision_reveals", {
  decisionId: varchar("decision_id", { length: 36 }).primaryKey(),
  engineEvalCp: int("engine_eval_cp").notNull(),
  engineBestMove: varchar("engine_best_move", { length: 6 }).notNull(),
  engineDepth: int("engine_depth").notNull(),
  engineSource: mysqlEnum("engine_source", ENGINE_SOURCES).notNull(),
  cpLoss: int("cp_loss").notNull(),
  revealedAt: timestamp("revealed_at").defaultNow().notNull(),
});
export type DecisionReveal = typeof decisionReveals.$inferSelect;
export type InsertDecisionReveal = typeof decisionReveals.$inferInsert;

/**
 * Atom `feedback` -- what the player revised after seeing the result.
 * Separate again: a revision is a third event, not a column on either of the first two.
 */
export const decisionFeedback = mysqlTable("decision_feedback", {
  decisionId: varchar("decision_id", { length: 36 }).primaryKey(),
  revisedRead: varchar("revised_read", { length: 200 }).notNull(),
  wouldChooseAgain: boolean("would_choose_again").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
export type DecisionFeedback = typeof decisionFeedback.$inferSelect;

/**
 * LAYER B -- CLAIMS.
 *
 * Claims are STORED, not recomputed on demand. A claim that is re-derived on every query is a
 * fresh hypothesis every time, so a prospective drill result would have nowhere to attach and no
 * claim could ever reach 'replicated'. The claim_id is derived from the bucketing key, so the
 * same pattern maps to the same row across sessions.
 *
 * A refuted claim is never deleted. Deleting it lets the same wrong pattern be rediscovered.
 */
export const claims = mysqlTable("claims", {
  claimId: varchar("claim_id", { length: 64 }).primaryKey(),
  statement: text("statement").notNull(),
  scope: varchar("scope", { length: 200 }).notNull(),
  supportingDecisionIds: json("supporting_decision_ids").$type<string[]>().notNull(),
  n: int("n").notNull(),
  grade: mysqlEnum("grade", CLAIM_GRADES).notNull(),
  refutationCondition: text("refutation_condition").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastEvaluatedAt: timestamp("last_evaluated_at").defaultNow().onUpdateNow().notNull(),
});
export type ClaimRow = typeof claims.$inferSelect;

/**
 * STARTED DRILLS.
 *
 * Written BEFORE the drill runs, carrying the refutation condition copied from the claim and the
 * prediction fixed in advance (R5). A drill row that exists is a drill that could have failed;
 * there is no way to record one whose condition was decided afterwards.
 */
export const drills = mysqlTable("drills", {
  drillId: varchar("drill_id", { length: 64 }).primaryKey(),
  claimId: varchar("claim_id", { length: 64 }).notNull(),
  fens: json("fens").$type<string[]>().notNull(),
  refutationCondition: text("refutation_condition").notNull(),
  predicted: boolean("predicted").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
});
export type DrillRow = typeof drills.$inferSelect;

/**
 * Prospective drill results. Separate table for the same reason the reveal is separate from the
 * decision: a forward test is a distinct event, and folding it into the claim row would make
 * "the claim was formed" and "the claim survived a test" the same fact.
 */
export const drillResults = mysqlTable("drill_results", {
  drillId: varchar("drill_id", { length: 64 }).primaryKey(),
  claimId: varchar("claim_id", { length: 64 }).notNull(),
  decisionIds: json("decision_ids").$type<string[]>().notNull(),
  refutationCondition: text("refutation_condition").notNull(),
  predicted: boolean("predicted").notNull(),
  observed: boolean("observed").notNull(),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
export type DrillResultRow = typeof drillResults.$inferSelect;

/**
 * A rule is language authored by the player after a reveal. The descriptive fields are
 * immutable; only its prospective-test grade and retrieval schedule may change.
 */
export const learningRules = mysqlTable("learning_rules", {
  ruleId: varchar("rule_id", { length: 64 }).primaryKey(),
  sourceDecisionId: varchar("source_decision_id", { length: 36 }).notNull(),
  trigger: varchar("trigger", { length: 200 }).notNull(),
  mechanismClass: mysqlEnum("mechanism_class", MECHANISM_CLASSES).notNull(),
  missedSignal: varchar("missed_signal", { length: 200 }).notNull(),
  actionRule: varchar("action_rule", { length: 300 }).notNull(),
  exceptionRule: varchar("exception_rule", { length: 200 }),
  predictedOutcome: varchar("predicted_outcome", { length: 300 }).notNull(),
  refutationCondition: text("refutation_condition").notNull(),
  authoredBy: mysqlEnum("authored_by", ["player"]).notNull(),
  grade: mysqlEnum("grade", LEARNING_RULE_GRADES).notNull(),
  retrievalStep: int("retrieval_step").notNull(),
  nextDueAt: timestamp("next_due_at"),
  createdAt: timestamp("created_at").notNull(),
  lastEvaluatedAt: timestamp("last_evaluated_at").notNull(),
});
export type LearningRuleRow = typeof learningRules.$inferSelect;

/** Pre-registered transfer test, written before any of its positions are shown. */
export const learningTransfers = mysqlTable("learning_transfers", {
  transferId: varchar("transfer_id", { length: 64 }).primaryKey(),
  ruleId: varchar("rule_id", { length: 64 }).notNull(),
  fens: json("fens").$type<string[]>().notNull(),
  ruleSnapshot: json("rule_snapshot")
    .$type<{
      trigger: string;
      mechanism_class: (typeof MECHANISM_CLASSES)[number];
      action_rule: string;
      predicted_outcome: string;
    }>()
    .notNull(),
  refutationCondition: text("refutation_condition").notNull(),
  minimumSuccesses: int("minimum_successes").notNull(),
  retrievalStep: int("retrieval_step").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  startedAt: timestamp("started_at").notNull(),
});
export type LearningTransferRow = typeof learningTransfers.$inferSelect;

/** Observed transfer result. Append-only and separate from both rule and preregistration. */
export const learningTransferResults = mysqlTable("learning_transfer_results", {
  transferId: varchar("transfer_id", { length: 64 }).primaryKey(),
  ruleId: varchar("rule_id", { length: 64 }).notNull(),
  decisionIds: json("decision_ids").$type<string[]>().notNull(),
  recalledRules: json("recalled_rules").$type<string[]>().notNull(),
  appliedRule: json("applied_rule").$type<boolean[]>().notNull(),
  successes: int("successes").notNull(),
  observed: boolean("observed").notNull(),
  completedAt: timestamp("completed_at").notNull(),
});
export type LearningTransferResultRow = typeof learningTransferResults.$inferSelect;

/**
 * A scan's reading, kept so that closing the import overlay stops discarding it.
 *
 * The buckets go in one `json` column rather than a row per bucket. Nothing queries into them --
 * a reading is always read whole, for one display -- and a bucket table would invite exactly the
 * query this product must never run: comparing one player's bucket against another's.
 *
 * The three scalar columns beside it are provenance, not decoration. A rate with no scan date is
 * a claim about a person; the same rate with "20 games, read 24 August" is a measurement. See
 * shared/import-diagnostic.ts.
 */
export const importReadings = mysqlTable("import_readings", {
  readingId: varchar("reading_id", { length: 64 }).primaryKey(),
  username: varchar("username", { length: 60 }).notNull(),
  games: int("games").notNull(),
  diagnostic: json("diagnostic").$type<ImportDiagnostic>().notNull(),
  scannedAt: timestamp("scanned_at").notNull(),
});

/**
 * A bucket the imported games named BEFORE the live loop recorded anything (shared/prereg.ts).
 *
 * Append-only like every other table here, and one row is active at a time: the newest by
 * `registeredAt`. Re-importing writes a new row rather than editing the old one, so the record
 * keeps what was believed and when, which is the only way a pre-registration can be audited
 * afterwards instead of taken on trust.
 */
export const preregisteredHypotheses = mysqlTable("preregistered_hypotheses", {
  hypothesisId: varchar("hypothesis_id", { length: 64 }).primaryKey(),
  bucketKey: varchar("bucket_key", { length: 40 }).notNull(),
  scope: varchar("scope", { length: 200 }).notNull(),
  /** Decisions already in the record. Only decisions after this index are ever tested. */
  decisionsBefore: int("decisions_before").notNull(),
  evidenceAccurateRate: int("evidence_accurate_rate_permille").notNull(),
  evidenceN: int("evidence_n").notNull(),
  evidenceRunnerUpKey: varchar("evidence_runner_up_key", { length: 40 }).notNull(),
  evidenceSeparation: int("evidence_separation_permille").notNull(),
  evidenceThreshold: int("evidence_threshold_permille").notNull(),
  evidenceGames: int("evidence_games").notNull(),
  refutationCondition: text("refutation_condition").notNull(),
  registeredAt: timestamp("registered_at").notNull(),
});
