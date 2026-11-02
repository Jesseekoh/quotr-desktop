<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import ArrowLeftIcon from '@tabler/icons-svelte/icons/arrow-left';
	import FileDownIcon from '@tabler/icons-svelte/icons/file-download';
	import DotsIcon from '@tabler/icons-svelte/icons/dots';
	import { removeInvoice, updateInvoiceStatus } from '#lib/api/invoices.js';
	import type { InvoiceStatus } from '#lib/api/types.js';
	import { confirm } from '#lib/hooks/confirm.svelte.js';
	import { shortcuts } from '#lib/hooks/shortcuts.js';
	import { exportInvoicePdf } from '#lib/utils/export.js';
	import InvoicePreview from '#lib/components/invoice/InvoicePreview.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Writable derived: follows fresh loads, but status changes can replace it locally.
	let invoice = $derived(data.invoice);
	let busy = $state(false);

	const STATUS_OPTIONS: { value: InvoiceStatus; label: string }[] = [
		{ value: 'UNPAID', label: 'Unpaid' },
		{ value: 'PAID', label: 'Paid' },
		{ value: 'VOID', label: 'Void' }
	];

	async function changeStatus(value: string) {
		const status = value as InvoiceStatus;
		if (status === invoice.status) return;
		busy = true;
		try {
			invoice = await updateInvoiceStatus({ id: invoice.id, status });
			toast.success(`Marked as ${STATUS_OPTIONS.find((o) => o.value === status)?.label}`);
		} catch {
			toast.error('Failed to update the invoice status');
		} finally {
			busy = false;
		}
	}

	async function exportPdf() {
		busy = true;
		try {
			await exportInvoicePdf(invoice);
		} finally {
			busy = false;
		}
	}

	async function remove() {
		const confirmed = await confirm({
			title: `Delete ${invoice.invoiceNumber}?`,
			description:
				'The invoice will be removed. The quote it came from is kept. This cannot be undone.',
			confirmLabel: 'Delete invoice',
			destructive: true
		});
		if (!confirmed) return;
		busy = true;
		try {
			await removeInvoice(invoice.id);
			toast.success('Invoice deleted');
			await goto(resolve('/invoices'), { invalidateAll: true });
		} catch {
			toast.error('Failed to delete the invoice');
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{invoice.invoiceNumber} · Quotr</title>
</svelte:head>

<svelte:window onkeydown={shortcuts({ 'mod+e': exportPdf })} />

<div class="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4 md:py-6 lg:px-6">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<Button href={resolve('/invoices')} variant="ghost" size="sm" class="-ml-2">
			<ArrowLeftIcon class="size-4" />
			Invoices
		</Button>
		<div class="flex items-center gap-2">
			<Select.Root
				type="single"
				value={invoice.status}
				onValueChange={changeStatus}
				disabled={busy}
			>
				<Select.Trigger aria-label="Invoice status" class="h-8 w-28">
					{STATUS_OPTIONS.find((option) => option.value === invoice.status)?.label}
				</Select.Trigger>
				<Select.Content>
					{#each STATUS_OPTIONS as option (option.value)}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<Button
				type="button"
				variant="outline"
				size="sm"
				onclick={exportPdf}
				disabled={busy}
				title="Export PDF (Ctrl+E)"
			>
				<FileDownIcon class="size-4" />
				Export PDF
			</Button>
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button {...props} variant="ghost" size="icon" class="size-8" aria-label="More actions">
							<DotsIcon class="size-4" />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end">
					{#if invoice.quote}
						<DropdownMenu.Item
							onSelect={() => goto(resolve('/(app)/quotes/[id]', { id: invoice.quote!.id }))}
						>
							Open quote {invoice.quote.quoteNumber}
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
					{/if}
					<DropdownMenu.Item variant="destructive" onSelect={remove}
						>Delete invoice</DropdownMenu.Item
					>
				</DropdownMenu.Content>
			</DropdownMenu.Root>
		</div>
	</div>

	<InvoicePreview {invoice} brand={data.brand} />
</div>
