import * as XLSX from 'xlsx';
import type { ProductCategory } from '#lib/db/schema.js';
import type { MarkupPcts } from '#lib/utils/markups.js';

export interface ImportableProduct {
	brand: string;
	category: ProductCategory;
	specification: string;
	warranty: string;
	costPrice: number;
	enduserPrice: number;
	discountPrice: number;
	resalePrice: number;
	specialPrice: number;
	technicalSpecs: Record<string, unknown> | null;
}

export interface ParsedSheet {
	sheetName: string;
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
	Ups: 'OTHER',
	'AVR and ATS': 'OTHER',
	Battery: 'BATTERY',
	MPPT: 'CHARGE_CONTROLLER',
	Panels: 'SOLAR_PANEL',
	'Connectors, breakers, surge pro': 'ACCESSORY',
	'Rack cabinets': 'CABINET',
	'Cables, bus bars': 'CABLE'
};

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

function excelSerialToIso(serial: number): string {
	const ms = Math.round((serial - 25_569) * 86_400_000);
	const d = new Date(ms);
	if (Number.isNaN(d.getTime())) return String(serial);
	return d.toISOString().slice(0, 10);
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

		// Panels repeat brand+spec across wattages, so capacity is part of the identity.
		const capacity = asNumber(get(row, 'capacity'));
		const key = `${norm(brand)}\u0000${norm(spec)}\u0000${capacity ?? ''}`;
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
			'size',
			'supplier'
		] as const) {
			const value = get(row, field);
			if (!isBlankText(value)) specs[field] = value;
		}
		const lastUpdated = asNumber(get(row, 'lastUpdated'));
		if (lastUpdated !== null && lastUpdated > 1000)
			specs.lastUpdated = excelSerialToIso(lastUpdated);

		// A numeric warranty cell is a number of years; 0 means no warranty stated.
		const warrantyRaw = get(row, 'warranty');
		const warrantyNum = asNumber(warrantyRaw);
		const warranty =
			warrantyNum !== null
				? warrantyNum > 0
					? `${warrantyNum} Years`
					: 'N/A'
				: String(warrantyRaw ?? '').trim();

		products.push({
			brand,
			category,
			specification: spec,
			warranty: warranty || 'N/A',
			costPrice: price('costPrice'),
			enduserPrice: price('enduserPrice'),
			discountPrice: price('discountPrice'),
			resalePrice: price('resalePrice'),
			specialPrice: price('specialPrice'),
			technicalSpecs: Object.keys(specs).length ? specs : null
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
