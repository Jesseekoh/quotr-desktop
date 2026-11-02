<script lang="ts">
	import type { BrandSettings } from '#lib/api/types.js';

	// Mirrors documentHeader() in pdf-shared.ts so the preview matches the exported PDF.
	let {
		brand,
		title,
		numberLabel,
		number
	}: {
		brand: BrandSettings | null;
		title: string;
		numberLabel: string;
		number: string;
	} = $props();

	let contactLines = $derived(
		[brand?.address, brand?.phone, brand?.email].filter((line): line is string => !!line)
	);
	let hasBrand = $derived(!!brand?.logo || !!brand?.businessName || contactLines.length > 0);
</script>

<header class="flex items-start justify-between gap-6">
	{#if hasBrand}
		<div class="flex min-w-0 flex-col gap-1">
			{#if brand?.logo}
				<!-- Logos are made for paper, so give them a white backing in dark mode. -->
				<img
					src={brand.logo}
					alt={brand.businessName ?? 'Business logo'}
					class="max-h-14 max-w-40 self-start object-contain dark:rounded dark:bg-white dark:p-1"
				/>
			{/if}
			{#if brand?.businessName}
				<div class="font-semibold" class:mt-1={!!brand.logo}>{brand.businessName}</div>
			{/if}
			{#each contactLines as line (line)}
				<div class="text-xs text-muted-foreground">{line}</div>
			{/each}
		</div>
	{/if}
	<div class={hasBrand ? 'text-right' : ''}>
		<h1 class="text-3xl font-bold tracking-tight">{title}</h1>
		<div class="mt-2 text-sm text-muted-foreground">
			{numberLabel} <span class="font-medium text-foreground">{number}</span>
		</div>
	</div>
</header>
