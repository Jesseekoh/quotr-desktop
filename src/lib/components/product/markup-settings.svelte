<script lang="ts">
	import { getMarkups, updateMarkup, type CategoryMarkupWithCount } from '#lib/api/products.js';
	import { MARKUP_FIELDS, bpToPercent, percentToBp } from '#lib/utils/markups.js';
	import { PRODUCT_CATEGORIES } from '#lib/utils/pricing.js';
	import type { ProductCategory } from '#lib/db/schema.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { toast } from 'svelte-sonner';

	type Props = {
		/** Called after a successful save so the page can refresh its data. */
		onSaved: () => void;
	};
	let { onSaved }: Props = $props();

	type Draft = Record<(typeof MARKUP_FIELDS)[number]['key'], string>;

	let isLoading = $state(true);
	let rows = $state<CategoryMarkupWithCount[]>([]);
	let drafts = $state<Record<string, Draft>>({});
	let savingCategory = $state<string | null>(null);

	$effect(() => {
		load();
	});

	async function load() {
		isLoading = true;
		try {
			const data = await getMarkups();
			rows = data;
			drafts = Object.fromEntries(
				data.map((r) => [
					r.category,
					{
						enduserPct: String(bpToPercent(r.enduserPct)),
						discountPct: String(bpToPercent(r.discountPct)),
						resalePct: String(bpToPercent(r.resalePct)),
						specialPct: String(bpToPercent(r.specialPct))
					}
				])
			);
		} catch {
			toast.error('Failed to load markups');
		} finally {
			isLoading = false;
		}
	}

	function categoryLabel(category: string): string {
		return PRODUCT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
	}

	async function save(category: ProductCategory) {
		const draft = drafts[category];
		const pcts = {
			enduserPct: percentToBp(Number(draft.enduserPct)),
			discountPct: percentToBp(Number(draft.discountPct)),
			resalePct: percentToBp(Number(draft.resalePct)),
			specialPct: percentToBp(Number(draft.specialPct))
		};
		if (Object.values(pcts).some((v) => !Number.isFinite(v) || v < 0)) {
			toast.error('Markup percentages must be numbers between 0 and 200');
			return;
		}

		savingCategory = category;
		try {
			const res = await updateMarkup({ category, ...pcts });
			toast.success(
				`${categoryLabel(category)} markups saved — ${res.updatedProducts} product(s) recalculated`
			);
			onSaved();
		} catch {
			toast.error('Failed to save markups');
		} finally {
			savingCategory = null;
		}
	}
</script>

<div class="space-y-3">
	<p class="text-sm text-muted-foreground">
		Each category has its own markup per price tier. Sell prices are derived from the cost price —
		changing a markup recalculates every price of that category's products.
	</p>

	{#if isLoading}
		<div class="space-y-2">
			{#each Array(3), i (i)}
				<div class="h-20 animate-pulse rounded-lg bg-muted"></div>
			{/each}
		</div>
	{:else}
		<div class="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
			{#each rows as row (row.category)}
				<div class="rounded-lg border p-3">
					<div class="mb-2 flex items-center justify-between gap-2">
						<span class="text-sm font-medium">{categoryLabel(row.category)}</span>
						<Badge variant="secondary"
							>{row.productCount} product{row.productCount === 1 ? '' : 's'}</Badge
						>
					</div>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{#each MARKUP_FIELDS as field (field.key)}
							<div class="space-y-1">
								<Label for="mk-{row.category}-{field.key}" class="text-xs text-muted-foreground">
									{field.label}
								</Label>
								<div class="relative">
									<Input
										id="mk-{row.category}-{field.key}"
										type="number"
										step="0.5"
										min="0"
										max="200"
										class="pr-7"
										bind:value={drafts[row.category][field.key]}
									/>
									<span
										class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground"
									>
										%
									</span>
								</div>
							</div>
						{/each}
					</div>
					<div class="mt-2 flex justify-end">
						<Button
							size="sm"
							variant="outline"
							onclick={() => save(row.category)}
							disabled={savingCategory !== null}
						>
							{savingCategory === row.category ? 'Recalculating…' : 'Save & recalculate'}
						</Button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
