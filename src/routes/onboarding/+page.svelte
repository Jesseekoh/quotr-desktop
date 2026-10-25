<script lang="ts">
	import ArrowLeftIcon from '@tabler/icons-svelte/icons/arrow-left';
	import ArrowRightIcon from '@tabler/icons-svelte/icons/arrow-right';
	import CheckIcon from '@tabler/icons-svelte/icons/check';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import BrandHeader from '#lib/components/brand-header.svelte';
	import BusinessFields, {
		type BusinessDetails
	} from '#lib/components/brand/business-fields.svelte';
	import LogoPicker from '#lib/components/brand/logo-picker.svelte';
	import ImportProducts from '#lib/components/product/import-products.svelte';
	import { completeOnboarding, updateBrandSettings } from '#lib/api/settings.js';
	import { errorMessage } from '#lib/api/types.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const STEPS = [
		{ title: 'Your business', description: 'Name and contact details' },
		{ title: 'Logo', description: 'Printed on every PDF' },
		{ title: 'Products', description: 'Import your price list' },
		{ title: 'All set', description: 'Start quoting' }
	] as const;

	// Resume where a previous, unfinished setup left off.
	// svelte-ignore state_referenced_locally
	let step = $state(data.brand.businessName ? 1 : 0);
	// svelte-ignore state_referenced_locally
	let details = $state<BusinessDetails>({
		businessName: data.brand.businessName ?? '',
		email: data.brand.email ?? '',
		phone: data.brand.phone ?? '',
		address: data.brand.address ?? ''
	});
	// svelte-ignore state_referenced_locally
	let logo = $state<string | null>(data.brand.logo);
	// svelte-ignore state_referenced_locally
	let productCount = $state(data.productCount);
	let processingLogo = $state(false);
	let saving = $state(false);

	let previewBrand = $derived({
		businessName: details.businessName.trim() || null,
		email: details.email.trim() || null,
		phone: details.phone.trim() || null,
		address: details.address.trim() || null,
		logo,
		onboardedAt: null
	});

	async function save(next: number) {
		saving = true;
		try {
			await updateBrandSettings({ ...details, logo });
			step = next;
		} catch (cause) {
			toast.error(errorMessage(cause, 'Could not save your business details.'));
		} finally {
			saving = false;
		}
	}

	function submitDetails(event: Event) {
		event.preventDefault();
		if (!details.businessName.trim()) return;
		void save(1);
	}

	function submitLogo(event: Event) {
		event.preventDefault();
		void save(2);
	}

	async function finish(destination: '/dashboard' | '/quotes/new' | '/products') {
		saving = true;
		try {
			await completeOnboarding({ ...details, logo });
			await goto(resolve(destination), { invalidateAll: true });
		} catch (cause) {
			toast.error(errorMessage(cause, 'Could not finish setup.'));
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Welcome · Quotr</title>
</svelte:head>

<div class="flex min-h-svh bg-muted/40">
	<aside class="hidden w-72 shrink-0 flex-col gap-10 border-r bg-sidebar p-8 md:flex">
		<div class="flex items-center gap-2">
			<InnerShadowTopIcon class="size-5" />
			<span class="text-base font-semibold">Quotr.</span>
		</div>
		<ol class="flex flex-col gap-1">
			{#each STEPS as item, index (item.title)}
				{@const done = index < step}
				{@const current = index === step}
				<li
					class="flex items-start gap-3 rounded-lg px-2 py-2.5"
					class:bg-sidebar-accent={current}
					aria-current={current ? 'step' : undefined}
				>
					<span
						class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums
							{done || current ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground'}"
					>
						{#if done}<CheckIcon class="size-3.5" />{:else}{index + 1}{/if}
					</span>
					<span class="flex flex-col">
						<span class="text-sm font-medium" class:text-muted-foreground={!done && !current}>
							{item.title}
						</span>
						<span class="text-xs text-muted-foreground">{item.description}</span>
					</span>
				</li>
			{/each}
		</ol>
		<p class="mt-auto text-xs text-muted-foreground">
			Everything stays on this computer. You can change any of this later in Settings.
		</p>
	</aside>

	<main class="flex flex-1 items-center justify-center p-6">
		<div class="flex w-full max-w-xl flex-col gap-6">
			<p class="text-sm text-muted-foreground md:hidden">
				Step {step + 1} of {STEPS.length} · {STEPS[step].title}
			</p>

			{#if step === 0}
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">Welcome to Quotr</h1>
					<p class="text-sm text-muted-foreground">
						Let's set up your business so your quotes and invoices go out under your name.
					</p>
				</div>
				<form onsubmit={submitDetails}>
					<Card.Root>
						<Card.Header>
							<Card.Title>Business details</Card.Title>
							<Card.Description>
								These appear in the header of every quote and invoice PDF.
							</Card.Description>
						</Card.Header>
						<Card.Content>
							<BusinessFields bind:values={details} requireName autofocus />
						</Card.Content>
						<Card.Footer class="justify-end">
							<Button type="submit" disabled={saving || !details.businessName.trim()}>
								Continue
								<ArrowRightIcon class="size-4" />
							</Button>
						</Card.Footer>
					</Card.Root>
				</form>
			{:else if step === 1}
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">Add your logo</h1>
					<p class="text-sm text-muted-foreground">
						Your logo is printed at the top of quote and invoice PDFs.
					</p>
				</div>
				<form onsubmit={submitLogo}>
					<Card.Root>
						<Card.Content class="flex flex-col gap-6">
							<LogoPicker bind:logo bind:processing={processingLogo} />
							<div class="flex flex-col gap-2">
								<span class="text-xs font-medium text-muted-foreground">PDF preview</span>
								<!-- Always light: this is how the printed page will look. -->
								<div class="paper rounded-lg border p-5 shadow-xs">
									<BrandHeader
										brand={previewBrand}
										title="Quote"
										numberLabel="Quote Number"
										number="Q-0001"
									/>
								</div>
							</div>
						</Card.Content>
						<Card.Footer class="justify-between">
							<Button type="button" variant="ghost" onclick={() => (step = 0)}>
								<ArrowLeftIcon class="size-4" />
								Back
							</Button>
							<Button type="submit" disabled={saving || processingLogo}>
								{logo ? 'Continue' : 'Skip for now'}
								<ArrowRightIcon class="size-4" />
							</Button>
						</Card.Footer>
					</Card.Root>
				</form>
			{:else if step === 2}
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">Import your products</h1>
					<p class="text-sm text-muted-foreground">
						Optional. Bring in your price-list workbook now so you can quote straight away, or add
						products later.
					</p>
				</div>
				<Card.Root>
					<Card.Content class="flex flex-col gap-4">
						{#if productCount > 0}
							<p
								class="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
								role="status"
							>
								<CheckIcon class="mr-1 inline size-4 text-emerald-600" />
								{productCount} product{productCount === 1 ? '' : 's'} in your catalog.
							</p>
						{/if}
						<ImportProducts onImported={(result) => (productCount += result.inserted)} />
					</Card.Content>
					<Card.Footer class="justify-between">
						<Button type="button" variant="ghost" onclick={() => (step = 1)}>
							<ArrowLeftIcon class="size-4" />
							Back
						</Button>
						<Button
							type="button"
							variant={productCount > 0 ? 'default' : 'outline'}
							onclick={() => (step = 3)}
						>
							{productCount > 0 ? 'Continue' : 'Skip for now'}
							<ArrowRightIcon class="size-4" />
						</Button>
					</Card.Footer>
				</Card.Root>
			{:else}
				<div>
					<h1 class="text-2xl font-semibold tracking-tight">You're all set</h1>
					<p class="text-sm text-muted-foreground">
						{details.businessName.trim()} is ready to send its first quote.
					</p>
				</div>
				<Card.Root>
					<Card.Content class="flex flex-col gap-3 text-sm">
						<div class="flex items-center gap-2">
							<CheckIcon class="size-4 text-emerald-600" />
							Business details saved
						</div>
						<div class="flex items-center gap-2" class:text-muted-foreground={!logo}>
							<CheckIcon class="size-4 {logo ? 'text-emerald-600' : 'text-muted-foreground/50'}" />
							{logo ? 'Logo added' : 'No logo yet. Add one any time in Settings.'}
						</div>
						<div class="flex items-center gap-2" class:text-muted-foreground={productCount === 0}>
							<CheckIcon
								class="size-4 {productCount > 0 ? 'text-emerald-600' : 'text-muted-foreground/50'}"
							/>
							{productCount > 0
								? `${productCount} product${productCount === 1 ? '' : 's'} in your catalog`
								: 'No products yet. You can import or add them from Products.'}
						</div>
					</Card.Content>
					<Card.Footer class="justify-between">
						<Button type="button" variant="ghost" onclick={() => (step = 2)} disabled={saving}>
							<ArrowLeftIcon class="size-4" />
							Back
						</Button>
						<div class="flex gap-2">
							<Button
								type="button"
								variant="outline"
								disabled={saving}
								onclick={() => finish(productCount > 0 ? '/dashboard' : '/products')}
							>
								{productCount > 0 ? 'Go to dashboard' : 'Go to products'}
							</Button>
							<Button type="button" disabled={saving} onclick={() => finish('/quotes/new')}>
								Create your first quote
								<ArrowRightIcon class="size-4" />
							</Button>
						</div>
					</Card.Footer>
				</Card.Root>
			{/if}
		</div>
	</main>
</div>
