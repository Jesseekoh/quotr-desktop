<script lang="ts">
	import type { QuoteItem } from '#lib/api/types.js';
	import { formatNaira } from '#lib/utils/format.js';
	import { lineTotal } from '#lib/utils/quote-totals.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import DotsIcon from '@tabler/icons-svelte/icons/dots';
	import LayersUnionIcon from '@tabler/icons-svelte/icons/layers-union';
	import { SvelteSet } from 'svelte/reactivity';

	let {
		items,
		destinations = [],
		onItemChange,
		onRemove,
		onMove,
		onCompress,
		focusItemId = null,
		onFocused
	}: {
		items: QuoteItem[];
		destinations?: {
			value: string;
			sectionId: string | null;
			optionId: string | null;
			label: string;
		}[];
		onItemChange: (
			itemId: string,
			patch: { description?: string; quantity?: number; unitPrice?: number }
		) => void;
		onRemove: (itemId: string) => void;
		onMove?: (itemId: string, sectionId: string | null, optionId: string | null) => void;
		/** Merge the given items (all from this table) into one line. Enables row selection. */
		onCompress?: (itemIds: string[]) => void;
		/** Item whose description should take focus once rendered, e.g. right after compressing. */
		focusItemId?: string | null;
		onFocused?: () => void;
	} = $props();

	// Selection is per table, so it always stays within one section/option.
	// Ids that leave the table (removed, moved, compressed) simply stop counting.
	const selected = new SvelteSet<string>();
	let selectedItems = $derived(items.filter((item) => selected.has(item.id)));
	let selectable = $derived(!!onCompress && items.length >= 2);
	let allSelected = $derived(selectable && selectedItems.length === items.length);
	let someSelected = $derived(selectedItems.length > 0 && !allSelected);

	function toggleItem(itemId: string, checked: boolean) {
		if (checked) selected.add(itemId);
		else selected.delete(itemId);
	}

	function toggleAll(checked: boolean) {
		selected.clear();
		if (checked) for (const item of items) selected.add(item.id);
	}

	function compressSelected() {
		if (!onCompress || selectedItems.length < 2) return;
		onCompress(selectedItems.map((item) => item.id));
		selected.clear();
	}

	// Focus and select the description so a freshly compressed line can be renamed straight away.
	// Both the table and card layouts render; focus() is a no-op on the hidden one.
	function focusWhen(shouldFocus: boolean) {
		return (textarea: HTMLTextAreaElement) => {
			if (!shouldFocus || textarea.offsetParent === null) return;
			textarea.focus();
			textarea.select();
			onFocused?.();
		};
	}

	// Borderless until hover/focus so the table stays readable while signalling editability.
	const cellInput =
		'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input';

	// Descriptions wrap instead of clipping, but stay single-line: Enter commits.
	const descriptionInput = `${cellInput} h-auto min-h-8 resize-none py-1.5`;

	// WebKit webviews don't support `field-sizing: content`, so grow the textarea
	// to fit its text manually — on typing and whenever the column width changes.
	function autosize(textarea: HTMLTextAreaElement) {
		const fit = () => {
			textarea.style.height = 'auto';
			textarea.style.height = `${textarea.scrollHeight + textarea.offsetHeight - textarea.clientHeight}px`;
		};
		fit();
		const observer = new ResizeObserver(fit);
		observer.observe(textarea);
		textarea.addEventListener('input', fit);
		return () => {
			observer.disconnect();
			textarea.removeEventListener('input', fit);
		};
	}

	function blurOnEnter(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		(event.currentTarget as HTMLElement).blur();
	}

	function commitDescription(item: QuoteItem, event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLTextAreaElement)) return;
		const value = input.value.trim();
		if (value && value !== item.description) onItemChange(item.id, { description: value });
		else input.value = item.description;
	}

	function commitQuantity(item: QuoteItem, event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const value = Number(input.value);
		if (Number.isInteger(value) && value > 0 && value !== item.quantity) {
			onItemChange(item.id, { quantity: value });
		} else {
			input.value = String(item.quantity);
		}
	}

	function commitUnitPrice(item: QuoteItem, event: Event) {
		const input = event.currentTarget;
		if (!(input instanceof HTMLInputElement)) return;
		const value = Number(input.value);
		if (Number.isFinite(value) && value >= 0 && value !== Number(item.unitPrice)) {
			onItemChange(item.id, { unitPrice: value });
		} else {
			input.value = String(item.unitPrice);
		}
	}

	function itemSublabel(item: QuoteItem) {
		// Catalog items usually copy the specification into the description, so
		// only repeat it when it adds something.
		const description = item.description.trim().toLowerCase();
		const specification = item.specification?.trim();
		const specIsNew =
			specification && !description.includes(specification.toLowerCase().replace(/\.$/, ''));
		return [item.brand, specIsNew ? specification : null].filter(Boolean).join(' · ');
	}

	function currentDestination(item: QuoteItem) {
		return (
			destinations.find(
				(destination) =>
					destination.sectionId === item.quoteSectionId &&
					destination.optionId === item.quoteOptionId
			)?.value ?? ''
		);
	}

	function handleMove(item: QuoteItem, value: string) {
		const destination = destinations.find((candidate) => candidate.value === value);
		if (destination && onMove) onMove(item.id, destination.sectionId, destination.optionId);
	}
