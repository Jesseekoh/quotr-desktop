CREATE TABLE `quote_template` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`label` text DEFAULT 'ENDUSER_PRICE' NOT NULL,
	`show_brand` integer DEFAULT true NOT NULL,
	`load_profile_total` integer,
	`load_profile_notes` text,
	`payment_terms` text,
	`notes` text,
	`content` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_template_name_unique` ON `quote_template` (`name`);