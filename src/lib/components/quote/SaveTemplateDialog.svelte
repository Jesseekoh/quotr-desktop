<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getTemplates, saveQuoteAsTemplate, type QuoteTemplate } from '#lib/api/templates.js';
	import { errorMessage } from '#lib/api/types.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';

	let {
		open = $bindable(false),
		quoteId
	}: {
		open: boolean;
		quoteId: string;
	} = $props();

	let name = $state('');
	let saving = $state(false);
	let templates = $state<QuoteTemplate[]>([]);

	let existing = $derived(
		templates.find((template) => template.name.toLowerCase() === name.trim().toLowerCase())
	);

	$effect(() => {
		if (!open) return;
		name = '';
		getTemplates()
			.then((list) => (templates = list))
			.catch(() => (templates = []));
	});

	async function submit(e: Event) {
		e.preventDefault();
		if (!name.trim()) return;
		saving = true;
		try {
			const template = await saveQuoteAsTemplate({ quoteId, name });
			toast.success(
				existing ? `Updated template "${template.name}"` : `Saved template "${template.name}"`
			);
			open = false;
		} catch (cause) {
			toast.error(errorMessage(cause, 'Could not save the template. Please try again.'));
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title>Save as template</Dialog.Title>
			<Dialog.Description>
				Keep this quote's sections, options and items to start new quotes from. The customer isn't
				saved.
			</Dialog.Description>
		</Dialog.Header>

		<form class="flex flex-col gap-4" onsubmit={submit}>
			<div class="flex flex-col gap-1.5">
				<Label for="template-name">Name</Label>
				<Input
					id="template-name"
					bind:value={name}
					placeholder="e.g. 10kVA inverter with 4 battery options"
					list="template-names"
					autocomplete="off"
					required
				/>
				<datalist id="template-names">
					{#each templates as template (template.id)}
						<option value={template.name}></option>
					{/each}
				</datalist>
				{#if existing}
					<p class="text-xs text-muted-foreground">
						A template named "{existing.name}" already exists. Saving will replace it.
					</p>
				{/if}
			</div>
			<Dialog.Footer>
				<Dialog.Close>
					{#snippet child({ props })}
						<Button {...props} variant="secondary">Cancel</Button>
					{/snippet}
				</Dialog.Close>
				<Button type="submit" disabled={saving || !name.trim()}>
					{saving ? 'Saving…' : existing ? 'Replace template' : 'Save template'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
