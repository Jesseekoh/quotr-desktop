<script lang="ts">
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import XIcon from '@tabler/icons-svelte/icons/x';
	import ArrowUpRightIcon from '@tabler/icons-svelte/icons/arrow-up-right';
	import FileDescriptionIcon from '@tabler/icons-svelte/icons/file-description';
	import FileDownIcon from '@tabler/icons-svelte/icons/file-download';
	import TemplateIcon from '@tabler/icons-svelte/icons/template';
	import { IconAlertCircle } from '@tabler/icons-svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Skeleton } from '#lib/components/ui/skeleton/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import QuotePreview from '#lib/components/quote/QuotePreview.svelte';
	import QuoteStatusBadge from '#lib/components/quote-status-badge.svelte';
	import { errorMessage as messageFor } from '#lib/api/types.js';
	import { getQuote, removeQuote, type QuoteDetail } from '#lib/api/quotes.js';
	import { confirm } from '#lib/hooks/confirm.svelte.js';
	import { exportQuotePdf } from '#lib/utils/export.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let selectedId = $state<string | null>(null);
	let selectedQuote = $state<QuoteDetail | null>(null);
	let loadingPreview = $state(false);
	let errorMessage = $state<string | null>(null);
	let exporting = $state(false);
	let list = $state<HTMLElement>();

	async function exportPdf(quote: QuoteDetail) {
		exporting = true;
		try {
			await exportQuotePdf(quote);
		} finally {
			exporting = false;
		}
	}

	// Keep a quote selected as long as the list has one (e.g. after a delete).
	$effect(() => {
		if (data.quotes.length === 0) {
			selectedId = null;
			selectedQuote = null;
			return;
		}
		if (!selectedId || !data.quotes.some((quote) => quote.id === selectedId)) {
			selectQuote(data.quotes[0].id);
		}
	});

	async function selectQuote(id: string) {
		selectedId = id;
		loadingPreview = true;
		errorMessage = null;
		try {
			const quote = await getQuote(id);
			if (selectedId === id) selectedQuote = quote;
		} catch (e) {
			if (selectedId === id) {
				selectedQuote = null;
				errorMessage = messageFor(e);
			}
		} finally {
			if (selectedId === id) loadingPreview = false;
		}
	}

	async function handleDelete(quote: PageData['quotes'][number]) {
		const confirmed = await confirm({
			title: `Delete ${quote.quoteNumber}?`,
			description: 'The quote and all of its items will be removed. This cannot be undone.',
			confirmLabel: 'Delete quote',
			destructive: true
		});
		if (!confirmed) return;
		errorMessage = null;
		try {
			await removeQuote(quote.id);
			if (selectedId === quote.id) {
				selectedId = null;
				selectedQuote = null;
			}
			await invalidateAll();
		} catch (e) {
			errorMessage = messageFor(e);
		}
	}

	// Arrow keys move through the list like a desktop master/detail view; Enter opens.
	function handleListKeydown(event: KeyboardEvent) {
		const index = data.quotes.findIndex((quote) => quote.id === selectedId);
		let next = index;
		if (event.key === 'ArrowDown') next = Math.min(data.quotes.length - 1, index + 1);
		else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
		else if (event.key === 'Enter' && selectedId) {
			event.preventDefault();
			goto(resolve('/(app)/quotes/[id]', { id: selectedId }));
			return;
		} else return;
		event.preventDefault();
		const quote = data.quotes[next];
		if (!quote || quote.id === selectedId) return;
		selectQuote(quote.id);
		list?.querySelector<HTMLElement>(`[data-quote-id="${quote.id}"]`)?.focus();
	}
</script>

<svelte:head>
	<title>Quotes · Quotr</title>
</svelte:head>

