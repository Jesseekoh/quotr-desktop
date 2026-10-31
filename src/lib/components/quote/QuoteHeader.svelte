<script lang="ts">
	import type { Snippet } from 'svelte';
	import FileDownIcon from '@tabler/icons-svelte/icons/file-download';
	import FileInvoiceIcon from '@tabler/icons-svelte/icons/file-invoice';
	import type { PriceLabel, QuoteStatus } from '#lib/api/types.js';
	import type { QuoteDetail } from '#lib/api/quotes.js';
	import { PRICE_LABEL_OPTIONS } from '#lib/utils/pricing.js';
	import { exportQuotePdf } from '#lib/utils/export.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Switch from '#lib/components/ui/switch/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let {
		quote,
		onLabelChange,
		onStatusChange,
		onShowBrandChange,
		showPreview,
		onShowPreviewChange,
		onCreateInvoice,
		disabled = false,
		children
	}: {
		quote: QuoteDetail;
		onLabelChange: (label: PriceLabel) => void;
		onStatusChange: (status: QuoteStatus) => void;
		onShowBrandChange: (show: boolean) => void;
		showPreview: boolean;
		onShowPreviewChange: (show: boolean) => void;
		onCreateInvoice: () => void;
		disabled?: boolean;
		// Extra quote-level fields shown beside the price label.
		children?: Snippet;
	} = $props();

	const STATUS_OPTIONS: { value: QuoteStatus; label: string }[] = [
		{ value: 'DRAFT', label: 'Draft' },
		{ value: 'SENT', label: 'Sent' },
		{ value: 'ACCEPTED', label: 'Accepted' },
		{ value: 'REJECTED', label: 'Rejected' }
	];

	function handleChange(value: string) {
		const nextLabel = value as PriceLabel;
		if (nextLabel !== quote.label) onLabelChange(nextLabel);
	}

	function handleStatusChange(value: string) {
		const nextStatus = value as QuoteStatus;
		if (nextStatus !== quote.status) onStatusChange(nextStatus);
	}

	let exporting = $state(false);

	async function exportPdf() {
		exporting = true;
		try {
			await exportQuotePdf(quote);
		} finally {
			exporting = false;
		}
	}
</script>

<Card.Root>
	<Card.Header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<Card.Title class="text-2xl">{quote.quoteNumber}</Card.Title>
			<Card.Description>
				{quote.customer.name}
				{#if quote.customer.phone || quote.customer.email}
					<span> · {quote.customer.phone ?? quote.customer.email}</span>
				{/if}
			</Card.Description>
		</div>
		<div class="flex flex-wrap items-center justify-end gap-3">
			<div class="flex items-center gap-2">
				<Switch.Root
					id="quote-preview-toggle"
					checked={showPreview}
					onCheckedChange={onShowPreviewChange}
					{disabled}
				/>
				<Label for="quote-preview-toggle">Show preview</Label>
			</div>
			<div class="flex items-center gap-2">
				<Switch.Root
					id="quote-brand-toggle"
					checked={quote.showBrand}
					onCheckedChange={onShowBrandChange}
					{disabled}
				/>
				<Label for="quote-brand-toggle" title="Print each item's brand in its description">
					Show brand
				</Label>
			</div>
			<Button
				type="button"
				variant="outline"
				onclick={exportPdf}
				disabled={exporting}
				title="Export PDF (Ctrl+E)"
			>
				<FileDownIcon class="size-4" />
				{exporting ? 'Exporting…' : 'Export PDF'}
			</Button>
			<Button type="button" onclick={onCreateInvoice} {disabled}>
				<FileInvoiceIcon class="size-4" />
				Create invoice
			</Button>
			<Select.Root type="single" value={quote.status} onValueChange={handleStatusChange} {disabled}>
				<Select.Trigger
					aria-label="Quote status"
					class="h-7 w-auto rounded-full border px-3 text-xs font-medium capitalize"
				>
					{STATUS_OPTIONS.find((option) => option.value === quote.status)?.label}
				</Select.Trigger>
				<Select.Content>
					{#each STATUS_OPTIONS as option (option.value)}
						<Select.Item value={option.value}>{option.label}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
	</Card.Header>
	<Card.Content class="flex-row flex-wrap items-end gap-4">
		<div class="flex w-full flex-col gap-2 sm:w-48">
			<Label for="quote-price-label">Price label</Label>
			<Select.Root type="single" value={quote.label} onValueChange={handleChange} {disabled}>
				<Select.Trigger
					id="quote-price-label"
					class="w-full"
					title="Changing this re-prices every catalog item on the quote."
				>
					{PRICE_LABEL_OPTIONS.find((option) => option.value === quote.label)?.text}
				</Select.Trigger>
				<Select.Content>
					{#each PRICE_LABEL_OPTIONS as opt (opt.value)}
						<Select.Item value={opt.value}>{opt.text}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		{@render children?.()}
	</Card.Content>
</Card.Root>
