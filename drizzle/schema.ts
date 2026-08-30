import {
  boolean,
  double,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";
import { CLAIM_GRADES } from "../shared/claim.js";
import { VALIDATION_KEYS } from "../shared/claim-grade-protocol.js";
import type { BlitzOutcome, Side } from "../shared/blitz-game-core.js";
import { BLITZ_ANALYSIS_STATES } from "../shared/blitz-record.js";
import { ENGINE_SOURCES, PHASES, PROBE_ASSIGNMENTS } from "../shared/decision-atom.js";
import { DECISION_PURPOSES } from "../shared/confidence-asked.js";
import type { StatedParts } from "../shared/decision-atom.js";
import { REVEAL_TIMINGS } from "../shared/reveal-timing.js";
import {
  ANALYSIS_TIMINGS,
  MEASUREMENT_PROTOCOLS,
} from "../shared/measurement-protocol.js";
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
    /**
     * Why this position was in front of the player -- the handoff, the bank, a drill, a transfer
     * check, an ordinary move, or a game already played.
     *
     * WHAT IT MAKES ANSWERABLE, and none of it was answerable before. Whether a decision was
     * ALLOWED to arrive without the two read fields, which is the difference between a player
     * being spared a toll and a client dropping a column. Which loop a player abandoned, since
     * `play` and `import` are different decisions and a count that pools them cannot say. And a
     * clean vocabulary reading, by dropping the decisions that were never asked for words.
     *
     * NULLABLE, AND NULL IS NOT `play`. Rows written before this column existed were never
     * stamped, and that era holds bank positions, drills and transfer checks as well as ordinary
     * moves. Backfilling the commonest value would not be a tidy default -- it would file every
     * drill of that era as free play and quietly corrupt the comparison the drills exist for.
     *
     * NOT RE-DERIVABLE SERVER-SIDE, unlike the phase two lines up. Nothing on the wire proves why
     * a client put a position in front of someone, so this column holds a claim rather than a
     * measurement, exactly as `reveal_timing` does.
     */
    purpose: mysqlEnum("purpose", DECISION_PURPOSES),
    /**
     * The drill this decision belongs to, and the reason the column above can be checked.
     *
     * `purpose` is the one atom field the server cannot re-derive -- the phase comes back from the
     * FEN and the legal-move count from the position, precisely so a wrong label cannot bias what
     * the record is divided by, and "why was this position here" has no such re-derivation. This
     * is the binding that replaces the trust: `commitDecision` resolves it against a drill that was
     * stored BEFORE the decision was made (R5) and requires that drill to contain this position.
     *
     * NULLABLE, AND NULL IS NOT A DEFAULT. It is null on every purpose but `drill`, and on every
     * row written before this column existed. No foreign key: the drills live in `prospective_drills`
     * and this record is append-only, so a constraint that could refuse a write is a constraint that
     * could lose a decision. The check is at the boundary, where it can produce a sentence.
     */
    drillId: varchar("drill_id", { length: 64 }),
    secondsTaken: int("seconds_taken").notNull(),
    chosenMove: varchar("chosen_move", { length: 6 }).notNull(),
    candidateMovesConsidered: json("candidate_moves_considered").$type<string[]>().notNull(),
    statedRead: varchar("stated_read", { length: 200 }).notNull(),
    /** Atom `unknown`. See the deviation note in shared/decision-atom.ts. */
    statedUnknown: varchar("stated_unknown", { length: 200 }).notNull(),
    /**
     * How each read was said: the options tapped, and what was typed beside them.
     *
     * NULLABLE, AND NULL IS NOT AN EMPTY ANSWER. A row written before this existed has a
     * `stated_read` full of text and recorded no parts at all; `{tapped:[],typed:""}` there would
     * assert the player answered with silence. Every reading of these counts null out of the
     * denominator instead.
     *
     * JSON rather than two columns each, because the pair is one fact -- what was said and how --
     * and splitting it would let a row hold tapped labels with no record of whether anything was
     * typed beside them.
     */
    statedReadParts: json("stated_read_parts").$type<StatedParts>(),
    statedUnknownParts: json("stated_unknown_parts").$type<StatedParts>(),
    /**
     * NULLABLE, AND NULL IS NOT A MISSING ANSWER. It means the question was never put, because
     * nothing measures a confidence stated on that position -- see shared/confidence-asked.ts.
     * `scoreDecisions` leaves those rows out of the calibration record and counts them; nothing
     * anywhere defaults them, because a default would be a belief the machine stated for a player
     * and then measured them against.
     */
    confidence: int("confidence"),
    /**
     * How many levels the scale had when that confidence was stated.
     *
     * NULLABLE ON PURPOSE, and it is not a missing value. Rows written before the scale moved to
     * seven have no scale to record; NULL is the honest representation of "stated on the
     * five-level scale", which is what a row of that age means. Backfilling it with a 5 would
     * assert that someone recorded it, and nobody did.
     */
    confidenceScale: int("confidence_scale"),
    /**
     * Which arm of the counterfactual probe this decision was randomised into.
     *
     * NULLABLE, AND NULL IS NOT A CONTROL. A row written before the probe existed was never
     * randomised into anything. Backfilling it as `not-probed` would enrol thousands of decisions
     * retrospectively into a group they were never part of, and every comparison between arms
     * would then be a comparison between two eras of the product.
     *
     * ON `decisions` RATHER THAN IN THE ANSWER TABLE, which is the whole design. The arm is known
     * at commit and has to be recorded whether or not anything was asked -- a table of answers
     * holds only probed decisions, and a treatment group with no control group has no denominator.
     */
    probeAssignment: mysqlEnum("probe_assignment", PROBE_ASSIGNMENTS),
    /** Legal moves in the entry position: the covariate an analysis conditions on. */
    legalMoves: int("legal_moves"),
    /**
     * Which reveal timing was in force -- after every decision, or after the whole game.
     *
     * NULLABLE, AND NULL IS NOT `per-decision`. Rows written before the deferred game existed
     * were all made in the coached loop, and backfilling them would still be a lie: it would
     * assert that a condition was recorded when nobody recorded one, and the first comparison
     * between the two modes would show a coached arm that is enormous and perfectly measured.
     */
    revealTiming: mysqlEnum("reveal_timing", REVEAL_TIMINGS),
    /**
     * The conditions this decision was produced under -- whether a clock was running, whether an
     * engine was, whether anybody was asked anything.
     *
     * NULLABLE, AND NULL IS NOT `instrumented-standard`. Every row written before this column
     * existed WAS made in the untimed commitment loop, because that was the only loop -- so the
     * backfill would even be factually right, and it is still forbidden. It would assert that a
     * condition was RECORDED when nobody recorded one, and the first comparison between protocols
     * would show a standard arm that is enormous and perfectly measured. Same argument as
     * `revealTiming` above and `probeAssignment` above that; the third time this repository has
     * had to make it.
     */
    measurementProtocol: mysqlEnum("measurement_protocol", MEASUREMENT_PROTOCOLS),
    /**
     * Which version of that protocol. A protocol whose rules change is a different protocol for
     * analysis even when its name is the same: move the sampling rate, or the moment the question
     * appears, and the rows before and after are two populations.
     */
    protocolVersion: int("protocol_version"),
    /**
     * WHEN THE ENGINE RAN, which is not when the player was TOLD. `reveal_timing: "end-of-game"`
     * does not mean the engine was quiet -- today it runs in both reveal modes and only the telling
     * differs -- so this cannot be derived from the column above it.
     */
    analysisTiming: mysqlEnum("analysis_timing", ANALYSIS_TIMINGS),
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
  /**
   * WHICH BUILD OF THAT SOURCE. Nullable, and null is never backfilled to a build.
   *
   * `engine_source` names a family and the family is not the instrument: `docs/ACTION_PLAN.md` B1
   * measured 13.61% of decisions flipping verdict between two engines that would both have written
   * `local_sf18` here. A row from before this column existed could have come from either, so there
   * is no value that would be true to write into it -- see `shared/decision-atom.ts` on the field,
   * and `scoreDecisions` for what a reading does with the absence.
   */
  engineBuild: varchar("engine_build", { length: 64 }),
  cpLoss: int("cp_loss").notNull(),
  revealedAt: timestamp("revealed_at").defaultNow().notNull(),
});
export type DecisionReveal = typeof decisionReveals.$inferSelect;
export type InsertDecisionReveal = typeof decisionReveals.$inferInsert;

