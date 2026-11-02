export function generateInvoiceNumber() {
	const now = new Date();
	const stamp = now
		.toISOString()
		.replace(/[-:T.]/g, '')
		.slice(0, 14);
	return `INV-${stamp}`;
}
