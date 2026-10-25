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
