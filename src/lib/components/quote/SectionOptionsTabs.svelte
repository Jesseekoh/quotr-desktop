<script lang="ts">
	import type { QuoteSection } from '#lib/api/types.js';
	import { formatNaira } from '#lib/utils/format.js';
	import { optionTotal } from '#lib/utils/quote-totals.js';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import DotsIcon from '@tabler/icons-svelte/icons/dots';
	import ItemsTable from './ItemsTable.svelte';
	import * as Tabs from '../ui/tabs/index.js';
	import * as DropdownMenu from '../ui/dropdown-menu/index.js';
	import { Button } from '../ui/button/index.js';
	import { Input } from '../ui/input/index.js';
	import { confirm } from '#lib/hooks/confirm.svelte.js';

	let {
		section,
		onAddOption,
		onAddItem,
		onRenameOption,
		onRemoveOption,
		onItemChange,
		onRemoveItem,
		onMoveItem
	}: {
		section: QuoteSection;
		onAddOption: () => void;
		onAddItem: (optionId: string) => void;
		onRenameOption: (optionId: string, name: string) => void;
		onRemoveOption: (optionId: string) => void;
		onItemChange: (
			itemId: string,
			patch: { description?: string; quantity?: number; unitPrice?: number }
		) => void;
		onRemoveItem: (itemId: string) => void;
		onMoveItem: (itemId: string, sectionId: string | null, optionId: string | null) => void;
	} = $props();

	let activeIndex = $state(0);
	let activeOption = $derived(section.options[activeIndex]);
	let destinations = $derived([
		{
			value: `section:${section.id}:base`,
			sectionId: section.id,
			optionId: null,
			label: 'Included in all options'
		},
		...section.options.map((option, index) => ({
			value: `section:${section.id}:option:${option.id}`,
			sectionId: section.id,
			optionId: option.id,
			label: option.name.trim() || `Option ${String.fromCharCode(65 + index)}`
		}))
	]);

	$effect(() => {
		if (activeIndex >= section.options.length)
			activeIndex = Math.max(0, section.options.length - 1);
	});

	function optionName(name: string, index: number) {
		return name.trim() || `Option ${String.fromCharCode(65 + index)}`;
	}

	function rename(optionId: string, event: Event) {
		if (!(event.currentTarget instanceof HTMLInputElement)) return;
		onRenameOption(optionId, event.currentTarget.value);
	}

	async function remove(optionId: string, name: string) {
		const confirmed = await confirm({
			title: `Delete ${name}?`,
			description: 'The option and all of its items will be removed. This cannot be undone.',
			confirmLabel: 'Delete option',
			destructive: true
		});
		if (confirmed) onRemoveOption(optionId);
	}
</script>

{#if section.options.length > 0}
	<Tabs.Root
		class="mt-2 gap-3"
		bind:value={() => `${activeIndex}`, (value) => (activeIndex = Number(value))}
	>
		<div class="flex flex-wrap items-center gap-2">
			<Tabs.List class="max-w-full justify-start overflow-x-auto">
				{#each section.options as option, index (option.id)}
					<Tabs.Trigger value={`${index}`}>{optionName(option.name, index)}</Tabs.Trigger>
				{/each}
			</Tabs.List>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="text-muted-foreground"
				onclick={onAddOption}
			>
				<PlusIcon class="size-4" />
				Option
			</Button>
		</div>
		{#if activeOption}
			<Tabs.Content value={`${activeIndex}`} class="flex flex-col gap-2">
				<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
					<Input
						value={activeOption.name}
						onchange={(event) => rename(activeOption.id, event)}
						aria-label="Option name"
						class="h-8 min-w-40 flex-1 basis-40 border-transparent bg-transparent px-2 font-medium shadow-none hover:border-input focus-visible:border-input sm:max-w-64"
					/>
					<span class="ml-auto text-sm text-muted-foreground tabular-nums">
						{formatNaira(optionTotal(activeOption))}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="text-muted-foreground"
						onclick={() => onAddItem(activeOption.id)}
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
									aria-label="Option actions"
								>
									<DotsIcon class="size-4" />
								</Button>
							{/snippet}
						</DropdownMenu.Trigger>
						<DropdownMenu.Content align="end">
							<DropdownMenu.Item
								variant="destructive"
								onclick={() => remove(activeOption.id, optionName(activeOption.name, activeIndex))}
							>
								Delete option
							</DropdownMenu.Item>
						</DropdownMenu.Content>
					</DropdownMenu.Root>
				</div>
				{#if activeOption.description}
					<p class="px-2 text-sm text-muted-foreground">{activeOption.description}</p>
				{/if}
				<ItemsTable
					items={activeOption.items}
					{destinations}
					{onItemChange}
					onRemove={onRemoveItem}
					onMove={onMoveItem}
				/>
			</Tabs.Content>
		{/if}
	</Tabs.Root>
{/if}
