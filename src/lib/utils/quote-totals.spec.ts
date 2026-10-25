import { describe, expect, it } from 'vitest';
import type { QuoteItem, QuoteOptionWithItems, QuoteSection } from '#lib/api/types.js';
import { quoteTotals, sectionRange } from './quote-totals.js';

function item(
	id: string,
	totalPrice: number,
	quoteSectionId: string | null,
	quoteOptionId: string | null
): QuoteItem {
	return {
		id,
		quoteId: 'quote',
		quoteSectionId,
		quoteOptionId,
		productId: null,
		description: id,
		brand: null,
		specification: null,
		category: null,
		quantity: 1,
		unit: 'pcs',
		unitPrice: totalPrice,
		totalPrice,
		sortOrder: 0
	};
}

function option(id: string, name: string, sectionId: string, total: number): QuoteOptionWithItems {
	return {
		id,
		quoteId: 'quote',
		quoteSectionId: sectionId,
		name,
		description: null,
		isDefault: false,
		sortOrder: 0,
		items: total ? [item(id, total, sectionId, id)] : []
	};
}

function section(id: string, options: QuoteOptionWithItems[], base = 0): QuoteSection {
	return {
		id,
		quoteId: 'quote',
		name: id,
		sortOrder: 0,
		items: base ? [item(`${id}-base`, base, id, null)] : [],
		options
	};
}

describe('quote totals', () => {
	it('handles no options and one option', () => {
		expect(sectionRange(section('Base', [], 100))).toEqual({ min: 100, max: 100 });
		expect(sectionRange(section('Battery', [option('a', 'Option A', 'Battery', 200)], 50))).toEqual(
			{
				min: 250,
				max: 250
			}
		);
	});

	it('includes base items and empty options', () => {
		const result = quoteTotals({
			sections: [
				section('Battery', [option('a', 'A', 'Battery', 0), option('b', 'B', 'Battery', 200)], 100)
			]
		});
		expect(result.overallMin).toBe(100);
		expect(result.overallMax).toBe(300);
	});

	it('enumerates two by three options in natural order', () => {
		const result = quoteTotals({
			sections: [
				section('Battery', [option('a', 'A', 'Battery', 10), option('b', 'B', 'Battery', 20)]),
				section('Inverter', [
					option('c', 'C', 'Inverter', 30),
					option('d', 'D', 'Inverter', 40),
					option('e', 'E', 'Inverter', 50)
				])
			]
		});
		expect(result.combinationCount).toBe(6);
		expect(result.combinations.map((combination) => combination.label)).toEqual([
			'Battery A + Inverter C',
			'Battery A + Inverter D',
			'Battery A + Inverter E',
			'Battery B + Inverter C',
			'Battery B + Inverter D',
			'Battery B + Inverter E'
		]);
	});

	it('includes ungrouped items and collapses equal totals', () => {
		const result = quoteTotals({
			items: [item('ungrouped', 25, null, null)],
			sections: [
				section('Battery', [option('a', '', 'Battery', 10), option('b', '', 'Battery', 10)])
			]
		});
		expect(result.overallMin).toBe(result.overallMax);
		expect(result.overallMin).toBe(35);
		expect(result.combinations[0]?.label).toContain('Battery Opt A');
	});

	it('breaks each combination into the fixed total plus one part per section', () => {
		const result = quoteTotals({
			items: [item('ungrouped', 100, null, null)],
			sections: [
				section('Battery', [option('a', 'A', 'Battery', 10), option('b', 'B', 'Battery', 20)]),
				section('Inverter', [option('c', 'C', 'Inverter', 1), option('d', 'D', 'Inverter', 2)])
			]
		});
		const first = result.combinations[0];
		expect(first?.parts.map((part) => [part.optionId, part.total])).toEqual([
			['a', 10],
			['c', 1]
		]);
		for (const combination of result.combinations) {
			expect(combination.total).toBe(
				result.fixedTotal + combination.parts.reduce((sum, part) => sum + part.total, 0)
			);
		}
	});

	it('does not repeat the section name when the option name already includes it', () => {
		const result = quoteTotals({
			sections: [
				section('Battery', [
					option('a', 'Battery option 1', 'Battery', 10),
					option('b', 'Lithium', 'Battery', 20)
				])
			]
		});
		expect(result.combinations.map((combination) => combination.label)).toEqual([
			'Battery option 1',
			'Battery Lithium'
		]);
	});

	it('limits calculation after an intentionally large combination set', () => {
		const sections = Array.from({ length: 5 }, (_, index) =>
			section(
				`Section ${index}`,
				Array.from({ length: 5 }, (_, optionIndex) =>
					option(`${index}-${optionIndex}`, `Option ${optionIndex}`, `Section ${index}`, 1)
				)
			)
		);
		const result = quoteTotals({ sections });
		expect(result.combinationCount).toBe(3125);
		expect(result.combinations).toHaveLength(2000);
		expect(result.truncated).toBe(true);
	});
});
