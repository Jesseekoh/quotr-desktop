import {
	check,
	index,
	integer,
	sqliteTable,
	text,
	type AnySQLiteColumn
} from 'drizzle-orm/sqlite-core';
import { sql, relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
export const priceLabels = [
	'DISCOUNT_PRICE',
	'RESALE_PRICE',
	'SPECIAL_PRICE',
	'ENDUSER_PRICE'
] as const;
export type PriceLabel = (typeof priceLabels)[number];

export const quoteStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const invoiceStatuses = ['UNPAID', 'PAID', 'VOID'] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

/** A `category.id`. Categories live in their own table so new ones need no migration. */
export type ProductCategory = string;

const timestamps = {
	createdAt: integer('created_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
		.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull()
};

export const product = sqliteTable(
	'product',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		// name: text('name').notNull(),

		brand: text('brand').notNull(),

		// References category.id (checked in the API, not by a foreign key).
		category: text('category').notNull(),

		specification: text('specification').notNull(),

		warranty: text('warranty').notNull().default('N/A'),

		technicalSpecs: text('technical_specs', {
			mode: 'json'
		}),

		unit: text('unit').default('pcs'),

		// Money is stored as whole naira, e.g. ₦150,000 -> 150000.
		costPrice: integer('cost_price').notNull(),

		discountPrice: integer('discount_price').notNull(),

		resalePrice: integer('resale_price').notNull(),

		specialPrice: integer('special_price').notNull(),

		enduserPrice: integer('enduser_price').notNull(),

		// Hand-set sell prices: markup and rounding changes leave them alone.
		manualPrices: integer('manual_prices', { mode: 'boolean' }).notNull().default(false),

		supplier: text('supplier'),

		// When the cost price was last confirmed (the price list's "Last Updated").
		priceUpdatedAt: integer('price_updated_at', { mode: 'timestamp_ms' }),

		isActive: integer('is_active', {
			mode: 'boolean'
		})
			.notNull()
			.default(true),

		...timestamps
	},
	(table) => [
		index('product_category_idx').on(table.category),
		index('product_brand_idx').on(table.brand)
	]
);

// ─────────────────────────────────────────────
// Category
//
// Product categories, one level of subcategories deep. Each top-level
// category holds the markup (in basis points, where 3000 = 30%) applied to a
// product's cost price to derive each sell price. A subcategory either has its
// own markups or leaves them NULL to inherit its parent's. Changing a markup
// recalculates the sell prices of every product that uses it:
// price = cost * (1 + markup / 10000), rounded to the price rounding step.
// ─────────────────────────────────────────────

export const category = sqliteTable(
	'category',
	{
		// Stable slug, e.g. 'HYBRID_INVERTER'. Products and quote items store it.
		id: text('id').primaryKey(),

		name: text('name').notNull(),

		parentId: text('parent_id').references((): AnySQLiteColumn => category.id),

		enduserPct: integer('enduser_pct'),

		discountPct: integer('discount_pct'),

		resalePct: integer('resale_pct'),

		specialPct: integer('special_pct'),

		sortOrder: integer('sort_order').notNull().default(0),

		...timestamps
	},
	(table) => [index('category_parent_id_idx').on(table.parentId)]
);

// ─────────────────────────────────────────────
// Customer
// ─────────────────────────────────────────────

export const customer = sqliteTable('customer', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),

	name: text('name').notNull(),

	phone: text('phone'),

	email: text('email'),

	address: text('address'),

	...timestamps
});

// ─────────────────────────────────────────────
// Quote
// ─────────────────────────────────────────────

export const quote = sqliteTable(
	'quote',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		quoteNumber: text('quote_number').notNull().unique(),

		customerId: text('customer_id')
			.notNull()
			.references(() => customer.id),

		label: text('label', {
			enum: priceLabels
		})
			.notNull()
			.default('ENDUSER_PRICE'),

		status: text('status', {
			enum: quoteStatuses
		})
			.notNull()
			.default('DRAFT'),

		// When the quote was sent to the customer / when they accepted it.
		// NULL while the quote is still a draft.
		sentAt: integer('sent_at', {
			mode: 'timestamp_ms'
		}),

		acceptedAt: integer('accepted_at', {
			mode: 'timestamp_ms'
		}),

		loadProfileTotal: integer('load_profile_total'),

		loadProfileNotes: text('load_profile_notes'),

		paymentTerms: text('payment_terms'),

		notes: text('notes'),

		// Whether the preview and PDF print each item's brand in its description.
		showBrand: integer('show_brand', { mode: 'boolean' }).notNull().default(true),

		...timestamps
	},
	(table) => [index('quote_customer_id_idx').on(table.customerId)]
);

