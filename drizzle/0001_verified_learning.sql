-- SUPERSEDED. This file is NOT applied by any pipeline.
--
-- CI applies `drizzle/migrations/*.sql` in order, and this file sits outside that directory, so it
-- has never been applied by the build. It was hand-written on 2026-08-22 (e910084, "feat: add
-- verified learning transfer loop") before the migration set was generated.
--
-- All three tables it creates -- `learning_rules`, `learning_transfers` and
-- `learning_transfer_results` -- are column-for-column IDENTICAL to their definitions in
-- `drizzle/migrations/0000_cold_titanium_man.sql`, which is what CI actually runs. It is not a
-- rival schema; it is a leftover that reads like one, which is worse, because a reader who finds it
-- has no way to tell.
--
-- The authority for the schema is `drizzle/migrations/`, and `verify-build.yml` says so in its own
-- words: "Schema from the generated SQL, not from a hand-written file that can drift from
-- schema.ts." Kept rather than deleted because a reader who finds it needs to be told what happened
-- to it, which is what this header is. Recorded as X-24 in
-- docs/consolidation-research/CONTRADICTIONS.md and Q25 in scripts/authority-scan.ts, whose
-- findUnscopedMigrations predicate reddens if any future .sql outside drizzle/migrations/ arrives
-- without a header like this one.

CREATE TABLE IF NOT EXISTS `learning_rules` (
  `rule_id` varchar(64) NOT NULL,
  `source_decision_id` varchar(36) NOT NULL,
  `trigger` varchar(200) NOT NULL,
  `mechanism_class` enum('threat_scan','candidate_generation','calculation','evaluation','time_allocation') NOT NULL,
  `missed_signal` varchar(200) NOT NULL,
  `action_rule` varchar(300) NOT NULL,
  `exception_rule` varchar(200),
  `predicted_outcome` varchar(300) NOT NULL,
  `refutation_condition` text NOT NULL,
  `authored_by` enum('player') NOT NULL,
  `grade` enum('hypothesis','replicated','refuted','retired') NOT NULL,
  `retrieval_step` int NOT NULL,
  `next_due_at` timestamp NULL,
  `created_at` timestamp NOT NULL,
  `last_evaluated_at` timestamp NOT NULL,
  PRIMARY KEY (`rule_id`)
);

CREATE TABLE IF NOT EXISTS `learning_transfers` (
  `transfer_id` varchar(64) NOT NULL,
  `rule_id` varchar(64) NOT NULL,
  `fens` json NOT NULL,
  `rule_snapshot` json NOT NULL,
  `refutation_condition` text NOT NULL,
  `minimum_successes` int NOT NULL,
  `retrieval_step` int NOT NULL,
  `scheduled_for` timestamp NOT NULL,
  `started_at` timestamp NOT NULL,
  PRIMARY KEY (`transfer_id`)
);

CREATE TABLE IF NOT EXISTS `learning_transfer_results` (
  `transfer_id` varchar(64) NOT NULL,
  `rule_id` varchar(64) NOT NULL,
  `decision_ids` json NOT NULL,
  `recalled_rules` json NOT NULL,
  `applied_rule` json NOT NULL,
  `successes` int NOT NULL,
  `observed` boolean NOT NULL,
  `completed_at` timestamp NOT NULL,
  PRIMARY KEY (`transfer_id`)
);
