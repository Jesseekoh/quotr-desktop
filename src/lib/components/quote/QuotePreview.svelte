<script lang="ts">
	import type {
		BrandSettings,
		Customer,
		PriceLabel,
		QuoteItem,
		QuoteSection
	} from '#lib/api/types.js';
	import BrandHeader from '#lib/components/brand-header.svelte';
	import { formatNaira } from '#lib/utils/format.js';
	import { itemDescription } from '#lib/utils/quotes.js';
	import { lineTotal, optionTotal, quoteTotals, sectionRange } from '#lib/utils/quote-totals.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import PriceCombinations from './PriceCombinations.svelte';

	type PreviewQuote = {
		quoteNumber: string;
		label: PriceLabel;
		loadProfileTotal: number | null;
		loadProfileNotes: string | null;
		showBrand: boolean;
		createdAt?: string | Date;
		customer?: Pick<Customer, 'name' | 'email' | 'phone' | 'address'>;
		items: QuoteItem[];
		sections: QuoteSection[];
	};

	let {
		quote,
		brand = null,
		sticky = true
	}: { quote: PreviewQuote; brand?: BrandSettings | null; sticky?: boolean } = $props();

	let totals = $derived(quoteTotals(quote));
	let commonItems = $derived(quote.items.filter((item) => item.quoteSectionId === null));
	let hasLoadProfile = $derived(quote.loadProfileTotal !== null || !!quote.loadProfileNotes);

	const dateFormatter = new Intl.DateTimeFormat('en-NG', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
	let issuedDate = $derived(
		quote.createdAt ? dateFormatter.format(new Date(quote.createdAt)) : '—'
	);

	function sectionTotalLabel(section: QuoteSection) {
		const range = sectionRange(section);
		return range.min === range.max
			? formatNaira(range.min)
			: `${formatNaira(range.min)} – ${formatNaira(range.max)}`;
	}
</script>

{#snippet tableHeader()}
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
{/snippet}

{#snippet itemRow(item: QuoteItem)}
	<Table.Row>
		<Table.Cell class="max-w-56 wrap-break-word whitespace-normal">
			{itemDescription(item, quote.showBrand)}
		</Table.Cell>
		<Table.Cell class="text-center tabular-nums">{item.quantity}</Table.Cell>
		<Table.Cell class="text-right tabular-nums">{formatNaira(item.unitPrice)}</Table.Cell>
		<Table.Cell class="text-right tabular-nums">{formatNaira(lineTotal(item))}</Table.Cell>
	</Table.Row>
{/snippet}

{#snippet itemTable(items: QuoteItem[])}
	<div class="overflow-x-auto">
		<Table.Root>
			{@render tableHeader()}
			<Table.Body>
				{#if items.length === 0}
					<Table.Row>
						<Table.Cell colspan={4} class="py-4 text-muted-foreground">No items.</Table.Cell>
					</Table.Row>
				{:else}
					{#each items as item (item.id)}
						{@render itemRow(item)}
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
{/snippet}

{#snippet sectionTable(section: QuoteSection)}
	<div class="overflow-x-auto">
		<Table.Root>
			{@render tableHeader()}
			<Table.Body>
				{#if section.items.length === 0 && section.options.length === 0}
					<Table.Row>
						<Table.Cell colspan={4} class="py-4 text-muted-foreground">No items.</Table.Cell>
					</Table.Row>
				{/if}
				{#each section.items as item (item.id)}
					{@render itemRow(item)}
				{/each}
				{#each section.options as option, optionIndex (option.id)}
					<Table.Row class="hover:bg-transparent">
						<Table.Cell colspan={4} class="pt-4 font-medium">
							{optionIndex > 0 ? 'OR · ' : ''}{option.name || 'Option'}
						</Table.Cell>
					</Table.Row>
					{#each option.items as item (item.id)}
						{@render itemRow(item)}
					{/each}
					<Table.Row>
						<Table.Cell colspan={3} class="text-right text-muted-foreground">
							Subtotal · {option.name || 'Option'}
						</Table.Cell>
						<Table.Cell class="text-right font-medium tabular-nums"
							>{formatNaira(optionTotal(option))}</Table.Cell
						>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
{/snippet}

<Card.Root class={sticky ? 'md:sticky md:top-4 md:max-h-[calc(100vh-6rem)] md:overflow-auto' : ''}>
	<Card.Content class="flex flex-col gap-6 p-6">
		<BrandHeader {brand} title="Quote" numberLabel="Quote Number" number={quote.quoteNumber} />

		<div class="grid gap-4 text-sm sm:grid-cols-2">
			<div>
				<div class="text-xs text-muted-foreground">Bill to</div>
				<div class="mt-1 font-medium">{quote.customer?.name ?? 'Client'}</div>
				{#each [quote.customer?.email, quote.customer?.phone, quote.customer?.address] as line, index (index)}
					{#if line}<div class="text-muted-foreground">{line}</div>{/if}
				{/each}
			</div>
			<div class="sm:text-right">
				<div class="text-xs text-muted-foreground">Date</div>
				<div class="mt-1 font-medium">{issuedDate}</div>
			</div>
		</div>

		{#if commonItems.length > 0}
			<section class="flex flex-col gap-2">
				<h2 class="font-semibold">Common items</h2>
				{@render itemTable(commonItems)}
			</section>
		{/if}

		{#each quote.sections as section, index (section.id)}
			<section class="flex flex-col gap-2">
				<h2 class="font-semibold">{index + 1}.0 {section.name}</h2>
				{@render sectionTable(section)}
				<div class="flex items-center justify-between gap-3 px-2 text-sm">
					<span class="text-muted-foreground">Total</span>
					<span class="font-semibold tabular-nums">{sectionTotalLabel(section)}</span>
				</div>
			</section>
		{/each}

		<section class="flex flex-col gap-3 border-t pt-5">
			<h2 class="font-semibold">Total</h2>
			<PriceCombinations {totals} />
		</section>

		{#if hasLoadProfile}
			<section class="flex flex-col gap-1 text-sm">
				<h2 class="font-semibold">Notes</h2>
				<p class="text-muted-foreground">
					Load profile:
					{quote.loadProfileTotal !== null ? formatNaira(quote.loadProfileTotal) : ''}
					{quote.loadProfileNotes}
				</p>
			</section>
		{/if}
	</Card.Content>
</Card.Root>
