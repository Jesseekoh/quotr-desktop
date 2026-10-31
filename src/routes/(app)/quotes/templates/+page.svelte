<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil';
	import TemplateIcon from '@tabler/icons-svelte/icons/template';
	import XIcon from '@tabler/icons-svelte/icons/x';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { errorMessage } from '#lib/api/types.js';
	import {
		removeTemplate,
		renameTemplate,
		templateItemCount,
		type QuoteTemplate
	} from '#lib/api/templates.js';
	import { confirm } from '#lib/hooks/confirm.svelte.js';
	import { PRICE_LABEL_OPTIONS } from '#lib/utils/pricing.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let editingId = $state<string | null>(null);
	let draftName = $state('');

	const dateFormatter = new Intl.DateTimeFormat('en-NG', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	function summary(template: QuoteTemplate) {
		const sections = template.content.sections.length;
		const items = templateItemCount(template.content);
		const label = PRICE_LABEL_OPTIONS.find((option) => option.value === template.label)?.text;
		return [
			`${sections} section${sections === 1 ? '' : 's'}`,
			`${items} item${items === 1 ? '' : 's'}`,
			label
		]
			.filter(Boolean)
			.join(' · ');
	}

	function startRename(template: QuoteTemplate) {
		editingId = template.id;
		draftName = template.name;
	}

	async function commitRename(template: QuoteTemplate) {
		if (editingId !== template.id) return;
		editingId = null;
		if (!draftName.trim() || draftName.trim() === template.name) return;
		try {
			await renameTemplate({ id: template.id, name: draftName });
			await invalidateAll();
		} catch (cause) {
			toast.error(errorMessage(cause, 'Could not rename the template.'));
		}
	}

	async function handleDelete(template: QuoteTemplate) {
		const confirmed = await confirm({
			title: `Delete "${template.name}"?`,
			description: 'Quotes already made from this template are not affected.',
			confirmLabel: 'Delete template',
			destructive: true
		});
		if (!confirmed) return;
		try {
			await removeTemplate(template.id);
			await invalidateAll();
		} catch (cause) {
			toast.error(errorMessage(cause, 'Could not delete the template.'));
		}
	}
</script>

<svelte:head>
	<title>Quote templates · Quotr</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 lg:px-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Quote templates</h1>
		<p class="text-sm text-muted-foreground">
			Start new quotes from a saved layout. Save one from any quote with "Save as template".
		</p>
	</div>

	{#if data.templates.length === 0}
		<Empty.Root class="border py-16">
			<Empty.Header>
				<Empty.Media variant="icon"><TemplateIcon /></Empty.Media>
				<Empty.Title>No templates yet</Empty.Title>
				<Empty.Description>
					Open a quote and choose "Save as template" to reuse its sections, options and items.
				</Empty.Description>
			</Empty.Header>
			<Empty.Content>
				<Button variant="outline" href={resolve('/quotes')}>Go to quotes</Button>
			</Empty.Content>
		</Empty.Root>
	{:else}
		<ul class="divide-y rounded-xl border">
			{#each data.templates as template (template.id)}
				<li class="flex items-center gap-3 px-4 py-3">
					<div class="min-w-0 flex-1">
						{#if editingId === template.id}
							<!-- svelte-ignore a11y_autofocus -->
							<Input
								bind:value={draftName}
								aria-label="Template name"
								autofocus
								onblur={() => commitRename(template)}
								onkeydown={(event) => {
									if (event.key === 'Enter') commitRename(template);
									if (event.key === 'Escape') editingId = null;
								}}
							/>
						{:else}
							<div class="truncate font-medium">{template.name}</div>
						{/if}
						<div class="mt-0.5 truncate text-sm text-muted-foreground">
							{summary(template)} · Updated {dateFormatter.format(template.updatedAt)}
						</div>
					</div>
					<Button
						size="sm"
						href={`${resolve('/quotes/new')}?template=${encodeURIComponent(template.id)}`}
					>
						Use
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`Rename ${template.name}`}
						onclick={() => startRename(template)}
					>
						<PencilIcon class="size-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={`Delete ${template.name}`}
						class="text-muted-foreground hover:text-destructive"
						onclick={() => handleDelete(template)}
					>
						<XIcon class="size-4" />
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
