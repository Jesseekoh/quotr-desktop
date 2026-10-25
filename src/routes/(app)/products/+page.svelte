<script lang="ts">
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import PlusIcon from '@tabler/icons-svelte/icons/plus';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings-2';
	import UploadIcon from '@tabler/icons-svelte/icons/upload';
	import PencilIcon from '@tabler/icons-svelte/icons/pencil';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import DatabaseIcon from '@tabler/icons-svelte/icons/database';
	import {
		FlexRender,
		createColumnHelper,
		createTable,
		renderComponent
	} from '@tanstack/svelte-table';
	import { goto, invalidateAll } from '$app/navigation';
	import * as Select from '#lib/components/ui/select/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { features, type DashboardTableFeatures } from '#lib/components/data-table-features.js';
	import { resolve } from '$app/paths';
	import type { Product } from '#lib/api/types.js';
	import { deleteProduct } from '#lib/api/products.js';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import * as Empty from '#lib/components/ui/empty/index.js';
	import { confirm } from '#lib/hooks/confirm.svelte.js';
	import CreateProductForm from '#lib/components/create-product-form.svelte';
	import MarkupSettings from '#lib/components/product/markup-settings.svelte';
	import ImportProducts from '#lib/components/product/import-products.svelte';
	import SpecCell from '#lib/components/product/spec-cell.svelte';
	import { PRODUCT_CATEGORIES } from '#lib/utils/pricing.js';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	// --- Filter state, seeded from the URL ---
	// svelte-ignore state_referenced_locally
	let category = $state(data.category);
	// svelte-ignore state_referenced_locally
	let search = $state(data.search);

	const CATEGORIES = [
		{ value: '', label: 'All Categories' },
		...PRODUCT_CATEGORIES.map((c) => ({ value: c.value as string, label: c.label }))
	];

	let categoryLabel = $derived(
		CATEGORIES.find((c) => c.value === category)?.label ?? 'All Categories'
	);

	/** Navigate with updated query params — lets the server re-run the load. */
	function applyFilters() {
		visibleCount = PAGE_STEP;
		const params = new SvelteURLSearchParams();
		if (category) params.set('category', category);
		if (search) params.set('search', search);
		const qs = params.toString();
		goto(`${resolve('/products')}${qs ? `?${qs}` : ''}`, {
			replaceState: true,
			keepFocus: true,
			noScroll: true
		});
	}

	function onCategoryChange(value: string) {
		category = value;
		applyFilters();
	}

	let debounceTimer: ReturnType<typeof setTimeout>;
	function onSearchInput() {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => applyFilters(), 350);
	}

	/** Format a Decimal/number value as currency. */
	function fmt(value: string | number): string {
		const n = typeof value === 'string' ? parseFloat(value) : value;
		return new Intl.NumberFormat('en-NG', {
			style: 'currency',
			currency: 'NGN',
			minimumFractionDigits: 2
		}).format(n);
	}

	/** Pretty-print a SCREAMING_SNAKE category enum value. */
	function fmtCategory(cat: string): string {
		return CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
	}

	// --- TanStack Table v9 setup ---
	/** How many rows to render initially and add per scroll step. */
	const PAGE_STEP = 50;

	const columnHelper = createColumnHelper<DashboardTableFeatures, Product>();

	const columns = columnHelper.columns([
		// columnHelper.accessor('name', {
		// 	header: 'Name',
		// 	enableHiding: false
		// }),
		columnHelper.accessor('brand', {
			header: 'Brand'
		}),
		columnHelper.accessor('category', {
			header: 'Category',
			cell: ({ getValue }) => fmtCategory(getValue())
		}),
		columnHelper.accessor('specification', {
			header: 'Specification',
			cell: ({ getValue }) => renderComponent(SpecCell, { spec: String(getValue()) })
		}),
		columnHelper.accessor('warranty', {
			header: 'Warranty',
			cell: ({ getValue }) => getValue() || '—'
		}),
		columnHelper.accessor('costPrice', {
			header: 'Cost Price',
			cell: ({ getValue }) => fmt(getValue())
		}),
		columnHelper.accessor('enduserPrice', {
			header: 'End User Price',
			cell: ({ getValue }) => fmt(getValue())
		}),
		columnHelper.accessor('discountPrice', {
			header: 'Discount Price',
			cell: ({ getValue }) => fmt(getValue())
		}),
		columnHelper.accessor('resalePrice', {
			header: 'Resale Price',
			cell: ({ getValue }) => fmt(getValue())
		}),
		columnHelper.accessor('specialPrice', {
			header: 'Special Price',
			cell: ({ getValue }) => fmt(getValue())
		})
	]);

	const table = createTable({
		features,
		get data() {
			return data.products;
		},
		columns,
		getRowId: (row) => row.id,
		// The pagination row model doubles as the infinite-scroll window:
		// it starts small and grows as the user scrolls.
		initialState: { pagination: { pageIndex: 0, pageSize: PAGE_STEP } }
	});

	// --- Infinite scroll ---
	let visibleCount = $state(PAGE_STEP);
	let sentinel = $state<HTMLElement>();

	const visibleRows = $derived(table.getRowModel().rows.length);
	const hasMore = $derived(visibleRows < data.products.length);

	$effect(() => {
		table.setPageSize(visibleCount);
	});

	$effect(() => {
		if (!sentinel) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting) && hasMore) {
					visibleCount += PAGE_STEP;
				}
			},
			// Start loading before the user actually reaches the bottom.
			{ rootMargin: '480px 0px' }
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	});

	let addDialogOpen = $state(false);
	let markupDialogOpen = $state(false);
	let importDialogOpen = $state(false);

	// The command palette links here with ?import=1 to open the import dialog.
	$effect(() => {
		if (data.openImport) importDialogOpen = true;
	});
	let editProduct = $state<Product | null>(null);

	function handleProductSaved() {
		addDialogOpen = false;
		editProduct = null;
		invalidateAll();
	}

	async function handleDelete(product: Product) {
		const confirmed = await confirm({
			title: 'Delete product?',
			description: `${product.brand} — ${product.specification} will be removed from your catalog. Quotes already created keep their recorded prices.`,
			confirmLabel: 'Delete',
			destructive: true
		});
		if (!confirmed) return;
		try {
			await deleteProduct(product.id);
			toast.success('Product removed from catalog');
			invalidateAll();
		} catch {
			toast.error('Failed to delete product');
		}
	}

	function handleImported() {
		importDialogOpen = false;
		invalidateAll();
	}

	let catalogEmpty = $derived(data.products.length === 0 && !data.search && !data.category);
