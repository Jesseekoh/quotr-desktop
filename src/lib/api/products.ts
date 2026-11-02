import { and, asc, eq, getTableColumns, inArray, like, or, sql } from 'drizzle-orm';
import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import type { ProductCategory } from '#lib/db/schema.js';
import { pricesFromMarkup, ROUNDING_STEPS, type MarkupPcts } from '#lib/utils/markups.js';
import { brandKey, capacityOf, productKey } from '#lib/utils/product-key.js';
import { getPriceRoundingStep } from './settings.js';
import { AppError } from './types.js';

export interface ProductFilters {
	/** A category id; a top-level category also matches its subcategories. */
	category?: ProductCategory;
	brand?: string;
	search?: string;
}

export async function getProducts(filters: ProductFilters = {}) {
	const term = filters.search ? `%${filters.search}%` : undefined;
	return db
		.select({ ...getTableColumns(table.product), categoryName: table.category.name })
		.from(table.product)
		.leftJoin(table.category, eq(table.category.id, table.product.category))
		.where(
			and(
				eq(table.product.isActive, true),
				filters.category
					? or(
							eq(table.product.category, filters.category),
							eq(table.category.parentId, filters.category)
						)
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
	await assertCategory(data.category);
	await db.insert(table.product).values(data);
}

// ─────────────────────────────────────────────
// Categories and markups
// ─────────────────────────────────────────────

type CategoryRow = typeof table.category.$inferSelect;

export interface CategoryWithMarkup extends MarkupPcts {
	id: string;
	name: string;
	parentId: string | null;
	/** True when a subcategory uses its parent's markups. */
	inherited: boolean;
	productCount: number;
}

const FALLBACK_MARKUP: MarkupPcts = {
	enduserPct: 3000,
	discountPct: 2500,
	resalePct: 2000,
	specialPct: 1500
};

function ownMarkup(row: CategoryRow): MarkupPcts | null {
	const { enduserPct, discountPct, resalePct, specialPct } = row;
	if (enduserPct === null || discountPct === null || resalePct === null || specialPct === null) {
		return null;
	}
	return { enduserPct, discountPct, resalePct, specialPct };
}

/** Markups each category resolves to: its own, else its parent's. */
function effectiveMarkups(rows: CategoryRow[]): Map<string, MarkupPcts> {
	const byId = new Map(rows.map((r) => [r.id, r]));
	return new Map(
		rows.map((r) => {
			const parent = r.parentId ? byId.get(r.parentId) : undefined;
			return [r.id, ownMarkup(r) ?? (parent && ownMarkup(parent)) ?? FALLBACK_MARKUP];
		})
	);
}

/** Every category, each parent followed by its subcategories, with resolved markups. */
export async function getCategories(): Promise<CategoryWithMarkup[]> {
	const [rows, counts] = await Promise.all([
		db
			.select()
			.from(table.category)
			.orderBy(asc(table.category.sortOrder), asc(table.category.name)),
		db
			.select({ category: table.product.category, count: sql<number>`count(*)` })
			.from(table.product)
			.where(eq(table.product.isActive, true))
			.groupBy(table.product.category)
	]);

	const countByCategory = new Map(counts.map((c) => [c.category, Number(c.count)]));
	const markups = effectiveMarkups(rows);
	const toItem = (r: CategoryRow): CategoryWithMarkup => ({
		id: r.id,
		name: r.name,
		parentId: r.parentId,
		...markups.get(r.id)!,
		inherited: r.parentId !== null && ownMarkup(r) === null,
		productCount: countByCategory.get(r.id) ?? 0
	});

	return rows
		.filter((r) => r.parentId === null)
		.flatMap((parent) => [
			toItem(parent),
			...rows.filter((r) => r.parentId === parent.id).map(toItem)
		]);
}

async function assertCategory(id: string | undefined) {
	if (id === undefined) return;
	const found = await db.query.category.findFirst({ where: eq(table.category.id, id) });
	if (!found) throw new AppError(400, 'Choose a category that exists.');
}

function slugify(name: string) {
	return (
		name
			.toUpperCase()
			.replace(/[^A-Z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '') || 'CATEGORY'
	);
}

export async function createCategory({
	name,
	parentId
}: {
	name: string;
	parentId?: string | null;
}) {
	const trimmed = name.trim();
	if (!trimmed) throw new AppError(400, 'Give the category a name.');

	const rows = await db.select().from(table.category);
	if (rows.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
		throw new AppError(400, `A category called "${trimmed}" already exists.`);
	}
	const parent = parentId ? rows.find((r) => r.id === parentId) : undefined;
	if (parentId && !parent) throw new AppError(400, 'Choose a parent category that exists.');
	if (parent?.parentId) throw new AppError(400, 'Subcategories cannot have subcategories.');

	const base = slugify(trimmed);
	let id = base;
	for (let n = 2; rows.some((r) => r.id === id); n++) id = `${base}_${n}`;

	// New top-level categories start from the default markups; subcategories inherit.
	const markup = parent ? {} : FALLBACK_MARKUP;
	const sortOrder =
		Math.max(0, ...rows.filter((r) => r.parentId === (parentId ?? null)).map((r) => r.sortOrder)) +
		1;
	await db.insert(table.category).values({
		id,
		name: trimmed,
		parentId: parentId ?? null,
		sortOrder,
		...markup
	});
	return { id };
}

export async function renameCategory({ id, name }: { id: string; name: string }) {
	const trimmed = name.trim();
	if (!trimmed) throw new AppError(400, 'Give the category a name.');
	await db
		.update(table.category)
		.set({ name: trimmed, updatedAt: new Date() })
		.where(eq(table.category.id, id));
}

/** Only empty categories can go; 'OTHER' is the import fallback and stays. */
export async function deleteCategory(id: string) {
	if (id === 'OTHER') throw new AppError(400, 'The Other category cannot be deleted.');
	const [{ products }] = await db
		.select({ products: sql<number>`count(*)` })
		.from(table.product)
		.where(eq(table.product.category, id));
	const [{ children }] = await db
		.select({ children: sql<number>`count(*)` })
		.from(table.category)
		.where(eq(table.category.parentId, id));
	if (Number(products) > 0 || Number(children) > 0) {
		throw new AppError(400, 'Move its products and subcategories elsewhere first.');
	}
	await db.delete(table.category).where(eq(table.category.id, id));
}

const MAX_MARKUP_BP = 20_000;

function assertMarkup(pcts: MarkupPcts) {
	if (Object.values(pcts).some((bp) => !Number.isInteger(bp) || bp < 0 || bp > MAX_MARKUP_BP)) {
		throw new AppError(400, 'Markup percentages must be between 0 and 200.');
	}
}

/**
 * The SQL twin of `priceFromMarkup`. Bound numbers may arrive as REALs, so the
 * CAST does the flooring (every value here is positive) instead of relying on
 * integer division.
 */
function markedUpSql(pct: number, step: number) {
	const unit = 10_000 * step;
	return sql<number>`CAST((${table.product.costPrice} * ${10_000 + pct} * 2 + ${unit}) / ${2 * unit} AS INTEGER) * ${step}`;
}

/**
 * Recompute the sell prices of every non-manual product in these categories
 * from their resolved markups. Returns how many products were repriced.
 */
async function recalcCategories(ids: string[]) {
	const [rows, step] = await Promise.all([
		db.select().from(table.category),
		getPriceRoundingStep()
	]);
	const markups = effectiveMarkups(rows);
	let updated = 0;
	for (const id of ids) {
		const m = markups.get(id);
		if (!m) continue;
		const where = and(eq(table.product.category, id), eq(table.product.manualPrices, false));
		await db
			.update(table.product)
			.set({
				enduserPrice: markedUpSql(m.enduserPct, step),
				discountPrice: markedUpSql(m.discountPct, step),
				resalePrice: markedUpSql(m.resalePct, step),
				specialPrice: markedUpSql(m.specialPct, step)
			})
			.where(where);
		const [{ count }] = await db
			.select({ count: sql<number>`count(*)` })
			.from(table.product)
			.where(where);
		updated += Number(count);
	}
	return updated;
}

/** A category plus the subcategories that inherit its markups. */
async function markupDependants(id: string) {
	const children = await db.select().from(table.category).where(eq(table.category.parentId, id));
	return [id, ...children.filter((c) => ownMarkup(c) === null).map((c) => c.id)];
}

/**
 * Save a category's markups (or, with `inherit`, make a subcategory use its
 * parent's), then reprice the products that use them.
 */
export async function updateMarkup({
	category,
	inherit = false,
	...pcts
}: MarkupPcts & { category: ProductCategory; inherit?: boolean }) {
	const row = await db.query.category.findFirst({ where: eq(table.category.id, category) });
	if (!row) throw new AppError(404, 'Category not found');
	if (inherit && !row.parentId) throw new AppError(400, 'Only subcategories can inherit markups.');
	if (!inherit) assertMarkup(pcts);

	const values = inherit
		? { enduserPct: null, discountPct: null, resalePct: null, specialPct: null }
		: pcts;
	await db
		.update(table.category)
		.set({ ...values, updatedAt: new Date() })
		.where(eq(table.category.id, category));

	return { updatedProducts: await recalcCategories(await markupDependants(category)) };
}

/** Change the rounding step and reprice every non-manual product with it. */
export async function updatePriceRoundingStep(step: number) {
	if (!(ROUNDING_STEPS as readonly number[]).includes(step)) {
		throw new AppError(400, 'Choose one of the listed rounding steps.');
	}
	await db
		.insert(table.brandSettings)
		.values({ id: 1, priceRoundingStep: step })
		.onConflictDoUpdate({ target: table.brandSettings.id, set: { priceRoundingStep: step } });
	const ids = (await db.select({ id: table.category.id }).from(table.category)).map((r) => r.id);
	return { updatedProducts: await recalcCategories(ids) };
}

/** Resolved markups for one category, for pricing a single product. */
async function markupFor(category: string) {
	const rows = await db.select().from(table.category);
	return effectiveMarkups(rows).get(category) ?? FALLBACK_MARKUP;
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
	await assertCategory(fields.category);

	const values: Partial<typeof table.product.$inferInsert> = { ...fields };

	if (recalcPrices) {
		const category = fields.category ?? existing.category;
		const costPrice = fields.costPrice ?? existing.costPrice;
		const [markup, step] = await Promise.all([markupFor(category), getPriceRoundingStep()]);
		Object.assign(values, pricesFromMarkup(costPrice, markup, step));
	}

	await db.update(table.product).set(values).where(eq(table.product.id, id));
}

/** Deleting a product hides it from the catalog; existing quotes keep their recorded prices. */
export async function deleteProduct(id: string) {
	await deleteProducts([id]);
}

export async function deleteProducts(ids: string[]) {
	if (ids.length === 0) return;
	await db.update(table.product).set({ isActive: false }).where(inArray(table.product.id, ids));
}

// ─────────────────────────────────────────────
// Bulk import (from the price-list workbook)
// ─────────────────────────────────────────────

const IMPORT_CHUNK = 200;

export interface ImportRow {
	brand: string;
	category: ProductCategory;
	specification: string;
	warranty: string;
	costPrice: number;
	supplier: string | null;
	priceUpdatedAt: Date | null;
	technicalSpecs: Record<string, unknown> | null;
	/**
	 * Sell prices typed into the workbook rather than derived from its markup
	 * row. They are kept as-is and the product is marked as manually priced.
	 */
	manualPrices: {
		enduserPrice: number;
		discountPrice: number;
		resalePrice: number;
		specialPrice: number;
	} | null;
}

export interface ImportProductsPayload {
	products: ImportRow[];
	/** Markups to save onto categories before pricing the rows (from the sheets' markup rows). */
	markups?: (MarkupPcts & { category: ProductCategory })[];
	/** Leave rows that match an existing product untouched instead of updating them. */
	skipExisting?: boolean;
	/** Move matched products to the row's category too (off: keep the category they have). */
	updateCategories?: boolean;
	/** Plan only: report what would change without writing anything. */
	dryRun?: boolean;
}

export interface ImportResult {
	inserted: number;
	updated: number;
	/** Updated products whose cost or any sell price changed. */
	pricesChanged: number;
	skipped: number;
	/** File brand spellings folded into a spelling already in the catalog (or earlier in the file). */
	brandMerges: { from: string; to: string }[];
}

const PRICE_KEYS = [
	'costPrice',
	'enduserPrice',
	'discountPrice',
	'resalePrice',
	'specialPrice'
] as const;

/**
 * Insert new products and refresh existing ones (matched on brand + spec +
 * capacity). Sell prices follow the category markups unless the row or the
 * existing product is manually priced.
 */
export async function importProducts({
	products,
	markups = [],
	skipExisting = false,
	updateCategories = false,
	dryRun = false
}: ImportProductsPayload): Promise<ImportResult> {
	for (const { category: _, ...pcts } of markups) assertMarkup(pcts);

	const [categoryRows, existing, step] = await Promise.all([
		db.select().from(table.category),
		db.select().from(table.product).where(eq(table.product.isActive, true)),
		getPriceRoundingStep()
	]);

	// Apply the incoming markups on top of the stored ones before pricing.
	const pending = new Map(markups.map(({ category, ...m }) => [category, m]));
	const resolved = effectiveMarkups(
		categoryRows.map((r) => (pending.has(r.id) ? { ...r, ...pending.get(r.id) } : r))
	);
	const knownCategory = (id: string) => (resolved.has(id) ? id : 'OTHER');

	const spelling = new Map(existing.map((p) => [brandKey(p.brand), p.brand]));
	const merges = new Map<string, string>();
	const byKey = new Map(
		existing.map((p) => [productKey(p.brand, p.specification, capacityOf(p.technicalSpecs)), p])
	);

	const seenInFile = new Set<string>();
	const inserts: (typeof table.product.$inferInsert)[] = [];
	const updates: { id: string; values: Partial<typeof table.product.$inferInsert> }[] = [];
	let pricesChanged = 0;
	let skipped = 0;

	for (const row of products) {
		const bk = brandKey(row.brand);
		const brand = spelling.get(bk) ?? row.brand.trim();
		if (!spelling.has(bk)) spelling.set(bk, brand);
		if (brand !== row.brand.trim()) merges.set(row.brand.trim(), brand);

		const costPrice = Math.round(row.costPrice);
		const key = productKey(brand, row.specification, capacityOf(row.technicalSpecs));
		const match = byKey.get(key);
		// The same product on two sheets: the first one wins.
		if (seenInFile.has(key) || (match && skipExisting)) {
			skipped++;
			continue;
		}
		seenInFile.add(key);

		const category = match && !updateCategories ? match.category : knownCategory(row.category);
		const keepManual = match?.manualPrices && !row.manualPrices;
		const derived = pricesFromMarkup(costPrice, resolved.get(category)!, step);
		const prices = row.manualPrices
			? {
					enduserPrice: Math.round(row.manualPrices.enduserPrice),
					discountPrice: Math.round(row.manualPrices.discountPrice),
					resalePrice: Math.round(row.manualPrices.resalePrice),
					specialPrice: Math.round(row.manualPrices.specialPrice)
				}
			: keepManual
				? {}
				: derived;

		const values = {
			category,
			specification: row.specification,
			warranty: row.warranty || 'N/A',
			costPrice,
			supplier: row.supplier,
			priceUpdatedAt: row.priceUpdatedAt,
			technicalSpecs: row.technicalSpecs,
			manualPrices: row.manualPrices !== null || Boolean(keepManual),
			...prices
		};

		if (match) {
			const next = { ...match, ...values };
			if (PRICE_KEYS.some((k) => next[k] !== match[k])) pricesChanged++;
			updates.push({ id: match.id, values });
		} else {
			inserts.push({ brand, ...derived, ...values });
		}
	}

	const result: ImportResult = {
		inserted: inserts.length,
		updated: updates.length,
		pricesChanged,
		skipped,
		brandMerges: [...merges].map(([from, to]) => ({ from, to }))
	};
	if (dryRun) return result;

	await db.transaction(async (tx) => {
		for (const { category, ...m } of markups) {
			await tx
				.update(table.category)
				.set({ ...m, updatedAt: new Date() })
				.where(eq(table.category.id, category));
		}
		for (let i = 0; i < inserts.length; i += IMPORT_CHUNK) {
			await tx.insert(table.product).values(inserts.slice(i, i + IMPORT_CHUNK));
		}
		for (const { id, values } of updates) {
			await tx.update(table.product).set(values).where(eq(table.product.id, id));
		}
	});

	// Saved markups reprice the rest of those categories too, like a manual save.
	if (markups.length > 0) {
		const ids = new Set<string>();
		for (const { category } of markups) {
			for (const id of await markupDependants(category)) ids.add(id);
		}
		await recalcCategories([...ids]);
	}

	return result;
}
