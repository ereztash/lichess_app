-- HAND-EDITED AFTER GENERATION, and the reason is the one column that cannot be added blind.
--
-- `drizzle-kit` wrote `ADD analysis_state enum(...) NOT NULL` with no default. On a table that
-- already holds rows MySQL fills those rows with the FIRST enum value -- `pending` -- which would
-- state that every game stored before today is waiting to be analysed. The opposite is true: they
-- were all analysed before they were stored, because that was the only order the code had.
--
-- Writing `complete` into them would be just as wrong. They were analysed, but nothing recorded
-- WHEN or BY WHAT, and `complete` promises both -- `storedBlitzRecordSchema` refuses a complete
-- game with a null `analysis`. So they get `legacy-unknown`, which is the only true statement
-- available: this build did not observe it. Same argument as `LEGACY_PROTOCOL` and
-- `LEGACY_VALIDATION`, and the same rule -- a legacy key is never backfilled to a real one.
--
-- Three steps rather than a DEFAULT, so that no future insert can acquire a value by forgetting to
-- name one. `analysisState` is `.notNull()` with no `.default()` in schema.ts, so TypeScript
-- requires it at every write site; a column default would quietly undo that.
ALTER TABLE `blitz_games` ADD `analysis_state` enum('pending','complete','refused','legacy-unknown');--> statement-breakpoint
UPDATE `blitz_games` SET `analysis_state` = 'legacy-unknown' WHERE `analysis_state` IS NULL;--> statement-breakpoint
ALTER TABLE `blitz_games` MODIFY `analysis_state` enum('pending','complete','refused','legacy-unknown') NOT NULL;--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `analysed_at` timestamp;--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `analysis_engine` varchar(64);--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `analysis_engine_build` varchar(64);--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `analysis_depth` int;--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `opponent_kind` varchar(32);--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `opponent_engine` varchar(64);--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `opponent_engine_build` varchar(64);--> statement-breakpoint
ALTER TABLE `blitz_games` ADD `opponent_depth` int;
