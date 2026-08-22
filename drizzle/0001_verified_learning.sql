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