</script>

<svelte:head>
	<title>Products · Quotr</title>
</svelte:head>

<div class="flex flex-1 flex-col">
	<div class="@container/main flex flex-1 flex-col gap-2">
		<div class="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
			<!-- Toolbar: category filter + search -->
			<div class="flex flex-col gap-3 px-4 sm:flex-row sm:items-end lg:px-6">
				<div class="flex flex-col gap-1.5">
					<Label for="category-filter" class="text-sm font-medium">Category</Label>
					<!-- <Select.Root type="single" bind:value={() => category, onCategoryChange}> -->
					<Select.Root type="single" value={category} onValueChange={onCategoryChange}>
						<Select.Trigger class="w-50" id="category-filter">
							{categoryLabel}
						</Select.Trigger>
						<Select.Content>
							{#each CATEGORIES as cat (cat.value)}
								<Select.Item value={cat.value}>{cat.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div class="relative flex-1 sm:max-w-sm">
					<Label for="search-input" class="sr-only">Search products</Label>
					<SearchIcon
						class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
					/>
					<Input
						id="search-input"
						type="search"
						placeholder="Search by name, brand, spec…"
						class="pl-9"
						bind:value={search}
						oninput={onSearchInput}
					/>
				</div>

				<div class="flex flex-col gap-2 sm:ml-auto sm:flex-row sm:items-center">
					<Dialog.Root bind:open={markupDialogOpen}>
						<Dialog.Trigger>
							{#snippet child({ props })}
								<Button {...props} variant="outline">
									<SettingsIcon class="size-4" />
									Markups
								</Button>
							{/snippet}
						</Dialog.Trigger>
						<Dialog.Content class="max-h-[90vh] max-w-2xl overflow-y-auto">
							<Dialog.Header>
								<Dialog.Title>Category Markups</Dialog.Title>
								<Dialog.Description>
									Markup percentage per price tier, applied to each product's cost price.
								</Dialog.Description>
							</Dialog.Header>
							<MarkupSettings onSaved={invalidateAll} />
						</Dialog.Content>
					</Dialog.Root>

					<Dialog.Root bind:open={importDialogOpen}>
						<Dialog.Trigger>
							{#snippet child({ props })}
								<Button {...props} variant="outline">
									<UploadIcon class="size-4" />
									Import
								</Button>
							{/snippet}
						</Dialog.Trigger>
						<Dialog.Content class="max-h-[90vh] max-w-2xl overflow-y-auto">
							<Dialog.Header>
								<Dialog.Title>Import from Excel</Dialog.Title>
								<Dialog.Description>
									Upload your price-list workbook to fill the catalog.
								</Dialog.Description>
							</Dialog.Header>
							<ImportProducts onImported={handleImported} />
						</Dialog.Content>
					</Dialog.Root>

					<Dialog.Root bind:open={addDialogOpen}>
						<Dialog.Trigger>
							{#snippet child({ props })}
								<Button {...props}>
									<PlusIcon class="size-4" />
									Add Product
								</Button>
							{/snippet}
						</Dialog.Trigger>
						<Dialog.Content class="max-h-[90vh] max-w-2xl overflow-y-auto">
							<Dialog.Header>
								<Dialog.Title>New Product</Dialog.Title>
								<Dialog.Description>
									Add a new product to your catalog. Fill in the details below.
								</Dialog.Description>
							</Dialog.Header>
							<CreateProductForm onSaved={handleProductSaved} />
						</Dialog.Content>
					</Dialog.Root>
				</div>
			</div>

			<!-- Data table -->
			<div class="px-4 lg:px-6">
				<div class="overflow-hidden rounded-lg border">
					<Table.Root>
						<Table.Header class="bg-muted">
							{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
								<Table.Row>
									{#each headerGroup.headers as header (header.id)}
										<Table.Head colspan={header.colSpan}>
											{#if !header.isPlaceholder}
												<FlexRender {header} />
											{/if}
										</Table.Head>
									{/each}
									<Table.Head class="w-16 text-right">
										<span class="sr-only">Actions</span>
									</Table.Head>
								</Table.Row>
							{/each}
						</Table.Header>
						<Table.Body>
							{#if table.getRowModel().rows?.length}
								{#each table.getRowModel().rows as row (row.id)}
									<Table.Row>
										{#each row.getVisibleCells() as cell (cell.id)}
											<Table.Cell>
												<FlexRender {cell} />
											</Table.Cell>
										{/each}
										<Table.Cell class="text-right whitespace-nowrap">
											<div class="flex justify-end gap-1">
												<Button
													variant="ghost"
													size="icon"
													class="size-8"
													onclick={() => (editProduct = row.original)}
												>
													<PencilIcon class="size-4 text-muted-foreground" />
													<span class="sr-only">Edit {row.original.brand}</span>
												</Button>
												<Button
													variant="ghost"
													size="icon"
													class="size-8 hover:text-destructive"
													onclick={() => handleDelete(row.original)}
												>
													<TrashIcon class="size-4" />
													<span class="sr-only">Delete {row.original.brand}</span>
												</Button>
											</div>
										</Table.Cell>
									</Table.Row>
								{/each}
							{:else}
								<Table.Row class="hover:bg-transparent">
									<Table.Cell colspan={columns.length + 1} class="h-24 text-center">
										{#if catalogEmpty}
											<Empty.Root class="py-10">
												<Empty.Header>
													<Empty.Media variant="icon"><DatabaseIcon /></Empty.Media>
													<Empty.Title>Your catalog is empty</Empty.Title>
													<Empty.Description>
														Import your price-list workbook, or add products one at a time.
													</Empty.Description>
												</Empty.Header>
												<Empty.Content class="flex-row justify-center">
													<Button onclick={() => (importDialogOpen = true)}>
														<UploadIcon class="size-4" />
														Import from Excel
													</Button>
													<Button variant="outline" onclick={() => (addDialogOpen = true)}>
														<PlusIcon class="size-4" />
														Add product
													</Button>
												</Empty.Content>
											</Empty.Root>
										{:else}
											No products match your filters.
										{/if}
									</Table.Cell>
								</Table.Row>
							{/if}
						</Table.Body>
					</Table.Root>
				</div>

				<!-- Infinite scroll sentinel + status -->
				{#if data.products.length > 0}
					<div bind:this={sentinel} aria-hidden="true"></div>
					<div class="flex items-center justify-between px-4 py-4 text-sm text-muted-foreground">
						<span>
							Showing {visibleRows} of {data.products.length}
							product{data.products.length === 1 ? '' : 's'}
						</span>
						{#if hasMore}
							<span>Scroll for more…</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Edit dialog: opened from a row's pencil button -->
<Dialog.Root
	open={editProduct !== null}
	onOpenChange={(o) => (editProduct = o ? editProduct : null)}
>
	<Dialog.Content class="max-h-[90vh] max-w-2xl overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>Edit Product</Dialog.Title>
			<Dialog.Description>
				Update the catalog entry. Existing quotes keep their recorded prices.
			</Dialog.Description>
		</Dialog.Header>
		{#if editProduct}
			{#key editProduct.id}
				<CreateProductForm product={editProduct} onSaved={handleProductSaved} />
			{/key}
		{/if}
	</Dialog.Content>
</Dialog.Root>
