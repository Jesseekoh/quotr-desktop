<script lang="ts">
	import { formatNaira } from '#lib/utils/format.js';
	import { MAX_RENDERED_COMBINATIONS, type QuoteTotals } from '#lib/utils/quote-totals.js';
	import { Button } from '#lib/components/ui/button/index.js';

	// Each combination's total = fixed items + the chosen option of every section with choices.
	let { totals }: { totals: QuoteTotals } = $props();

	let showAll = $state(false);
	let hasChoices = $derived(
		totals.combinations.some((combination) => combination.parts.length > 0)
	);
	let visibleCombinations = $derived(
		totals.combinations.slice(0, showAll ? totals.combinations.length : MAX_RENDERED_COMBINATIONS)
	);
</script>

{#if !hasChoices}
	<div class="flex items-baseline justify-end gap-6">
		<span class="text-sm text-muted-foreground">Total</span>
		<span class="text-xl font-bold tabular-nums">{formatNaira(totals.fixedTotal)}</span>
	</div>
{:else}
	<div class="flex flex-col text-sm">
		<div class="flex justify-between gap-3 pb-2">
			<span class="text-muted-foreground">Fixed items</span>
			<span class="tabular-nums">{formatNaira(totals.fixedTotal)}</span>
		</div>
		<div class="divide-y border-t">
			{#each visibleCombinations as combination, index (combination.label || `combination-${index}`)}
				<div class="flex items-start justify-between gap-3 py-2.5">
					<div class="min-w-0">
						<div class="font-medium">{combination.label}</div>
						<div class="text-xs text-muted-foreground tabular-nums">
							{[totals.fixedTotal, ...combination.parts.map((part) => part.total)]
								.map((value) => formatNaira(value))
								.join(' + ')}
						</div>
					</div>
					<span class="shrink-0 font-semibold tabular-nums">{formatNaira(combination.total)}</span>
				</div>
			{/each}
		</div>
		{#if totals.combinationCount > MAX_RENDERED_COMBINATIONS}
			<div class="flex items-center justify-between pt-2 text-muted-foreground">
				<span>
					{totals.truncated
						? `Showing ${totals.combinations.length} of ${totals.combinationCount} combinations`
						: `${totals.combinationCount} combinations`}
				</span>
				<Button
					type="button"
					variant="link"
					size="sm"
					class="px-0"
					onclick={() => (showAll = !showAll)}
				>
					{showAll ? 'Show fewer' : 'Show all'}
				</Button>
			</div>
		{/if}
	</div>
{/if}
