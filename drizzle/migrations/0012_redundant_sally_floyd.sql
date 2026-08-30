CREATE TABLE `blitz_decisions` (
	`game_id` varchar(64) NOT NULL,
	`ply` int NOT NULL,
	`side` enum('w','b') NOT NULL,
	`san` varchar(16) NOT NULL,
	`fen_before` varchar(120) NOT NULL,
	`think_ms` int NOT NULL,
	`clock_before_ms` int NOT NULL,
	`opponent_clock_before_ms` int NOT NULL,
	`was_asked` boolean NOT NULL,
	`sampling_probability` double NOT NULL,
	`confidence` int,
	`instrumentation_latency_ms` int,
	`cp_loss` int,
	`standing_cp` int,
	CONSTRAINT `blitz_decisions_game_id_ply_pk` PRIMARY KEY(`game_id`,`ply`)
);
--> statement-breakpoint
CREATE TABLE `blitz_games` (
	`game_id` varchar(64) NOT NULL,
	`played_as` enum('w','b') NOT NULL,
	`initial_ms` int NOT NULL,
	`increment_ms` int NOT NULL,
	`outcome` json NOT NULL,
	`started_at` timestamp NOT NULL,
	`finished_at` timestamp NOT NULL,
	`measurement_protocol` enum('historical-passive','instrumented-standard','instrumented-blitz') NOT NULL,
	`protocol_version` int NOT NULL,
	`analysis_timing` enum('during-play','after-play') NOT NULL,
	`sampling_policy_version` int NOT NULL,
	`ask_rate` double NOT NULL,
	CONSTRAINT `blitz_games_game_id` PRIMARY KEY(`game_id`)
);
