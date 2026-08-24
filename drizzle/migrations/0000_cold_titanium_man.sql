CREATE TABLE `claims` (
	`claim_id` varchar(64) NOT NULL,
	`statement` text NOT NULL,
	`scope` varchar(200) NOT NULL,
	`supporting_decision_ids` json NOT NULL,
	`n` int NOT NULL,
	`grade` enum('hypothesis','replicated','refuted') NOT NULL,
	`refutation_condition` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_evaluated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `claims_claim_id` PRIMARY KEY(`claim_id`)
);
--> statement-breakpoint
CREATE TABLE `decision_feedback` (
	`decision_id` varchar(36) NOT NULL,
	`revised_read` varchar(200) NOT NULL,
	`would_choose_again` boolean NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_feedback_decision_id` PRIMARY KEY(`decision_id`)
);
--> statement-breakpoint
CREATE TABLE `decision_reveals` (
	`decision_id` varchar(36) NOT NULL,
	`engine_eval_cp` int NOT NULL,
	`engine_best_move` varchar(6) NOT NULL,
	`engine_depth` int NOT NULL,
	`engine_source` enum('local_sf18','lichess_cloud') NOT NULL,
	`cp_loss` int NOT NULL,
	`revealed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_reveals_decision_id` PRIMARY KEY(`decision_id`)
);
--> statement-breakpoint
CREATE TABLE `decisions` (
	`decision_id` varchar(36) NOT NULL,
	`game_id` varchar(64) NOT NULL,
	`fen` varchar(200) NOT NULL,
	`ply` int NOT NULL,
	`phase` enum('opening','middlegame','endgame') NOT NULL,
	`clock_ms_remaining` int,
	`seconds_taken` int NOT NULL,
	`chosen_move` varchar(6) NOT NULL,
	`candidate_moves_considered` json NOT NULL,
	`stated_read` varchar(200) NOT NULL,
	`stated_unknown` varchar(200) NOT NULL,
	`confidence` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decisions_decision_id` PRIMARY KEY(`decision_id`)
);
--> statement-breakpoint
CREATE TABLE `drill_results` (
	`drill_id` varchar(64) NOT NULL,
	`claim_id` varchar(64) NOT NULL,
	`decision_ids` json NOT NULL,
	`refutation_condition` text NOT NULL,
	`predicted` boolean NOT NULL,
	`observed` boolean NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drill_results_drill_id` PRIMARY KEY(`drill_id`)
);
--> statement-breakpoint
CREATE TABLE `drills` (
	`drill_id` varchar(64) NOT NULL,
	`claim_id` varchar(64) NOT NULL,
	`fens` json NOT NULL,
	`refutation_condition` text NOT NULL,
	`predicted` boolean NOT NULL,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `drills_drill_id` PRIMARY KEY(`drill_id`)
);
--> statement-breakpoint
CREATE TABLE `learning_rules` (
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
	`next_due_at` timestamp,
	`created_at` timestamp NOT NULL,
	`last_evaluated_at` timestamp NOT NULL,
	CONSTRAINT `learning_rules_rule_id` PRIMARY KEY(`rule_id`)
);
--> statement-breakpoint
CREATE TABLE `learning_transfer_results` (
	`transfer_id` varchar(64) NOT NULL,
	`rule_id` varchar(64) NOT NULL,
	`decision_ids` json NOT NULL,
	`recalled_rules` json NOT NULL,
	`applied_rule` json NOT NULL,
	`successes` int NOT NULL,
	`observed` boolean NOT NULL,
	`completed_at` timestamp NOT NULL,
	CONSTRAINT `learning_transfer_results_transfer_id` PRIMARY KEY(`transfer_id`)
);
--> statement-breakpoint
CREATE TABLE `learning_transfers` (
	`transfer_id` varchar(64) NOT NULL,
	`rule_id` varchar(64) NOT NULL,
	`fens` json NOT NULL,
	`rule_snapshot` json NOT NULL,
	`refutation_condition` text NOT NULL,
	`minimum_successes` int NOT NULL,
	`retrieval_step` int NOT NULL,
	`scheduled_for` timestamp NOT NULL,
	`started_at` timestamp NOT NULL,
	CONSTRAINT `learning_transfers_transfer_id` PRIMARY KEY(`transfer_id`)
);
--> statement-breakpoint
CREATE TABLE `preregistered_hypotheses` (
	`hypothesis_id` varchar(64) NOT NULL,
	`bucket_key` varchar(40) NOT NULL,
	`scope` varchar(200) NOT NULL,
	`decisions_before` int NOT NULL,
	`evidence_accurate_rate_permille` int NOT NULL,
	`evidence_n` int NOT NULL,
	`evidence_runner_up_key` varchar(40) NOT NULL,
	`evidence_separation_permille` int NOT NULL,
	`evidence_threshold_permille` int NOT NULL,
	`evidence_games` int NOT NULL,
	`refutation_condition` text NOT NULL,
	`registered_at` timestamp NOT NULL,
	CONSTRAINT `preregistered_hypotheses_hypothesis_id` PRIMARY KEY(`hypothesis_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE INDEX `decisions_game_idx` ON `decisions` (`game_id`);