<script lang="ts">
	import { formatNaira } from '#lib/utils/format.js';
	import { groupInvoiceItems } from '#lib/utils/invoice-items.js';
	import type { PdfInvoice } from '#lib/utils/invoice-pdf.js';
	import type { BrandSettings } from '#lib/api/types.js';
	import BrandHeader from '#lib/components/brand-header.svelte';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Table from '#lib/components/ui/table/index.js';

	let { invoice, brand = null }: { invoice: PdfInvoice; brand?: BrandSettings | null } = $props();

	let groups = $derived(groupInvoiceItems(invoice.items));

	const dateFormatter = new Intl.DateTimeFormat('en-NG', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
</script>

<Card.Root>
	<Card.Content class="flex flex-col gap-6 p-6">
		{#if invoice.status === 'VOID'}
			<span class="-mb-4 self-end text-sm font-semibold text-muted-foreground">VOID</span>
		{/if}
		<BrandHeader
			{brand}
			title="Invoice"
			numberLabel="Invoice Number"
			number={invoice.invoiceNumber}
		/>

		<div class="grid gap-4 text-sm sm:grid-cols-2">
			<div>
				<div class="text-xs text-muted-foreground">Bill to</div>
				<div class="mt-1 font-medium">{invoice.customer?.name ?? 'Client'}</div>
				{#each [invoice.customer?.email, invoice.customer?.phone, invoice.customer?.address] as line, index (index)}
					{#if line}<div class="text-muted-foreground">{line}</div>{/if}
				{/each}
			</div>
			<div class="flex flex-col gap-2 sm:text-right">
				<div>
					<div class="text-xs text-muted-foreground">Issued</div>
					<div class="mt-1 font-medium">{dateFormatter.format(new Date(invoice.createdAt))}</div>
				</div>
				{#if invoice.dueDate}
					<div>
						<div class="text-xs text-muted-foreground">Due</div>
						<div class="mt-1 font-medium">{dateFormatter.format(new Date(invoice.dueDate))}</div>
					</div>
				{/if}
			</div>
		</div>

		{#each groups as group (group.heading)}
			<section class="flex flex-col gap-2">
				<h2 class="font-semibold">{group.heading}</h2>
				<div class="overflow-x-auto">
					<Table.Root>
						<Table.Header>
							<Table.Row
								class="hover:bg-transparent [&>th]:h-8 [&>th]:text-xs [&>th]:font-normal [&>th]:text-muted-foreground"
							>
								<Table.Head>Items</Table.Head>
								<Table.Head class="text-center">QTY</Table.Head>
								<Table.Head class="text-right">Rate</Table.Head>
								<Table.Head class="text-right">Total</Table.Head>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{#each group.parts as part, partIndex (partIndex)}
								{#if part.optionName}
									<Table.Row class="hover:bg-transparent">
										<Table.Cell colspan={4} class="pt-4 font-medium">{part.optionName}</Table.Cell>
									</Table.Row>
								{/if}
								{#each part.lines as line (line.id)}
									<Table.Row>
										<Table.Cell class="max-w-56 wrap-break-word whitespace-normal">
											{line.description}
										</Table.Cell>
										<Table.Cell class="text-center tabular-nums">{line.quantity}</Table.Cell>
										<Table.Cell class="text-right tabular-nums"
											>{formatNaira(line.unitPrice)}</Table.Cell
										>
										<Table.Cell class="text-right tabular-nums"
											>{formatNaira(line.totalPrice)}</Table.Cell
										>
									</Table.Row>
								{/each}
							{/each}
						</Table.Body>
					</Table.Root>
				</div>
				{#if group.number !== null}
					<div class="flex items-center justify-between gap-3 px-2 text-sm">
						<span class="text-muted-foreground">Total</span>
						<span class="font-semibold tabular-nums">{formatNaira(group.total)}</span>
					</div>
				{/if}
			</section>
		{/each}

		<section class="flex items-baseline justify-end gap-6 border-t pt-5">
			<span class="text-sm text-muted-foreground">
				{invoice.status === 'PAID' ? 'Total paid' : 'Total due'}
			</span>
			<span class="text-xl font-bold tabular-nums">{formatNaira(invoice.total)}</span>
		</section>

		{#if invoice.paymentTerms || invoice.notes || invoice.quote}
			<section class="flex flex-col gap-1 text-sm">
				<h2 class="font-semibold">Notes</h2>
				{#if invoice.paymentTerms}
					<p class="text-muted-foreground">Payment terms: {invoice.paymentTerms}</p>
				{/if}
				{#if invoice.notes}<p class="text-muted-foreground">{invoice.notes}</p>{/if}
				{#if invoice.quote}
					<p class="text-muted-foreground">Based on quote {invoice.quote.quoteNumber}.</p>
				{/if}
			</section>
		{/if}
	</Card.Content>
</Card.Root>
