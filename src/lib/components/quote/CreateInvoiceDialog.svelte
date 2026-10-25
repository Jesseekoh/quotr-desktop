<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import type { QuoteItem, QuoteSection } from '#lib/api/types.js';
	import { createInvoiceFromQuote } from '#lib/api/invoices.js';
	import { errorMessage as messageFor } from '#lib/api/types.js';
	import { formatNaira } from '#lib/utils/format.js';
	import { quoteTotals, sectionTotalForOption } from '#lib/utils/quote-totals.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let {
		open = $bindable(false),
		quoteId,
		items,
		sections
	}: {
		open?: boolean;
		quoteId: string;
		items: QuoteItem[];
		sections: QuoteSection[];
	} = $props();

	const DEFAULT_DUE_DAYS = 14;

	let totals = $derived(quoteTotals({ items, sections }));
	// Only sections with a real choice; single-option sections are part of the fixed total.
	let choiceSections = $derived(sections.filter((section) => section.options.length >= 2));
	let selections = $state<Record<string, string>>({});
	let dueDate = $state(defaultDueDate());
	let creating = $state(false);

	let missing = $derived(choiceSections.filter((section) => !selections[section.id]));
	let total = $derived(
		choiceSections.reduce((sum, section) => {
			const option = section.options.find((candidate) => candidate.id === selections[section.id]);
			return option ? sum + sectionTotalForOption(section, option) : sum;
		}, totals.fixedTotal)
	);

	function defaultDueDate() {
		const date = new Date(Date.now() + DEFAULT_DUE_DAYS * 86_400_000);
		return date.toISOString().slice(0, 10);
	}

	function optionName(name: string, index: number) {
		return name.trim() || `Option ${String.fromCharCode(65 + index)}`;
	}

	async function create(event: Event) {
		event.preventDefault();
		if (missing.length > 0) {
			toast.error(`Choose an option for ${missing.map((section) => section.name).join(', ')}.`);
			return;
		}
		creating = true;
		try {
			const invoice = await createInvoiceFromQuote({
				quoteId,
				selections,
				dueDate: dueDate || null
			});
			open = false;
			toast.success(`Invoice ${invoice.invoiceNumber} created`);
			await goto(resolve('/(app)/invoices/[id]', { id: invoice.id }));
		} catch (e) {
			toast.error(messageFor(e, 'Failed to create the invoice'));
		} finally {
			creating = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
		<Dialog.Header>
			<Dialog.Title>Create invoice</Dialog.Title>
			<Dialog.Description>
				{choiceSections.length > 0
					? 'Pick the option the customer chose in each section. The invoice keeps a copy of these items.'
					: 'Every item on this quote is fixed, so the invoice will include all of them.'}
			</Dialog.Description>
		</Dialog.Header>

		<form id="create-invoice" class="flex flex-col gap-5" onsubmit={create}>
			{#each choiceSections as section (section.id)}
				<fieldset class="flex flex-col gap-2">
					<legend class="mb-2 text-sm font-medium">{section.name}</legend>
					{#each section.options as option, index (option.id)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors has-checked:border-foreground has-checked:bg-muted/50"
						>
							<input
								type="radio"
								name={`section-${section.id}`}
								value={option.id}
								bind:group={selections[section.id]}
								class="accent-foreground"
							/>
							<span class="flex-1">{optionName(option.name, index)}</span>
							<span class="text-muted-foreground tabular-nums">
								{formatNaira(sectionTotalForOption(section, option))}
							</span>
						</label>
					{/each}
				</fieldset>
			{/each}

			<Label class="flex flex-col items-start gap-2">
				<span>Due date (optional)</span>
				<Input type="date" bind:value={dueDate} class="w-48" />
			</Label>

			<div class="flex flex-col gap-1 border-t pt-4 text-sm">
				{#if choiceSections.length > 0}
					<div class="flex justify-between text-muted-foreground">
						<span>Fixed items</span>
						<span class="tabular-nums">{formatNaira(totals.fixedTotal)}</span>
					</div>
				{/if}
				<div class="flex items-baseline justify-between">
					<span class="font-semibold">Invoice total</span>
					<span class="text-lg font-bold tabular-nums">{formatNaira(total)}</span>
				</div>
				{#if missing.length > 0}
					<p class="text-xs text-muted-foreground">
						Choose an option in {missing.length} more section{missing.length === 1 ? '' : 's'}.
					</p>
				{/if}
			</div>
		</form>

		<Dialog.Footer>
			<Button type="button" variant="secondary" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit" form="create-invoice" disabled={creating || missing.length > 0}>
				{creating ? 'Creating…' : 'Create invoice'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
