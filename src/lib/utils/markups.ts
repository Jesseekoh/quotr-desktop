/** One markup set — a percentage (in basis points) per price tier. */
export interface MarkupPcts {
	enduserPct: number;
	discountPct: number;
	resalePct: number;
	specialPct: number;
}

/** Percentages are stored in basis points: 3000 = 30%, 3500 = 35%. */
export const BP_PER_PERCENT = 100;

export const MARKUP_FIELDS = [
	{ key: 'enduserPct', label: 'End User' },
	{ key: 'discountPct', label: 'Discount' },
	{ key: 'resalePct', label: 'Resale' },
	{ key: 'specialPct', label: 'Special' }
] as const;

/** Steps (in naira) sell prices can be rounded to. */
export const ROUNDING_STEPS = [1, 10, 50, 100, 500, 1000] as const;

export function bpToPercent(bp: number): number {
	return bp / BP_PER_PERCENT;
}

export function percentToBp(percent: number): number {
	return Math.round(percent * BP_PER_PERCENT);
}

/**
 * Derive a sell price from cost price and a markup in basis points, rounded
 * half-up to the nearest `step` naira — the price list's
 * MROUND(cost * (1 + margin), 1000). Integer maths throughout, so e.g.
 * 470,000 at 15% is exactly 540,500 before rounding. `markedUpSql` in
 * api/products.ts mirrors this for bulk recalculation; keep them in step.
 */
export function priceFromMarkup(costPrice: number, markupBp: number, step = 1): number {
	const scaled = Math.round(costPrice) * (10_000 + markupBp);
	const unit = 10_000 * step;
	return Math.floor((2 * scaled + unit) / (2 * unit)) * step;
}

export function pricesFromMarkup(costPrice: number, markup: MarkupPcts, step = 1) {
	return {
		enduserPrice: priceFromMarkup(costPrice, markup.enduserPct, step),
		discountPrice: priceFromMarkup(costPrice, markup.discountPct, step),
		resalePrice: priceFromMarkup(costPrice, markup.resalePct, step),
		specialPrice: priceFromMarkup(costPrice, markup.specialPct, step)
	};
}
