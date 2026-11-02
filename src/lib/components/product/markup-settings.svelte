<script lang="ts">
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import {
		createCategory,
		deleteCategory,
		getCategories,
		renameCategory,
		updateMarkup,
		updatePriceRoundingStep,
		type CategoryWithMarkup
	} from '#lib/api/products.js';
	import { getPriceRoundingStep } from '#lib/api/settings.js';
	import { errorMessage } from '#lib/api/types.js';
	import { MARKUP_FIELDS, ROUNDING_STEPS, bpToPercent, percentToBp } from '#lib/utils/markups.js';
	import CategorySelect from '#lib/components/product/category-select.svelte';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { confirm } from '#lib/hooks/confirm.svelte.js';
	import { toast } from 'svelte-sonner';

	type Props = {
		/** Called after a successful save so the page can refresh its data. */
		onSaved: () => void;
	};
	let { onSaved }: Props = $props();

	type Draft = Record<(typeof MARKUP_FIELDS)[number]['key'], string> & {
		name: string;
		inherit: boolean;
	};

	let isLoading = $state(true);
	let rows = $state<CategoryWithMarkup[]>([]);
	let drafts = $state<Record<string, Draft>>({});
	let savingCategory = $state<string | null>(null);
	let roundingStep = $state('1000');
	let savedStep = $state('1000');
	let newName = $state('');
	let newParent = $state('');

	$effect(() => {
		load();
	});

	async function load() {
		isLoading = true;
		try {
			const [data, step] = await Promise.all([getCategories(), getPriceRoundingStep()]);
			rows = data;
			roundingStep = savedStep = String(step);
			drafts = Object.fromEntries(
				data.map((r) => [
					r.id,
					{
						name: r.name,
						inherit: r.inherited,
						enduserPct: String(bpToPercent(r.enduserPct)),
						discountPct: String(bpToPercent(r.discountPct)),
						resalePct: String(bpToPercent(r.resalePct)),
						specialPct: String(bpToPercent(r.specialPct))
					}
				])
			);
		} catch {
			toast.error('Failed to load categories');
		} finally {
			isLoading = false;
		}
	}

	function parentOf(row: CategoryWithMarkup) {
		return rows.find((r) => r.id === row.parentId);
	}

	async function save(row: CategoryWithMarkup) {
		const draft = drafts[row.id];
		const pcts = {
			enduserPct: percentToBp(Number(draft.enduserPct)),
			discountPct: percentToBp(Number(draft.discountPct)),
			resalePct: percentToBp(Number(draft.resalePct)),
			specialPct: percentToBp(Number(draft.specialPct))
		};
		if (!draft.inherit && Object.values(pcts).some((v) => !Number.isFinite(v) || v < 0)) {
			toast.error('Markup percentages must be numbers between 0 and 200');
			return;
		}

		savingCategory = row.id;
		try {
			if (draft.name.trim() !== row.name) await renameCategory({ id: row.id, name: draft.name });
			const res = await updateMarkup({ category: row.id, inherit: draft.inherit, ...pcts });
			toast.success(`${draft.name.trim()} saved — ${res.updatedProducts} product(s) recalculated`);
			await load();
			onSaved();
		} catch (cause) {
			toast.error(errorMessage(cause, 'Failed to save markups'));
		} finally {
			savingCategory = null;
		}
	}

	async function saveRounding() {
		savingCategory = '__rounding__';
		try {
			const res = await updatePriceRoundingStep(Number(roundingStep));
			savedStep = roundingStep;
			toast.success(`Rounding saved — ${res.updatedProducts} product(s) recalculated`);
			onSaved();
		} catch (cause) {
			toast.error(errorMessage(cause, 'Failed to save rounding'));
		} finally {
			savingCategory = null;
		}
	}

	async function add(e: Event) {
		e.preventDefault();
		try {
			await createCategory({ name: newName, parentId: newParent || null });
			toast.success(`${newName.trim()} added`);
			newName = '';
			newParent = '';
			await load();
			onSaved();
		} catch (cause) {
			toast.error(errorMessage(cause, 'Failed to add category'));
		}
	}

	async function remove(row: CategoryWithMarkup) {
		const confirmed = await confirm({
			title: `Delete ${row.name}?`,
			description: 'The category is removed. Quotes that used it keep their line items.',
			confirmLabel: 'Delete',
			destructive: true
		});
		if (!confirmed) return;
		try {
			await deleteCategory(row.id);
			await load();
			onSaved();
		} catch (cause) {
			toast.error(errorMessage(cause, 'Failed to delete category'));
		}
	}

	const fmtStep = (step: number | string) => `₦${Number(step).toLocaleString('en-NG')}`;

	const hasChildren = (row: CategoryWithMarkup) => rows.some((r) => r.parentId === row.id);
