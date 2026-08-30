ALTER TABLE `decisions` ADD `measurement_protocol` enum('historical-passive','instrumented-standard','instrumented-blitz');--> statement-breakpoint
ALTER TABLE `decisions` ADD `protocol_version` int;--> statement-breakpoint
ALTER TABLE `decisions` ADD `analysis_timing` enum('during-play','after-play');