/**
 * The answer to "what would you have played instead" -- a FOURTH event, not a column.
 *
 * SEPARATE TABLE FOR THE SAME REASON AS THE REVEAL AND THE FEEDBACK. It happens at a different
 * moment from the commit, it may never happen at all, and the presence of the row is itself the
 * measurement: a row means the question was put and answered.
 *
 * `alternativeMove` NULL INSIDE AN EXISTING ROW IS A REAL ANSWER -- asked, and unable to name
 * one. That is a different fact from never having been asked, which is the absence of the row
 * entirely, and a design that stored only the move could never separate them again.
 */
export const decisionCounterfactuals = mysqlTable("decision_counterfactuals", {
  decisionId: varchar("decision_id", { length: 36 }).primaryKey(),
  alternativeMove: varchar("alternative_move", { length: 6 }),
  /** What the alternative cost, from the reveal's own search. Null until the engine has run. */
  alternativeCpLoss: int("alternative_cp_loss"),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
});
export type DecisionCounterfactual = typeof decisionCounterfactuals.$inferSelect;

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
  /*
   * WHICH PROTOCOL PRODUCED THE GRADE (ADR-003). A position drill and a timed holdout are not
   * interchangeable evidence, and `replicated` means a different thing under each, so the grade
   * alone cannot be read back honestly.
   *
   * NULLABLE ON PURPOSE, and null is NOT "position drill". Rows graded before this column existed
   * did not record a protocol; `getClaim` maps a graded row with no protocol to LEGACY_VALIDATION,
   * which still decides the claim. The tempting backfill is `position-drill` and it would even be
   * factually right -- a position drill was the only protocol there was -- and it is forbidden for
   * the reason `measurement_protocol` gives about its own: a fact nobody wrote down is not a fact
   * the record may claim.
   */
  gradedUnder: mysqlEnum("graded_under", VALIDATION_KEYS),
  refutationCondition: text("refutation_condition").notNull(),
  /*
   * WHICH SIDE THE REFUTATION CONDITION IS ON. See the field note on `Claim` in shared/claim.ts:
   * the verdict is a one-sided test and this is the side, so a claim that reaches `finishDrill`
   * without it cannot be graded honestly.
   *
   * NULLABLE ON PURPOSE, and it is not a third direction. Rows written before this column existed
   * genuinely do not record it, and there is no backfill that would not be a guess: re-deriving
   * the sign from today's decisions lets the evidence choose the test's direction, which is the
   * post-hoc choice R5 forbids. `createDrill` refuses such a claim instead. A DEFAULT here would
   * be worse than the null -- it would make every legacy row assert a direction nobody measured.
   */
  predictsOverconfidence: boolean("predicts_overconfidence"),
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
  /*
   * The direction copied from the claim when the drill started -- one term with the condition
   * above, which states it in words.
   *
   * NULLABLE FOR THE SAME REASON AS THE CLAIMS COLUMN, and for one more: a drill already open
   * when this shipped was registered without a recorded sign. Adding the column NOT NULL would
   * either refuse to migrate a table with rows in it or invent a direction for those drills.
   * `getDrill` refuses to hand back an ungradeable spec instead, which fails the one drill
   * rather than mis-grading it.
   */
  predictsOverconfidence: boolean("predicts_overconfidence"),
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
  /** The protocol this forward test ran under. Null on a row written before ADR-003, and read
   * back as LEGACY_VALIDATION rather than assumed to be a drill. */
  protocol: mysqlEnum("protocol", VALIDATION_KEYS),
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
/**
 * ONE ROW PER POSITION, WRITTEN WHEN THE OBSERVATION IS MADE.
 *
 * These used to live in React state for the whole run and reach the server only at completion.
 * Three separate defects came out of that single choice, all found by review:
 *
 *   - a reload lost them, and the resume path then re-served positions whose engine verdict the
 *     player had already been shown -- measuring recall of that answer, which is the exact failure
 *     `position-key.ts` exists to prevent;
 *   - a failed reveal write stranded the run with no control that could advance it;
 *   - and the client was the only holder of the observations, so completion had to trust whatever
 *     it sent.
 *
 * Writing each one as it is made is the same rule the decision layer already follows: an
 * observation is data, and data that was not stored must never look like data that was. The
 * composite primary key makes it append-only per position -- a second write for the same slot is
 * rejected by the database rather than by a check somebody has to remember.
 */
