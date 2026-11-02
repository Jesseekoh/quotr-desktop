import * as XLSX from 'xlsx';
import type { ImportRow } from '#lib/api/products.js';
import type { ProductCategory } from '#lib/db/schema.js';
import type { MarkupPcts } from '#lib/utils/markups.js';
import { productKey } from '#lib/utils/product-key.js';

export interface ImportableProduct extends ImportRow {
	/**
	 * Category read from the row itself (its Type column or specification),
	 * or null to use the sheet's category.
	 */
	detectedCategory: ProductCategory | null;
}

export interface ParsedSheet {
	sheetName: string;
	/** Category for rows the parser could not classify on their own. */
	category: ProductCategory;
	/** Markup row detected above the sheet's header, in basis points. */
	markup: MarkupPcts | null;
	products: ImportableProduct[];
	/** Rows that had content but were not importable (e.g. missing specification). */
	skipped: number;
}

/** Default home for each sheet of the price-list workbook. */
export const SHEET_CATEGORY_MAP: Record<string, ProductCategory> = {
	Inverter: 'INVERTER',
	'Stacking Kit': 'ACCESSORY',
	Ups: 'UPS',
	'AVR and ATS': 'AVR_ATS',
	Battery: 'BATTERY',
	MPPT: 'CHARGE_CONTROLLER',
	Panels: 'SOLAR_PANEL',
	'Connectors, breakers, surge pro': 'ACCESSORY',
	'Rack cabinets': 'CABINET',
	'Cables, bus bars': 'CABLE'
};

/**
 * Type-column values → category. The workbook spells types several ways
 * ("Hybrid Inverter", "Inverter Hybrid", "Invertert String"), so a type is
 * matched on its set of words, in any order. `onlyIn` limits a rule to one
 * sheet category: on "Rack cabinets", Type is the battery a cabinet holds.
 */
const TYPE_RULES: { words: string[]; category: ProductCategory; onlyIn?: ProductCategory }[] = [
	{ words: ['ups'], category: 'UPS' },
	{ words: ['avr'], category: 'AVR_ATS' },
	{ words: ['ats'], category: 'AVR_ATS' },
	{ words: ['water', 'pump'], category: 'WATER_PUMP' },
	{ words: ['hybrid'], category: 'HYBRID_INVERTER' },
	{ words: ['standalone'], category: 'STANDALONE_INVERTER' },
	{ words: ['string'], category: 'STRING_INVERTER' },
	{ words: ['allinone', 'inverter'], category: 'ALL_IN_ONE_INVERTER' },
	{ words: ['allinone', 'invertert'], category: 'ALL_IN_ONE_INVERTER' },
	{ words: ['lithium'], category: 'LITHIUM_BATTERY', onlyIn: 'BATTERY' },
	{ words: ['lead', 'acid'], category: 'LEAD_ACID_BATTERY', onlyIn: 'BATTERY' },
	{ words: ['flooded'], category: 'FLOODED_BATTERY', onlyIn: 'BATTERY' },
	{ words: ['mppt'], category: 'CHARGE_CONTROLLER' },
	{ words: ['accessories'], category: 'ACCESSORY' }
];

/** Fallback for sheets without a Type column (e.g. "Stacking Kit"). */
const SPEC_RULES: { pattern: RegExp; category: ProductCategory }[] = [
	{ pattern: /warranty extension/i, category: 'SERVICE' },
	{ pattern: /monitoring|wifi dongle|gateway|cerbo|ccgx/i, category: 'MONITORING' },
	{ pattern: /transfer switch|\bats\b|\bavr\b/i, category: 'AVR_ATS' }
];

function typeWords(type: string): Set<string> {
	return new Set(
		type
			.toLowerCase()
			.replace(/all[\s-]*in[\s-]*one/g, 'allinone')
			.split(/[^a-z0-9]+/)
			.filter(Boolean)
	);
}

function detectCategory(
	type: Cell,
	spec: string,
	sheetCategory: ProductCategory
): ProductCategory | null {
	if (!isBlankText(type)) {
		const words = typeWords(String(type));
		return (
			TYPE_RULES.find(
				(r) => (!r.onlyIn || r.onlyIn === sheetCategory) && r.words.every((w) => words.has(w))
			)?.category ?? null
		);
	}
	return SPEC_RULES.find((r) => r.pattern.test(spec))?.category ?? null;
}

