<script lang="ts">
	import TrendingDownIcon from '@tabler/icons-svelte/icons/trending-down';
	import TrendingUpIcon from '@tabler/icons-svelte/icons/trending-up';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { formatNaira } from '#lib/utils/format.js';
	import { QUOTE_EXPIRY_DAYS } from '#lib/utils/quotes.js';

	type Stats = {
		value: { current: number; previous: number };
		sent: { current: number; previous: number };
		acceptance: {
			current: number;
			previous: number;
			sentCurrent: number;
			sentPrevious: number;
		};
		awaiting: { count: number; value: number };
	};

	let {
		stats,
		rangeLabel,
		loading = false
	}: { stats: Stats; rangeLabel: string; loading?: boolean } = $props();

	/** % change between equal-length periods; null when it can't be computed. */
	function percentChange(current: number, previous: number): number | null {
		if (previous <= 0) return null;
		return ((current - previous) / previous) * 100;
	}

	function rate(accepted: number, sent: number): number | null {
		return sent > 0 ? accepted / sent : null;
	}

	const valueChange = $derived(percentChange(stats.value.current, stats.value.previous));
	const sentChange = $derived(percentChange(stats.sent.current, stats.sent.previous));
	const currentRate = $derived(rate(stats.acceptance.current, stats.acceptance.sentCurrent));
	const previousRate = $derived(rate(stats.acceptance.previous, stats.acceptance.sentPrevious));
	const rateChange = $derived(
		currentRate !== null && previousRate !== null ? (currentRate - previousRate) * 100 : null
	);

	function trend(delta: number | null): 'up' | 'down' | 'flat' {
		if (delta === null || delta === 0) return 'flat';
		return delta > 0 ? 'up' : 'down';
	}

	function badgeText(delta: number | null, unit = '%'): string {
		if (delta === null) return '—';
		const rounded = Math.abs(delta) < 0.05 ? 0 : delta;
		return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}${unit}`;
	}

	function trendLine(delta: number | null): string {
		switch (trend(delta)) {
			case 'up':
				return 'Trending up this period';
			case 'down':
				return 'Trending down this period';
			default:
				return 'No change from the previous period';
		}
	}
</script>

<div
	class="grid grid-cols-1 gap-4 px-4 transition-opacity *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card"
	class:opacity-60={loading}
>
	<Card.Root class="@container/card">
		<Card.Header>
			<Card.Description>Quote Value</Card.Description>
			<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
				{formatNaira(stats.value.current)}
			</Card.Title>
			<Card.Action>
				{#if valueChange !== null && valueChange !== 0}
					<Badge variant="outline">
						{#if trend(valueChange) === 'up'}<TrendingUpIcon />{:else}<TrendingDownIcon />{/if}
						{badgeText(valueChange)}
					</Badge>
				{/if}
			</Card.Action>
		</Card.Header>
		<Card.Footer class="flex-col items-start gap-1.5 text-sm">
			<div class="line-clamp-1 flex gap-2 font-medium">
				{trendLine(valueChange)}
				{#if trend(valueChange) === 'up'}<TrendingUpIcon class="size-4" />
				{:else if trend(valueChange) === 'down'}<TrendingDownIcon class="size-4" />{/if}
			</div>
			<div class="text-muted-foreground">Value of quotes sent for the {rangeLabel}</div>
		</Card.Footer>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header>
			<Card.Description>Quotes Sent</Card.Description>
			<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
				{stats.sent.current.toLocaleString('en-US')}
			</Card.Title>
			<Card.Action>
				{#if sentChange !== null && sentChange !== 0}
					<Badge variant="outline">
						{#if trend(sentChange) === 'up'}<TrendingUpIcon />{:else}<TrendingDownIcon />{/if}
						{badgeText(sentChange)}
					</Badge>
				{/if}
			</Card.Action>
		</Card.Header>
		<Card.Footer class="flex-col items-start gap-1.5 text-sm">
			<div class="line-clamp-1 flex gap-2 font-medium">
				{trendLine(sentChange)}
				{#if trend(sentChange) === 'up'}<TrendingUpIcon class="size-4" />
				{:else if trend(sentChange) === 'down'}<TrendingDownIcon class="size-4" />{/if}
			</div>
			<div class="text-muted-foreground">Sent for the {rangeLabel}</div>
		</Card.Footer>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header>
			<Card.Description>Acceptance Rate</Card.Description>
			<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
				{currentRate === null ? '—' : `${(currentRate * 100).toFixed(1)}%`}
			</Card.Title>
			<Card.Action>
				{#if rateChange !== null && rateChange !== 0}
					<Badge variant="outline">
						{#if trend(rateChange) === 'up'}<TrendingUpIcon />{:else}<TrendingDownIcon />{/if}
						{badgeText(rateChange, 'pp')}
					</Badge>
				{/if}
			</Card.Action>
		</Card.Header>
		<Card.Footer class="flex-col items-start gap-1.5 text-sm">
			<div class="line-clamp-1 flex gap-2 font-medium">
				{trendLine(rateChange)}
				{#if trend(rateChange) === 'up'}<TrendingUpIcon class="size-4" />
				{:else if trend(rateChange) === 'down'}<TrendingDownIcon class="size-4" />{/if}
			</div>
			<div class="text-muted-foreground">
				{stats.acceptance.current} of {stats.acceptance.sentCurrent} quotes sent were accepted
			</div>
		</Card.Footer>
	</Card.Root>

	<Card.Root class="@container/card">
		<Card.Header>
			<Card.Description>Awaiting Response</Card.Description>
			<Card.Title class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
				{stats.awaiting.count.toLocaleString('en-US')}
			</Card.Title>
		</Card.Header>
		<Card.Footer class="flex-col items-start gap-1.5 text-sm">
			<div class="line-clamp-1 flex gap-2 font-medium">
				{formatNaira(stats.awaiting.value)} pending
			</div>
			<div class="text-muted-foreground">Sent quotes not answered in {QUOTE_EXPIRY_DAYS} days</div>
		</Card.Footer>
	</Card.Root>
</div>
