import { beforeAll, describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { mockIPC } from '@tauri-apps/api/mocks';
import { fakeInvoke } from '#lib/test/fake-libsql.js';

// Tauri's IPC mock expects a browser global.
globalThis.window ??= globalThis as typeof globalThis & Window;
mockIPC((command, args) => fakeInvoke(command, args as Parameters<typeof fakeInvoke>[1]));

const { initDatabase } = await import('#lib/db/index.js');
const settings = await import('./settings.js');
const products = await import('./products.js');
const customers = await import('./customers.js');
const quotes = await import('./quotes.js');
const invoices = await import('./invoices.js');
const dashboard = await import('./dashboard.js');
const { parseWorkbook } = await import('#lib/utils/product-import.js');
const { quoteTotals } = await import('#lib/utils/quote-totals.js');

beforeAll(async () => {
	await initDatabase();
});

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('onboarding', () => {
	it('starts un-onboarded and saves business details', async () => {
		expect((await settings.getBrandSettings()).onboardedAt).toBeNull();

		await settings.updateBrandSettings({
			businessName: '  Sunrise Solar  ',
			email: 'sales@sunrise.ng',
			phone: '',
			logo: PNG
		});
		const saved = await settings.getBrandSettings();
		expect(saved).toMatchObject({
			businessName: 'Sunrise Solar',
			email: 'sales@sunrise.ng',
			phone: null,
			logo: PNG,
			onboardedAt: null
		});

		await settings.completeOnboarding({ address: '1 Marina, Lagos' });
		const done = await settings.getBrandSettings();
		expect(done.onboardedAt).toBeInstanceOf(Date);
		// Fields left out of a later save are kept.
		expect(done).toMatchObject({ businessName: 'Sunrise Solar', address: '1 Marina, Lagos' });
	});

	it('rejects logos that are not PNG or JPEG data URLs', async () => {
		await expect(
			settings.updateBrandSettings({ logo: 'data:image/svg+xml;base64,PHN2Zz4=' })
		).rejects.toThrow(/PNG or JPEG/);
	});
});

describe('product catalog', () => {
	it('parses a price-list workbook and imports it, skipping duplicates', async () => {
		const sheet = XLSX.utils.aoa_to_sheet([
			[0.3, 0.25, 0.2, 0.15],
			[
				'Brand',
				'Specification',
				'Warranty',
				'Cost Price',
				'End User Price',
				'Discount Price',
				'Resale Price',
				'Special Price'
			],
			['Growatt', '5kVA 48V Hybrid Inverter', 2, 500_000, 650_000, 625_000, 600_000, 575_000],
			['Felicity', '3.5kVA 24V Inverter', 0, 300_000, 390_000, 375_000, 360_000, 345_000],
			['', '', '', '', '', '', '', '']
		]);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, sheet, 'Inverter');
		const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
		const parsed = await parseWorkbook(new File([bytes], 'prices.xlsx'));

		expect(parsed).toHaveLength(1);
		expect(parsed[0]).toMatchObject({
			category: 'INVERTER',
			markup: { enduserPct: 3000, discountPct: 2500, resalePct: 2000, specialPct: 1500 }
		});
		expect(parsed[0].products.map((p) => [p.brand, p.warranty])).toEqual([
			['Growatt', '2 Years'],
			['Felicity', 'N/A']
		]);

		expect(await products.importProducts({ products: parsed[0].products })).toEqual({
			inserted: 2,
			skipped: 0
		});
		expect(await products.importProducts({ products: parsed[0].products })).toEqual({
			inserted: 0,
			skipped: 2
		});
		expect(await products.countProducts()).toBe(2);
	});

	it('filters, recalculates from markups, and soft-deletes', async () => {
		const [growatt] = await products.getProducts({ search: 'growatt' });
		expect(growatt.specification).toContain('5kVA');
		expect(await products.getProducts({ category: 'BATTERY' })).toHaveLength(0);

		const { updatedProducts } = await products.updateMarkup({
			category: 'INVERTER',
			enduserPct: 4000,
			discountPct: 3000,
			resalePct: 2000,
			specialPct: 1000
		});
		expect(updatedProducts).toBe(2);
		const [repriced] = await products.getProducts({ search: 'growatt' });
		expect(repriced.enduserPrice).toBe(700_000);
		const markups = await products.getMarkups();
		expect(markups.find((m) => m.category === 'INVERTER')).toMatchObject({
			enduserPct: 4000,
			productCount: 2
		});

		await products.updateProduct({ id: repriced.id, costPrice: 600_000, recalcPrices: true });
		const [updated] = await products.getProducts({ search: 'growatt' });
		expect(updated).toMatchObject({
			costPrice: 600_000,
			enduserPrice: 840_000,
			specialPrice: 660_000
		});

		const [felicity] = await products.getProducts({ search: 'felicity' });
		await products.deleteProduct(felicity.id);
		expect(await products.getProducts({ search: 'felicity' })).toHaveLength(0);
		expect(await products.countProducts()).toBe(1);
	});
});