</script>

{#snippet itemMenu(item: QuoteItem)}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					size="icon"
					class="size-8 text-muted-foreground"
					aria-label={`Actions for ${item.description}`}
				>
					<DotsIcon class="size-4" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-52">
			{#if onMove && destinations.length > 1}
				<DropdownMenu.Sub>
					<DropdownMenu.SubTrigger>Move to</DropdownMenu.SubTrigger>
					<DropdownMenu.SubContent class="w-56">
						<DropdownMenu.RadioGroup
							value={currentDestination(item)}
							onValueChange={(value) => handleMove(item, value)}
						>
							{#each destinations as destination (destination.value)}
								<DropdownMenu.RadioItem value={destination.value}>
									{destination.label}
								</DropdownMenu.RadioItem>
							{/each}
						</DropdownMenu.RadioGroup>
					</DropdownMenu.SubContent>
				</DropdownMenu.Sub>
				<DropdownMenu.Separator />
			{/if}
			<DropdownMenu.Item variant="destructive" onclick={() => onRemove(item.id)}>
				Remove item
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{/snippet}

{#if items.length === 0}
	<p class="py-3 text-sm text-muted-foreground">No items yet.</p>
{:else}
	<div class="@container/items">
		{#if selectedItems.length > 0}
			<div
				class="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-background/70 px-3 py-1.5 text-sm"
				role="toolbar"
				aria-label="Selected items"
			>
				<span class="font-medium">{selectedItems.length} selected</span>
				<span class="text-muted-foreground tabular-nums">
					{formatNaira(selectedItems.reduce((total, item) => total + lineTotal(item), 0))}
				</span>
				<div class="ml-auto flex items-center gap-1">
					<Button type="button" variant="ghost" size="sm" onclick={() => selected.clear()}>
						Clear
					</Button>
					<Button
						type="button"
						size="sm"
						disabled={selectedItems.length < 2}
						title={selectedItems.length < 2 ? 'Select at least two items' : undefined}
						onclick={compressSelected}
					>
						<LayersUnionIcon class="size-4" />
						Compress into one line
					</Button>
				</div>
			</div>
		{/if}
		<div class="hidden overflow-x-auto @xl/items:block">
			<Table.Root>
				<Table.Header>
					<Table.Row
						class="hover:bg-transparent [&>th]:h-8 [&>th]:text-xs [&>th]:font-normal [&>th]:text-muted-foreground"
					>
						{#if selectable}
							<Table.Head class="w-8 pr-0">
								<Checkbox
									checked={allSelected}
									indeterminate={someSelected}
									onCheckedChange={toggleAll}
									aria-label="Select all items"
								/>
							</Table.Head>
						{/if}
						<Table.Head>Description</Table.Head>
						<Table.Head class="text-right">Qty</Table.Head>
						<Table.Head class="text-right">Unit price</Table.Head>
						<Table.Head class="text-right">Total</Table.Head>
						<Table.Head class="w-10"><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each items as item (item.id)}
						<Table.Row data-state={selected.has(item.id) ? 'selected' : undefined}>
							{#if selectable}
								<Table.Cell class="w-8 pr-0 align-top">
									<Checkbox
										class="mt-2"
										checked={selected.has(item.id)}
										onCheckedChange={(checked) => toggleItem(item.id, checked)}
										aria-label={`Select ${item.description}`}
									/>
								</Table.Cell>
							{/if}
							<Table.Cell class="max-w-xs min-w-48 whitespace-normal">
								<Textarea
									rows={1}
									value={item.description}
									onchange={(e) => commitDescription(item, e)}
									onkeydown={blurOnEnter}
									aria-label="Description"
									{@attach autosize}
									{@attach focusWhen(item.id === focusItemId)}
									class={descriptionInput}
								/>
								{#if itemSublabel(item)}
									<div
										class="mt-0.5 px-2 text-xs wrap-break-word whitespace-normal text-muted-foreground"
									>
										{itemSublabel(item)}
									</div>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<Input
									type="number"
									min="1"
									step="1"
									value={item.quantity}
									onchange={(e) => commitQuantity(item, e)}
									aria-label={`Quantity for ${item.description}`}
									class="ml-auto w-20 text-right {cellInput}"
								/>
							</Table.Cell>
							<Table.Cell class="text-right">
								<Input
									type="number"
									min="0"
									step="1"
									value={item.unitPrice}
									onchange={(e) => commitUnitPrice(item, e)}
									aria-label={`Unit price for ${item.description}`}
									class="ml-auto w-24 text-right {cellInput}"
								/>
							</Table.Cell>
							<Table.Cell class="text-right font-medium tabular-nums"
								>{formatNaira(lineTotal(item))}</Table.Cell
							>
							<Table.Cell class="text-right">
								{@render itemMenu(item)}
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>

		<div class="flex flex-col gap-3 @xl/items:hidden">
			{#each items as item (item.id)}
				<article class="rounded-md border p-3 {selected.has(item.id) ? 'bg-muted' : ''}">
					<div class="flex items-start justify-between gap-3">
						{#if selectable}
							<Checkbox
								class="mt-2"
								checked={selected.has(item.id)}
								onCheckedChange={(checked) => toggleItem(item.id, checked)}
								aria-label={`Select ${item.description}`}
							/>
						{/if}
						<div class="min-w-0 flex-1">
							<Textarea
								rows={1}
								value={item.description}
								onchange={(e) => commitDescription(item, e)}
								onkeydown={blurOnEnter}
								aria-label="Description"
								{@attach autosize}
								{@attach focusWhen(item.id === focusItemId)}
								class={descriptionInput}
							/>
							{#if itemSublabel(item)}
								<p class="mt-0.5 px-2 text-xs wrap-break-word text-muted-foreground">
									{itemSublabel(item)}
								</p>
							{/if}
						</div>
						{@render itemMenu(item)}
					</div>

					<div class="mt-3 grid grid-cols-2 gap-3 text-sm">
						<label class="flex flex-col gap-1">
							<span class="text-xs text-muted-foreground">Quantity</span>
							<Input
								type="number"
								min="1"
								step="1"
								value={item.quantity}
								onchange={(e) => commitQuantity(item, e)}
								class="{cellInput} border-input"
							/>
						</label>
						<label class="flex flex-col gap-1">
							<span class="text-xs text-muted-foreground">Unit price</span>
							<Input
								type="number"
								min="0"
								step="1"
								value={item.unitPrice}
								onchange={(e) => commitUnitPrice(item, e)}
								class="{cellInput} border-input"
							/>
						</label>
						<div class="col-span-2 flex items-center justify-between">
							<span class="text-xs text-muted-foreground">Total</span>
							<span class="font-semibold tabular-nums">{formatNaira(lineTotal(item))}</span>
						</div>
					</div>
				</article>
			{/each}
		</div>
	</div>
{/if}
