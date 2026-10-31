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
const templates = await import('./templates.js');
const dashboard = await import('./dashboard.js');
const { parseWorkbook } = await import('#lib/utils/product-import.js');
const { priceFromMarkup } = await import('#lib/utils/markups.js');
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
	it('parses a price-list workbook, imports it, then updates on re-import', async () => {
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
			updated: 0,
			pricesChanged: 0,
			skipped: 0,
			brandMerges: []
		});
		expect(await products.importProducts({ products: parsed[0].products })).toMatchObject({
			inserted: 0,
			updated: 2,
			pricesChanged: 0
		});
		expect(
			await products.importProducts({ products: parsed[0].products, skipExisting: true })
		).toMatchObject({ inserted: 0, updated: 0, skipped: 2 });
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
		const categories = await products.getCategories();
		expect(categories.find((c) => c.id === 'INVERTER')).toMatchObject({
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

function workbook(sheets: Record<string, unknown[][]>) {
	const book = XLSX.utils.book_new();
	for (const [name, rows] of Object.entries(sheets)) {
		XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), name);
	}
	const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
	return new File([bytes], 'prices.xlsx');
}

function rowsFor(sheets: Awaited<ReturnType<typeof parseWorkbook>>) {
	return sheets.flatMap((sheet) =>
		sheet.products.map(({ detectedCategory, ...p }) => ({
			...p,
			category: detectedCategory ?? sheet.category
		}))
	);
}

describe('price rounding', () => {
	it('rounds half-up to the step like MROUND', () => {
		// Values from the workbook: cost → MROUND(cost * (1 + margin), 1000).
		expect(priceFromMarkup(390_000, 2500, 1000)).toBe(488_000);
		expect(priceFromMarkup(185_000, 2500, 1000)).toBe(231_000);
		expect(priceFromMarkup(470_000, 1500, 1000)).toBe(541_000);
		expect(priceFromMarkup(390_000, 2500, 1)).toBe(487_500);
	});
});