// ─────────────────────────────────────────────
// Quote Section
// ─────────────────────────────────────────────

export const quoteSection = sqliteTable(
	'quote_section',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		quoteId: text('quote_id')
			.notNull()
			.references(() => quote.id, {
				onDelete: 'cascade'
			}),

		name: text('name').notNull(),

		sortOrder: integer('sort_order').notNull().default(0),

		...timestamps
	},
	(table) => [index('quote_section_quote_id_idx').on(table.quoteId)]
);

// ─────────────────────────────────────────────
// Quote Option
// ─────────────────────────────────────────────

export const quoteOption = sqliteTable(
	'quote_option',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		quoteId: text('quote_id')
			.notNull()
			.references(() => quote.id, {
				onDelete: 'cascade'
			}),

		name: text('name').notNull(),

		description: text('description'),

		isDefault: integer('is_default', {
			mode: 'boolean'
		})
			.notNull()
			.default(false),

		sortOrder: integer('sort_order').notNull().default(0),

		quoteSectionId: text('quote_section_id').references(() => quoteSection.id),

		...timestamps
	},
	(table) => [index('quote_option_quote_id_idx').on(table.quoteId)]
);

// ─────────────────────────────────────────────
// Quote Item
// ─────────────────────────────────────────────

export const quoteItem = sqliteTable(
	'quote_item',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		quoteId: text('quote_id')
			.notNull()
			.references(() => quote.id, {
				onDelete: 'cascade'
			}),

		quoteOptionId: text('quote_option_id').references(() => quoteOption.id, {
			onDelete: 'cascade'
		}),

		productId: text('product_id').references(() => product.id),

		description: text('description').notNull(),

		brand: text('brand'),

		specification: text('specification'),

		category: text('category'),

		quantity: integer('quantity').notNull().default(1),

		unit: text('unit').default('pcs'),

		unitPrice: integer('unit_price').notNull(),

		totalPrice: integer('total_price').notNull(),

		sortOrder: integer('sort_order').notNull().default(0),

		quoteSectionId: text('quote_section_id').references(() => quoteSection.id, {
			onDelete: 'set null'
		}),

		...timestamps
	},
	(table) => [
		index('quote_item_quote_id_idx').on(table.quoteId),
		index('quote_item_quote_option_id_idx').on(table.quoteOptionId)
	]
);
// ─────────────────────────────────────────────
// Quote Template
//
// A named snapshot of a quote's layout (sections, options, items) to start new
// quotes from. Lines are stored as JSON since a template is only ever read and
// written whole; catalog lines are re-priced when a quote is made from it.
// ─────────────────────────────────────────────

export type TemplateItem = {
	productId: string | null;
	description: string;
	brand: string | null;
	specification: string | null;
	category: string | null;
	quantity: number;
	unit: string | null;
	unitPrice: number;
};

export type TemplateContent = {
	items: TemplateItem[];
	sections: {
		name: string;
		items: TemplateItem[];
		options: {
			name: string;
			description: string | null;
			isDefault: boolean;
			items: TemplateItem[];
		}[];
	}[];
};

export const quoteTemplate = sqliteTable('quote_template', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => createId()),

	name: text('name').notNull().unique(),

	label: text('label', { enum: priceLabels }).notNull().default('ENDUSER_PRICE'),

	showBrand: integer('show_brand', { mode: 'boolean' }).notNull().default(true),

	loadProfileTotal: integer('load_profile_total'),

	loadProfileNotes: text('load_profile_notes'),

	paymentTerms: text('payment_terms'),

	notes: text('notes'),

	content: text('content', { mode: 'json' }).$type<TemplateContent>().notNull(),

	...timestamps
});

// ─────────────────────────────────────────────
// Invoice
//
// Created from a quote once the customer picks one option per section. Lines
// are copied from the quote so later quote edits never change an issued invoice.
// ─────────────────────────────────────────────

export const invoice = sqliteTable(
	'invoice',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		invoiceNumber: text('invoice_number').notNull().unique(),

		// Kept as a link back to the source quote; the invoice stands alone if it's deleted.
		quoteId: text('quote_id').references(() => quote.id, {
			onDelete: 'set null'
		}),

		customerId: text('customer_id')
			.notNull()
			.references(() => customer.id),

		status: text('status', { enum: invoiceStatuses }).notNull().default('UNPAID'),

		// Sum of the copied line totals, in the same units as quote prices.
		total: integer('total').notNull(),

		dueDate: integer('due_date', { mode: 'timestamp_ms' }),

		paidAt: integer('paid_at', { mode: 'timestamp_ms' }),

		paymentTerms: text('payment_terms'),

		notes: text('notes'),

		...timestamps
	},
	(table) => [index('invoice_quote_id_idx').on(table.quoteId)]
);

