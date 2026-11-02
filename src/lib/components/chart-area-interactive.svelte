<script lang="ts">
	import { scaleUtc } from 'd3-scale';
	import { curveNatural } from 'd3-shape';
	import { Area, AreaChart } from 'layerchart';
	import * as Card from '#lib/components/ui/card/index.js';
	import * as Chart from '#lib/components/ui/chart/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as ToggleGroup from '#lib/components/ui/toggle-group/index.js';

	type ChartPoint = { date: string; created: number; accepted: number };

	let {
		chart,
		range,
		loading = false,
		onRangeChange
	}: {
		chart: ChartPoint[];
		range: string;
		loading?: boolean;
		onRangeChange?: (range: string) => void;
	} = $props();

	const selectedLabel = $derived.by(() => {
		switch (range) {
			case '30d':
				return 'Last 30 days';
			case '7d':
				return 'Last 7 days';
			default:
				return 'Last 3 months';
		}
	});

	const chartData = $derived(
		chart.map((point) => ({ ...point, date: new Date(`${point.date}T00:00:00`) }))
	);

	const totalQuotes = $derived(chartData.reduce((total, point) => total + point.created, 0));

	function changeRange(next: string | undefined) {
		if (!next || next === range) return;
		onRangeChange?.(next);
	}

	const chartConfig = {
		created: { label: 'Quotes created', color: 'var(--chart-1)' },
		accepted: { label: 'Quotes accepted', color: 'var(--chart-2)' }
	} satisfies Chart.ChartConfig;
</script>

<Card.Root class="@container/card">
	<Card.Header>
		<Card.Title>Quotes</Card.Title>
		<Card.Description>
			<span class="hidden @[540px]/card:block">
				Created vs accepted for the {selectedLabel.toLowerCase()}
			</span>
			<span class="@[540px]/card:hidden">Created vs accepted</span>
		</Card.Description>
		<Card.Action>
			<ToggleGroup.Root
				type="single"
				value={range}
				onValueChange={changeRange}
				variant="outline"
				class="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
			>
				<ToggleGroup.Item value="90d" disabled={loading}>Last 3 months</ToggleGroup.Item>
				<ToggleGroup.Item value="30d" disabled={loading}>Last 30 days</ToggleGroup.Item>
				<ToggleGroup.Item value="7d" disabled={loading}>Last 7 days</ToggleGroup.Item>
			</ToggleGroup.Root>
			<Select.Root type="single" value={range} onValueChange={changeRange}>
				<Select.Trigger
					size="sm"
					class="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
					aria-label="Select a value"
				>
					<span data-slot="select-value">
						{selectedLabel}
					</span>
				</Select.Trigger>
				<Select.Content class="rounded-xl">
					<Select.Item value="90d" class="rounded-lg">Last 3 months</Select.Item>
					<Select.Item value="30d" class="rounded-lg">Last 30 days</Select.Item>
					<Select.Item value="7d" class="rounded-lg">Last 7 days</Select.Item>
				</Select.Content>
			</Select.Root>
		</Card.Action>
	</Card.Header>
	<Card.Content
		class="relative px-2 pt-4 transition-opacity sm:px-6 sm:pt-6 {loading ? 'opacity-60' : ''}"
	>
		{#if totalQuotes === 0}
			<div
				class="absolute inset-0 z-10 flex items-center justify-center text-sm text-muted-foreground"
			>
				No quotes created in this period
			</div>
		{/if}
		<Chart.Container config={chartConfig} class="aspect-auto h-[250px] w-full">
			<AreaChart
				legend
				data={chartData}
				x="date"
				xScale={scaleUtc()}
				series={[
					{
						key: 'created',
						label: 'Quotes created',
						color: chartConfig.created.color
					},
					{
						key: 'accepted',
						label: 'Quotes accepted',
						color: chartConfig.accepted.color
					}
				]}
				seriesLayout="stack"
				props={{
					xAxis: {
						ticks: range === '7d' ? 7 : undefined,
						format: (v) => {
							return v.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							});
						}
					},
					yAxis: { format: () => '' }
				}}
			>
				{#snippet marks({ context })}
					<defs>
						<linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stop-color="var(--color-created)" stop-opacity={1.0} />
							<stop offset="95%" stop-color="var(--color-created)" stop-opacity={0.1} />
						</linearGradient>
						<linearGradient id="fillAccepted" x1="0" y1="0" x2="0" y2="1">
							<stop offset="5%" stop-color="var(--color-accepted)" stop-opacity={0.8} />
							<stop offset="95%" stop-color="var(--color-accepted)" stop-opacity={0.1} />
						</linearGradient>
					</defs>
					{#each context.series.visibleSeries as s (s.key)}
						<Area
							seriesKey={s.key}
							curve={curveNatural}
							fillOpacity={0.4}
							line={{ class: 'stroke-1' }}
							motion="tween"
							{...s.props}
							fill={s.key === 'created' ? 'url(#fillCreated)' : 'url(#fillAccepted)'}
						/>
					{/each}
				{/snippet}
				{#snippet tooltip()}
					<Chart.Tooltip
						labelFormatter={(v: Date) => {
							return v.toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							});
						}}
						indicator="line"
					/>
				{/snippet}
			</AreaChart>
		</Chart.Container>
	</Card.Content>
</Card.Root>
