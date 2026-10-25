<script lang="ts">
	import ChevronDownIcon from '@tabler/icons-svelte/icons/chevron-down';
	import LayoutColumnsIcon from '@tabler/icons-svelte/icons/layout-columns';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import {
		FlexRender,
		createColumnHelper,
		createTable,
		renderComponent
	} from '@tanstack/svelte-table';
	import { resolve } from '$app/paths';
	import { goto, invalidateAll } from '$app/navigation';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { toast } from 'svelte-sonner';
	import { confirm } from '#lib/hooks/confirm.svelte.js';
	import QuoteRowActions from './quote-row-actions.svelte';
	import QuoteStatusBadge from './quote-status-badge.svelte';
	import { features, type DashboardTableFeatures } from './data-table-features.js';
	import { formatNaira } from '#lib/utils/format.js';
	import {
		getRecentQuotes,
		type RecentQuoteStatus,
		type RecentQuotes
	} from '#lib/api/dashboard.js';
	import { duplicateQuote, removeQuote } from '#lib/api/quotes.js';

	type QuoteRow = RecentQuotes['rows'][number];
	type QuoteCounts = RecentQuotes['counts'];

	let { data: tableData }: { data: RecentQuotes } = $props();

	// svelte-ignore state_referenced_locally
	let rows = $state<QuoteRow[]>(tableData.rows);
	// svelte-ignore state_referenced_locally
	let counts = $state<QuoteCounts>(tableData.counts);
	let activeTab = $state('all');
	let isFetching = $state(false);

	// Keep in sync when the server load reruns (e.g. after creating a quote).
	$effect(() => {
		rows = tableData.rows;
		counts = tableData.counts;
	});

	const tabs = $derived([
		{ id: 'all', label: 'All', badge: counts.all },
		{ id: 'DRAFT', label: 'Drafts', badge: counts.DRAFT },
		{ id: 'SENT', label: 'Sent', badge: counts.SENT },
		{ id: 'ACCEPTED', label: 'Accepted', badge: counts.ACCEPTED }
	] as const);

	let activeLabel = $derived(tabs.find((tab) => activeTab === tab.id)?.label ?? 'All');

	async function switchTab(next: string) {
		if (next === activeTab || isFetching) return;
		activeTab = next;
		isFetching = true;
		try {
			const result = await getRecentQuotes(next as RecentQuoteStatus);
			rows = result.rows;
			counts = result.counts;
		} catch {
			toast.error('Failed to load quotes');
		} finally {
			isFetching = false;
		}
	}

	async function refresh() {
		const result = await getRecentQuotes(activeTab as RecentQuoteStatus);
		rows = result.rows;
		counts = result.counts;
	}

	function openQuote(id: string) {
		goto(resolve('/(app)/quotes/[id]', { id }));
	}

	async function duplicate(id: string) {
		try {
			const result = await duplicateQuote(id);
			toast.success(`Created ${result.quoteNumber}`);
			await invalidateAll();
			await refresh();
		} catch {
			toast.error('Failed to duplicate quote');
		}
	}

	async function remove(quote: QuoteRow) {
		const confirmed = await confirm({
			title: `Delete ${quote.quoteNumber}?`,
			description: 'The quote and all of its items will be removed. This cannot be undone.',
			confirmLabel: 'Delete quote',
			destructive: true
		});
		if (!confirmed) return;
		try {
			await removeQuote(quote.id);
			toast.success('Quote deleted');
			await refresh();
		} catch {
			toast.error('Failed to delete quote');
		}
	}

	function openOnRowClick(event: MouseEvent, id: string) {
		if ((event.target as HTMLElement).closest('button, a, [role=menu]')) return;
		openQuote(id);
	}

	const columnHelper = createColumnHelper<DashboardTableFeatures, QuoteRow>();

	const columns = columnHelper.columns([
		columnHelper.accessor('quoteNumber', {
			header: 'Quote',
			enableHiding: false
		}),
		columnHelper.accessor('customerName', {
			header: 'Client'
		}),
		columnHelper.accessor('status', {
			header: 'Status',
			cell: ({ row }) =>
				renderComponent(QuoteStatusBadge, {
					status: row.original.status,
					sentAt: row.original.sentAt
				})
		}),
		columnHelper.accessor('totalMax', {
			header: 'Total',
			cell: ({ row }) => {
				const { totalMin, totalMax } = row.original;
				return totalMax > totalMin
					? `${formatNaira(totalMin)} – ${formatNaira(totalMax)}`
					: formatNaira(totalMin);
			}
		}),
		columnHelper.accessor('createdAt', {
			header: 'Date',
			cell: ({ row }) =>
				new Date(row.original.sentAt ?? row.original.createdAt).toLocaleDateString('en-NG', {
					day: 'numeric',
					month: 'short',
					year: 'numeric'
				})
		}),
		columnHelper.display({
			id: 'actions',
			header: () => null,
			cell: ({ row }) =>
				renderComponent(QuoteRowActions, {
					onOpen: () => openQuote(row.original.id),
					onDuplicate: () => duplicate(row.original.id),
					onDelete: () => remove(row.original)
				})
		})
	]);

	// v9 manages its state internally — reads like
	// `table.getRowModel()` are rune-reactive, so no `$state` mirrors are needed.
	const table = createTable({
		features,
		get data() {
			return rows;
		},
		columns,
		getRowId: (row) => row.id
	});
