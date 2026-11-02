<script lang="ts">
	import * as Popover from '#lib/components/ui/popover/index.js';

	let { spec }: { spec: string } = $props();

	// Short specs never truncate, so they stay plain text — only long ones
	// become a click target for the full-description popover.
	const TRUNCATION_LIMIT = 60;
	const isLong = $derived(spec.length > TRUNCATION_LIMIT);
</script>

{#if isLong}
	<Popover.Root>
		<Popover.Trigger
			title="Show full description"
			class="block max-w-[200px] cursor-pointer truncate text-left underline decoration-dotted underline-offset-2 outline-none focus-visible:ring-1 focus-visible:ring-ring md:max-w-[280px]"
		>
			{spec}
		</Popover.Trigger>
		<Popover.Content align="start" class="w-80 max-w-[85vw] leading-relaxed break-words">
			{spec}
		</Popover.Content>
	</Popover.Root>
{:else}
	{spec}
{/if}