describe('quotes and invoices', () => {
	it('builds a quote with sections and options, then invoices the chosen option', async () => {
		const customer = await customers.createCustomer({ name: 'Ada Obi', phone: '0803' });
		expect((await customers.searchCustomers('ada'))[0].id).toBe(customer.id);

		const created = await quotes.createQuote({ customerId: customer.id, label: 'ENDUSER_PRICE' });
		const quoteId = created.id;
		const [inverter] = await products.getProducts({ search: 'growatt' });

		// Ungrouped item, then a section with two options.
		let quote = await quotes.addItem({
			quoteId,
			data: { description: 'Installation', unitPrice: 50_000 }
		});
		quote = await quotes.addSection({ quoteId, name: 'Inverter' });
		const sectionId = quote.sections[0].id;
		quote = await quotes.addOption({
			quoteId,
			quoteSectionId: sectionId,
			name: 'Inverter option 1'
		});
		quote = await quotes.addOption({
			quoteId,
			quoteSectionId: sectionId,
			name: 'Inverter option 2'
		});
		const [optionA, optionB] = quote.sections[0].options;

		quote = await quotes.addItem({
			quoteId,
			data: { productId: inverter.id, quantity: 2 },
			quoteSectionId: sectionId,
			quoteOptionId: optionA.id
		});
		quote = await quotes.addItem({
			quoteId,
			data: { description: 'Budget inverter', unitPrice: 400_000 },
			quoteSectionId: sectionId,
			quoteOptionId: optionB.id
		});
		quote = await quotes.addItem({
			quoteId,
			data: { description: 'Breaker', unitPrice: 10_000 },
			quoteSectionId: sectionId
		});

		const [section] = quote.sections;
		expect(section.items.map((item) => item.description)).toEqual(['Breaker']);
		expect(section.options.map((option) => option.items.length)).toEqual([1, 1]);
		expect(section.options[0].items[0]).toMatchObject({
			unitPrice: 840_000,
			totalPrice: 1_680_000
		});

		const totals = quoteTotals(quote);
		expect(totals.overallMin).toBe(50_000 + 10_000 + 400_000);
		expect(totals.overallMax).toBe(50_000 + 10_000 + 1_680_000);

		// Switching the price label re-prices catalog items only.
		quote = await quotes.updateQuote({ id: quoteId, label: 'SPECIAL_PRICE' });
		expect(quote.sections[0].options[0].items[0].unitPrice).toBe(660_000);

		// Moving the breaker into option B, and back out to the section.
		const breaker = quote.sections[0].items[0];
		quote = await quotes.updateItem({
			quoteId,
			id: breaker.id,
			quoteSectionId: sectionId,
			quoteOptionId: optionB.id
		});
		expect(quote.sections[0].items).toHaveLength(0);
		quote = await quotes.updateItem({ quoteId, id: breaker.id, quoteOptionId: null });
		expect(quote.sections[0].items).toHaveLength(1);

		await expect(invoices.createInvoiceFromQuote({ quoteId, selections: {} })).rejects.toThrow(
			/Choose an option/
		);

		const invoice = await invoices.createInvoiceFromQuote({
			quoteId,
			selections: { [sectionId]: optionB.id },
			dueDate: '2026-12-01'
		});
		expect(invoice.total).toBe(50_000 + 10_000 + 400_000);
		const detail = await invoices.getInvoice(invoice.id);
		expect(
			detail.items.map((line) => [line.sectionName, line.optionName, line.description])
		).toEqual([
			[null, null, 'Installation'],
			['Inverter', null, 'Breaker'],
			['Inverter', 'Inverter option 2', 'Budget inverter']
		]);
		expect((await quotes.getQuote(quoteId)).status).toBe('ACCEPTED');

		const paid = await invoices.updateInvoiceStatus({ id: invoice.id, status: 'PAID' });
		expect(paid.paidAt).toBeInstanceOf(Date);

		// Deep copy, then delete the original: cascades remove its rows, the invoice stays.
		const copy = await quotes.duplicateQuote(quoteId);
		const copied = await quotes.getQuote(copy.id);
		expect(copied.status).toBe('DRAFT');
		expect(copied.items).toHaveLength(4);
		expect(copied.sections[0].options.map((o) => o.name)).toEqual([
			'Inverter option 1',
			'Inverter option 2'
		]);

		await quotes.removeQuote(quoteId);
		await expect(quotes.getQuote(quoteId)).rejects.toThrow(/not found/);
		expect((await invoices.getInvoice(invoice.id)).quoteId).toBeNull();

		const afterRemove = await quotes.removeSection({ quoteId: copy.id, id: copied.sections[0].id });
		expect(afterRemove.sections).toHaveLength(0);
		expect(afterRemove.items.map((item) => item.description)).toEqual(['Installation']);
	});

	it('reports dashboard stats for sent quotes', async () => {
		const [quote] = await quotes.getQuotes();
		await quotes.updateQuote({ id: quote.id, status: 'SENT' });

		const stats = await dashboard.getDashboardStats('7d');
		expect(stats.chart).toHaveLength(7);
		expect(stats.cards.sent.current).toBe(1);
		expect(stats.cards.awaiting).toEqual({ count: 1, value: 50_000 });

		const recent = await dashboard.getRecentQuotes('SENT');
		expect(recent.counts.SENT).toBe(1);
		expect(recent.rows[0]).toMatchObject({ customerName: 'Ada Obi', totalMin: 50_000 });
	});
});
