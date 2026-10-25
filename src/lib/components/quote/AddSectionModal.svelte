<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let {
		open = $bindable(false),
		onSubmit
	}: {
		open: boolean;
		onSubmit: (payload: { name: string }) => void;
	} = $props();

	let name = $state('');

	function submit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		onSubmit({ name: name.trim() });
		name = '';
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add section</Dialog.Title>
			<Dialog.Description>Group quote items into a numbered section.</Dialog.Description>
		</Dialog.Header>

		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-col gap-1.5">
				<Label for="section-name">Name</Label>
				<Input id="section-name" bind:value={name} placeholder="e.g. Inverter" required />
			</div>
			<Dialog.Footer>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="secondary">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit">Add section</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
