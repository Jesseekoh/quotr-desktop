<script lang="ts">
	import type { PageData } from './$types';
	import QuoteHeader from '#lib/components/quote/QuoteHeader.svelte';
	import LoadProfileFields from '#lib/components/quote/LoadProfileFields.svelte';
	import TotalsSummary from '#lib/components/quote/TotalsSummary.svelte';
	import AddItemModal from '#lib/components/quote/AddItemModal.svelte';
	import AddOptionModal from '#lib/components/quote/AddOptionModal.svelte';
	import AddSectionModal from '#lib/components/quote/AddSectionModal.svelte';
	import QuoteSections from '#lib/components/quote/QuoteSections.svelte';
	import QuotePreview from '#lib/components/quote/QuotePreview.svelte';
	import CreateInvoiceDialog from '#lib/components/quote/CreateInvoiceDialog.svelte';
	import SaveTemplateDialog from '#lib/components/quote/SaveTemplateDialog.svelte';
	import { errorMessage as messageFor } from '#lib/api/types.js';
	import type { PriceLabel, QuoteStatus } from '#lib/api/types.js';
	import type { CreateItemPayload } from '#lib/api/quotes.js';
	import { quoteTotals } from '#lib/utils/quote-totals.js';
	import { exportQuotePdf } from '#lib/utils/export.js';
	import { shortcuts } from '#lib/hooks/shortcuts.js';
	import { onMount } from 'svelte';

	import * as Alert from '#lib/components/ui/alert/index.js';
	import { IconAlertCircle } from '@tabler/icons-svelte';
	import {
		updateQuote,
		addSection,
		removeSection,
		removeOption,
		addItem,
		updateItem,
		removeItem,
		addOption,
		updateOption
	} from '#lib/api/quotes.js';

	type PageProps = {
		data: PageData;
	};
	let { data }: PageProps = $props();

	// Writable derived: follows fresh loads, and each mutation swaps in the updated quote.
	let quote = $derived(data.quote);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let showPreview = $state(false);
	let showCreateInvoice = $state(false);
	let showSaveTemplate = $state(false);
	let hydrated = $state(false);
	let loadProfileDraft = $state<{
		loadProfileTotal: number | null;
		loadProfileNotes: string;
	} | null>(null);

	let addItemTarget = $state<string | null>(null);
	let addItemSectionId = $state<string | null>(null);
	let addOptionSectionId = $state<string | null>(null);
	let addOptionDefaultName = $state('');
	let showAddItemModal = $state(false);
	let showAddOptionModal = $state(false);
	let showAddSectionModal = $state(false);

	onMount(() => {
		try {
			showPreview = window.localStorage.getItem('quotr:quote-preview') === 'true';
		} catch {
			showPreview = false;
		}
		hydrated = true;
	});

	$effect(() => {
		if (!hydrated) return;
		try {
			window.localStorage.setItem('quotr:quote-preview', String(showPreview));
		} catch {
			// Storage is optional; the preview just starts hidden next time.
		}
	});

	async function withLoading(fn: () => Promise<void>) {
		loading = true;
		errorMessage = null;
		try {
			await fn();
		} catch (e) {
			errorMessage = messageFor(e);
		} finally {
			loading = false;
		}
	}

	function openAddItem(targetOptionId: string | null, targetSectionId: string | null = null) {
		addItemTarget = targetOptionId;
		addItemSectionId = targetSectionId;
		showAddItemModal = true;
	}

	function nextOptionName(section: { name: string; options: { name: string }[] }) {
		const base = section.name.trim() || 'Option';
		let max = 0;
		for (const option of section.options) {
			const match = option.name.match(/option\s+(\d+)\s*$/i);
			if (match) max = Math.max(max, Number(match[1]));
		}
		return `${base} option ${max + 1}`;
	}

	function openAddOption(sectionId: string) {
		const section = quote.sections.find((item) => item.id === sectionId);
		addOptionSectionId = sectionId;
		addOptionDefaultName = section ? nextOptionName(section) : '';
		showAddOptionModal = true;
	}

	async function handleLabelChange(label: PriceLabel) {
		await withLoading(async () => {
			quote = await updateQuote({ id: quote.id, label });
		});
	}

	async function handleStatusChange(status: QuoteStatus) {
		await withLoading(async () => {
			quote = await updateQuote({ id: quote.id, status });
		});
	}

	async function handleShowBrandChange(showBrand: boolean) {
		await withLoading(async () => {
			quote = await updateQuote({ id: quote.id, showBrand });
		});
	}

	async function handleLoadProfileSave(payload: {
		loadProfileTotal: number | null;
		loadProfileNotes: string;
	}) {
		await withLoading(async () => {
			quote = await updateQuote({ id: quote.id, ...payload });
			loadProfileDraft = null;
		});
	}

	async function handleAddOption(payload: {
		name: string;
		description?: string;
		quoteSectionId: string;
	}) {
		await withLoading(async () => {
			quote = await addOption({ quoteId: quote.id, ...payload });
			showAddOptionModal = false;
		});
	}

	async function handleRenameOption(optionId: string, name: string) {
		if (!name.trim()) return;
		await withLoading(async () => {
			quote = await updateOption({ id: optionId, quoteId: quote.id, name: name.trim() });
		});
	}

	async function handleAddSection(payload: { name: string }) {
		await withLoading(async () => {
			quote = await addSection({
				quoteId: quote.id,
				sortOrder: quote.sections.length,
				...payload
			});
			showAddSectionModal = false;
		});
	}

	async function handleRemoveSection(sectionId: string) {
		await withLoading(async () => {
			quote = await removeSection({ id: sectionId, quoteId: quote.id });
		});
	}

	async function handleRemoveOption(optionId: string) {
		await withLoading(async () => {
			quote = await removeOption({ id: optionId, quoteId: quote.id });
		});
	}

	async function handleAddItem(payload: CreateItemPayload) {
		await withLoading(async () => {
			const { quoteOptionId, quoteSectionId, ...itemData } = payload;
			quote = await addItem({
				quoteId: quote.id,
				data: itemData,
				quoteOptionId: quoteOptionId ?? addItemTarget,
				quoteSectionId: quoteSectionId ?? addItemSectionId
			});

			showAddItemModal = false;
		});
	}

	async function handleItemChange(
		itemId: string,
		patch: { description?: string; quantity?: number; unitPrice?: number }
	) {
		await withLoading(async () => {
			quote = await updateItem({ id: itemId, quoteId: quote.id, data: patch });
		});
	}

	async function handleRemoveItem(itemId: string) {
		await withLoading(async () => {
			quote = await removeItem({ id: itemId, quoteId: quote.id });
		});
	}

	async function handleMoveItem(itemId: string, sectionId: string | null, optionId: string | null) {
		await withLoading(async () => {
			quote = await updateItem({
				id: itemId,
				quoteId: quote.id,
				quoteSectionId: sectionId,
				quoteOptionId: optionId
			});
		});
	}

	const ungroupedItems = $derived(
		quote.items.filter((item) => item.quoteSectionId === null && item.quoteOptionId === null)
	);
	const totals = $derived(quoteTotals(quote));

	const onkeydown = shortcuts({
		'mod+e': () => exportQuotePdf(quote),
		'mod+i': () => openAddItem(null, null)
	});
