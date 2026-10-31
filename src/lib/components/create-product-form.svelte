<script lang="ts">
	import {
		createProduct,
		updateProduct,
		getCategories,
		type CategoryWithMarkup
	} from '#lib/api/products.js';
	import { getPriceRoundingStep } from '#lib/api/settings.js';
	import type { Product } from '#lib/api/types.js';
	import { type ProductCategory } from '#lib/db/schema.js';
	import { priceFromMarkup } from '#lib/utils/markups.js';
	import CategorySelect from '#lib/components/product/category-select.svelte';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { toast } from 'svelte-sonner';

	type Props = {
		/** When set, the form edits this product instead of creating a new one. */
		product?: Product;
		onSaved: () => void;
	};
	let { product, onSaved }: Props = $props();

	let isLoading = $state(false);
	const editing = $derived(product !== undefined);

	// svelte-ignore state_referenced_locally
	let selectedCategory = $state<ProductCategory | undefined>(product?.category);
	// svelte-ignore state_referenced_locally
	let brand = $state(product?.brand ?? '');
	// svelte-ignore state_referenced_locally
	let specification = $state(product?.specification ?? '');
	// svelte-ignore state_referenced_locally
	let warranty = $state(product?.warranty ?? '');
	// svelte-ignore state_referenced_locally
	let unit = $state(product?.unit ?? '');
	// svelte-ignore state_referenced_locally
	let costPrice = $state(product !== undefined ? String(product.costPrice) : '');
	// svelte-ignore state_referenced_locally
	let enduserPrice = $state(product !== undefined ? String(product.enduserPrice) : '');
	// svelte-ignore state_referenced_locally
	let discountPrice = $state(product !== undefined ? String(product.discountPrice) : '');
	// svelte-ignore state_referenced_locally
	let resalePrice = $state(product !== undefined ? String(product.resalePrice) : '');
	// svelte-ignore state_referenced_locally
	let specialPrice = $state(product !== undefined ? String(product.specialPrice) : '');

	// Prices track the category markups until the user types one by hand,
	// which marks the product as manually priced: markup changes then leave it
	// alone. Editing a product that follows the markups shows its recalculated
	// prices up front, so saving never snaps them silently.
	// svelte-ignore state_referenced_locally
	let autoCalc = $state(!product?.manualPrices);
	let categories = $state<CategoryWithMarkup[]>([]);
	let roundingStep = $state(1000);

	$effect(() => {
		Promise.all([getCategories(), getPriceRoundingStep()]).then(([rows, step]) => {
			categories = rows;
			roundingStep = step;
			if (autoCalc) recalcFromCost();
		});
	});

	function categoryMarkups(): CategoryWithMarkup | undefined {
		return categories.find((c) => c.id === (selectedCategory ?? 'OTHER'));
	}

	function recalcFromCost() {
		const markup = categoryMarkups();
		const cost = Number(costPrice);
		if (!markup || costPrice === '' || !Number.isFinite(cost)) return;
		enduserPrice = String(priceFromMarkup(cost, markup.enduserPct, roundingStep));
		discountPrice = String(priceFromMarkup(cost, markup.discountPct, roundingStep));
		resalePrice = String(priceFromMarkup(cost, markup.resalePct, roundingStep));
		specialPrice = String(priceFromMarkup(cost, markup.specialPct, roundingStep));
	}

	function onCostInput() {
		if (autoCalc) recalcFromCost();
	}

	/** A hand-edited price detaches the form from the markups. */
	function onPriceInput() {
		autoCalc = false;
	}

	const PRICE_FIELDS = [
		{
			key: 'enduserPrice',
			label: 'End User',
			get: () => enduserPrice,
			set: (v: string) => (enduserPrice = v)
		},
		{
			key: 'discountPrice',
			label: 'Discount',
			get: () => discountPrice,
			set: (v: string) => (discountPrice = v)
		},
		{
			key: 'resalePrice',
			label: 'Resale',
			get: () => resalePrice,
			set: (v: string) => (resalePrice = v)
		},
		{
			key: 'specialPrice',
			label: 'Special',
			get: () => specialPrice,
			set: (v: string) => (specialPrice = v)
		}
	] as const;

	let categoryLabel = $derived(categoryMarkups()?.name ?? 'Select a category');

	async function handleSubmit(e: Event & { currentTarget: HTMLFormElement }) {
		e.preventDefault();
		isLoading = true;
		const form = e.currentTarget;
		const base = {
			brand: brand.trim(),
			category: (selectedCategory ?? 'OTHER') as ProductCategory,
			specification: specification.trim(),
			warranty: warranty.trim() || 'N/A',
			unit: unit.trim() || undefined,
			costPrice: Number(costPrice || 0),
			manualPrices: !autoCalc
		};

		const prices = {
			enduserPrice: Number(enduserPrice || 0),
			discountPrice: Number(discountPrice || 0),
			resalePrice: Number(resalePrice || 0),
			specialPrice: Number(specialPrice || 0)
		};

		try {
			if (product) {
				await updateProduct({
					id: product.id,
					...base,
					// Server recomputes the sell prices from the current category
					// markups; otherwise the hand-entered prices are kept.
					...(autoCalc ? { recalcPrices: true } : prices)
				});
				toast.success('Product updated');
			} else {
				// With autoCalc on, the price fields already hold the marked-up values.
				await createProduct({ ...base, ...prices });
				toast.success('Product created');
				form.reset();
			}
			onSaved();
		} catch {
			toast.error(product ? 'Failed to update product' : 'Failed to create product');
		} finally {
			isLoading = false;
		}
	}