</script>

<Tabs.Root value={activeTab} onValueChange={switchTab} class="w-full flex-col justify-start gap-6">
	<div class="flex items-center justify-between px-4 lg:px-6">
		<Label for="view-selector" class="sr-only">View</Label>
		<Select.Root type="single" value={activeTab} onValueChange={switchTab}>
			<Select.Trigger class="flex w-fit @4xl/main:hidden" size="sm" id="view-selector">
				{activeLabel}
			</Select.Trigger>
			<Select.Content>
				{#each tabs as tab (tab.id)}
					<Select.Item value={tab.id}>{tab.label}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>
		<Tabs.List
			class="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex"
		>
			{#each tabs as tab (tab.id)}
				<Tabs.Trigger value={tab.id}>
					{tab.label}
					{#if tab.badge > 0}
						<Badge variant="secondary">{tab.badge}</Badge>
					{/if}
				</Tabs.Trigger>
			{/each}
		</Tabs.List>
		<div class="flex items-center gap-2">
			<DropdownMenu.Root>
				<DropdownMenu.Trigger>
					{#snippet child({ props })}
						<Button variant="outline" size="sm" {...props}>
							<LayoutColumnsIcon />
							<span class="hidden lg:inline">Customize Columns</span>
							<span class="lg:hidden">Columns</span>
							<ChevronDownIcon />
						</Button>
					{/snippet}
				</DropdownMenu.Trigger>
				<DropdownMenu.Content align="end" class="w-56">
					{#each table
						.getAllColumns()
						.filter((col) => typeof col.accessorFn !== 'undefined' && col.getCanHide()) as column (column.id)}
						<DropdownMenu.CheckboxItem
							class="capitalize"
							checked={column.getIsVisible()}
							onCheckedChange={(value) => column.toggleVisibility(!!value)}
						>
							{column.id}
						</DropdownMenu.CheckboxItem>
					{/each}
				</DropdownMenu.Content>
			</DropdownMenu.Root>
			<Button variant="outline" size="sm" onclick={() => goto(resolve('/(app)/quotes/new'))}>
				<PlusIcon />
				<span class="hidden lg:inline">New Quote</span>
			</Button>
		</div>
	</div>
	<Tabs.Content value={activeTab} class="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6">
		<div class="overflow-hidden rounded-lg border transition-opacity" class:opacity-60={isFetching}>
			<Table.Root>
				<Table.Header class="sticky top-0 z-10 bg-muted">
					{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
						<Table.Row>
							{#each headerGroup.headers as header (header.id)}
								<Table.Head colspan={header.colSpan}>
									{#if !header.isPlaceholder}
										<FlexRender {header} />
									{/if}
								</Table.Head>
							{/each}
						</Table.Row>
					{/each}
				</Table.Header>
				<Table.Body>
					{#if table.getRowModel().rows?.length}
						{#each table.getRowModel().rows as row (row.id)}
							<Table.Row
								class="cursor-pointer"
								onclick={(event) => openOnRowClick(event, row.original.id)}
							>
								{#each row.getVisibleCells() as cell (cell.id)}
									<Table.Cell class={cell.column.id === 'quoteNumber' ? 'font-medium' : ''}>
										<FlexRender {cell} />
									</Table.Cell>
								{/each}
							</Table.Row>
						{/each}
					{:else if counts.all === 0}
						<Table.Row>
							<Table.Cell colspan={columns.length} class="h-24 text-center">
								No quotes yet. Click “New Quote” to create one.
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={columns.length} class="h-24 text-center">
								No {activeLabel.toLowerCase()} quotes.
							</Table.Cell>
						</Table.Row>
					{/if}
				</Table.Body>
			</Table.Root>
		</div>
		<div class="flex items-center justify-between px-4">
			<div class="text-sm text-muted-foreground">
				Showing {table.getRowModel().rows.length} of {counts.all} quote(s)
			</div>
		</div>
	</Tabs.Content>
</Tabs.Root>