</script>

<svelte:head>
	<title>{quote?.quoteNumber} · Quotr</title>
</svelte:head>

<svelte:window {onkeydown} />

{#key data.quote.id}
	<div
		class="@container/main mx-auto flex w-full flex-col gap-6 px-4 py-4 md:px-6 md:py-6"
		aria-busy={loading}
	>
		{#if errorMessage}
			<Alert.Root variant="destructive">
				<IconAlertCircle class="size-4" />
				<Alert.Description>{errorMessage}</Alert.Description>
			</Alert.Root>
		{/if}

		<QuoteHeader
			{quote}
			onLabelChange={handleLabelChange}
			onStatusChange={handleStatusChange}
			onShowBrandChange={handleShowBrandChange}
			{showPreview}
			onShowPreviewChange={(value) => (showPreview = value)}
			onCreateInvoice={() => (showCreateInvoice = true)}
			onSaveTemplate={() => (showSaveTemplate = true)}
			disabled={loading}
		>
			<LoadProfileFields
				loadProfileTotal={quote.loadProfileTotal}
				loadProfileNotes={quote.loadProfileNotes}
				onSave={handleLoadProfileSave}
				onChange={(payload) => (loadProfileDraft = payload)}
				disabled={loading}
			/>
		</QuoteHeader>

		<div class={showPreview ? 'grid gap-6 md:grid-cols-2' : ''}>
			<div class="flex min-w-0 flex-col gap-6">
				<QuoteSections
					{ungroupedItems}
					sections={quote.sections}
					onAddSection={() => (showAddSectionModal = true)}
					onAddItem={(sectionId, optionId) => openAddItem(optionId, sectionId)}
					onAddOption={openAddOption}
					onRenameOption={handleRenameOption}
					onRemoveOption={handleRemoveOption}
					onRemoveSection={handleRemoveSection}
					onItemChange={handleItemChange}
					onRemoveItem={handleRemoveItem}
					onMoveItem={handleMoveItem}
				/>

				<TotalsSummary {totals} />
			</div>

			{#if showPreview}
				<QuotePreview quote={{ ...quote, ...loadProfileDraft }} brand={data.brand} />
			{/if}
		</div>
	</div>
{/key}

<SaveTemplateDialog bind:open={showSaveTemplate} quoteId={quote.id} />

<CreateInvoiceDialog
	bind:open={showCreateInvoice}
	quoteId={quote.id}
	items={quote.items}
	sections={quote.sections}
/>

<AddItemModal
	bind:open={showAddItemModal}
	label={quote.label}
	sectionId={addItemSectionId}
	optionId={addItemTarget}
	onSubmit={handleAddItem}
/>

<AddOptionModal
	bind:open={showAddOptionModal}
	sectionId={addOptionSectionId ?? ''}
	defaultName={addOptionDefaultName}
	onSubmit={handleAddOption}
/>

<AddSectionModal bind:open={showAddSectionModal} onSubmit={handleAddSection} />
