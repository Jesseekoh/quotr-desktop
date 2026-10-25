import { and, asc, eq, like, or, sql } from 'drizzle-orm';
import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import type { ProductCategory } from '#lib/db/schema.js';
import { DEFAULT_MARKUPS, priceFromMarkup, type MarkupPcts } from '#lib/utils/markups.js';
import { AppError } from './types.js';

export interface ProductFilters {
	category?: ProductCategory | string;
	brand?: string;
	search?: string;
}

export async function getProducts(filters: ProductFilters = {}) {
	const term = filters.search ? `%${filters.search}%` : undefined;
	return db
		.select()
		.from(table.product)
		.where(
			and(
				eq(table.product.isActive, true),
				filters.category
					? eq(table.product.category, filters.category as ProductCategory)
					: undefined,
				filters.brand ? like(table.product.brand, `%${filters.brand}%`) : undefined,
				term
					? or(like(table.product.brand, term), like(table.product.specification, term))
					: undefined
			)
		)
		.orderBy(asc(table.product.brand));
}

export async function countProducts() {
	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(table.product)
		.where(eq(table.product.isActive, true));
	return Number(count);
}

type ProductInput = Omit<
	typeof table.product.$inferInsert,
	'id' | 'createdAt' | 'updatedAt' | 'isActive'
>;

export async function createProduct(data: ProductInput) {
	await db.insert(table.product).values(data);
}

// ─────────────────────────────────────────────
// Category markups
// ─────────────────────────────────────────────

export type CategoryMarkupWithCount = Awaited<ReturnType<typeof getMarkups>>[number];

/** Markup rows for every category (defaults fill in unsaved ones) + product counts. */
export async function getMarkups() {
	const [rows, counts] = await Promise.all([
		db.select().from(table.categoryMarkup),
		db
			.select({ category: table.product.category, count: sql<number>`count(*)` })
			.from(table.product)
			.where(eq(table.product.isActive, true))
			.groupBy(table.product.category)
	]);

	const countByCategory = new Map(counts.map((c) => [c.category, Number(c.count)]));

	return table.productCategories.map((category) => {
		const row = rows.find((r) => r.category === category);
		return {
			category,
			enduserPct: row?.enduserPct ?? DEFAULT_MARKUPS[category].enduserPct,
			discountPct: row?.discountPct ?? DEFAULT_MARKUPS[category].discountPct,
			resalePct: row?.resalePct ?? DEFAULT_MARKUPS[category].resalePct,
			specialPct: row?.specialPct ?? DEFAULT_MARKUPS[category].specialPct,
			productCount: countByCategory.get(category) ?? 0
		};
	});
}

const MAX_MARKUP_BP = 20_000;

/**
 * Save a category's markups, then recalculate every sell price of that
 * category's products from their cost price: price = round(cost * (1 + pct/10000)).
 */
export async function updateMarkup({
	category,
	...pcts
}: MarkupPcts & { category: ProductCategory }) {
	if (Object.values(pcts).some((bp) => !Number.isInteger(bp) || bp < 0 || bp > MAX_MARKUP_BP)) {
		throw new AppError(400, 'Markup percentages must be between 0 and 200.');
	}

	await db
		.insert(table.categoryMarkup)
		.values({ category, ...pcts })
		.onConflictDoUpdate({
			target: table.categoryMarkup.category,
			set: { ...pcts, updatedAt: new Date() }
		});

	await db
		.update(table.product)
		.set({
			enduserPrice: markedUp(pcts.enduserPct),
			discountPrice: markedUp(pcts.discountPct),
			resalePrice: markedUp(pcts.resalePct),
			specialPrice: markedUp(pcts.specialPct)
		})
		.where(eq(table.product.category, category));

	const [{ count }] = await db
		.select({ count: sql<number>`count(*)` })
		.from(table.product)
		.where(eq(table.product.category, category));

	return { updatedProducts: Number(count) };
}

function markedUp(pct: number) {
	return sql<number>`CAST(ROUND(${table.product.costPrice} * (1.0 + ${pct} / 10000.0)) AS INTEGER)`;
}

// ─────────────────────────────────────────────
// Product update / delete
// ─────────────────────────────────────────────

export type UpdateProductPayload = Partial<ProductInput> & {
	id: string;
	// When true, the four sell prices are recomputed from the category markups
	// and the (new) cost price instead of taken from the payload.
	recalcPrices?: boolean;
};

export async function updateProduct({ id, recalcPrices, ...fields }: UpdateProductPayload) {
	const existing = await db.query.product.findFirst({ where: eq(table.product.id, id) });
	if (!existing) throw new AppError(404, 'Product not found');

	const values: Partial<typeof table.product.$inferInsert> = { ...fields };

	if (recalcPrices) {
		const category = fields.category ?? existing.category;
		const costPrice = fields.costPrice ?? existing.costPrice;
		const markup =
			(await db.query.categoryMarkup.findFirst({
				where: eq(table.categoryMarkup.category, category)
			})) ?? DEFAULT_MARKUPS[category];

		values.enduserPrice = priceFromMarkup(costPrice, markup.enduserPct);
		values.discountPrice = priceFromMarkup(costPrice, markup.discountPct);
		values.resalePrice = priceFromMarkup(costPrice, markup.resalePct);
		values.specialPrice = priceFromMarkup(costPrice, markup.specialPct);
	}

	await db.update(table.product).set(values).where(eq(table.product.id, id));
}

/** Deleting a product hides it from the catalog; existing quotes keep their recorded prices. */
export async function deleteProduct(id: string) {
	await db.update(table.product).set({ isActive: false }).where(eq(table.product.id, id));
}

// ─────────────────────────────────────────────
// Bulk import (from the price-list workbook)
// ─────────────────────────────────────────────

const IMPORT_CHUNK = 200;

export interface ImportProductsPayload {
	products: ProductInput[];
	// Skip rows whose (brand, specification) already exists in the catalog.
	skipExisting?: boolean;
}

export async function importProducts({ products, skipExisting = true }: ImportProductsPayload) {
	let candidates = products;
	if (skipExisting) {
		const existing = await db
			.select({ brand: table.product.brand, specification: table.product.specification })
			.from(table.product)
			.where(eq(table.product.isActive, true));
		const keys = new Set(existing.map((p) => `${p.brand}\u0000${p.specification}`));
		candidates = products.filter((p) => !keys.has(`${p.brand}\u0000${p.specification}`));
	}

	const rows = candidates.map((p) => ({
		...p,
		warranty: p.warranty || 'N/A',
		costPrice: Math.round(p.costPrice),
		enduserPrice: Math.round(p.enduserPrice),
		discountPrice: Math.round(p.discountPrice),
		resalePrice: Math.round(p.resalePrice),
		specialPrice: Math.round(p.specialPrice)
	}));

	await db.transaction(async (tx) => {
		for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
			await tx.insert(table.product).values(rows.slice(i, i + IMPORT_CHUNK));
		}
	});

	return { inserted: rows.length, skipped: products.length - rows.length };
}
