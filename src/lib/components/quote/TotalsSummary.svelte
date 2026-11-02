<script lang="ts">
	import type { QuoteTotals } from '#lib/utils/quote-totals.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import PriceCombinations from './PriceCombinations.svelte';

	let { totals }: { totals: QuoteTotals } = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>Quote total</Card.Title>
	</Card.Header>
	<Card.Content>
		<PriceCombinations {totals} />
	</Card.Content>
</Card.Root>
