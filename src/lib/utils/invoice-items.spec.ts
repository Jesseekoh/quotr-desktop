import { describe, expect, it } from 'vitest';
import { groupInvoiceItems, type InvoiceLine } from './invoice-items';

let nextId = 0;
function line(
	sectionName: string | null,
	optionName: string | null,
	totalPrice: number
): InvoiceLine {
	return {
		id: `line-${nextId++}`,
		sectionName,
		optionName,
		description: 'item',
		brand: null,
		specification: null,
		quantity: 1,
		unitPrice: totalPrice,
		totalPrice
	};
}

describe('groupInvoiceItems', () => {
	it('numbers sections and splits shared lines from the chosen option', () => {
		const groups = groupInvoiceItems([
			line(null, null, 5),
			line('Inverter', null, 10),
			line('Battery', null, 1),
			line('Battery', 'Lithium', 20),
			line('Battery', 'Lithium', 30)
		]);
		expect(groups.map((group) => [group.heading, group.total])).toEqual([
			['Items', 5],
			['1.0 Inverter', 10],
			['2.0 Battery', 51]
		]);
		expect(groups[2]?.parts.map((part) => [part.optionName, part.lines.length])).toEqual([
			[null, 1],
			['Lithium', 2]
		]);
	});
});
