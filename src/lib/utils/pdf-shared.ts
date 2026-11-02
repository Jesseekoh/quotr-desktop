import type {
	Content,
	ContentStack,
	ContentTable,
	TDocumentDefinitions,
	TableCell
} from 'pdfmake/interfaces';
import type { Customer } from '#lib/api/types.js';

// Building blocks shared by the quote and invoice PDFs so both look the same.

export type PdfBrand = {
	businessName: string | null;
	// PNG or JPEG data URL; pdfmake can't embed other formats.
	logo: string | null;
	email?: string | null;
	phone?: string | null;
	address?: string | null;
};

export type PdfCustomer = Pick<Customer, 'name' | 'email' | 'phone' | 'address'> | null | undefined;

export const COLORS = {
	text: '#171717',
	muted: '#737373',
	border: '#d4d4d4',
	rule: '#efefef'
};

export const dateFormatter = new Intl.DateTimeFormat('en-NG', {
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});

// No boxes: a rule under the header and faint separators between rows.
export const tableLayout: ContentTable['layout'] = {
	hLineWidth: (i) => (i === 0 ? 0 : 0.5),
	vLineWidth: () => 0,
	hLineColor: (i) => (i === 1 ? COLORS.border : COLORS.rule),
	paddingLeft: (i) => (i === 0 ? 0 : 8),
	paddingRight: (i, node) => (i === (node.table.widths?.length ?? 0) - 1 ? 0 : 8),
	paddingTop: () => 5,
	paddingBottom: () => 5
};

// A fresh row per table: pdfmake mutates cell objects while laying them out.
function headerRow(): TableCell[] {
	return [
		{ text: 'Items', style: 'th' },
		{ text: 'QTY', style: 'th', alignment: 'center' },
		{ text: 'Rate', style: 'th', alignment: 'right' },
		{ text: 'Total', style: 'th', alignment: 'right' }
	];
}

export function itemTable(body: TableCell[][]): ContentTable {
	return {
		table: {
			// Repeat the column header on every page the table spans.
			headerRows: 1,
			dontBreakRows: true,
			widths: ['*', 40, 'auto', 'auto'],
			body: [headerRow(), ...body]
		},
		layout: tableLayout
	};
}

export function totalLine(label: string, value: string): Content {
	return {
		margin: [0, 6, 0, 0],
		columns: [
			{ text: label, color: COLORS.muted },
			{ text: value, alignment: 'right', bold: true }
		]
	};
}

export function sectionHeading(text: string): Content {
	return { text, style: 'h2', headlineLevel: 1 };
}

export function spacer(): Content {
	return { text: '', margin: [0, 0, 0, 16] };
}

function brandBlock(brand: PdfBrand | null | undefined): ContentStack | null {
	const stack: Content[] = [];
	if (brand?.logo) stack.push({ image: brand.logo, fit: [160, 60] });
	if (brand?.businessName) {
		stack.push({ text: brand.businessName, bold: true, margin: [0, brand.logo ? 6 : 0, 0, 0] });
	}
	for (const line of [brand?.address, brand?.phone, brand?.email]) {
		if (line) stack.push({ text: line, style: 'label', margin: [0, 1, 0, 0] });
	}
	return stack.length > 0 ? { stack } : null;
}

// Title block ("Quote", "Invoice"), with the brand top-left when there is one.
export function documentHeader(
	title: string,
	numberLabel: string,
	number: string,
	brand: PdfBrand | null | undefined
): Content {
	const heading: Content[] = [
		{ text: title, style: 'h1' },
		{
			margin: [0, 6, 0, 0],
			text: [
				{ text: `${numberLabel}  `, color: COLORS.muted },
				{ text: number, bold: true }
			]
		}
	];
	const branding = brandBlock(brand);
	return branding
		? {
				margin: [0, 0, 0, 18],
				columns: [
					{ width: '*', ...branding },
					{ width: 'auto', stack: heading, alignment: 'right' }
				]
			}
		: { margin: [0, 0, 0, 14], stack: heading };
}

