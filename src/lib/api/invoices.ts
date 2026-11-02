import { asc, desc, eq } from 'drizzle-orm';
import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import type { InvoiceStatus } from '#lib/db/schema.js';
import { generateInvoiceNumber } from '#lib/utils/invoices.js';
import { AppError } from './types.js';

type QuoteItem = typeof table.quoteItem.$inferSelect;
type NewInvoiceItem = Omit<typeof table.invoiceItem.$inferInsert, 'invoiceId'>;

export async function getInvoices() {
	return db.query.invoice.findMany({
		orderBy: desc(table.invoice.createdAt),
		with: {
			customer: true,
			quote: { columns: { id: true, quoteNumber: true } }
		}
	});
}

export type InvoiceDetail = Awaited<ReturnType<typeof getInvoice>>;

export async function getInvoice(id: string) {
	const invoice = await db.query.invoice.findFirst({
		where: eq(table.invoice.id, id),
		with: {
			customer: true,
			quote: { columns: { id: true, quoteNumber: true } },
			items: { orderBy: asc(table.invoiceItem.sortOrder) }
		}
	});
	if (!invoice) throw new AppError(404, `Invoice ${id} not found`);
	return invoice;
}

export async function createInvoiceFromQuote({
	quoteId,
	selections,
	dueDate
}: {
	quoteId: string;
	// sectionId -> chosen optionId, for every section with two or more options.
	selections: Record<string, string>;
	// YYYY-MM-DD from a date input.
	dueDate?: string | null;
}) {
	const quote = await db.query.quote.findFirst({
		where: eq(table.quote.id, quoteId),
		with: {
			items: true,
			sections: {
				orderBy: [asc(table.quoteSection.sortOrder), asc(table.quoteSection.createdAt)],
				with: {
					options: {
						orderBy: [asc(table.quoteOption.sortOrder), asc(table.quoteOption.createdAt)]
					}
				}
			}
		}
	});
	if (!quote) throw new AppError(404, `Quote ${quoteId} not found`);

	const lines: NewInvoiceItem[] = [];
	const addLines = (
		items: QuoteItem[],
		sectionName: string | null = null,
		optionName: string | null = null
	) => {
		for (const item of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
			lines.push({
				sectionName,
				optionName,
				description: item.description,
				brand: item.brand,
				specification: item.specification,
				quantity: item.quantity,
				unit: item.unit,
				unitPrice: item.unitPrice,
				totalPrice: item.quantity * item.unitPrice,
				sortOrder: lines.length
			});
		}
	};

	// Same rules as quoteTotals: items outside sections always apply, a section
	// with one option always includes it, and a section with more needs a choice.
	addLines(quote.items.filter((item) => item.quoteSectionId === null));
	for (const section of quote.sections) {
		const sectionItems = quote.items.filter((item) => item.quoteSectionId === section.id);
		addLines(
			sectionItems.filter((item) => item.quoteOptionId === null),
			section.name
		);
		if (section.options.length === 0) continue;
		const option =
			section.options.length === 1
				? section.options[0]
				: section.options.find((candidate) => candidate.id === selections[section.id]);
		if (!option) throw new AppError(400, `Choose an option for “${section.name}”`);
		addLines(
			sectionItems.filter((item) => item.quoteOptionId === option.id),
			section.name,
			option.name.trim() || 'Option'
		);
	}
	if (lines.length === 0) throw new AppError(400, 'This quote has no items to invoice');

	const total = lines.reduce((sum, line) => sum + line.totalPrice, 0);
	return db.transaction(async (tx) => {
		const [invoice] = await tx
			.insert(table.invoice)
			.values({
				invoiceNumber: generateInvoiceNumber(),
				quoteId: quote.id,
				customerId: quote.customerId,
				total,
				dueDate: dueDate ? new Date(dueDate) : null,
				paymentTerms: quote.paymentTerms,
				notes: quote.notes
			})
			.returning();
		await tx
			.insert(table.invoiceItem)
			.values(lines.map((line) => ({ ...line, invoiceId: invoice.id })));
		// The customer has picked their options, so the quote is accepted.
		if (quote.status !== 'ACCEPTED') {
			await tx
				.update(table.quote)
				.set({ status: 'ACCEPTED', acceptedAt: new Date() })
				.where(eq(table.quote.id, quote.id));
		}
		return invoice;
	});
}

export async function updateInvoiceStatus({ id, status }: { id: string; status: InvoiceStatus }) {
	const [invoice] = await db
		.update(table.invoice)
		.set({ status, paidAt: status === 'PAID' ? new Date() : null })
		.where(eq(table.invoice.id, id))
		.returning();
	if (!invoice) throw new AppError(404, `Invoice ${id} not found`);
	return getInvoice(id);
}

export async function removeInvoice(id: string) {
	const [invoice] = await db
		.delete(table.invoice)
		.where(eq(table.invoice.id, id))
		.returning({ id: table.invoice.id });
	if (!invoice) throw new AppError(404, `Invoice ${id} not found`);
}
