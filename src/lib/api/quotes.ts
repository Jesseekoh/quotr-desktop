import { and, asc, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import type { PriceLabel, ProductCategory, QuoteStatus } from '#lib/db/schema.js';
import { generateQuoteNumber } from '#lib/utils/quotes.js';
import { AppError, type QuoteItem, type QuoteSection } from './types.js';

type Product = typeof table.product.$inferSelect;

export async function getQuotes() {
	return db.query.quote.findMany({
		with: { customer: true },
		orderBy: desc(table.quote.createdAt)
	});
}

export type QuoteDetail = Awaited<ReturnType<typeof getQuote>>;

export async function getQuote(id: string) {
	const quote = await db.query.quote.findFirst({
		where: eq(table.quote.id, id),
		with: {
			customer: true,
			items: { orderBy: [asc(table.quoteItem.sortOrder), asc(table.quoteItem.createdAt)] },
			sections: {
				orderBy: [asc(table.quoteSection.sortOrder), asc(table.quoteSection.createdAt)],
				with: {
					options: {
						orderBy: [asc(table.quoteOption.sortOrder), asc(table.quoteOption.createdAt)]
					}
				}
			}
		}
	});
	if (!quote) throw new AppError(404, `Quote ${id} not found`);
	return { ...quote, sections: groupSections(quote.items, quote.sections) };
}

/**
 * Hang each item off its section (shared items) or its option. Items carry both
 * ids, so a section's own items are the ones without an option.
 */
function groupSections(
	items: QuoteItem[],
	sections: (Omit<QuoteSection, 'items' | 'options'> & {
		options: Omit<QuoteSection['options'][number], 'items'>[];
	})[]
): QuoteSection[] {
	return sections.map((section) => ({
		id: section.id,
		quoteId: section.quoteId,
		name: section.name,
		sortOrder: section.sortOrder,
		items: items.filter(
			(item) => item.quoteSectionId === section.id && item.quoteOptionId === null
		),
		options: section.options.map((option) => ({
			...option,
			items: items.filter((item) => item.quoteOptionId === option.id)
		}))
	}));
}

export interface CreateQuotePayload {
	customerId: string;
	quoteNumber?: string;
	label: PriceLabel;
	loadProfileTotal?: number;
	loadProfileNotes?: string;
	paymentTerms?: string;
	notes?: string;
}

export async function createQuote(payload: CreateQuotePayload) {
	await findCustomerOrThrow(payload.customerId);
	const [quote] = await db
		.insert(table.quote)
		.values({ ...payload, quoteNumber: payload.quoteNumber ?? (await uniqueQuoteNumber()) })
		.returning();
	return quote;
}

export interface UpdateQuotePayload {
	id: string;
	customerId?: string;
	label?: PriceLabel;
	status?: QuoteStatus;
	loadProfileTotal?: number | null;
	loadProfileNotes?: string | null;
	paymentTerms?: string | null;
	notes?: string | null;
	showBrand?: boolean;
}

export async function updateQuote({ id, ...payload }: UpdateQuotePayload) {
	const existing = await findQuoteOrThrow(id);
	if (payload.customerId) await findCustomerOrThrow(payload.customerId);

	const updateData: Partial<typeof table.quote.$inferInsert> = { ...payload };
	// Stamp lifecycle timestamps on status transitions.
	if (payload.status && payload.status !== existing.status) {
		if (payload.status === 'SENT') updateData.sentAt = new Date();
		if (payload.status === 'ACCEPTED') updateData.acceptedAt = new Date();
	}
	await db.update(table.quote).set(updateData).where(eq(table.quote.id, id));

	if (payload.label && payload.label !== existing.label) {
		await recalculatePricesForLabel(id, payload.label);
	}
	return getQuote(id);
}

export async function removeQuote(id: string) {
	await db.delete(table.quote).where(eq(table.quote.id, id));
}

/** Deep-copy a quote (sections, options, items) as a new DRAFT with a fresh number. */
export async function duplicateQuote(id: string) {
	const quote = await findQuoteOrThrow(id);
	const [sections, options, items] = await Promise.all([
		db.select().from(table.quoteSection).where(eq(table.quoteSection.quoteId, id)),
		db.select().from(table.quoteOption).where(eq(table.quoteOption.quoteId, id)),
		db.select().from(table.quoteItem).where(eq(table.quoteItem.quoteId, id))
	]);

	const quoteNumber = await uniqueQuoteNumber();
	const newId = createId();
	const sectionIds = new Map(sections.map((s) => [s.id, createId()]));
	const optionIds = new Map(options.map((o) => [o.id, createId()]));

	await db.transaction(async (tx) => {
		await tx.insert(table.quote).values({
			id: newId,
			quoteNumber,
			customerId: quote.customerId,
			label: quote.label,
			status: 'DRAFT',
			loadProfileTotal: quote.loadProfileTotal,
			loadProfileNotes: quote.loadProfileNotes,
			paymentTerms: quote.paymentTerms,
			notes: quote.notes,
			showBrand: quote.showBrand
		});
		if (sections.length) {
			await tx.insert(table.quoteSection).values(
				sections.map((s) => ({
					id: sectionIds.get(s.id),
					quoteId: newId,
					name: s.name,
					sortOrder: s.sortOrder
				}))
			);
		}
		if (options.length) {
			await tx.insert(table.quoteOption).values(
				options.map((o) => ({
					id: optionIds.get(o.id),
					quoteId: newId,
					quoteSectionId: o.quoteSectionId ? (sectionIds.get(o.quoteSectionId) ?? null) : null,
					name: o.name,
					description: o.description,
					isDefault: o.isDefault,
					sortOrder: o.sortOrder
				}))
			);
		}
		if (items.length) {
			await tx.insert(table.quoteItem).values(
				items.map((i) => ({
					id: createId(),
					quoteId: newId,
					quoteOptionId: i.quoteOptionId ? (optionIds.get(i.quoteOptionId) ?? null) : null,
					quoteSectionId: i.quoteSectionId ? (sectionIds.get(i.quoteSectionId) ?? null) : null,
					productId: i.productId,
					description: i.description,
					brand: i.brand,
					specification: i.specification,
					category: i.category,
					quantity: i.quantity,
					unit: i.unit,
					unitPrice: i.unitPrice,
					totalPrice: i.totalPrice,
					sortOrder: i.sortOrder
				}))
			);
		}
	});

	return { id: newId, quoteNumber };
}

// ─────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────

export interface AddOptionPayload {
	quoteId: string;
	quoteSectionId: string;
	name: string;
	description?: string;
	isDefault?: boolean;
	sortOrder?: number;
}

export async function addOption(payload: AddOptionPayload) {
	await findSectionOrThrow(payload.quoteId, payload.quoteSectionId);
	await db.insert(table.quoteOption).values(payload);
	return getQuote(payload.quoteId);
}

export async function updateOption({
	quoteId,
	id,
	...data
}: {
	quoteId: string;
	id: string;
	name?: string;
	description?: string | null;
	isDefault?: boolean;
	sortOrder?: number;
}) {
	await findOptionOrThrow(quoteId, id);
	await db.update(table.quoteOption).set(data).where(eq(table.quoteOption.id, id));
	return getQuote(quoteId);
}

export async function removeOption({ quoteId, id }: { quoteId: string; id: string }) {
	await findOptionOrThrow(quoteId, id);
	await db.delete(table.quoteOption).where(eq(table.quoteOption.id, id));
	return getQuote(quoteId);
}

// ─────────────────────────────────────────────
// Items
// ─────────────────────────────────────────────

// Either pass `productId` (+ optional overrides) to pull from the catalog,
// or pass `description` + `unitPrice` for a freeform line item.
export interface ItemData {
	productId?: string | null;
	description?: string | null;
	brand?: string | null;
	specification?: string | null;
	category?: ProductCategory | null;
	quantity?: number | null;
	unit?: string | null;
	unitPrice?: number | null;
	sortOrder?: number | null;
}

export interface CreateItemPayload extends ItemData {
	quoteOptionId?: string | null;
	quoteSectionId?: string | null;
}

export async function addItem({
	quoteId,
	data,
	quoteOptionId = null,
	quoteSectionId = null
}: {
	quoteId: string;
	data: ItemData;
	quoteOptionId?: string | null;
	quoteSectionId?: string | null;
}) {
	const quote = await findQuoteOrThrow(quoteId);
	if (quoteOptionId) {
		const option = await findOptionOrThrow(quoteId, quoteOptionId);
		if (quoteSectionId !== option.quoteSectionId) {
			throw new AppError(400, 'Item option must belong to the selected section');
		}
	}
	if (quoteSectionId) await findSectionOrThrow(quoteId, quoteSectionId);
	const values = await buildItemData(quote.label, data);
	await db.insert(table.quoteItem).values({ quoteId, quoteOptionId, quoteSectionId, ...values });
	return getQuote(quoteId);
}

export async function updateItem({
	quoteId,
	id,
	data,
	quoteOptionId,
	quoteSectionId
}: {
	quoteId: string;
	id: string;
	data?: ItemData;
	quoteOptionId?: string | null;
	quoteSectionId?: string | null;
}) {
	const quote = await findQuoteOrThrow(quoteId);
	const item = await findItemOrThrow(quoteId, id);
	if (quoteOptionId) {
		const option = await findOptionOrThrow(quoteId, quoteOptionId);
		const sectionId = quoteSectionId ?? item.quoteSectionId;
		if (sectionId !== option.quoteSectionId) {
			throw new AppError(400, 'Item option must belong to the selected section');
		}
	}
	if (quoteSectionId) await findSectionOrThrow(quoteId, quoteSectionId);
	const values = await buildItemData(quote.label, { ...item, ...data });
	await db
		.update(table.quoteItem)
		.set({
			...values,
			quoteOptionId: quoteOptionId !== undefined ? quoteOptionId : item.quoteOptionId,
			quoteSectionId: quoteSectionId !== undefined ? quoteSectionId : item.quoteSectionId
		})
		.where(eq(table.quoteItem.id, id));
	return getQuote(quoteId);
}

export async function removeItem({ quoteId, id }: { quoteId: string; id: string }) {
	await findItemOrThrow(quoteId, id);
	await db.delete(table.quoteItem).where(eq(table.quoteItem.id, id));
	return getQuote(quoteId);
}

// ─────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────

export async function addSection({
	quoteId,
	...data
}: {
	quoteId: string;
	name: string;
	sortOrder?: number;
}) {
	await findQuoteOrThrow(quoteId);
	await db.insert(table.quoteSection).values({ quoteId, ...data });
	return getQuote(quoteId);
}

export async function updateSection({
	quoteId,
	id,
	...data
}: {
	quoteId: string;
	id: string;
	name?: string;
	sortOrder?: number;
}) {
	await findSectionOrThrow(quoteId, id);
	await db.update(table.quoteSection).set(data).where(eq(table.quoteSection.id, id));
	return getQuote(quoteId);
}

export async function removeSection({ quoteId, id }: { quoteId: string; id: string }) {
	await findSectionOrThrow(quoteId, id);
	await db.transaction(async (tx) => {
		const options = await tx
			.select({ id: table.quoteOption.id })
			.from(table.quoteOption)
			.where(eq(table.quoteOption.quoteSectionId, id));
		const optionIds = options.map((option) => option.id);

		await tx.delete(table.quoteItem).where(eq(table.quoteItem.quoteSectionId, id));
		if (optionIds.length > 0) {
			await tx.delete(table.quoteItem).where(inArray(table.quoteItem.quoteOptionId, optionIds));
			await tx.delete(table.quoteOption).where(inArray(table.quoteOption.id, optionIds));
		}
		await tx.delete(table.quoteSection).where(eq(table.quoteSection.id, id));
	});
	return getQuote(quoteId);
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** Quote numbers are timestamps, so two made in the same second need a suffix. */
export async function uniqueQuoteNumber() {
	const base = generateQuoteNumber();
	let quoteNumber = base;
	for (let attempt = 2; ; attempt++) {
		const clash = await db.query.quote.findFirst({
			where: eq(table.quote.quoteNumber, quoteNumber),
			columns: { id: true }
		});
		if (!clash) return quoteNumber;
		quoteNumber = `${base}-${attempt}`;
	}
}

export async function findCustomerOrThrow(id: string) {
	const customer = await db.query.customer.findFirst({ where: eq(table.customer.id, id) });
	if (!customer) throw new AppError(404, `Customer ${id} not found`);
	return customer;
}

async function findQuoteOrThrow(id: string) {
	const quote = await db.query.quote.findFirst({ where: eq(table.quote.id, id) });
	if (!quote) throw new AppError(404, `Quote ${id} not found`);
	return quote;
}

async function findOptionOrThrow(quoteId: string, id: string) {
	const option = await db.query.quoteOption.findFirst({
		where: and(eq(table.quoteOption.id, id), eq(table.quoteOption.quoteId, quoteId))
	});
	if (!option) throw new AppError(404, `Option ${id} not found on quote ${quoteId}`);
	return option;
}

async function findItemOrThrow(quoteId: string, id: string) {
	const item = await db.query.quoteItem.findFirst({
		where: and(eq(table.quoteItem.id, id), eq(table.quoteItem.quoteId, quoteId))
	});
	if (!item) throw new AppError(404, `Item ${id} not found on quote ${quoteId}`);
	return item;
}

async function findSectionOrThrow(quoteId: string, id: string) {
	const section = await db.query.quoteSection.findFirst({
		where: and(eq(table.quoteSection.id, id), eq(table.quoteSection.quoteId, quoteId))
	});
	if (!section) throw new AppError(404, `Section ${id} not found on quote ${quoteId}`);
	return section;
}

async function recalculatePricesForLabel(quoteId: string, label: PriceLabel) {
	const items = await db.query.quoteItem.findMany({
		where: and(eq(table.quoteItem.quoteId, quoteId), isNotNull(table.quoteItem.productId)),
		with: { product: true }
	});
	await db.transaction(async (tx) => {
		for (const item of items) {
			if (!item.product) continue;
			const unitPrice = getPriceForLabel(item.product, label);
			await tx
				.update(table.quoteItem)
				.set({ unitPrice, totalPrice: unitPrice * item.quantity })
				.where(eq(table.quoteItem.id, item.id));
		}
	});
}

async function buildItemData(label: PriceLabel, payload: ItemData) {
	const quantity = payload.quantity ?? 1;
	if (payload.productId) {
		const product = await db.query.product.findFirst({
			where: eq(table.product.id, payload.productId)
		});
		if (!product) throw new AppError(404, `Product ${payload.productId} not found`);
		const unitPrice = payload.unitPrice ?? getPriceForLabel(product, label);
		return {
			productId: product.id,
			description: payload.description ?? `${product.brand} ${product.specification}`,
			brand: payload.brand ?? product.brand,
			specification: payload.specification ?? product.specification,
			category: payload.category ?? product.category,
			quantity,
			unit: payload.unit ?? product.unit ?? 'pcs',
			unitPrice,
			totalPrice: unitPrice * quantity,
			sortOrder: payload.sortOrder ?? 0
		};
	}
	if (!payload.description) {
		throw new AppError(400, 'A description is required for items not from the catalog');
	}
	if (payload.unitPrice === undefined || payload.unitPrice === null) {
		throw new AppError(400, 'A unit price is required for items not from the catalog');
	}
	const unitPrice = payload.unitPrice;
	return {
		productId: null,
		description: payload.description,
		brand: payload.brand ?? null,
		specification: payload.specification ?? null,
		category: payload.category ?? null,
		quantity,
		unit: payload.unit ?? 'pcs',
		unitPrice,
		totalPrice: unitPrice * quantity,
		sortOrder: payload.sortOrder ?? 0
	};
}

export function getPriceForLabel(product: Product, label: PriceLabel) {
	return {
		DISCOUNT_PRICE: product.discountPrice,
		RESALE_PRICE: product.resalePrice,
		SPECIAL_PRICE: product.specialPrice,
		ENDUSER_PRICE: product.enduserPrice
	}[label];
}