// Customer on the left, labelled dates (issued, due, ...) on the right.
export function billToBlock(
	customer: PdfCustomer,
	dates: [label: string, value: string][]
): Content {
	const billTo: Content[] = [
		{ text: 'Bill to', style: 'label' },
		{ text: customer?.name ?? 'Client', bold: true, margin: [0, 2, 0, 0] }
	];
	for (const line of [customer?.email, customer?.phone, customer?.address]) {
		if (line) billTo.push({ text: line, color: COLORS.muted });
	}
	return {
		margin: [0, 0, 0, 22],
		columns: [
			{ width: '*', stack: billTo },
			{
				width: 'auto',
				alignment: 'right',
				stack: dates.flatMap(([label, value], index): Content[] => [
					{ text: label, style: 'label', margin: [0, index > 0 ? 6 : 0, 0, 0] },
					{ text: value, bold: true, margin: [0, 2, 0, 0] }
				])
			}
		]
	};
}

// A right-aligned grand total under a full-width rule.
export function grandTotal(label: string, value: string): Content {
	return {
		margin: [0, 6, 0, 0],
		unbreakable: true,
		stack: [
			{
				canvas: [
					{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: COLORS.border }
				],
				margin: [0, 0, 0, 10]
			},
			{
				columns: [
					{ width: '*', text: '' },
					{ width: 'auto', text: label, color: COLORS.muted, margin: [0, 4, 16, 0] },
					{ width: 'auto', text: value, fontSize: 14, bold: true }
				]
			}
		]
	};
}

export function notesBlock(lines: string[]): Content {
	return {
		margin: [0, 24, 0, 0],
		unbreakable: true,
		stack: [{ text: 'Notes', style: 'h2' }, ...lines.map((text) => ({ text, color: COLORS.muted }))]
	};
}

export function documentShell(
	title: string,
	number: string,
	content: Content[]
): TDocumentDefinitions {
	return {
		info: { title: `${title} ${number}` },
		pageSize: 'A4',
		pageMargins: [40, 40, 40, 50],
		content,
		footer: (currentPage, pageCount) => ({
			margin: [40, 16, 40, 0],
			columns: [
				{ text: number, style: 'label' },
				{ text: `Page ${currentPage} of ${pageCount}`, style: 'label', alignment: 'right' }
			]
		}),
		// Keep a heading with its table instead of stranding it at a page bottom.
		pageBreakBefore: (node) =>
			node.headlineLevel === 1 && (node.startPosition?.verticalRatio ?? 0) > 0.85,
		defaultStyle: { font: 'Roboto', fontSize: 10, color: COLORS.text, lineHeight: 1.2 },
		styles: {
			h1: { fontSize: 24, bold: true },
			h2: { fontSize: 12, bold: true, margin: [0, 0, 0, 6] },
			th: { fontSize: 8.5, color: COLORS.muted },
			label: { fontSize: 8.5, color: COLORS.muted }
		}
	};
}

// pdfmake and its embedded fonts are ~1MB, so load them only on export.
async function renderPdf(doc: TDocumentDefinitions): Promise<Uint8Array> {
	const [{ default: pdfMake }, { default: vfs }] = await Promise.all([
		import('pdfmake/build/pdfmake'),
		import('pdfmake/build/vfs_fonts')
	]);
	pdfMake.addVirtualFileSystem(vfs);
	const blob = await pdfMake.createPdf(doc).getBlob();
	return new Uint8Array(await blob.arrayBuffer());
}

/**
 * Ask where to save with the native dialog, then write the PDF there.
 * Resolves to the saved path, or null when the user cancels the dialog.
 */
export async function savePdf(doc: TDocumentDefinitions, filename: string) {
	const [{ save }, { writeFile }] = await Promise.all([
		import('@tauri-apps/plugin-dialog'),
		import('@tauri-apps/plugin-fs')
	]);
	const path = await save({
		title: 'Save PDF',
		defaultPath: filename,
		filters: [{ name: 'PDF document', extensions: ['pdf'] }]
	});
	if (!path) return null;
	await writeFile(path, await renderPdf(doc));
	return path;
}
