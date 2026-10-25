import type { ProductCategory } from '#lib/db/schema.js';

/** One markup set per category — a percentage (in basis points) per price tier. */
export interface MarkupPcts {
	enduserPct: number;
	discountPct: number;
	resalePct: number;
	specialPct: number;
}

/** Percentages are stored in basis points: 3000 = 30%, 3500 = 35%. */
export const BP_PER_PERCENT = 100;

/** Seeds matching the markup rows of the source price-list workbook. */
export const DEFAULT_MARKUPS: Record<ProductCategory, MarkupPcts> = {
	INVERTER: { enduserPct: 3000, discountPct: 2500, resalePct: 2000, specialPct: 1500 },
	BATTERY: { enduserPct: 3000, discountPct: 2500, resalePct: 2000, specialPct: 1500 },
	SOLAR_PANEL: { enduserPct: 3000, discountPct: 2500, resalePct: 2000, specialPct: 1500 },
	CHARGE_CONTROLLER: { enduserPct: 3000, discountPct: 2500, resalePct: 2000, specialPct: 1500 },
	ACCESSORY: { enduserPct: 4000, discountPct: 3500, resalePct: 3000, specialPct: 2000 },
	CABINET: { enduserPct: 3500, discountPct: 3000, resalePct: 2500, specialPct: 2000 },
	CABLE: { enduserPct: 3500, discountPct: 3000, resalePct: 2500, specialPct: 2000 },
	RACK_MOUNTING: { enduserPct: 3500, discountPct: 3000, resalePct: 2500, specialPct: 2000 },
	OTHER: { enduserPct: 3000, discountPct: 2500, resalePct: 2000, specialPct: 1500 }
};

export const MARKUP_FIELDS = [
	{ key: 'enduserPct', label: 'End User' },
	{ key: 'discountPct', label: 'Discount' },
	{ key: 'resalePct', label: 'Resale' },
	{ key: 'specialPct', label: 'Special' }
] as const;

export function bpToPercent(bp: number): number {
	return bp / BP_PER_PERCENT;
}

export function percentToBp(percent: number): number {
	return Math.round(percent * BP_PER_PERCENT);
}

/** Derive a sell price from cost price and a markup in basis points. */
export function priceFromMarkup(costPrice: number, markupBp: number): number {
	return Math.round(costPrice * (1 + markupBp / 10_000));
}
