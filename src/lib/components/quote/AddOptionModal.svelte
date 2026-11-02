<script lang="ts">
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';

	let {
		open = $bindable(false),
		sectionId,
		defaultName = '',
		onSubmit
	}: {
		open: boolean;
		sectionId: string;
		defaultName?: string;
		onSubmit: (payload: { name: string; description?: string; quoteSectionId: string }) => void;
	} = $props();

	let name = $state('');
	let description = $state('');

	$effect(() => {
		if (open) {
			name = defaultName;
			description = '';
		}
	});

	function submit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		onSubmit({
			name: name.trim(),
			description: description.trim() || undefined,
			quoteSectionId: sectionId
		});
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Add option</Dialog.Title>
			<Dialog.Description>Create a new option group for this quote.</Dialog.Description>
		</Dialog.Header>

		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-col gap-1.5">
				<Label for="opt-name">Name</Label>
				<Input id="opt-name" bind:value={name} placeholder="e.g. Battery Option E" required />
			</div>

			<div class="flex flex-col gap-1.5">
				<Label for="opt-desc">Description (optional)</Label>
				<Textarea
					id="opt-desc"
					bind:value={description}
					rows={2}
					placeholder="e.g. 32.14KWh - 48VDC"
				/>
			</div>

			<Dialog.Footer>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="secondary">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit">Add option</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
