<script lang="ts">
	import {
		getCategories,
		importProducts,
		type CategoryWithMarkup,
		type ImportProductsPayload,
		type ImportResult
	} from '#lib/api/products.js';
	import { parseWorkbook, type ParsedSheet } from '#lib/utils/product-import.js';
	import { bpToPercent, MARKUP_FIELDS, type MarkupPcts } from '#lib/utils/markups.js';
	import type { ProductCategory } from '#lib/db/schema.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import FileSpreadsheetIcon from '@tabler/icons-svelte/icons/file-spreadsheet';
	import FileDropZone from '#lib/components/file-drop-zone.svelte';
	import CategorySelect from '#lib/components/product/category-select.svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { toast } from 'svelte-sonner';

	type Props = {
		/** Called after a successful import so the page can refresh its data. */
		onImported: (result: ImportResult) => void;
		/** Label for the import button, e.g. during onboarding. */
		importLabel?: (count: number) => string;
	};
	let {
		onImported,
		importLabel = (count) => `Import ${count} product${count === 1 ? '' : 's'}`
	}: Props = $props();

	let fileName = $state<string | null>(null);

	let isParsing = $state(false);
	let isImporting = $state(false);
	let sheets = $state<ParsedSheet[]>([]);
	let choices = $state<Record<string, { include: boolean; category: ProductCategory }>>({});
	let categories = $state<CategoryWithMarkup[]>([]);
	let skipZeroCost = $state(true);
	let updateExisting = $state(true);
	let updateCategories = $state(false);
	let useSheetMarkups = $state(true);
	let preview = $state<ImportResult | null>(null);

	$effect(() => {
		getCategories().then((rows) => (categories = rows));
	});

	async function onFile(file: File) {
		isParsing = true;
		fileName = file.name;
		try {
			const parsed = await parseWorkbook(file);
			sheets = parsed;
			choices = Object.fromEntries(
				parsed.map((s) => [s.sheetName, { include: s.products.length > 0, category: s.category }])
			);
		} catch {
			toast.error('Could not read that workbook');
			fileName = null;
		} finally {
			isParsing = false;
		}
	}

	function categoryName(id: string) {
		return categories.find((c) => c.id === id)?.name ?? id;
	}

	/** The top-level category whose markups a category uses. */
	function markupOwner(id: string) {
		const cat = categories.find((c) => c.id === id);
		return cat?.parentId && cat.inherited ? cat.parentId : id;
	}

	/** Products queued for import, honouring per-sheet include/category and the cost filter. */
	let selectedProducts = $derived.by(() => {
		const out: { sheetName: string; product: ImportProductsPayload['products'][number] }[] = [];
		for (const sheet of sheets) {
			const choice = choices[sheet.sheetName];
			if (!choice?.include) continue;
			for (const { detectedCategory, ...product } of sheet.products) {
				if (skipZeroCost && product.costPrice <= 0) continue;
				out.push({
					sheetName: sheet.sheetName,
					product: { ...product, category: detectedCategory ?? choice.category }
				});
			}
		}
		return out;
	});

	/** How many of a sheet's rows land in each category. */
	function breakdown(sheetName: string) {
		const counts: Record<string, number> = {};
		for (const { sheetName: s, product } of selectedProducts) {
			if (s === sheetName) counts[product.category] = (counts[product.category] ?? 0) + 1;
		}
		return Object.entries(counts).sort((a, b) => b[1] - a[1]);
	}

	/**
	 * Each sheet's markup row goes to every category its rows use. When two
	 * sheets disagree about one category, the first sheet wins and we say so.
	 */
	let markupPlan = $derived.by(() => {
		const plan = new Map<string, { sheetName: string; markup: MarkupPcts }>();
		const conflicts: string[] = [];
		if (!useSheetMarkups) return { plan, conflicts };
		for (const sheet of sheets) {
			if (!choices[sheet.sheetName]?.include || !sheet.markup) continue;
			const owners = new Set(
				selectedProducts
					.filter((p) => p.sheetName === sheet.sheetName)
					.map((p) => markupOwner(p.product.category))
			);
			for (const owner of owners) {
				const prior = plan.get(owner);
				if (!prior) plan.set(owner, { sheetName: sheet.sheetName, markup: sheet.markup });
				else if (MARKUP_FIELDS.some((f) => prior.markup[f.key] !== sheet.markup![f.key])) {
					conflicts.push(
						`${categoryName(owner)}: "${sheet.sheetName}" and "${prior.sheetName}" have different markups, using "${prior.sheetName}".`
					);
				}
			}
		}
		return { plan, conflicts };
	});

	function payload(dryRun: boolean): ImportProductsPayload {
		return {
			products: selectedProducts.map((p) => p.product),
			markups: [...markupPlan.plan].map(([category, { markup }]) => ({ category, ...markup })),
			skipExisting: !updateExisting,
			updateCategories,
			dryRun
		};
	}

	// Re-plan (without writing) whenever the selection or options change.
	let previewTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const next = payload(true);
		clearTimeout(previewTimer);
		if (next.products.length === 0) {
			preview = null;
			return;
		}
		previewTimer = setTimeout(async () => {
			try {
				preview = await importProducts(next);
			} catch {
				preview = null;
			}
		}, 250);
		return () => clearTimeout(previewTimer);
	});

	async function runImport() {
		if (selectedProducts.length === 0) return;
		isImporting = true;
		try {
			const res = await importProducts(payload(false));
			toast.success(
				`Imported ${res.inserted} new product(s), updated ${res.updated}` +
					(res.skipped > 0 ? `, skipped ${res.skipped}` : '')
			);
			sheets = [];
			choices = {};
			fileName = null;
			onImported(res);
		} catch {
			toast.error('Import failed');
		} finally {
			isImporting = false;
		}
	}

	function fmtMarkup(markup: MarkupPcts) {
		return MARKUP_FIELDS.map((f) => `${f.label} ${bpToPercent(markup[f.key])}%`).join(' · ');
	}