export const invoiceItem = sqliteTable(
	'invoice_item',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => createId()),

		invoiceId: text('invoice_id')
			.notNull()
			.references(() => invoice.id, {
				onDelete: 'cascade'
			}),

		// Section and chosen option names at the time of invoicing, for grouping.
		sectionName: text('section_name'),

		optionName: text('option_name'),

		description: text('description').notNull(),

		brand: text('brand'),

		specification: text('specification'),

		quantity: integer('quantity').notNull(),

		unit: text('unit'),

		unitPrice: integer('unit_price').notNull(),

		totalPrice: integer('total_price').notNull(),

		sortOrder: integer('sort_order').notNull().default(0)
	},
	(table) => [index('invoice_item_invoice_id_idx').on(table.invoiceId)]
);

// ─────────────────────────────────────────────
// Brand settings
// ─────────────────────────────────────────────

// Single-row table: the check constraint pins the id to 1.
export const brandSettings = sqliteTable(
	'brand_settings',
	{
		id: integer('id').primaryKey().default(1),

		businessName: text('business_name'),

		// Logo as a PNG data URL, downscaled before saving so it stays small and
		// can be embedded straight into generated PDFs.
		logo: text('logo'),

		// Contact details printed under the brand on quote and invoice PDFs.
		email: text('email'),

		phone: text('phone'),

		address: text('address'),

		// Sell prices derived from markups are rounded to the nearest multiple of
		// this many naira (the price list uses MROUND(..., 1000)).
		priceRoundingStep: integer('price_rounding_step').notNull().default(1000),

		// Set when the first-run setup finishes; the app shell redirects to
		// onboarding until then.
		onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),

		...timestamps
	},
	(table) => [check('brand_settings_singleton', sql`${table.id} = 1`)]
);

// ─────────────────────────────────────────────
// Invoice relations
// ─────────────────────────────────────────────

export const invoiceRelations = relations(invoice, ({ one, many }) => ({
	quote: one(quote, {
		fields: [invoice.quoteId],
		references: [quote.id]
	}),

	customer: one(customer, {
		fields: [invoice.customerId],
		references: [customer.id]
	}),

	items: many(invoiceItem)
}));

export const invoiceItemRelations = relations(invoiceItem, ({ one }) => ({
	invoice: one(invoice, {
		fields: [invoiceItem.invoiceId],
		references: [invoice.id]
	})
}));

// ─────────────────────────────────────────────
// Product relations
// ─────────────────────────────────────────────

export const productRelations = relations(product, ({ many }) => ({
	quoteItems: many(quoteItem)
}));

// ─────────────────────────────────────────────
// Customer relations
// ─────────────────────────────────────────────

export const customerRelations = relations(customer, ({ many }) => ({
	quotes: many(quote),
	invoices: many(invoice)
}));

// ─────────────────────────────────────────────
// Quote relations
// ─────────────────────────────────────────────

export const quoteRelations = relations(quote, ({ one, many }) => ({
	customer: one(customer, {
		fields: [quote.customerId],
		references: [customer.id]
	}),

	items: many(quoteItem),

	options: many(quoteOption),

	sections: many(quoteSection),

	invoices: many(invoice)
}));

// ─────────────────────────────────────────────
// Quote Section relations
// ─────────────────────────────────────────────

export const quoteSectionRelations = relations(quoteSection, ({ one, many }) => ({
	quote: one(quote, {
		fields: [quoteSection.quoteId],
		references: [quote.id]
	}),

	items: many(quoteItem),

	options: many(quoteOption)
}));

// ─────────────────────────────────────────────
// Quote Option relations
// ─────────────────────────────────────────────

export const quoteOptionRelations = relations(quoteOption, ({ one, many }) => ({
	quote: one(quote, {
		fields: [quoteOption.quoteId],
		references: [quote.id]
	}),

	quoteSection: one(quoteSection, {
		fields: [quoteOption.quoteSectionId],
		references: [quoteSection.id]
	}),

	items: many(quoteItem)
}));

// ─────────────────────────────────────────────
// Quote Item relations
// ─────────────────────────────────────────────

export const quoteItemRelations = relations(quoteItem, ({ one }) => ({
	quote: one(quote, {
		fields: [quoteItem.quoteId],
		references: [quote.id]
	}),

	quoteOption: one(quoteOption, {
		fields: [quoteItem.quoteOptionId],
		references: [quoteOption.id]
	}),

	product: one(product, {
		fields: [quoteItem.productId],
		references: [product.id]
	}),

	quoteSection: one(quoteSection, {
		fields: [quoteItem.quoteSectionId],
		references: [quoteSection.id]
	})
}));
