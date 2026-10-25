import { toast } from 'svelte-sonner';
import { getBrandSettings } from '#lib/api/settings.js';
import { saveInvoicePdf, type PdfInvoice } from '#lib/utils/invoice-pdf.js';
import { saveQuotePdf, type PdfQuote } from '#lib/utils/quote-pdf.js';

async function openPath(path: string) {
	const { openPath } = await import('@tauri-apps/plugin-opener');
	await openPath(path);
}

async function revealPath(path: string) {
	const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
	await revealItemInDir(path);
}

/** Run a PDF save, then offer to open the file or show it in its folder. */
async function exportWithToast(save: () => Promise<string | null>) {
	try {
		const path = await save();
		if (!path) return;
		const name = path.split(/[\\/]/).pop() ?? path;
		toast.success(`Saved ${name}`, {
			action: { label: 'Open', onClick: () => void openPath(path) },
			cancel: { label: 'Show in folder', onClick: () => void revealPath(path) }
		});
	} catch (cause) {
		console.error(cause);
		toast.error('Could not export the PDF. Please try again.');
	}
}

export async function exportQuotePdf(quote: PdfQuote) {
	await exportWithToast(async () => saveQuotePdf(quote, await getBrandSettings()));
}

export async function exportInvoicePdf(invoice: PdfInvoice) {
	await exportWithToast(async () => saveInvoicePdf(invoice, await getBrandSettings()));
}
