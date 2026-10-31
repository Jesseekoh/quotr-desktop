import { asc, eq, inArray, sql } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import type { PriceLabel, TemplateContent, TemplateItem } from '#lib/db/schema.js';
import { findCustomerOrThrow, getPriceForLabel, getQuote, uniqueQuoteNumber } from './quotes.js';
import { AppError, type QuoteItem } from './types.js';

export type QuoteTemplate = typeof table.quoteTemplate.$inferSelect;

export async function getTemplates() {
	return db.query.quoteTemplate.findMany({ orderBy: asc(table.quoteTemplate.name) });
}

export async function getTemplate(id: string) {
	const template = await db.query.quoteTemplate.findFirst({
		where: eq(table.quoteTemplate.id, id)
	});
	if (!template) throw new AppError(404, `Template ${id} not found`);
	return template;
}

/** Number of line items across the whole template. */
export function templateItemCount(content: TemplateContent) {
	return (
		content.items.length +
		content.sections.reduce(
			(sum, section) =>
				sum +
				section.items.length +
				section.options.reduce((optionSum, option) => optionSum + option.items.length, 0),
			0
		)
	);
}

/**
 * Snapshot a quote's layout under `name`. Names are matched case-insensitively,
 * so saving under an existing name replaces that template.
 */
export async function saveQuoteAsTemplate({ quoteId, name }: { quoteId: string; name: string }) {
	const trimmed = name.trim();
	if (!trimmed) throw new AppError(400, 'Give the template a name');
	const quote = await getQuote(quoteId);

	const values = {
		name: trimmed,
		label: quote.label,
		showBrand: quote.showBrand,
		loadProfileTotal: quote.loadProfileTotal,
		loadProfileNotes: quote.loadProfileNotes,
		paymentTerms: quote.paymentTerms,
		notes: quote.notes,
		content: {
			items: quote.items.filter((item) => item.quoteSectionId === null).map(toTemplateItem),
			sections: quote.sections.map((section) => ({
				name: section.name,
				items: section.items.map(toTemplateItem),
				options: section.options.map((option) => ({
					name: option.name,
					description: option.description,
					isDefault: option.isDefault,
					items: option.items.map(toTemplateItem)
				}))
			}))
		}
	};

	const existing = await findTemplateByName(trimmed);
	if (existing) {
		const [template] = await db
			.update(table.quoteTemplate)
			.set(values)
			.where(eq(table.quoteTemplate.id, existing.id))
			.returning();
		return template;
	}
	const [template] = await db.insert(table.quoteTemplate).values(values).returning();
	return template;
}

export async function renameTemplate({ id, name }: { id: string; name: string }) {
	const trimmed = name.trim();
	if (!trimmed) throw new AppError(400, 'Give the template a name');
	await getTemplate(id);
	const clash = await findTemplateByName(trimmed);
	if (clash && clash.id !== id) {
		throw new AppError(409, `A template named "${clash.name}" already exists`);
	}
	await db.update(table.quoteTemplate).set({ name: trimmed }).where(eq(table.quoteTemplate.id, id));
	return getTemplate(id);
}

export async function removeTemplate(id: string) {
	await db.delete(table.quoteTemplate).where(eq(table.quoteTemplate.id, id));
}

export async function findTemplateByName(name: string) {
	return db.query.quoteTemplate.findFirst({
		where: eq(sql`lower(${table.quoteTemplate.name})`, name.trim().toLowerCase())
	});
}

export interface CreateQuoteFromTemplatePayload {
	templateId: string;
	customerId: string;
	label: PriceLabel;
	loadProfileTotal?: number;
	loadProfileNotes?: string;
	paymentTerms?: string;
}

/**
 * Start a new DRAFT quote with the template's sections, options and items.
 * Catalog items take today's price for `label`; items whose product has since
 * been deleted keep their saved price as freeform lines.
 */
export async function createQuoteFromTemplate({
	templateId,
	...payload
}: CreateQuoteFromTemplatePayload) {
	const template = await getTemplate(templateId);
	await findCustomerOrThrow(payload.customerId);
	const { content } = template;

	const allItems = [
		...content.items,
		...content.sections.flatMap((section) => [
			...section.items,
			...section.options.flatMap((option) => option.items)
		])
	];
	const productIds = [
		...new Set(allItems.map((item) => item.productId).filter((id): id is string => !!id))
	];
	const products = productIds.length
		? await db.query.product.findMany({ where: inArray(table.product.id, productIds) })
		: [];
	const productsById = new Map(products.map((product) => [product.id, product]));

	const quoteId = createId();
	const quoteNumber = await uniqueQuoteNumber();
	const itemRows: (typeof table.quoteItem.$inferInsert)[] = [];
	const sectionRows: (typeof table.quoteSection.$inferInsert)[] = [];
	const optionRows: (typeof table.quoteOption.$inferInsert)[] = [];

	function addItems(
		items: TemplateItem[],
		quoteSectionId: string | null,
		quoteOptionId: string | null
	) {
		items.forEach((item, sortOrder) => {
			const product = item.productId ? productsById.get(item.productId) : undefined;
			const unitPrice = product ? getPriceForLabel(product, payload.label) : item.unitPrice;
			itemRows.push({
				quoteId,
				quoteSectionId,
				quoteOptionId,
				productId: product?.id ?? null,
				description: item.description,
				brand: item.brand,
				specification: item.specification,
				category: item.category,
				quantity: item.quantity,
				unit: item.unit,
				unitPrice,
				totalPrice: unitPrice * item.quantity,
				sortOrder
			});
		});
	}

	addItems(content.items, null, null);
	content.sections.forEach((section, sectionOrder) => {
		const sectionId = createId();
		sectionRows.push({ id: sectionId, quoteId, name: section.name, sortOrder: sectionOrder });
		addItems(section.items, sectionId, null);
		section.options.forEach((option, optionOrder) => {
			const optionId = createId();
			optionRows.push({
				id: optionId,
				quoteId,
				quoteSectionId: sectionId,
				name: option.name,
				description: option.description,
				isDefault: option.isDefault,
				sortOrder: optionOrder
			});
			addItems(option.items, sectionId, optionId);
		});
	});

	await db.transaction(async (tx) => {
		await tx.insert(table.quote).values({
			id: quoteId,
			quoteNumber,
			customerId: payload.customerId,
			label: payload.label,
			showBrand: template.showBrand,
			loadProfileTotal: payload.loadProfileTotal ?? template.loadProfileTotal,
			loadProfileNotes: payload.loadProfileNotes ?? template.loadProfileNotes,
			paymentTerms: payload.paymentTerms ?? template.paymentTerms,
			notes: template.notes
		});
		if (sectionRows.length) await tx.insert(table.quoteSection).values(sectionRows);
		if (optionRows.length) await tx.insert(table.quoteOption).values(optionRows);
		if (itemRows.length) await tx.insert(table.quoteItem).values(itemRows);
	});

	return { id: quoteId, quoteNumber };
}

function toTemplateItem(item: QuoteItem): TemplateItem {
	return {
		productId: item.productId,
		description: item.description,
		brand: item.brand,
		specification: item.specification,
		category: item.category,
		quantity: item.quantity,
		unit: item.unit,
		unitPrice: item.unitPrice
	};
}
