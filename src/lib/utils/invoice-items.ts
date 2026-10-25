export type InvoiceLine = {
	id: string;
	sectionName: string | null;
	optionName: string | null;
	description: string;
	brand: string | null;
	specification: string | null;
	quantity: number;
	unitPrice: number;
	totalPrice: number;
};

export type InvoiceGroup = {
	// Section number for headings ("1.0 Battery"); null for items outside sections.
	number: number | null;
	heading: string;
	total: number;
	// Shared section lines first (optionName null), then the chosen option's lines.
	parts: { optionName: string | null; lines: InvoiceLine[] }[];
};

/**
 * Rebuild the quote's section layout from an invoice's lines. Lines are stored in
 * quote order (items outside sections first, then each section's lines together),
 * so a new group starts whenever the section changes.
 */
export function groupInvoiceItems(lines: InvoiceLine[]): InvoiceGroup[] {
	const groups: (InvoiceGroup & { sectionName: string | null })[] = [];
	let sectionCount = 0;
	for (const line of lines) {
		let group = groups.at(-1);
		if (!group || group.sectionName !== line.sectionName) {
			const number = line.sectionName === null ? null : ++sectionCount;
			group = {
				sectionName: line.sectionName,
				number,
				heading: number === null ? 'Items' : `${number}.0 ${line.sectionName}`,
				total: 0,
				parts: []
			};
			groups.push(group);
		}
		let part = group.parts.at(-1);
		if (!part || part.optionName !== line.optionName) {
			part = { optionName: line.optionName, lines: [] };
			group.parts.push(part);
		}
		part.lines.push(line);
		group.total += line.totalPrice;
	}
	return groups;
}
