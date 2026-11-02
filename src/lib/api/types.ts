import type * as table from '#lib/db/schema.js';

export type { InvoiceStatus, PriceLabel, ProductCategory, QuoteStatus } from '#lib/db/schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];
type WithoutTimestamps<T> = Omit<T, 'createdAt' | 'updatedAt'>;

export type Product = Row<typeof table.product>;
/** A product as the catalog lists it, with its category's display name. */
export type CatalogProduct = Product & { categoryName: string | null };
export type Customer = Row<typeof table.customer>;
export type Invoice = Row<typeof table.invoice>;
export type InvoiceItem = Row<typeof table.invoiceItem>;

export type QuoteItem = WithoutTimestamps<Row<typeof table.quoteItem>>;
export type QuoteOption = WithoutTimestamps<Row<typeof table.quoteOption>>;

export interface QuoteOptionWithItems extends QuoteOption {
	items: QuoteItem[];
}

/** A section with its shared items (no option) and its options' items grouped in. */
export interface QuoteSection {
	id: string;
	quoteId: string;
	name: string;
	sortOrder: number;
	items: QuoteItem[];
	options: QuoteOptionWithItems[];
}

export interface BrandSettings {
	businessName: string | null;
	logo: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	onboardedAt: Date | null;
}

/** Thrown for problems the user can fix; the message is safe to show. */
export class AppError extends Error {
	status: number;
	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export function errorMessage(cause: unknown, fallback = 'Something went wrong. Please try again.') {
	return cause instanceof AppError ? cause.message : fallback;
}
