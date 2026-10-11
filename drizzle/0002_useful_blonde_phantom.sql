CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`received_on` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