describe('categories and re-import', () => {
	const HEADER = [
		'Brand',
		'Type',
		'Specification',
		'Capacity',
		'End User Price',
		'Discount Price',
		'Resale Price',
		'Special Price',
		'Cost Price',
		'Supplier',
		'Last Updated'
	];
	const MARKUP_ROW = ['', '', '', '', 0.3, 0.25, 0.2, 0.15];
	// 2025-05-17 as an Excel date serial.
	const MAY_2025 = 45_794;

	it('sorts rows by their Type column and keeps hand-typed prices', async () => {
		const parsed = await parseWorkbook(
			workbook({
				Inverter: [
					MARKUP_ROW,
					HEADER,
					[
						'Deye',
						'Inverter Hybrid',
						'5KW 48V Hybrid',
						5,
						507_000,
						488_000,
						468_000,
						449_000,
						390_000,
						'Ade',
						MAY_2025
					],
					['Upsen', 'UPS', '3KVA Online UPS', 3, 0, 0, 0, 0, 200_000, 0, MAY_2025],
					['Vectronic', 'AVR 3 Phase', '30KVA AVR', 30, 0, 0, 0, 0, 100_000, 0, MAY_2025],
					['Sorotec', 'Invertert String', '10KW String', 10, 0, 0, 0, 0, 100_000, 0, MAY_2025],
					// Prices that don't follow the sheet's markup row were typed in by hand.
					[
						'Smk/Proton',
						'Hybrid Inverter ',
						'3KW 24V',
						3,
						999_000,
						900_000,
						800_000,
						700_000,
						300_000,
						0,
						MAY_2025
					]
				],
				'Stacking Kit': [
					MARKUP_ROW,
					[
						'Brand',
						'Specification',
						'End User Price',
						'Discount Price',
						'Resale Price',
						'Special Price',
						'Cost Price'
					],
					['Victron', 'Cerbo GX', 0, 0, 0, 0, 150_000],
					['Warranty', 'Warranty Extension from 2 to 5 Years', 0, 0, 0, 0, 50_000],
					['Victron', 'RJ45 Cable', 0, 0, 0, 0, 5_000]
				]
			})
		);
		const rows = rowsFor(parsed);
		expect(rows.map((r) => [r.brand, r.category])).toEqual([
			['Deye', 'HYBRID_INVERTER'],
			['Upsen', 'UPS'],
			['Vectronic', 'AVR_ATS'],
			['Sorotec', 'STRING_INVERTER'],
			['Smk/Proton', 'HYBRID_INVERTER'],
			['Victron', 'MONITORING'],
			['Warranty', 'SERVICE'],
			['Victron', 'ACCESSORY']
		]);
		expect(rows[0]).toMatchObject({ supplier: 'Ade', manualPrices: null });
		expect(rows[0].priceUpdatedAt?.toISOString().slice(0, 10)).toBe('2025-05-17');
		expect(rows[1].supplier).toBeNull();
		expect(rows[4].manualPrices).toMatchObject({ enduserPrice: 999_000 });

		// As the import dialog does: the Inverter sheet's markup row goes to its category.
		await products.importProducts({
			products: rows,
			markups: [{ category: 'INVERTER', ...parsed[0].markup! }]
		});
		const [deye] = await products.getProducts({ search: '5KW 48V Hybrid' });
		expect(deye).toMatchObject({
			categoryName: 'Hybrid Inverter',
			enduserPrice: 507_000,
			discountPrice: 488_000,
			manualPrices: false
		});
		const [smk] = await products.getProducts({ search: '3KW 24V' });
		expect(smk).toMatchObject({ enduserPrice: 999_000, manualPrices: true });

		// A parent category filter includes its subcategories.
		const inverters = await products.getProducts({ category: 'INVERTER' });
		expect(inverters.map((p) => p.brand)).toEqual(
			expect.arrayContaining(['Deye', 'Sorotec', 'Smk/Proton'])
		);
		expect(inverters.map((p) => p.brand)).not.toContain('Upsen');
	});

	it('updates costs on re-import and folds brand spellings together', async () => {
		const plan = await products.importProducts({
			dryRun: true,
			products: [
				{
					brand: 'DEYE',
					category: 'HYBRID_INVERTER',
					specification: '5KW 48V Hybrid',
					warranty: 'N/A',
					costPrice: 400_000,
					supplier: 'Ade',
					priceUpdatedAt: new Date('2026-01-02'),
					technicalSpecs: { capacity: 5 },
					manualPrices: null
				}
			]
		});
		expect(plan).toEqual({
			inserted: 0,
			updated: 1,
			pricesChanged: 1,
			skipped: 0,
			brandMerges: [{ from: 'DEYE', to: 'Deye' }]
		});
		// Dry runs write nothing.
		expect((await products.getProducts({ search: '5KW 48V Hybrid' }))[0].costPrice).toBe(390_000);

		await products.importProducts({
			products: [
				{
					brand: 'DEYE',
					category: 'HYBRID_INVERTER',
					specification: '5KW 48V Hybrid',
					warranty: 'N/A',
					costPrice: 400_000,
					supplier: 'Ade',
					priceUpdatedAt: new Date('2026-01-02'),
					technicalSpecs: { capacity: 5 },
					manualPrices: null
				}
			]
		});
		const [deye] = await products.getProducts({ search: '5KW 48V Hybrid' });
		expect(deye).toMatchObject({ brand: 'Deye', costPrice: 400_000, enduserPrice: 520_000 });
		expect(deye.priceUpdatedAt?.toISOString().slice(0, 10)).toBe('2026-01-02');
	});

	it('reprices subcategories that inherit, and leaves manual prices alone', async () => {
		const { updatedProducts } = await products.updateMarkup({
			category: 'INVERTER',
			enduserPct: 5000,
			discountPct: 4000,
			resalePct: 3000,
			specialPct: 2000
		});
		expect(updatedProducts).toBeGreaterThan(0);
		const [deye] = await products.getProducts({ search: '5KW 48V Hybrid' });
		expect(deye.enduserPrice).toBe(600_000);
		const [smk] = await products.getProducts({ search: '3KW 24V' });
		expect(smk.enduserPrice).toBe(999_000);

		// A subcategory's own markups, then back to inheriting.
		await products.updateMarkup({
			category: 'HYBRID_INVERTER',
			enduserPct: 1000,
			discountPct: 1000,
			resalePct: 1000,
			specialPct: 1000
		});
		expect((await products.getProducts({ search: '5KW 48V Hybrid' }))[0].enduserPrice).toBe(
			440_000
		);
		const hybrid = (await products.getCategories()).find((c) => c.id === 'HYBRID_INVERTER');
		expect(hybrid).toMatchObject({ inherited: false, enduserPct: 1000 });

		await products.updateMarkup({
			category: 'HYBRID_INVERTER',
			inherit: true,
			enduserPct: 0,
			discountPct: 0,
			resalePct: 0,
			specialPct: 0
		});
		expect((await products.getProducts({ search: '5KW 48V Hybrid' }))[0].enduserPrice).toBe(
			600_000
		);

		// The rounding step reprices too: 400,000 * 1.5 is already a round number, 10% isn't.
		await products.updateMarkup({
			category: 'UPS',
			enduserPct: 1234,
			discountPct: 1000,
			resalePct: 1000,
			specialPct: 1000
		});
		expect((await products.getProducts({ search: 'Online UPS' }))[0].enduserPrice).toBe(225_000);
		await products.updatePriceRoundingStep(1);
		expect((await products.getProducts({ search: 'Online UPS' }))[0].enduserPrice).toBe(224_680);
		await products.updatePriceRoundingStep(1000);
	});

	it('deletes several products at once', async () => {
		const before = await products.countProducts();
		const victron = await products.getProducts({ brand: 'Victron' });
		expect(victron).toHaveLength(2);
		await products.deleteProducts(victron.map((p) => p.id));
		await products.deleteProducts([]);
		expect(await products.getProducts({ brand: 'Victron' })).toHaveLength(0);
		expect(await products.countProducts()).toBe(before - 2);
	});

	it('adds and deletes categories', async () => {
		const { id } = await products.createCategory({ name: 'Generator' });
		expect(id).toBe('GENERATOR');
		const { id: childId } = await products.createCategory({ name: 'Diesel', parentId: id });
		const categories = await products.getCategories();
		expect(categories.find((c) => c.id === childId)).toMatchObject({
			parentId: 'GENERATOR',
			inherited: true,
			enduserPct: 3000
		});
		await expect(products.createCategory({ name: 'generator' })).rejects.toThrow(/already exists/);
		await expect(products.deleteCategory(id)).rejects.toThrow(/subcategories/);
		await products.deleteCategory(childId);
		await products.deleteCategory(id);
		await expect(products.deleteCategory('UPS')).rejects.toThrow(/Move its products/);
		await expect(
			products.createProduct({
				brand: 'X',
				category: 'NOPE',
				specification: 'Y',
				costPrice: 1,
				enduserPrice: 1,
				discountPrice: 1,
				resalePrice: 1,
				specialPrice: 1
			})
		).rejects.toThrow(/category that exists/);
	});
});

