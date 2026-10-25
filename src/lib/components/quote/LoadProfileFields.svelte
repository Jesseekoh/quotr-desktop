<script lang="ts">
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let {
		loadProfileTotal,
		loadProfileNotes,
		onSave,
		onChange,
		disabled = false
	}: {
		loadProfileTotal: string | number | null;
		loadProfileNotes: string | null;
		onSave: (payload: { loadProfileTotal: number | null; loadProfileNotes: string }) => void;
		onChange?: (payload: { loadProfileTotal: number | null; loadProfileNotes: string }) => void;
		disabled?: boolean;
	} = $props();

	let total = $derived(loadProfileTotal !== null ? Number(loadProfileTotal) : null);
	let notes = $derived(loadProfileNotes ?? '');
	let dirty = $state(false);

	function markDirty() {
		dirty = true;
		onChange?.({ loadProfileTotal: total, loadProfileNotes: notes });
	}

	function save(e: Event) {
		e.preventDefault();
		onSave({ loadProfileTotal: total, loadProfileNotes: notes });
		dirty = false;
	}
</script>

<form class="flex w-full min-w-0 flex-wrap items-end gap-4 sm:w-auto sm:flex-1" onsubmit={save}>
	<Label class="flex w-32 flex-col items-start gap-2">
		<span>Total load</span>
		<Input
			type="number"
			min="0"
			step="any"
			bind:value={total}
			oninput={markDirty}
			{disabled}
			placeholder="e.g. 5580"
		/>
	</Label>

	<Label class="flex min-w-0 flex-1 flex-col items-start gap-2 sm:min-w-56">
		<span>Load notes</span>
		<Input
			bind:value={notes}
			oninput={markDirty}
			{disabled}
			placeholder="e.g. Fridge, TVs, lights, sockets, pumping machine"
		/>
	</Label>

	{#if dirty}
		<Button type="submit" {disabled}>Save</Button>
	{/if}
</form>