</script>

<form class="space-y-4" onsubmit={handleSubmit}>
	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label for="cp-brand">Brand</Label>
			<Input
				id="cp-brand"
				name="brand"
				placeholder="e.g. Canadian Solar"
				bind:value={brand}
				required
			/>
		</div>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label>Category</Label>
			<CategorySelect
				{categories}
				value={selectedCategory ?? ''}
				onValueChange={(v) => {
					selectedCategory = v;
					if (autoCalc) recalcFromCost();
				}}
			/>
		</div>
		<div class="space-y-2">
			<Label for="cp-unit">Unit</Label>
			<Input id="cp-unit" name="unit" placeholder="e.g. pcs, metres (optional)" bind:value={unit} />
		</div>
	</div>

	<div class="space-y-2">
		<Label for="cp-specification">Specification</Label>
		<Textarea
			id="cp-specification"
			name="specification"
			placeholder="e.g. 550W Mono PERC, Vmp 38.4V, Imp 14.33A"
			rows={2}
			bind:value={specification}
			required
		/>
	</div>

	<div class="space-y-2">
		<Label for="cp-warranty">Warranty</Label>
		<Input id="cp-warranty" name="warranty" placeholder="e.g. 2 Years" bind:value={warranty} />
	</div>

	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<Label class="text-sm font-medium">Pricing (₦)</Label>
			{#if autoCalc}
				<span class="text-xs text-muted-foreground">
					Prices follow the {categoryLabel.toLowerCase()} markups
				</span>
			{/if}
		</div>
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="space-y-1">
				<Label for="cp-cost" class="text-xs text-muted-foreground">Cost</Label>
				<Input
					id="cp-cost"
					name="costPrice"
					type="number"
					placeholder="0.00"
					step="0.01"
					min="0"
					bind:value={costPrice}
					oninput={onCostInput}
					required
				/>
			</div>
			{#each PRICE_FIELDS as field (field.key)}
				<div class="space-y-1">
					<Label for="cp-{field.key}" class="text-xs text-muted-foreground">{field.label}</Label>
					<Input
						id="cp-{field.key}"
						name={field.key}
						type="number"
						placeholder="0.00"
						step="0.01"
						min="0"
						value={field.get()}
						oninput={(e) => {
							field.set(e.currentTarget.value);
							onPriceInput();
						}}
						required
					/>
				</div>
			{/each}
		</div>
		<label class="flex items-center gap-2 text-sm text-muted-foreground">
			<Checkbox
				checked={autoCalc}
				onCheckedChange={(checked) => {
					autoCalc = checked === true;
					if (autoCalc) recalcFromCost();
				}}
			/>
			Auto-calculate prices from markup
		</label>
	</div>

	<Button type="submit" class="w-full" disabled={isLoading}>
		{isLoading ? 'Saving…' : editing ? 'Save Changes' : 'Create Product'}
	</Button>
</form>
