CREATE TABLE `decision_counterfactuals` (
	`decision_id` varchar(36) NOT NULL,
	`alternative_move` varchar(6),
	`alternative_cp_loss` int,
	`answered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_counterfactuals_decision_id` PRIMARY KEY(`decision_id`)
);
--> statement-breakpoint
ALTER TABLE `decisions` ADD `probe_assignment` enum('probed','not-probed','ineligible');--> statement-breakpoint
ALTER TABLE `decisions` ADD `legal_moves` int;