<script lang="ts">
	import type { QuoteItem } from '#lib/api/types.js';
	import { formatNaira } from '#lib/utils/format.js';
	import { lineTotal } from '#lib/utils/quote-totals.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import DotsIcon from '@tabler/icons-svelte/icons/dots';

	let {
		items,
		destinations = [],
		onItemChange,
		onRemove,
		onMove
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
	} = $props();

	// Borderless until hover/focus so the table stays readable while signalling editability.
	const cellInput =
		'h-8 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input';

	// Descriptions wrap instead of clipping, but stay single-line: Enter commits.
	const descriptionInput = `${cellInput} h-auto min-h-8 resize-none py-1.5`;

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
		<div class="hidden overflow-x-auto @xl/items:block">
			<Table.Root>
				<Table.Header>
					<Table.Row
						class="hover:bg-transparent [&>th]:h-8 [&>th]:text-xs [&>th]:font-normal [&>th]:text-muted-foreground"
					>
						<Table.Head>Description</Table.Head>
						<Table.Head class="text-right">Qty</Table.Head>
						<Table.Head class="text-right">Unit price</Table.Head>
						<Table.Head class="text-right">Total</Table.Head>
						<Table.Head class="w-10"><span class="sr-only">Actions</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each items as item (item.id)}
						<Table.Row>
							<Table.Cell class="max-w-xs min-w-48 whitespace-normal">
								<Textarea
									rows={1}
									value={item.description}
									onchange={(e) => commitDescription(item, e)}
									onkeydown={blurOnEnter}
									aria-label="Description"
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
				<article class="rounded-md border p-3">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0 flex-1">
							<Textarea
								rows={1}
								value={item.description}
								onchange={(e) => commitDescription(item, e)}
								onkeydown={blurOnEnter}
								aria-label="Description"
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
