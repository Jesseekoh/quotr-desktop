<script lang="ts">
	import type { QuoteSection } from '#lib/api/types.js';
	import { formatNaira } from '#lib/utils/format.js';
	import { sectionRange } from '#lib/utils/quote-totals.js';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import DotsIcon from '@tabler/icons-svelte/icons/dots';
	import ItemsTable from './ItemsTable.svelte';
	import SectionOptionsTabs from './SectionOptionsTabs.svelte';
	import * as Card from '../ui/card/index.js';
	import { Button } from '../ui/button/index.js';
	import * as Dialog from '../ui/dialog/index.js';
	import * as DropdownMenu from '../ui/dropdown-menu/index.js';

	let sectionToRemove = $state<QuoteSection | null>(null);
	let showRemoveSectionDialog = $state(false);

	let {
		ungroupedItems,
		sections,
		onAddSection,
		onAddItem,
		onAddOption,
		onRenameOption,
		onRemoveOption,
		onRemoveSection,
		onItemChange,
		onRemoveItem,
		onMoveItem
	}: {
		ungroupedItems: QuoteSection['items'];
		sections: QuoteSection[];
		onAddSection: () => void;
		onAddItem: (sectionId: string | null, optionId: string | null) => void;
		onAddOption: (sectionId: string) => void;
		onRenameOption: (optionId: string, name: string) => void;
		onRemoveOption: (optionId: string) => void;
		onRemoveSection: (sectionId: string) => void;
		onItemChange: (
			itemId: string,
			patch: { description?: string; quantity?: number; unitPrice?: number }
		) => void;
		onRemoveItem: (itemId: string) => void;
		onMoveItem: (itemId: string, sectionId: string | null, optionId: string | null) => void;
	} = $props();

	function requestRemoveSection(section: QuoteSection) {
		sectionToRemove = section;
		showRemoveSectionDialog = true;
	}

	function confirmRemoveSection() {
		if (!sectionToRemove) return;
		onRemoveSection(sectionToRemove.id);
		showRemoveSectionDialog = false;
		sectionToRemove = null;
	}

	function sectionTotalLabel(section: QuoteSection) {
		const range = sectionRange(section);
		return range.min === range.max
			? formatNaira(range.min)
			: `${formatNaira(range.min)} – ${formatNaira(range.max)}`;
	}

	function sectionItemCount(section: QuoteSection) {
		return (
			section.items.length +
			section.options.reduce((count, option) => count + option.items.length, 0)
		);
	}
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Items</Card.Title>
		<Card.Action class="flex gap-1">
			<Button type="button" variant="ghost" size="sm" onclick={() => onAddItem(null, null)}>
				<PlusIcon class="size-4" />
				Item
			</Button>
			<Button type="button" variant="ghost" size="sm" onclick={onAddSection}>
				<PlusIcon class="size-4" />
				Section
			</Button>
		</Card.Action>
	</Card.Header>
	<Card.Content class="flex flex-col divide-y">
		{#if ungroupedItems.length === 0 && sections.length === 0}
			<p class="py-6 text-center text-sm text-muted-foreground">
				No items yet. Add an item, or create a section to organize them.
			</p>
		{/if}

		{#if ungroupedItems.length > 0}
			<section class="pb-6">
				{#if sections.length > 0}
					<h3 class="mb-2 text-sm font-medium text-muted-foreground">General items</h3>
				{/if}
				<ItemsTable
					items={ungroupedItems}
					destinations={[
						{ value: 'ungrouped', sectionId: null, optionId: null, label: 'General items' },
						...sections.map((section) => ({
							value: `section:${section.id}`,
							sectionId: section.id,
							optionId: null,
							label: section.name
						}))
					]}
					{onItemChange}
					onRemove={onRemoveItem}
					onMove={onMoveItem}
				/>
			</section>
		{/if}

		{#each sections as section, index (section.id)}
			<section class="py-6 first:pt-0 last:pb-0">
				<div class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
					<h3 class="mr-auto font-semibold">{index + 1}.0 {section.name}</h3>
					<div class="flex items-center gap-1">
						<span class="mr-1 text-sm font-medium tabular-nums">{sectionTotalLabel(section)}</span>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							class="text-muted-foreground"
							onclick={() => onAddItem(section.id, null)}
						>
							<PlusIcon class="size-4" />
							Item
						</Button>
						<DropdownMenu.Root>
							<DropdownMenu.Trigger>
								{#snippet child({ props })}
									<Button
										{...props}
										variant="ghost"
										size="icon"
										class="size-8 text-muted-foreground"
										aria-label={`Actions for ${section.name}`}
									>
										<DotsIcon class="size-4" />
									</Button>
								{/snippet}
							</DropdownMenu.Trigger>
							<DropdownMenu.Content align="end">
								<DropdownMenu.Item onclick={() => onAddOption(section.id)}
									>Add option</DropdownMenu.Item
								>
								<DropdownMenu.Separator />
								<DropdownMenu.Item
									variant="destructive"
									onclick={() => requestRemoveSection(section)}
								>
									Remove section
								</DropdownMenu.Item>
							</DropdownMenu.Content>
						</DropdownMenu.Root>
					</div>
				</div>
				{#if section.items.length > 0 || section.options.length === 0}
					<ItemsTable
						items={section.items}
						destinations={[
							{ value: 'ungrouped', sectionId: null, optionId: null, label: 'General items' },
							{
								value: `section:${section.id}:base`,
								sectionId: section.id,
								optionId: null,
								label: 'Included in all options'
							},
							...section.options.map((option, optionIndex) => ({
								value: `section:${section.id}:option:${option.id}`,
								sectionId: section.id,
								optionId: option.id,
								label: option.name.trim() || `Option ${String.fromCharCode(65 + optionIndex)}`
							}))
						]}
						{onItemChange}
						onRemove={onRemoveItem}
						onMove={onMoveItem}
					/>
				{/if}
				<SectionOptionsTabs
					{section}
					onAddOption={() => onAddOption(section.id)}
					onAddItem={(optionId) => onAddItem(section.id, optionId)}
					{onRenameOption}
					{onRemoveOption}
					{onItemChange}
					{onRemoveItem}
					{onMoveItem}
				/>
			</section>
		{/each}
	</Card.Content>
</Card.Root>

<Dialog.Root bind:open={showRemoveSectionDialog}>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Remove section?</Dialog.Title>
			<Dialog.Description>
				{#if sectionToRemove}
					This will remove “{sectionToRemove.name}” and its {sectionItemCount(sectionToRemove)}
					item{sectionItemCount(sectionToRemove) === 1 ? '' : 's'} and
					{sectionToRemove.options.length} option{sectionToRemove.options.length === 1 ? '' : 's'}.
					This action cannot be undone.
				{/if}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Dialog.Close>
				{#snippet child({ props })}
					<Button {...props} variant="secondary">Cancel</Button>
				{/snippet}
			</Dialog.Close>
			<Button type="button" variant="destructive" onclick={confirmRemoveSection}
				>Remove section</Button
			>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
