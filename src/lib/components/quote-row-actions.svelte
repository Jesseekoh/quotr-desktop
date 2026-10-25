<script lang="ts">
	import DotsVerticalIcon from '@tabler/icons-svelte/icons/dots-vertical';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let {
		onOpen,
		onDuplicate,
		onDelete
	}: { onOpen: () => void; onDuplicate: () => void; onDelete: () => void } = $props();
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger class="flex size-8 text-muted-foreground data-[state=open]:bg-muted">
		{#snippet child({ props })}
			<Button variant="ghost" size="icon" {...props} onclick={(event) => event.stopPropagation()}>
				<DotsVerticalIcon />
				<span class="sr-only">Open menu</span>
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-32" onclick={(event) => event.stopPropagation()}>
		<DropdownMenu.Item onclick={onOpen}>Open</DropdownMenu.Item>
		<DropdownMenu.Item onclick={onDuplicate}>Duplicate</DropdownMenu.Item>
		<DropdownMenu.Separator />
		<DropdownMenu.Item variant="destructive" onclick={onDelete}>Delete</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