/** Sheets that hold validation lists / notes rather than products. */
const IGNORED_SHEETS = new Set(['Notes']);

type Cell = string | number | boolean | null;

function norm(value: Cell): string {
	return String(value ?? '')
		.trim()
		.toLowerCase()
		.replace(/['’]/g, '')
		.replace(/\s+/g, ' ');
}

/** Column aliases → canonical field. Unlisted headers (e.g. "Discount Price/Watt2") are ignored. */
const HEADER_ALIASES: Record<string, string> = {
	brand: 'brand',
	type: 'type',
	warranty: 'warranty',
	specification: 'specification',
	specifications: 'specification',
	capacity: 'capacity',
	input: 'input',
	'dc voltage': 'dcVoltage',
	mppv: 'mppV',
	mppa: 'mppA',
	mppt: 'mppT',
	size: 'size',
	'end user price': 'enduserPrice',
	'end users price': 'enduserPrice',
	'discount price': 'discountPrice',
	'resale price': 'resalePrice',
	'resellers price': 'resalePrice',
	'special price': 'specialPrice',
	'last price': 'specialPrice',
	'cost price': 'costPrice',
	supplier: 'supplier',
	'last updated': 'lastUpdated'
};

type PriceField = 'enduserPrice' | 'discountPrice' | 'resalePrice' | 'specialPrice' | 'costPrice';

/** "0" and blank both count as empty for text columns (the workbook uses 0 as placeholder). */
function isBlankText(value: Cell): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'number') return value === 0;
	const s = String(value).trim();
	return s === '' || s === '0' || s === '.';
}

function asNumber(value: Cell): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string') {
		const s = value.trim().replace(/,/g, '');
		if (s === '') return null;
		const n = Number(s);
		if (Number.isFinite(n)) return n;
	}
	return null;
}

/** Markup cells are fractions (0.3), percents (30) or percent strings ("30%"). */
function markupBpFromCell(value: Cell): number | null {
	if (typeof value === 'string') {
		const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*%$/);
		if (m) return Math.round(parseFloat(m[1]) * 100);
		return null;
	}
	const n = asNumber(value);
	if (n === null || n <= 0) return null;
	if (n <= 1) return Math.round(n * 10_000);
	if (n <= 200) return Math.round(n * 100);
	return null;
}

