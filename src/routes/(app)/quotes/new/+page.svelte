<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CustomerPicker from '#lib/components/quote/CustomerPicker.svelte';
	import { PRICE_LABEL_OPTIONS } from '#lib/utils/pricing.js';
	import { errorMessage as messageFor, type PriceLabel } from '#lib/api/types.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Label from '#lib/components/ui/label/label.svelte';
	import * as Select from '#lib/components/ui/select/index.js';
	import { createCustomer } from '#lib/api/customers.js';
	import { createQuote } from '#lib/api/quotes.js';

	let mode = $state<'existing' | 'new'>('existing');
	let customerId = $state<string | null>(null);
	let newCustomer = $state({ name: '', phone: '', email: '', address: '' });

	let label = $state<PriceLabel>('ENDUSER_PRICE');
	let loadProfileTotal = $state<number | null>(null);
	let loadProfileNotes = $state('');
	let paymentTerms = $state('');

	let submitting = $state(false);
	let errorMessage = $state<string | null>(null);

	async function submit(e: Event) {
		e.preventDefault();
		errorMessage = null;

		if (mode === 'existing' && !customerId) {
			errorMessage = 'Select an existing customer, or switch to "New customer".';
			return;
		}
		if (mode === 'new' && !newCustomer.name.trim()) {
			errorMessage = "Enter the new customer's name.";
			return;
		}

		submitting = true;
		try {
			let resolvedCustomerId = customerId;

			if (mode === 'new') {
				const customer = await createCustomer({
					name: newCustomer.name.trim(),
					phone: newCustomer.phone.trim() || undefined,
					email: newCustomer.email.trim() || undefined,
					address: newCustomer.address.trim() || undefined
				});
				resolvedCustomerId = customer.id;
			}

			const quote = await createQuote({
				customerId: resolvedCustomerId as string,
				label,
				loadProfileTotal: loadProfileTotal ?? undefined,
				loadProfileNotes: loadProfileNotes.trim() || undefined,
				paymentTerms: paymentTerms.trim() || undefined
			});

			await goto(resolve('/(app)/quotes/[id]', { id: quote.id }));
		} catch (err) {
			errorMessage = messageFor(err, 'Could not create the quote. Please try again.');
		} finally {
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>New quote · Quotr</title>
</svelte:head>

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 lg:px-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">New quote</h1>
		<p class="text-sm text-muted-foreground">Create a quote for a customer.</p>
	</div>

	{#if errorMessage}
		<p
			class="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		>
			{errorMessage}
		</p>
	{/if}

	<form class="flex flex-col gap-6" onsubmit={submit}>
		<Card.Root>
			<Card.Header>
				<Card.Title>Customer</Card.Title>
				<Card.Description>Choose an existing customer or add a new one.</Card.Description>
			</Card.Header>
			<Card.Content>
				<CustomerPicker bind:mode bind:customerId bind:newCustomer />
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header>
				<Card.Title>Quote details</Card.Title>
				<Card.Description>Set the pricing and payment details for this quote.</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<Label for="price-label">Price label</Label>
					<Select.Root
						type="single"
						bind:value={() => label, (value) => (label = value as PriceLabel)}
					>
						<Select.Trigger id="price-label" class="w-full">
							{PRICE_LABEL_OPTIONS.find((option) => option.value === label)?.text}
						</Select.Trigger>
						<Select.Content>
							{#each PRICE_LABEL_OPTIONS as opt (opt.value)}
								<Select.Item value={opt.value}>{opt.text}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
					<p class="text-xs text-muted-foreground">
						Decides which price tier catalog items use on this quote.
					</p>
				</div>

				<div class="grid gap-5 sm:grid-cols-2">
					<Label class="flex flex-col gap-2">
						<span>Total load (optional)</span>
						<Input
							type="number"
							min="0"
							step="any"
							bind:value={loadProfileTotal}
							placeholder="e.g. 5580"
						/>
					</Label>
					<Label class="flex flex-col gap-2">
						<span>Load profile notes (optional)</span>
						<Input bind:value={loadProfileNotes} placeholder="e.g. Fridge, TVs, lights, sockets" />
					</Label>
				</div>

				<Label class="flex flex-col gap-2">
					<span>Payment terms (optional)</span>
					<Input
						bind:value={paymentTerms}
						placeholder="e.g. 80% prepayment, balance on completion"
					/>
				</Label>
			</Card.Content>
		</Card.Root>

		<div class="flex justify-end">
			<Button type="submit" disabled={submitting}>
				{submitting ? 'Creating…' : 'Create quote'}
			</Button>
		</div>
	</form>
</div>