</script>

<div class="space-y-3">
	<p class="text-sm text-muted-foreground">
		Sell prices are derived from the cost price. Changing a markup recalculates the prices of that
		category's products, except those priced by hand. Subcategories can use their parent's markups.
	</p>

	<div class="flex flex-wrap items-end gap-2 rounded-lg border p-3">
		<div class="space-y-1">
			<Label class="text-xs text-muted-foreground">Round sell prices to the nearest</Label>
			<Select.Root type="single" bind:value={roundingStep}>
				<Select.Trigger class="w-36">{fmtStep(roundingStep)}</Select.Trigger>
				<Select.Content>
					{#each ROUNDING_STEPS as step (step)}
						<Select.Item value={String(step)}>{fmtStep(step)}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
		</div>
		<Button
			size="sm"
			variant="outline"
			onclick={saveRounding}
			disabled={savingCategory !== null || roundingStep === savedStep}
		>
			{savingCategory === '__rounding__' ? 'Recalculating…' : 'Save & recalculate'}
		</Button>
	</div>

	{#if isLoading}
		<div class="space-y-2">
			{#each Array(3), i (i)}
				<div class="h-20 animate-pulse rounded-lg bg-muted"></div>
			{/each}
		</div>
	{:else}
		<div class="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
			{#each rows as row (row.id)}
				{@const draft = drafts[row.id]}
				{@const parent = parentOf(row)}
				<div class="rounded-lg border p-3 {row.parentId ? 'ml-6' : ''}">
					<div class="mb-2 flex items-center justify-between gap-2">
						<Input
							aria-label="Category name"
							class="h-8 max-w-60 font-medium"
							bind:value={draft.name}
						/>
						<div class="flex items-center gap-1">
							<Badge variant="secondary"
								>{row.productCount} product{row.productCount === 1 ? '' : 's'}</Badge
							>
							{#if row.productCount === 0 && !hasChildren(row) && row.id !== 'OTHER'}
								<Button
									variant="ghost"
									size="icon"
									class="size-8 hover:text-destructive"
									onclick={() => remove(row)}
								>
									<TrashIcon class="size-4" />
									<span class="sr-only">Delete {row.name}</span>
								</Button>
							{/if}
						</div>
					</div>
					{#if parent}
						<label class="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
							<Checkbox
								checked={draft.inherit}
								onCheckedChange={(c) => {
									draft.inherit = c === true;
									if (draft.inherit) {
										for (const f of MARKUP_FIELDS)
											draft[f.key] = String(bpToPercent(parent[f.key]));
									}
								}}
							/>
							Use {parent.name} markups
						</label>
					{/if}
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{#each MARKUP_FIELDS as field (field.key)}
							<div class="space-y-1">
								<Label for="mk-{row.id}-{field.key}" class="text-xs text-muted-foreground">
									{field.label}
								</Label>
								<div class="relative">
									<Input
										id="mk-{row.id}-{field.key}"
										type="number"
										step="0.5"
										min="0"
										max="200"
										class="pr-7"
										disabled={draft.inherit}
										bind:value={draft[field.key]}
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
							onclick={() => save(row)}
							disabled={savingCategory !== null}
						>
							{savingCategory === row.id ? 'Recalculating…' : 'Save & recalculate'}
						</Button>
					</div>
				</div>
			{/each}
		</div>

		<form class="flex flex-wrap items-end gap-2 rounded-lg border border-dashed p-3" onsubmit={add}>
			<div class="min-w-40 flex-1 space-y-1">
				<Label for="new-category" class="text-xs text-muted-foreground">New category</Label>
				<Input id="new-category" placeholder="e.g. Generator" bind:value={newName} required />
			</div>
			<div class="w-48 space-y-1">
				<Label class="text-xs text-muted-foreground">Inside</Label>
				<CategorySelect
					categories={rows}
					value={newParent}
					onValueChange={(v) => (newParent = v)}
					allLabel="Top level"
					topLevelOnly
				/>
			</div>
			<Button type="submit" size="sm">Add</Button>
		</form>
	{/if}
</div>
