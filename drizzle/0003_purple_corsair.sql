CREATE TABLE `vendor_commitments` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`vendor` text NOT NULL,
	`category` text NOT NULL,
	`agreed_paise` integer NOT NULL,
	`due_on` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `commitment_id` text REFERENCES vendor_commitments(id) ON DELETE SET NULL;
