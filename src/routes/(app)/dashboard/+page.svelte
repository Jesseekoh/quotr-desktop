<script lang="ts">
	import ChartAreaInteractive from '#lib/components/chart-area-interactive.svelte';
	import DataTable from '#lib/components/data-table.svelte';
	import SectionCards from '#lib/components/section-cards.svelte';
	import { getDashboardStats, type DashboardRange } from '#lib/api/dashboard.js';
	import { toast } from 'svelte-sonner';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const RANGE_LABELS: Record<DashboardRange, string> = {
		'90d': 'Last 3 months',
		'30d': 'Last 30 days',
		'7d': 'Last 7 days'
	};

	let range = $state<DashboardRange>('90d');
	// svelte-ignore state_referenced_locally
	let stats = $state(data.stats.cards);
	// svelte-ignore state_referenced_locally
	let chart = $state(data.stats.chart);
	let isRefreshing = $state(false);

	async function handleRangeChange(next: string) {
		if (next === range || isRefreshing) return;
		if (!(next in RANGE_LABELS)) return;
		isRefreshing = true;
		range = next as DashboardRange;
		try {
			const result = await getDashboardStats(range);
			stats = result.cards;
			chart = result.chart;
		} catch {
			toast.error('Failed to load dashboard data');
		} finally {
			isRefreshing = false;
		}
	}
</script>

<svelte:head>
	<title>Dashboard · Quotr</title>
</svelte:head>

<div class="flex flex-1 flex-col">
	<div class="@container/main flex flex-1 flex-col gap-2">
		<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<SectionCards {stats} rangeLabel={RANGE_LABELS[range]} loading={isRefreshing} />
			<div class="px-4 lg:px-6">
				<ChartAreaInteractive
					{chart}
					{range}
					loading={isRefreshing}
					onRangeChange={handleRangeChange}
				/>
			</div>
			<DataTable data={data.quotes} />
		</div>
	</div>
</div>