<div class="flex flex-1 flex-col">
	<div class="@container/main flex flex-1 flex-col gap-2">
		<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<div class="flex items-center justify-between px-4 lg:px-6">
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">Quotes</h1>
					<p class="text-sm text-muted-foreground">Manage your customer quotes.</p>
				</div>
				<div class="flex gap-2">
					<Button variant="outline" href={resolve('/quotes/templates')}>
						<TemplateIcon class="size-4" />
						Templates
					</Button>
					<Button href={resolve('/quotes/new')}>
						<PlusIcon class="size-4" />
						New quote
					</Button>
				</div>
			</div>

			{#if errorMessage}
				<div class="px-4 lg:px-6">
					<Alert.Root variant="destructive">
						<IconAlertCircle class="size-4" />
						<Alert.Description>{errorMessage}</Alert.Description>
					</Alert.Root>
				</div>
			{/if}

			{#if data.quotes.length === 0}
				<div class="px-4 lg:px-6">
					<Empty.Root class="border py-16">
						<Empty.Header>
							<Empty.Media variant="icon"><FileDescriptionIcon /></Empty.Media>
							<Empty.Title>No quotes yet</Empty.Title>
							<Empty.Description>Create a quote for a customer to get started.</Empty.Description>
						</Empty.Header>
						<Empty.Content>
							<Button href={resolve('/quotes/new')}>
								<PlusIcon class="size-4" />
								New quote
							</Button>
						</Empty.Content>
					</Empty.Root>
				</div>
			{:else}
				<div class="grid gap-4 px-4 md:grid-cols-[minmax(0,20rem)_1fr] md:gap-6 lg:px-6">
					<div
						bind:this={list}
						class="max-h-[calc(100vh-12rem)] divide-y overflow-y-auto rounded-lg border"
						role="listbox"
						tabindex="-1"
						aria-label="Quotes"
						onkeydown={handleListKeydown}
					>
						{#each data.quotes as quote (quote.id)}
							<div
								class="flex items-center gap-1 pr-2 transition-colors {selectedId === quote.id
									? 'bg-muted/60'
									: 'hover:bg-muted/40'}"
							>
								<button
									type="button"
									data-quote-id={quote.id}
									role="option"
									aria-selected={selectedId === quote.id}
									class="min-w-0 flex-1 cursor-pointer p-4 text-left outline-none focus-visible:bg-muted/60"
									onclick={() => selectQuote(quote.id)}
									ondblclick={() => goto(resolve('/(app)/quotes/[id]', { id: quote.id }))}
								>
									<div class="flex items-center justify-between gap-3">
										<span class="truncate font-medium">{quote.quoteNumber}</span>
										<QuoteStatusBadge status={quote.status} sentAt={quote.sentAt} />
									</div>
									<div class="mt-0.5 truncate text-sm text-muted-foreground">
										{quote.customer.name}
									</div>
								</button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`Open ${quote.quoteNumber}`}
									href={resolve('/(app)/quotes/[id]', { id: quote.id })}
								>
									<ArrowUpRightIcon class="size-4" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									aria-label={`Delete ${quote.quoteNumber}`}
									class="text-muted-foreground hover:text-destructive"
									onclick={() => handleDelete(quote)}
								>
									<XIcon class="size-4" />
								</Button>
							</div>
						{/each}
					</div>

					<div class="min-w-0">
						{#if selectedQuote && selectedQuote.id === selectedId && !loadingPreview}
							{@const activeQuote = selectedQuote}
							<div class="mb-3 flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									size="sm"
									href={resolve('/(app)/quotes/[id]', { id: activeQuote.id })}
								>
									<ArrowUpRightIcon class="size-4" />
									Open quote
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={exporting}
									onclick={() => exportPdf(activeQuote)}
								>
									<FileDownIcon class="size-4" />
									{exporting ? 'Exporting…' : 'Export PDF'}
								</Button>
							</div>
							<QuotePreview quote={activeQuote} brand={data.brand} />
						{:else if selectedId}
							<div class="flex flex-col gap-4 rounded-xl border p-6">
								<Skeleton class="h-8 w-40" />
								<Skeleton class="h-28 w-full" />
								<Skeleton class="h-48 w-full" />
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
