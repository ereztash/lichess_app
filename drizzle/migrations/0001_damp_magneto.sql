CREATE TABLE `import_readings` (
	`reading_id` varchar(64) NOT NULL,
	`username` varchar(60) NOT NULL,
	`games` int NOT NULL,
	`diagnostic` json NOT NULL,
	`scanned_at` timestamp NOT NULL,
	CONSTRAINT `import_readings_reading_id` PRIMARY KEY(`reading_id`)
);