function excelSerialToDate(serial: number): Date | null {
	const d = new Date(Math.round((serial - 25_569) * 86_400_000));
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whether a row's sell prices come from the sheet's markup row (within the
 * workbook's ₦1,000 rounding) rather than being typed in by hand. Rows with no
 * sell prices, or no cost to derive them from, count as following it.
 */
function followsMarkup(
	cost: number,
	prices: Record<'enduserPrice' | 'discountPrice' | 'resalePrice' | 'specialPrice', number>,
	markup: MarkupPcts | null
): boolean {
	const values = Object.values(prices);
	if (values.every((v) => v === 0) || cost <= 0) return true;
	if (!markup) return false;
	const tiers = [
		[prices.enduserPrice, markup.enduserPct],
		[prices.discountPrice, markup.discountPct],
		[prices.resalePrice, markup.resalePct],
		[prices.specialPrice, markup.specialPct]
	] as const;
	// A blank tier (0) is a column the sheet doesn't have, not a hand-set price.
	// Compared in units of 1/10,000 naira so 390,000 at 15% is exactly 448,500.
	return tiers.every(
		([p, bp]) => p === 0 || Math.abs(p * 10_000 - cost * (10_000 + bp)) <= 500 * 10_000
	);
}

function findHeaderRow(rows: Cell[][]): number {
	for (let i = 0; i < Math.min(rows.length, 15); i++) {
		if (rows[i]?.some((cell) => norm(cell) === 'brand')) return i;
	}
	return -1;
}

function mapColumns(headerRow: Cell[]): Record<string, number> {
	const cols: Record<string, number> = {};
	headerRow.forEach((cell, idx) => {
		const field = HEADER_ALIASES[norm(cell)];
		if (field && cols[field] === undefined) cols[field] = idx;
	});
	return cols;
}

function detectMarkup(rows: Cell[][], headerRow: number): MarkupPcts | null {
	// The markup row sits directly above the header (sometimes with a spacer row).
	for (let i = headerRow - 1; i >= Math.max(0, headerRow - 3); i--) {
		const values = (rows[i] ?? []).map(markupBpFromCell).filter((bp): bp is number => bp !== null);
		if (values.length >= 2) {
			const [enduserPct = 3000, discountPct = 2500, resalePct = 2000, specialPct = 1500] = values;
			return { enduserPct, discountPct, resalePct, specialPct };
		}
	}
	return null;
}

function parseSheet(name: string, ws: XLSX.WorkSheet, category: ProductCategory): ParsedSheet {
	const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, {
		header: 1,
		raw: true,
		defval: null,
		blankrows: false
	});
	const headerRow = findHeaderRow(rows);
	const empty: ParsedSheet = { sheetName: name, category, markup: null, products: [], skipped: 0 };
	if (headerRow === -1) return empty;

	const cols = mapColumns(rows[headerRow]);
	const markup = detectMarkup(rows, headerRow);
	const get = (row: Cell[], field: string): Cell =>
		cols[field] === undefined ? null : (row[cols[field]] ?? null);

	const seen = new Set<string>();
	const products: ImportableProduct[] = [];
	let skipped = 0;

	for (let i = headerRow + 1; i < rows.length; i++) {
		const row = rows[i];
		if (!row) continue;

		const brandCell = get(row, 'brand');
		const typeCell = get(row, 'type');
		const specCell = get(row, 'specification');
		const spec = String(specCell ?? '').trim();
		if (isBlankText(brandCell) && isBlankText(typeCell) && isBlankText(specCell)) continue;
		if (isBlankText(specCell)) {
			skipped++;
			continue;
		}

		// Sheets like "Connectors" keep the real brand in the Type column.
		const brand =
			[brandCell, typeCell].map((c) => String(c ?? '').trim()).find((s) => !isBlankText(s)) ??
			'Unbranded';

		const capacity = asNumber(get(row, 'capacity'));
		const key = productKey(brand, spec, capacity ?? undefined);
		if (seen.has(key)) continue;
		seen.add(key);

		const price = (field: PriceField) => asNumber(get(row, field)) ?? 0;

		const specs: Record<string, unknown> = {};
		for (const field of [
			'type',
			'capacity',
			'input',
			'dcVoltage',
			'mppV',
			'mppA',
			'mppT',
			'size'
		] as const) {
			const value = get(row, field);
			if (!isBlankText(value)) specs[field] = value;
		}
		const lastUpdated = asNumber(get(row, 'lastUpdated'));
		const supplier = get(row, 'supplier');

		// A numeric warranty cell is a number of years; 0 means no warranty stated.
		const warrantyRaw = get(row, 'warranty');
		const warrantyNum = asNumber(warrantyRaw);
		const warranty =
			warrantyNum !== null
				? warrantyNum > 0
					? `${warrantyNum} Years`
					: 'N/A'
				: String(warrantyRaw ?? '').trim();

		const costPrice = price('costPrice');
		const sheetPrices = {
			enduserPrice: price('enduserPrice'),
			discountPrice: price('discountPrice'),
			resalePrice: price('resalePrice'),
			specialPrice: price('specialPrice')
		};

		products.push({
			brand,
			category,
			detectedCategory: detectCategory(typeCell, spec, category),
			specification: spec,
			warranty: warranty || 'N/A',
			costPrice,
			supplier: isBlankText(supplier) ? null : String(supplier).trim(),
			priceUpdatedAt:
				lastUpdated !== null && lastUpdated > 1000 ? excelSerialToDate(lastUpdated) : null,
			technicalSpecs: Object.keys(specs).length ? specs : null,
			manualPrices: followsMarkup(costPrice, sheetPrices, markup) ? null : sheetPrices
		});
	}

	return { sheetName: name, category, markup, products, skipped };
}

/** Parse a price-list workbook into per-sheet product batches (client-side). */
export async function parseWorkbook(file: File): Promise<ParsedSheet[]> {
	const buffer = await file.arrayBuffer();
	const wb = XLSX.read(buffer, { type: 'array' });

	return wb.SheetNames.filter((name) => !IGNORED_SHEETS.has(name)).map((name) => {
		const category = SHEET_CATEGORY_MAP[name] ?? 'OTHER';
		return parseSheet(name, wb.Sheets[name], category);
	});
}
