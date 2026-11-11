CREATE TABLE `switched_off` (
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`off_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	PRIMARY KEY(`kind`, `id`)
);
