<script lang="ts">
	import { importProducts } from '#lib/api/products.js';
	import { parseWorkbook, type ParsedSheet } from '#lib/utils/product-import.js';
	import { bpToPercent, MARKUP_FIELDS } from '#lib/utils/markups.js';
	import { PRODUCT_CATEGORIES } from '#lib/utils/pricing.js';
	import type { ProductCategory } from '#lib/db/schema.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import FileSpreadsheetIcon from '@tabler/icons-svelte/icons/file-spreadsheet';
	import FileDropZone from '#lib/components/file-drop-zone.svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { toast } from 'svelte-sonner';

	type Props = {
		/** Called after a successful import so the page can refresh its data. */
		onImported: (result: { inserted: number; skipped: number }) => void;
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
	let skipZeroCost = $state(true);
	let skipExisting = $state(true);

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

	/** Products queued for import, honouring per-sheet include/category and the cost filter. */
	let selectedProducts = $derived.by(() => {
		const out: { sheetName: string; product: (typeof sheets)[number]['products'][number] }[] = [];
		for (const sheet of sheets) {
			const choice = choices[sheet.sheetName];
			if (!choice?.include) continue;
			for (const product of sheet.products) {
				if (skipZeroCost && product.costPrice <= 0) continue;
				out.push({ sheetName: sheet.sheetName, product });
			}
		}
		return out;
	});

	async function runImport() {
		if (selectedProducts.length === 0) return;
		isImporting = true;
		try {
			const res = await importProducts({
				products: selectedProducts.map(({ product, sheetName }) => {
					const category = choices[sheetName].category;
					return { ...product, category };
				}),
				skipExisting
			});
			toast.success(
				`Imported ${res.inserted} product(s)` +
					(res.skipped > 0 ? `, skipped ${res.skipped} already in your catalog` : '')
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
			Each sheet becomes a batch of products. Adjust the category per sheet before importing.
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
								<Select.Root
									type="single"
									value={choices[sheet.sheetName].category}
									onValueChange={(v) => (choices[sheet.sheetName].category = v as ProductCategory)}
								>
									<Select.Trigger class="w-full">
										{PRODUCT_CATEGORIES.find((c) => c.value === choices[sheet.sheetName].category)
											?.label ?? choices[sheet.sheetName].category}
									</Select.Trigger>
									<Select.Content>
										{#each PRODUCT_CATEGORIES as cat (cat.value)}
											<Select.Item value={cat.value}>{cat.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>
							{#if sheet.markup}
								<span class="text-xs text-muted-foreground">
									sheet markups:
									{MARKUP_FIELDS.map(
										(f) => `${f.label} ${bpToPercent(sheet.markup?.[f.key] ?? 0)}%`
									).join(' · ')}
								</span>
							{/if}
						</div>
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
				<Checkbox checked={skipExisting} onCheckedChange={(c) => (skipExisting = c === true)} />
				<span class="text-muted-foreground"
					>Skip products already in the catalog (same brand &amp; specification)</span
				>
			</label>
		</div>

		<Button
			class="w-full"
			onclick={runImport}
			disabled={isImporting || selectedProducts.length === 0}
		>
			{isImporting ? 'Importing…' : importLabel(selectedProducts.length)}
		</Button>
	{/if}
</div>
