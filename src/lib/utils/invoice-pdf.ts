import type { Content, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';
import { formatNaira } from '#lib/utils/format.js';
import { groupInvoiceItems, type InvoiceLine } from '#lib/utils/invoice-items.js';
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
	totalLine,
	type PdfBrand,
	type PdfCustomer
} from '#lib/utils/pdf-shared.js';

export type PdfInvoice = {
	invoiceNumber: string;
	status: string;
	total: number;
	createdAt: string | Date;
	dueDate: string | Date | null;
	paymentTerms: string | null;
	notes: string | null;
	customer?: PdfCustomer;
	quote?: { quoteNumber: string } | null;
	items: InvoiceLine[];
};

function lineRow(line: InvoiceLine): TableCell[] {
	return [
		{ text: line.description },
		{ text: String(line.quantity), alignment: 'center' },
		{ text: formatNaira(line.unitPrice), alignment: 'right' },
		{ text: formatNaira(line.totalPrice), alignment: 'right' }
	];
}

export function buildInvoiceDocument(
	invoice: PdfInvoice,
	brand?: PdfBrand | null
): TDocumentDefinitions {
	const dates: [string, string][] = [['Issued', dateFormatter.format(new Date(invoice.createdAt))]];
	if (invoice.dueDate) dates.push(['Due', dateFormatter.format(new Date(invoice.dueDate))]);

	const content: Content[] = [
		documentHeader('Invoice', 'Invoice Number', invoice.invoiceNumber, brand),
		billToBlock(invoice.customer, dates)
	];

	for (const group of groupInvoiceItems(invoice.items)) {
		const body: TableCell[][] = [];
		for (const part of group.parts) {
			if (part.optionName) {
				body.push([
					{ text: part.optionName, colSpan: 4, bold: true, margin: [0, 6, 0, 0] },
					{},
					{},
					{}
				]);
			}
			body.push(...part.lines.map(lineRow));
		}
		content.push(sectionHeading(group.heading), itemTable(body));
		content.push(
			...(group.number !== null ? [totalLine('Total', formatNaira(group.total))] : []),
			spacer()
		);
	}

	content.push(
		grandTotal(invoice.status === 'PAID' ? 'Total paid' : 'Total due', formatNaira(invoice.total))
	);

	const notes = [
		invoice.paymentTerms ? `Payment terms: ${invoice.paymentTerms}` : null,
		invoice.notes,
		invoice.quote ? `Based on quote ${invoice.quote.quoteNumber}.` : null
	].filter((line): line is string => !!line);
	if (notes.length > 0) content.push(notesBlock(notes));

	if (invoice.status === 'VOID') {
		content.unshift({
			text: 'VOID',
			color: COLORS.muted,
			bold: true,
			alignment: 'right',
			margin: [0, 0, 0, 6]
		});
	}

	return documentShell('Invoice', invoice.invoiceNumber, content);
}

export function saveInvoicePdf(invoice: PdfInvoice, brand?: PdfBrand | null) {
	return savePdf(buildInvoiceDocument(invoice, brand), `${invoice.invoiceNumber}.pdf`);
}
