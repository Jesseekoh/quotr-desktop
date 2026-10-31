<script lang="ts">
	import {
		createTable,
		createColumnHelper,
		tableFeatures,
		FlexRender
	} from '@tanstack/svelte-table';
	import type { ColumnDef } from '@tanstack/svelte-table';
	import { onMount } from 'svelte';

	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import * as Tabs from '#lib/components/ui/tabs/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { cn } from '#lib/utils.js';
	import { IconCheck } from '@tabler/icons-svelte';

	import { getCategories, getProducts, type CategoryWithMarkup } from '#lib/api/products.js';
	import { getProductPriceForLabel } from '#lib/utils/pricing.js';
	import { formatNaira } from '#lib/utils/format.js';
	import CategorySelect from '#lib/components/product/category-select.svelte';
	import type { PriceLabel } from '#lib/api/types.js';
	import type { CatalogProduct as Product } from '#lib/api/types.js';
	import type { CreateItemPayload } from '#lib/api/quotes.js';

	let {
		open = $bindable(false),
		label,
		sectionId = null,
		optionId = null,
		onSubmit
	}: {
		open: boolean;
		label: PriceLabel;
		sectionId?: string | null;
		optionId?: string | null;
		onSubmit: (payload: CreateItemPayload) => void;
	} = $props();

	let activeTab = $state<'catalog' | 'freeform'>('catalog');

	// --- Catalog tab -------------------------------------------------

	let search = $state('');
	// '' means all categories.
	let categoryFilter = $state('');
	let categories = $state<CategoryWithMarkup[]>([]);
	let products = $state<Product[]>([]);
	let searching = $state(false);
	let selectedProduct = $state<Product | null>(null);
	let quantity = $state(1);

	let searchTimer: ReturnType<typeof setTimeout>;
	let hasMounted = false;

	async function runSearch() {
		searching = true;
		try {
			products = await getProducts({
				search: search || undefined,
				category: categoryFilter || undefined
			});
			// products = await searchProducts({
			// 	search: search || undefined,
			// 	category: category as Product['category'] | undefined
			// });
		} finally {
			searching = false;
		}
	}

	// Debounce as the user types/changes the filter.
	$effect(() => {
		// touch both so the effect re-runs on either change
		void search;
		void categoryFilter;
		if (!hasMounted) return;
		clearTimeout(searchTimer);
		searchTimer = setTimeout(runSearch, 300);
	});

	onMount(() => {
		hasMounted = true;
		void runSearch();
		getCategories().then((rows) => (categories = rows));
		return () => clearTimeout(searchTimer);
	});

	// v9 requires an explicit (possibly empty) feature set.
	const features = tableFeatures({});

	const columnHelper = createColumnHelper<typeof features, Product>();

	const columns: ColumnDef<typeof features, Product>[] = columnHelper.columns([
		// columnHelper.accessor('name', { header: 'Product' }),
		columnHelper.accessor('brand', { header: 'Brand' }),
		columnHelper.accessor('specification', { header: 'Description' }),
		columnHelper.accessor('category', {
			header: 'Category',
			cell: (info) => info.row.original.categoryName ?? '—'
		}),
		columnHelper.display({
			id: 'price',
			header: 'Price for this quote',
			cell: (info) => formatNaira(getProductPriceForLabel(info.row.original, label))
		})
	]);

	const table = createTable({
		features,
		columns,
		get data() {
			return products;
		}
	});

	function selectProduct(product: Product) {
		selectedProduct = selectedProduct?.id === product.id ? null : product;
	}

	function submitCatalog(e: Event) {
		e.preventDefault();
		if (!selectedProduct) return;
		onSubmit({
			productId: selectedProduct.id,
			quantity,
			quoteSectionId: sectionId,
			quoteOptionId: optionId
		});
		open = false;
	}

	// --- Freeform tab --------------------------------------------------

	let description = $state('');
	let brand = $state('');
	let specification = $state('');
	let unitPrice = $state<number | null>(null);
	let freeformQuantity = $state(1);
	let fixedPrice = $state(false);

	function resetForm() {
		activeTab = 'catalog';
		search = '';
		categoryFilter = '';
		selectedProduct = null;
		quantity = 1;
		description = '';
		brand = '';
		specification = '';
		unitPrice = null;
		freeformQuantity = 1;
		fixedPrice = false;
	}

	$effect(() => {
		if (!open) resetForm();
	});

	function submitFreeform(e: Event) {
		e.preventDefault();
		if (!description.trim() || unitPrice === null) return;
		onSubmit({
			description: description.trim(),
			brand: brand.trim() || undefined,
			specification: specification.trim() || undefined,
			unitPrice,
			quantity: fixedPrice ? 1 : freeformQuantity,
			quoteSectionId: sectionId,
			quoteOptionId: optionId
		});
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] max-w-3xl min-w-0 overflow-y-auto lg:max-w-5xl">
		<Dialog.Header>
			<Dialog.Title>Add item</Dialog.Title>
			<Dialog.Description>
				Pick a product from your catalog or type in a custom line item.
			</Dialog.Description>
		</Dialog.Header>

		<Tabs.Root bind:value={activeTab} class="w-full min-w-0">
			<Tabs.List>
				<Tabs.Trigger value="catalog">From catalog</Tabs.Trigger>
				<Tabs.Trigger value="freeform">Type it in</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="catalog">
				<form class="flex min-w-0 flex-col gap-3 pt-3" onsubmit={submitCatalog}>
					<div class="flex gap-2">
						<Input placeholder="Search products…" bind:value={search} class="flex-1" />
						<CategorySelect
							{categories}
							value={categoryFilter}
							onValueChange={(v) => (categoryFilter = v)}
							allLabel="All categories"
							class="w-48"
						/>
					</div>

					<div class="max-h-64 max-w-full min-w-0 overflow-auto rounded-md border">
						{#if searching}
							<p class="p-3 text-sm text-muted-foreground">Searching…</p>
						{:else if products.length === 0}
							<p class="p-3 text-sm text-muted-foreground">No products found.</p>
						{:else}
							<Table.Root class="w-max min-w-full text-xs">
								<Table.Header class="sticky top-0 bg-background">
									{#each table.getHeaderGroups() as headerGroup (headerGroup.id)}
										<Table.Row>
											<Table.Head class="h-8 w-8 px-1"></Table.Head>
											{#each headerGroup.headers as header (header.id)}
												<Table.Head
													class={cn(
														'h-8 px-1 text-xs',
														header.column.id === 'specification' && 'max-w-48 truncate'
													)}
												>
													{#if !header.isPlaceholder}
														<FlexRender {header} />
													{/if}
												</Table.Head>
											{/each}
										</Table.Row>
									{/each}
								</Table.Header>
								<Table.Body>
									{#each table.getRowModel().rows as row (row.id)}
										<Table.Row
											class={cn(
												'cursor-pointer',
												selectedProduct?.id === row.original.id && 'bg-muted'
											)}
											onclick={() => selectProduct(row.original)}
										>
											<Table.Cell class="w-8 p-1">
												{#if selectedProduct?.id === row.original.id}
													<IconCheck class="size-4 text-primary" />
												{/if}
											</Table.Cell>
											{#each row.getAllCells() as cell (cell.id)}
												<Table.Cell
													class={cn(
														'p-1 text-xs',
														cell.column.id === 'specification' && 'max-w-48 truncate'
													)}
												>
													<FlexRender {cell} />
												</Table.Cell>
											{/each}
										</Table.Row>
									{/each}
								</Table.Body>
							</Table.Root>
						{/if}
					</div>

					{#if selectedProduct}
						<div class="flex items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
							<p class="text-sm text-muted-foreground">{selectedProduct.specification}</p>
							<div class="flex items-center gap-2">
								<Label for="catalog-qty" class="text-sm">Quantity</Label>
								<Input id="catalog-qty" type="number" min="1" bind:value={quantity} class="w-20" />
							</div>
						</div>
					{/if}

					<Dialog.Footer>
						<Dialog.Close>
							{#snippet child({ props })}
								<Button {...props} variant="secondary">Cancel</Button>
							{/snippet}
						</Dialog.Close>
						<Button type="submit" disabled={!selectedProduct}>Add item</Button>
					</Dialog.Footer>
				</form>
			</Tabs.Content>

			<Tabs.Content value="freeform">
				<form class="flex flex-col gap-3 pt-3" onsubmit={submitFreeform}>
					<div class="flex flex-col gap-1.5">
						<Label for="ff-description">Description</Label>
						<Input
							id="ff-description"
							bind:value={description}
							required
							placeholder="e.g. Connecting cables & accessories"
						/>
					</div>

					<div class="flex flex-col gap-1.5">
						<Label for="ff-brand">Brand (optional)</Label>
						<Input id="ff-brand" bind:value={brand} />
					</div>

					<div class="flex flex-col gap-1.5">
						<Label for="ff-spec">Specification (optional)</Label>
						<Textarea id="ff-spec" bind:value={specification} rows={2} />
					</div>

					<div class="flex gap-3">
						<div class="flex flex-1 flex-col gap-1.5">
							<Label for="ff-price">Unit price (₦)</Label>
							<Input
								id="ff-price"
								type="number"
								min="0"
								step="any"
								bind:value={unitPrice}
								required
							/>
						</div>
						<div class="flex flex-col gap-1.5">
							<Label for="ff-qty">Quantity</Label>
							<Input
								id="ff-qty"
								type="number"
								min="1"
								bind:value={freeformQuantity}
								disabled={fixedPrice}
								class="w-20"
							/>
						</div>
					</div>

					<label for="ff-fixed-price" class="flex items-center gap-2 text-sm">
						<Checkbox id="ff-fixed-price" bind:checked={fixedPrice} />
						<span>Fixed price (quantity 1)</span>
					</label>

					<Dialog.Footer>
						<Dialog.Close>
							{#snippet child({ props })}
								<Button {...props} variant="secondary">Cancel</Button>
							{/snippet}
						</Dialog.Close>
						<Button type="submit">Add item</Button>
					</Dialog.Footer>
				</form>
			</Tabs.Content>
		</Tabs.Root>
	</Dialog.Content>
</Dialog.Root>
