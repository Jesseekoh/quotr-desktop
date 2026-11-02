CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`enduser_pct` integer,
	`discount_pct` integer,
	`resale_pct` integer,
	`special_pct` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `category_parent_id_idx` ON `category` (`parent_id`);--> statement-breakpoint
ALTER TABLE `brand_settings` ADD `price_rounding_step` integer DEFAULT 1000 NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `manual_prices` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `product` ADD `supplier` text;--> statement-breakpoint
ALTER TABLE `product` ADD `price_updated_at` integer;--> statement-breakpoint
-- Seed categories. The first nine are the old enum values, so existing products and quote items keep pointing at a valid row. Subcategories leave their markups NULL to inherit the parent's.
INSERT INTO `category` (`id`, `name`, `parent_id`, `enduser_pct`, `discount_pct`, `resale_pct`, `special_pct`, `sort_order`) VALUES
	('SOLAR_PANEL', 'Solar Panel', NULL, 3000, 2500, 2000, 1500, 10),
	('INVERTER', 'Inverter', NULL, 3000, 2500, 2000, 1500, 20),
	('HYBRID_INVERTER', 'Hybrid Inverter', 'INVERTER', NULL, NULL, NULL, NULL, 21),
	('STANDALONE_INVERTER', 'Standalone Inverter', 'INVERTER', NULL, NULL, NULL, NULL, 22),
	('STRING_INVERTER', 'String Inverter', 'INVERTER', NULL, NULL, NULL, NULL, 23),
	('ALL_IN_ONE_INVERTER', 'All-in-One Inverter', 'INVERTER', NULL, NULL, NULL, NULL, 24),
	('UPS', 'UPS', NULL, 3000, 2500, 2000, 1500, 30),
	('AVR_ATS', 'AVR & ATS', NULL, 3000, 2500, 2000, 1500, 40),
	('WATER_PUMP', 'Water Pump', NULL, 3000, 2500, 2000, 1500, 50),
	('CHARGE_CONTROLLER', 'Charge Controller', NULL, 3000, 2500, 2000, 1500, 60),
	('BATTERY', 'Battery', NULL, 3000, 2500, 2000, 1500, 70),
	('LITHIUM_BATTERY', 'Lithium Battery', 'BATTERY', NULL, NULL, NULL, NULL, 71),
	('LEAD_ACID_BATTERY', 'Lead Acid Battery', 'BATTERY', NULL, NULL, NULL, NULL, 72),
	('FLOODED_BATTERY', 'Flooded Battery', 'BATTERY', NULL, NULL, NULL, NULL, 73),
	('MONITORING', 'Monitoring', NULL, 3000, 2500, 2000, 1500, 80),
	('RACK_MOUNTING', 'Rack / Mounting', NULL, 3500, 3000, 2500, 2000, 90),
	('CABLE', 'Cable', NULL, 3500, 3000, 2500, 2000, 100),
	('CABINET', 'Cabinet', NULL, 3500, 3000, 2500, 2000, 110),
	('ACCESSORY', 'Accessory', NULL, 4000, 3500, 3000, 2000, 120),
	('SERVICE', 'Service', NULL, 3000, 2500, 2000, 1500, 130),
	('OTHER', 'Other', NULL, 3000, 2500, 2000, 1500, 140);
--> statement-breakpoint
-- Carry over markups the user already saved.
UPDATE `category` SET
	`enduser_pct` = (SELECT m.`enduser_pct` FROM `category_markup` m WHERE m.`category` = `category`.`id`),
	`discount_pct` = (SELECT m.`discount_pct` FROM `category_markup` m WHERE m.`category` = `category`.`id`),
	`resale_pct` = (SELECT m.`resale_pct` FROM `category_markup` m WHERE m.`category` = `category`.`id`),
	`special_pct` = (SELECT m.`special_pct` FROM `category_markup` m WHERE m.`category` = `category`.`id`)
WHERE `id` IN (SELECT `category` FROM `category_markup`);
