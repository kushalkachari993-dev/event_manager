ALTER TABLE `events` ADD `order_description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `fulfillment` text DEFAULT 'delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `fulfillment_time` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `deposit_required_paise` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `target_margin_pct` integer DEFAULT 30 NOT NULL;