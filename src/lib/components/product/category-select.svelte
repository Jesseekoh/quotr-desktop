<script lang="ts">
	import type { CategoryWithMarkup } from '#lib/api/products.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { cn } from '#lib/utils.js';

	// bits-ui's Select can't use '' as a real value.
	const ALL = '__all__';

	type Props = {
		categories: Pick<CategoryWithMarkup, 'id' | 'name' | 'parentId'>[];
		/** A category id, or '' for "all" when `allLabel` is set. */
		value: string;
		onValueChange: (value: string) => void;
		/** Adds an "all categories" option that maps to ''. */
		allLabel?: string;
		/** Only offer top-level categories (e.g. when picking a parent). */
		topLevelOnly?: boolean;
		placeholder?: string;
		id?: string;
		class?: string;
	};
	let {
		categories,
		value,
		onValueChange,
		allLabel,
		topLevelOnly = false,
		placeholder = 'Select a category',
		id,
		class: className
	}: Props = $props();

	const options = $derived(topLevelOnly ? categories.filter((c) => !c.parentId) : categories);
	const label = $derived(
		value ? (categories.find((c) => c.id === value)?.name ?? value) : (allLabel ?? placeholder)
	);
</script>

<Select.Root
	type="single"
	value={value || (allLabel ? ALL : '')}
	onValueChange={(v) => onValueChange(v === ALL ? '' : v)}
>
	<Select.Trigger {id} class={cn('w-full', className)}>
		<span class="truncate">{label}</span>
	</Select.Trigger>
	<Select.Content>
		{#if allLabel}
			<Select.Item value={ALL}>{allLabel}</Select.Item>
		{/if}
		{#each options as cat (cat.id)}
			<Select.Item value={cat.id} class={cat.parentId ? 'pl-6' : ''}>{cat.name}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
