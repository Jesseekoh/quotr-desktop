import { describe, expect, it } from 'vitest';
import { itemDescription } from './quotes.js';

describe('itemDescription', () => {
	it('strips a catalog brand prefix when brands are hidden', () => {
		const item = { description: 'Jinko 550W mono panel', brand: 'Jinko' };
		expect(itemDescription(item, false)).toBe('550W mono panel');
		expect(itemDescription(item, true)).toBe('Jinko 550W mono panel');
	});

	it('adds a separately stored brand when brands are shown', () => {
		const item = { description: '5kVA inverter', brand: 'Felicity' };
		expect(itemDescription(item, true)).toBe('Felicity 5kVA inverter');
		expect(itemDescription(item, false)).toBe('5kVA inverter');
	});

	it('leaves items without a brand alone', () => {
		expect(itemDescription({ description: 'Installation', brand: null }, false)).toBe(
			'Installation'
		);
	});

	it('keeps a description that is only the brand', () => {
		expect(itemDescription({ description: 'Jinko', brand: 'Jinko' }, false)).toBe('Jinko');
	});
});