</script>

<div class="space-y-4">
	<div class="space-y-2">
		<FileDropZone
			accept=".xlsx,.xls,.csv"
			extensions={['xlsx', 'xls', 'csv']}
			disabled={isParsing || isImporting}
			{onFile}
		>
			{#snippet children({ dragging })}
				<FileSpreadsheetIcon class="size-8 text-muted-foreground" />
				{#if fileName}
					<span class="font-medium">{fileName}</span>
					<span class="text-xs text-muted-foreground">Drop or click to choose another file</span>
				{:else}
					<span class="font-medium">
						{dragging
							? 'Drop to read the workbook'
							: 'Drop your price list here, or click to browse'}
					</span>
					<span class="text-xs text-muted-foreground">Excel (.xlsx, .xls) or CSV</span>
				{/if}
			{/snippet}
		</FileDropZone>
		<p class="text-xs text-muted-foreground">
			Rows are sorted into categories by their Type column where it has one. The sheet's category is
			used for everything else.
		</p>
	</div>

	{#if isParsing}
		<p class="text-sm text-muted-foreground">Reading workbook…</p>
	{:else if sheets.length > 0}
		<div class="max-h-[45vh] space-y-2 overflow-y-auto pr-1">
			{#each sheets as sheet (sheet.sheetName)}
				<div class="rounded-lg border p-3 {sheet.products.length === 0 ? 'opacity-50' : ''}">
					<div class="flex items-center gap-2">
						<Checkbox
							checked={choices[sheet.sheetName]?.include}
							disabled={sheet.products.length === 0}
							onCheckedChange={(checked) => (choices[sheet.sheetName].include = checked === true)}
						/>
						<span class="flex-1 truncate text-sm font-medium">{sheet.sheetName}</span>
						<Badge variant="secondary"
							>{sheet.products.length} row{sheet.products.length === 1 ? '' : 's'}</Badge
						>
					</div>
					{#if sheet.products.length > 0}
						<div class="mt-2 flex flex-wrap items-center gap-3">
							<div class="min-w-44 flex-1">
								<CategorySelect
									{categories}
									value={choices[sheet.sheetName].category}
									onValueChange={(v) => (choices[sheet.sheetName].category = v)}
								/>
							</div>
							{#if sheet.markup}
								<span class="text-xs text-muted-foreground">
									sheet markups: {fmtMarkup(sheet.markup)}
								</span>
							{/if}
						</div>
						{#if choices[sheet.sheetName].include}
							<p class="mt-2 text-xs text-muted-foreground">
								{breakdown(sheet.sheetName)
									.map(([id, n]) => `${n} ${categoryName(id)}`)
									.join(' · ')}
							</p>
						{/if}
					{:else}
						<p class="mt-1 text-xs text-muted-foreground">No importable rows in this sheet.</p>
					{/if}
				</div>
			{/each}
		</div>

		<div class="space-y-2">
			<label class="flex items-center gap-2 text-sm">
				<Checkbox checked={skipZeroCost} onCheckedChange={(c) => (skipZeroCost = c === true)} />
				<span class="text-muted-foreground">Skip rows without a cost price</span>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<Checkbox checked={updateExisting} onCheckedChange={(c) => (updateExisting = c === true)} />
				<span class="text-muted-foreground"
					>Update products already in the catalog (cost, supplier, price date)</span
				>
			</label>
			{#if updateExisting}
				<label class="ml-6 flex items-center gap-2 text-sm">
					<Checkbox
						checked={updateCategories}
						onCheckedChange={(c) => (updateCategories = c === true)}
					/>
					<span class="text-muted-foreground">Also move them to the category detected here</span>
				</label>
			{/if}
			<label class="flex items-center gap-2 text-sm">
				<Checkbox
					checked={useSheetMarkups}
					onCheckedChange={(c) => (useSheetMarkups = c === true)}
				/>
				<span class="text-muted-foreground"
					>Save the workbook's markup rows to their categories</span
				>
			</label>
			{#if useSheetMarkups && markupPlan.plan.size > 0}
				<ul class="ml-6 space-y-0.5 text-xs text-muted-foreground">
					{#each [...markupPlan.plan] as [category, { markup }] (category)}
						<li>{categoryName(category)}: {fmtMarkup(markup)}</li>
					{/each}
				</ul>
			{/if}
			{#each markupPlan.conflicts as conflict (conflict)}
				<p class="ml-6 text-xs text-amber-600 dark:text-amber-400">{conflict}</p>
			{/each}
		</div>

		{#if preview}
			<div class="space-y-1 rounded-lg bg-muted/50 p-3 text-sm">
				<p>
					{preview.inserted} new · {preview.updated} updated ({preview.pricesChanged} with price changes){preview.skipped >
					0
						? ` · ${preview.skipped} skipped`
						: ''}
				</p>
				{#if preview.brandMerges.length > 0}
					<p class="text-xs text-muted-foreground">
						Brand spellings matched to existing ones:
						{preview.brandMerges.map((m) => `${m.from} → ${m.to}`).join(', ')}
					</p>
				{/if}
			</div>
		{/if}

		<Button
			class="w-full"
			onclick={runImport}
			disabled={isImporting || selectedProducts.length === 0}
		>
			{isImporting ? 'Importing…' : importLabel(selectedProducts.length)}
		</Button>
	{/if}
</div>