export const learningTransferObservations = mysqlTable(
  "learning_transfer_observations",
  {
    transferId: varchar("transfer_id", { length: 64 }).notNull(),
    /** Index into the preregistered `fens`, so a resume knows exactly where it stopped. */
    position: int("position").notNull(),
    decisionId: varchar("decision_id", { length: 36 }).notNull(),
    /** Written before the reveal. Empty recall is a FAILED RETRIEVAL and is stored as one. */
    recalledRule: varchar("recalled_rule", { length: 300 }).notNull(),
    /** Player report, also collected before the reveal. Recorded; never a success criterion. */
    appliedRule: boolean("applied_rule").notNull(),
    recordedAt: timestamp("recorded_at").defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.transferId, table.position] })],
);
export type LearningTransferObservationRow = typeof learningTransferObservations.$inferSelect;

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

/**
 * A blitz game somebody actually played, and every decision in it.
 *
 * SEPARATE FROM `decision_atoms` ON PURPOSE -- see `docs/blitz/ADR-004`. The atom requires two
 * stated reads that are not nullable, nobody writes prose during a three-minute game, and an empty
 * string for them would read afterwards as "asked, and answered with silence".
 *
 * The conditions ride on the GAME rather than being re-derived at read time, so a later reader can
 * tell which regime produced a row without knowing what the constants happened to be that week.
 */
