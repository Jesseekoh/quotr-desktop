<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatNaira } from '#lib/utils/format.js';
	import InvoiceStatusBadge from '#lib/components/invoice/InvoiceStatusBadge.svelte';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import FileInvoiceIcon from '@tabler/icons-svelte/icons/file-invoice';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const dateFormatter = new Intl.DateTimeFormat('en-NG', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	let outstanding = $derived(
		data.invoices
			.filter((invoice) => invoice.status === 'UNPAID')
			.reduce((sum, invoice) => sum + invoice.total, 0)
	);
</script>

<svelte:head>
	<title>Invoices · Quotr</title>
</svelte:head>

<div class="flex flex-col gap-6 px-4 py-4 md:py-6 lg:px-6">
	<div class="flex flex-wrap items-end justify-between gap-3">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight">Invoices</h1>
			<p class="text-sm text-muted-foreground">
				Create an invoice from a quote once the customer has picked their options.
			</p>
		</div>
		{#if outstanding > 0}
			<div class="text-right">
				<div class="text-xs text-muted-foreground">Outstanding</div>
				<div class="text-lg font-semibold tabular-nums">{formatNaira(outstanding)}</div>
			</div>
		{/if}
	</div>

	{#if data.invoices.length === 0}
		<Empty.Root class="border py-16">
			<Empty.Header>
				<Empty.Media variant="icon"><FileInvoiceIcon /></Empty.Media>
				<Empty.Title>No invoices yet</Empty.Title>
				<Empty.Description>
					Open a quote and choose <span class="font-medium text-foreground">Create invoice</span> once
					the customer has picked their options.
				</Empty.Description>
			</Empty.Header>
		</Empty.Root>
	{:else}
		<div class="overflow-x-auto rounded-lg border">
			<Table.Root>
				<Table.Header>
					<Table.Row class="hover:bg-transparent">
						<Table.Head>Invoice</Table.Head>
						<Table.Head>Client</Table.Head>
						<Table.Head class="hidden md:table-cell">Quote</Table.Head>
						<Table.Head class="hidden sm:table-cell">Due</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head class="text-right">Total</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.invoices as invoice (invoice.id)}
						<Table.Row class="relative">
							<Table.Cell class="font-medium">
								<!-- The link covers the row so the whole row is clickable. -->
								<a
									href={resolve('/(app)/invoices/[id]', { id: invoice.id })}
									class="after:absolute after:inset-0"
								>
									{invoice.invoiceNumber}
								</a>
							</Table.Cell>
							<Table.Cell>{invoice.customer.name}</Table.Cell>
							<Table.Cell class="hidden text-muted-foreground md:table-cell">
								{invoice.quote?.quoteNumber ?? '—'}
							</Table.Cell>
							<Table.Cell class="hidden text-muted-foreground sm:table-cell">
								{invoice.dueDate ? dateFormatter.format(new Date(invoice.dueDate)) : '—'}
							</Table.Cell>
							<Table.Cell><InvoiceStatusBadge status={invoice.status} /></Table.Cell>
							<Table.Cell class="text-right font-medium tabular-nums">
								{formatNaira(invoice.total)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	{/if}
</div>
