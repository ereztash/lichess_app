CREATE TABLE `learning_transfer_observations` (
	`transfer_id` varchar(64) NOT NULL,
	`position` int NOT NULL,
	`decision_id` varchar(36) NOT NULL,
	`recalled_rule` varchar(300) NOT NULL,
	`applied_rule` boolean NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learning_transfer_observations_transfer_id_position_pk` PRIMARY KEY(`transfer_id`,`position`)
);