export const blitzGames = mysqlTable("blitz_games", {
  gameId: varchar("game_id", { length: 64 }).primaryKey(),
  /** Which side the person played. The core runs both, so this cannot be inferred from the rows. */
  playedAs: mysqlEnum("played_as", ["w", "b"]).$type<Side>().notNull(),
  initialMs: int("initial_ms").notNull(),
  incrementMs: int("increment_ms").notNull(),
  outcome: json("outcome").$type<BlitzOutcome>().notNull(),
  startedAt: timestamp("started_at").notNull(),
  finishedAt: timestamp("finished_at").notNull(),
  measurementProtocol: mysqlEnum("measurement_protocol", MEASUREMENT_PROTOCOLS).notNull(),
  protocolVersion: int("protocol_version").notNull(),
  /** INV-4 as data: the engine ran after the game, or the game was not analysed. */
  analysisTiming: mysqlEnum("analysis_timing", ANALYSIS_TIMINGS).notNull(),
  samplingPolicyVersion: int("sampling_policy_version").notNull(),
  askRate: double("ask_rate").notNull(),
  /*
   * WHETHER THE ENGINE HAS SCORED THIS GAME, AS A STATE RATHER THAN AS AN ABSENCE.
   *
   * The game is now written BEFORE the analysis runs, so that a tab closed mid-analysis cannot
   * lose it. That makes a null `cp_loss` ambiguous for the first time: it used to mean only "the
   * evaluator could not answer for one of the two positions", and it would now ALSO mean "nothing
   * has asked it yet". Those are different facts about a decision and must not share an encoding.
   *
   * `legacy-unknown` IS A SEPARATE VALUE AND IS NEVER BACKFILLED TO `complete`. Rows written
   * before this column existed were in fact analysed before they were stored -- but nothing
   * recorded that, and writing `complete` into them would assert a fact this build did not
   * observe. It is the argument `measurement-protocol.ts` makes for its own legacy key, and
   * `claim-grade-protocol.ts` for `LEGACY_VALIDATION`.
   */
  analysisState: mysqlEnum("analysis_state", BLITZ_ANALYSIS_STATES).notNull(),
  /** When the engine finished. Null wherever the state is not `complete`. */
  analysedAt: timestamp("analysed_at"),
  /*
   * WHAT SCORED IT. Null wherever the state is not `complete`.
   *
   * `docs/ACTION_PLAN.md` B1 measured 13.61% of decisions flipping verdict between the engine that
   * produced this project's published numbers and the engine it ships. A record that cannot say
   * which engine scored it cannot be pooled across a version bump, and nothing else here records
   * one.
   */
  analysisEngine: varchar("analysis_engine", { length: 64 }),
  analysisEngineBuild: varchar("analysis_engine_build", { length: 64 }),
  analysisDepth: int("analysis_depth"),
  /*
   * WHO THE PLAYER WAS PLAYING. Null only on rows written before this was recorded.
   *
   * Without it every blitz claim is a claim about playing one colour against whatever the build
   * used that week, stated as a claim about the player. If the opponent's search policy changes
   * between builds the population changes, and nothing recorded that it did.
   */
  opponentKind: varchar("opponent_kind", { length: 32 }),
  opponentEngine: varchar("opponent_engine", { length: 64 }),
  opponentEngineBuild: varchar("opponent_engine_build", { length: 64 }),
  opponentDepth: int("opponent_depth"),
});
export type BlitzGameRow = typeof blitzGames.$inferSelect;

