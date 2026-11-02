export function generateQuoteNumber() {
	const now = new Date();
	const stamp = now
		.toISOString()
		.replace(/[-:T.]/g, '')
		.slice(0, 14);
	return `Q-${stamp}`;
}

/** A sent quote that hasn't been answered within this many days counts as expired. */
export const QUOTE_EXPIRY_DAYS = 30;

/** Sent quotes older than the expiry window are shown as EXPIRED. */
export function isQuoteExpired(
	status: string,
	sentAt: Date | string | null,
	now = new Date()
): boolean {
	if (status !== 'SENT' || !sentAt) return false;
	const sent = typeof sentAt === 'string' ? new Date(sentAt) : sentAt;
	return sent.getTime() <= now.getTime() - QUOTE_EXPIRY_DAYS * 86_400_000;
}

/**
 * The description printed for a line item. Catalog items store the brand as a
 * prefix of the description and freeform items keep it separate, so strip any
 * leading brand first, then add it back only when the quote shows brands.
 */
export function itemDescription(
	item: { description: string; brand: string | null },
	showBrand: boolean
): string {
	const description = item.description.trim();
	const brand = item.brand?.trim();
	if (!brand) return description;
	const unbranded = description.toLowerCase().startsWith(brand.toLowerCase())
		? description.slice(brand.length).replace(/^[\s\-–—·:,]+/, '')
		: description;
	if (!showBrand) return unbranded || description;
	return unbranded ? `${brand} ${unbranded}` : brand;
}
