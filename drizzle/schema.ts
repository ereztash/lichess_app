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