describe('quote templates', () => {
	it('saves a quote as a template and starts new quotes from it', async () => {
		const customer = await customers.createCustomer({ name: 'Template Customer' });
		const [inverter] = await products.getProducts({ search: 'growatt' });
		const { id: quoteId } = await quotes.createQuote({
			customerId: customer.id,
			label: 'ENDUSER_PRICE',
			paymentTerms: '70% upfront'
		});
		await quotes.updateQuote({ id: quoteId, showBrand: false });
		await quotes.addItem({ quoteId, data: { description: 'Installation', unitPrice: 50_000 } });
		let quote = await quotes.addSection({ quoteId, name: 'Batteries' });
		const sectionId = quote.sections[0].id;
		quote = await quotes.addOption({ quoteId, quoteSectionId: sectionId, name: '2 batteries' });
		quote = await quotes.addOption({ quoteId, quoteSectionId: sectionId, name: '4 batteries' });
		const [twoBatteries, fourBatteries] = quote.sections[0].options;
		await quotes.addItem({
			quoteId,
			data: { productId: inverter.id, quantity: 2 },
			quoteSectionId: sectionId,
			quoteOptionId: twoBatteries.id
		});
		await quotes.addItem({
			quoteId,
			data: { description: 'Battery rack', unitPrice: 30_000 },
			quoteSectionId: sectionId,
			quoteOptionId: fourBatteries.id
		});

		const saved = await templates.saveQuoteAsTemplate({
			quoteId,
			name: '  10kVA inverter with battery options '
		});
		expect(saved).toMatchObject({ name: '10kVA inverter with battery options', showBrand: false });
		expect(templates.templateItemCount(saved.content)).toBe(3);

		// Saving under the same name (any case) replaces rather than duplicates.
		await quotes.addItem({ quoteId, data: { description: 'Cabling', unitPrice: 20_000 } });
		const replaced = await templates.saveQuoteAsTemplate({
			quoteId,
			name: '10KVA INVERTER WITH BATTERY OPTIONS'
		});
		expect(replaced.id).toBe(saved.id);
		expect(templates.templateItemCount(replaced.content)).toBe(4);
		expect(await templates.getTemplates()).toHaveLength(1);

		const other = await templates.saveQuoteAsTemplate({ quoteId, name: 'Other' });
		await expect(
			templates.renameTemplate({ id: other.id, name: '10kva inverter with battery options' })
		).rejects.toThrow(/already exists/);
		await templates.removeTemplate(other.id);

		// A new quote copies the layout and re-prices catalog items for its own label.
		const second = await customers.createCustomer({ name: 'Second Customer' });
		const created = await templates.createQuoteFromTemplate({
			templateId: saved.id,
			customerId: second.id,
			label: 'RESALE_PRICE'
		});
		const fromTemplate = await quotes.getQuote(created.id);
		expect(fromTemplate).toMatchObject({
			customerId: second.id,
			label: 'RESALE_PRICE',
			status: 'DRAFT',
			showBrand: false,
			paymentTerms: '70% upfront'
		});
		expect(
			fromTemplate.items.filter((item) => !item.quoteSectionId).map((i) => i.description)
		).toEqual(['Installation', 'Cabling']);
		const [section] = fromTemplate.sections;
		expect(section.name).toBe('Batteries');
		expect(section.options.map((option) => option.name)).toEqual(['2 batteries', '4 batteries']);
		const [catalogItem] = section.options[0].items;
		const resalePrice = (await products.getProducts({ search: 'growatt' }))[0].resalePrice;
		expect(catalogItem).toMatchObject({
			productId: inverter.id,
			unitPrice: resalePrice,
			totalPrice: resalePrice * 2
		});
		expect(section.options[1].items[0]).toMatchObject({
			description: 'Battery rack',
			unitPrice: 30_000
		});
	});
});
