CREATE TABLE `pilot_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`email` text NOT NULL,
	`stage` text NOT NULL,
	`ease_score` integer NOT NULL,
	`blocker` text NOT NULL,
	`worked_well` text DEFAULT '' NOT NULL,
	`delivered_orders` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