export const blitzDecisions = mysqlTable(
  "blitz_decisions",
  {
    gameId: varchar("game_id", { length: 64 }).notNull(),
    ply: int("ply").notNull(),
    side: mysqlEnum("side", ["w", "b"]).$type<Side>().notNull(),
    san: varchar("san", { length: 16 }).notNull(),
    fenBefore: varchar("fen_before", { length: 120 }).notNull(),
    /** Frozen at commit by the game core (INV-1). Nothing downstream may add to it. */
    thinkMs: int("think_ms").notNull(),
    clockBeforeMs: int("clock_before_ms").notNull(),
    opponentClockBeforeMs: int("opponent_clock_before_ms").notNull(),
    wasAsked: boolean("was_asked").notNull(),
    /** The probability in force when the sampler chose, so the regime is reconstructable. */
    samplingProbability: double("sampling_probability").notNull(),
    /*
     * THE FOUR NULLABLE COLUMNS, AND NOT ONE OF THEM MAY DEFAULT TO ZERO.
     *
     * A decision nobody questioned has no confidence and no latency; one answered instantly has a
     * small latency. Storing the first as the second makes the mean of either column a fiction and
     * hides exactly the population the sampler exists to describe. The engine's two columns are
     * null when the evaluator could not answer for one of the two positions -- which is a fact
     * about the search, not a cp-loss of zero.
     */
    confidence: int("confidence"),
    instrumentationLatencyMs: int("instrumentation_latency_ms"),
    cpLoss: int("cp_loss"),
    standingCp: int("standing_cp"),
  },
  (table) => [primaryKey({ columns: [table.gameId, table.ply] })],
);
export type BlitzDecisionRow = typeof blitzDecisions.$inferSelect;
