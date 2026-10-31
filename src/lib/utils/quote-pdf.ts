import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import type { QuoteItem, QuoteOption, QuoteSection } from '#lib/api/types.js';
import { formatNaira } from '#lib/utils/format.js';
import { itemDescription } from '#lib/utils/quotes.js';
import { lineTotal, optionTotal, quoteTotals, sectionRange } from '#lib/utils/quote-totals.js';
import {
	COLORS,
	billToBlock,
	dateFormatter,
	documentHeader,
	documentShell,
	savePdf,
	grandTotal,
	itemTable,
	notesBlock,
	sectionHeading,
	spacer,
	tableLayout,
	totalLine,
	type PdfBrand,
	type PdfCustomer
} from '#lib/utils/pdf-shared.js';

export type { PdfBrand } from '#lib/utils/pdf-shared.js';

// Accepts the raw quote (flat items, sections with options) from either the
// API client or the remote layer; sections are grouped here like the preview.
export type PdfQuote = {
	quoteNumber: string;
	loadProfileTotal: string | number | null;
	loadProfileNotes: string | null;
	showBrand?: boolean;
	createdAt?: string | Date;
	customer?: PdfCustomer;
	items?: QuoteItem[];
	sections?: (Pick<QuoteSection, 'id' | 'name'> & { options?: QuoteOption[] })[];
};

function groupSections(quote: PdfQuote): QuoteSection[] {
	const items = quote.items ?? [];
	return (quote.sections ?? []).map((section) => ({
		...section,
		quoteId: '',
		sortOrder: 0,
		items: items.filter(
			(item) => item.quoteSectionId === section.id && item.quoteOptionId === null
		),
		options: (section.options ?? []).map((option) => ({
			...option,
			items: items.filter((item) => item.quoteOptionId === option.id)
		}))
	}));
}

function rangeLabel(min: number, max: number) {
	return min === max ? formatNaira(min) : `${formatNaira(min)} – ${formatNaira(max)}`;
}

function itemRow(item: QuoteItem, showBrand: boolean): TableCell[] {
	return [
		{ text: itemDescription(item, showBrand) },
		{ text: String(item.quantity), alignment: 'center' },
		{ text: formatNaira(item.unitPrice), alignment: 'right' },
		{ text: formatNaira(lineTotal(item)), alignment: 'right' }
	];
}

function emptyRow(): TableCell[] {
	return [{ text: 'No items.', colSpan: 4, color: COLORS.muted }, {}, {}, {}];
}

export function buildQuoteDocument(quote: PdfQuote, brand?: PdfBrand | null): TDocumentDefinitions {
	const sections = groupSections(quote);
	const totals = quoteTotals({ items: quote.items ?? [], sections });
	const commonItems = (quote.items ?? []).filter((item) => item.quoteSectionId === null);
	const issuedDate = quote.createdAt ? dateFormatter.format(new Date(quote.createdAt)) : '—';
	const row = (item: QuoteItem) => itemRow(item, quote.showBrand ?? true);
	const content: Content[] = [];

	content.push(
		documentHeader('Quote', 'Quote Number', quote.quoteNumber, brand),
		billToBlock(quote.customer, [['Date', issuedDate]])
	);

	if (commonItems.length > 0) {
		content.push(sectionHeading('Common items'), itemTable(commonItems.map(row)), spacer());
	}

	sections.forEach((section, index) => {
		const body: TableCell[][] = section.items.map(row);
		section.options.forEach((option, optionIndex) => {
			const name = option.name || 'Option';
			body.push([
				{
					text: `${optionIndex > 0 ? 'OR · ' : ''}${name}`,
					colSpan: 4,
					bold: true,
					margin: [0, 6, 0, 0]
				},
				{},
				{},
				{}
			]);
			body.push(...option.items.map(row));
			body.push([
				{ text: `Subtotal · ${name}`, colSpan: 3, alignment: 'right', color: COLORS.muted },
				{},
				{},
				{ text: formatNaira(optionTotal(option)), alignment: 'right', bold: true }
			]);
		});
		if (body.length === 0) body.push(emptyRow());

		const range = sectionRange(section);
		content.push(
			sectionHeading(`${index + 1}.0 ${section.name}`),
			itemTable(body),
			totalLine('Total', rangeLabel(range.min, range.max)),
			spacer()
		);
	});

	const hasChoices = totals.combinations.some((combination) => combination.parts.length > 0);
	if (!hasChoices) {
		content.push(grandTotal('Total', formatNaira(totals.fixedTotal)));
	} else {
		// Every combination = fixed items + the chosen option of each section with choices.
		content.push(sectionHeading('Total'), {
			table: {
				headerRows: 1,
				dontBreakRows: true,
				widths: ['*', 'auto'],
				body: [
					[
						{ text: 'Fixed items', color: COLORS.muted },
						{ text: formatNaira(totals.fixedTotal), alignment: 'right' }
					],
					...totals.combinations.map((combination): TableCell[] => [
						{
							stack: [
								{ text: combination.label, bold: true },
								{
									text: [totals.fixedTotal, ...combination.parts.map((part) => part.total)]
										.map((value) => formatNaira(value))
										.join(' + '),
									style: 'label'
								}
							]
						},
						{ text: formatNaira(combination.total), alignment: 'right', bold: true }
					])
				]
			},
			layout: tableLayout
		});
		if (totals.truncated) {
			content.push({
				text: `Showing ${totals.combinations.length} of ${totals.combinationCount} combinations.`,
				style: 'label',
				margin: [0, 4, 0, 0]
			});
		}
	}

	if (quote.loadProfileTotal !== null || quote.loadProfileNotes) {
		const loadTotal = quote.loadProfileTotal !== null ? formatNaira(quote.loadProfileTotal) : '';
		content.push(notesBlock([`Load profile: ${loadTotal} ${quote.loadProfileNotes ?? ''}`.trim()]));
	}

	return documentShell('Quote', quote.quoteNumber, content);
}

export function saveQuotePdf(quote: PdfQuote, brand?: PdfBrand | null) {
	return savePdf(buildQuoteDocument(quote, brand), `${quote.quoteNumber}.pdf`);
}
