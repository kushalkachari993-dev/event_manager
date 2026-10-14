CREATE TABLE `bakery_profiles` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`business_name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`instagram` text DEFAULT '' NOT NULL,
	`logo_data_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
