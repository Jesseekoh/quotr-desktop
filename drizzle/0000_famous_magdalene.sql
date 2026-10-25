CREATE TABLE `brand_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`business_name` text,
	`logo` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	CONSTRAINT "brand_settings_singleton" CHECK("brand_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `category_markup` (
	`category` text PRIMARY KEY NOT NULL,
	`enduser_pct` integer DEFAULT 3000 NOT NULL,
	`discount_pct` integer DEFAULT 2500 NOT NULL,
	`resale_pct` integer DEFAULT 2000 NOT NULL,
	`special_pct` integer DEFAULT 1500 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoice` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`quote_id` text,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'UNPAID' NOT NULL,
	`total` integer NOT NULL,
	`due_date` integer,
	`paid_at` integer,
	`payment_terms` text,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_invoice_number_unique` ON `invoice` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoice_quote_id_idx` ON `invoice` (`quote_id`);--> statement-breakpoint
CREATE TABLE `invoice_item` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`section_name` text,
	`option_name` text,
	`description` text NOT NULL,
	`brand` text,
	`specification` text,
	`quantity` integer NOT NULL,
	`unit` text,
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoice`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_item_invoice_id_idx` ON `invoice_item` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `product` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`specification` text NOT NULL,
	`warranty` text DEFAULT 'N/A' NOT NULL,
	`technical_specs` text,
	`unit` text DEFAULT 'pcs',
	`cost_price` integer NOT NULL,
	`discount_price` integer NOT NULL,
	`resale_price` integer NOT NULL,
	`special_price` integer NOT NULL,
	`enduser_price` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `product_category_idx` ON `product` (`category`);--> statement-breakpoint
CREATE INDEX `product_brand_idx` ON `product` (`brand`);--> statement-breakpoint
CREATE TABLE `quote` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`label` text DEFAULT 'ENDUSER_PRICE' NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`sent_at` integer,
	`accepted_at` integer,
	`load_profile_total` integer,
	`load_profile_notes` text,
	`payment_terms` text,
	`notes` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customer`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_quote_number_unique` ON `quote` (`quote_number`);--> statement-breakpoint
CREATE INDEX `quote_customer_id_idx` ON `quote` (`customer_id`);--> statement-breakpoint
CREATE TABLE `quote_item` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`quote_option_id` text,
	`product_id` text,
	`description` text NOT NULL,
	`brand` text,
	`specification` text,
	`category` text,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit` text DEFAULT 'pcs',
	`unit_price` integer NOT NULL,
	`total_price` integer NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`quote_section_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quote_option_id`) REFERENCES `quote_option`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`quote_section_id`) REFERENCES `quote_section`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `quote_item_quote_id_idx` ON `quote_item` (`quote_id`);--> statement-breakpoint
CREATE INDEX `quote_item_quote_option_id_idx` ON `quote_item` (`quote_option_id`);--> statement-breakpoint
CREATE TABLE `quote_option` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_default` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`quote_section_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quote_section_id`) REFERENCES `quote_section`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `quote_option_quote_id_idx` ON `quote_option` (`quote_id`);--> statement-breakpoint
CREATE TABLE `quote_section` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`quote_id`) REFERENCES `quote`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quote_section_quote_id_idx` ON `quote_section` (`quote_id`);