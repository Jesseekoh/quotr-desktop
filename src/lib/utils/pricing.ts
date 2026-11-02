// import type { PriceLabel, Product } from '../api/types';
import type { PriceLabel } from '#lib/db/schema.js';
import type { Product } from '#lib/api/types.js';

const FIELD_BY_LABEL: Record<PriceLabel, keyof Product> = {
	// COST_PRICE: 'costPrice',
	DISCOUNT_PRICE: 'discountPrice',
	RESALE_PRICE: 'resalePrice',
	SPECIAL_PRICE: 'specialPrice',
	ENDUSER_PRICE: 'enduserPrice'
};

// Preview only - the backend is the source of truth and snapshots the
// actual price when the item is added.
export function getProductPriceForLabel(product: Product, label: PriceLabel): number {
	return Number(product[FIELD_BY_LABEL[label]]);
}

export const PRICE_LABEL_OPTIONS: { value: PriceLabel; text: string }[] = [
	// { value: 'COST_PRICE', text: 'Cost price' },
	{ value: 'DISCOUNT_PRICE', text: 'Discount price' },
	{ value: 'RESALE_PRICE', text: 'Resale price' },
	{ value: 'SPECIAL_PRICE', text: 'Special price' },
	{ value: 'ENDUSER_PRICE', text: 'End-user price' }
];
