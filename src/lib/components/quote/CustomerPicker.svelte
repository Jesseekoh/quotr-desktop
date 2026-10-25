<script lang="ts">
	import { searchCustomers } from '#lib/api/customers.js';
	import Input from '../ui/input/input.svelte';
	import Textarea from '../ui/textarea/textarea.svelte';
	import * as Tabs from '#lib/components/ui/tabs/index.js';

	// The remote layer returns Drizzle rows (Date timestamps), not the API Client type.
	type CustomerResult = Awaited<ReturnType<typeof searchCustomers>>[number];

	let {
		mode = $bindable<'existing' | 'new'>('existing'),
		// eslint-disable-next-line no-useless-assignment -- write-only bindable; the parent reads it
		customerId = $bindable<string | null>(),
		newCustomer = $bindable({ name: '', phone: '', email: '', address: '' })
	} = $props();

	let search = $state('');
	let results = $state<CustomerResult[]>([]);
	let searching = $state(false);
	let selectedCustomer = $state<CustomerResult | null>(null);
	let searchTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		void search;
		clearTimeout(searchTimer);
		if (!search.trim() || (selectedCustomer && search === selectedCustomer.name)) {
			results = [];
			return;
		}
		searchTimer = setTimeout(async () => {
			searching = true;
			try {
				results = await searchCustomers(search.trim());
			} finally {
				searching = false;
			}
		}, 300);
	});

	function selectCustomer(customer: CustomerResult) {
		selectedCustomer = customer;
		customerId = customer.id;
		search = customer.name;
		results = [];
	}

	function handleSearchInput() {
		if (selectedCustomer && search !== selectedCustomer.name) {
			selectedCustomer = null;
			customerId = null;
		}
	}
</script>

<Tabs.Root
	value={mode === 'existing' ? 'existing-customer' : 'new-customer'}
	onValueChange={(v) => (mode = v === 'existing-customer' ? 'existing' : 'new')}
>
	<Tabs.List>
		<Tabs.Trigger value="existing-customer">Existing customer</Tabs.Trigger>
		<Tabs.Trigger value="new-customer">New customer</Tabs.Trigger>
	</Tabs.List>

	<Tabs.Content value="existing-customer" class="flex flex-col gap-3 pt-4">
		<label class="flex flex-col gap-1.5 text-sm">
			<span class="font-medium">Search customers</span>
			<Input
				bind:value={search}
				oninput={handleSearchInput}
				placeholder="Search by name, phone, or email…"
			/>
		</label>

		{#if searching}
			<p class="text-sm text-muted-foreground">Searching…</p>
		{:else if results.length > 0}
			<ul class="max-h-40 divide-y overflow-y-auto rounded-md border text-sm">
				{#each results as customer (customer.id)}
					<li>
						<button
							type="button"
							class="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
							onclick={() => selectCustomer(customer)}
						>
							<span class="truncate font-medium">{customer.name}</span>
							{#if customer.phone || customer.email}
								<span class="truncate text-xs text-muted-foreground">
									{customer.phone ?? customer.email}
								</span>
							{/if}
						</button>
					</li>
				{/each}
			</ul>
		{:else if search.trim() && !selectedCustomer}
			<p class="text-sm text-muted-foreground">No matches. Switch to "New customer" to add them.</p>
		{/if}

		{#if selectedCustomer}
			<p class="text-sm text-emerald-600 dark:text-emerald-400">
				Selected: <strong>{selectedCustomer.name}</strong>
			</p>
		{/if}
	</Tabs.Content>

	<Tabs.Content value="new-customer" class="flex flex-col gap-4 pt-4">
		<label class="flex flex-col gap-1.5 text-sm">
			<span class="font-medium">Name</span>
			<Input
				bind:value={newCustomer.name}
				disabled={mode !== 'new'}
				required={mode === 'new'}
				placeholder="Customer's full name"
			/>
		</label>

		<div class="grid gap-4 sm:grid-cols-2">
			<label class="flex flex-col gap-1.5 text-sm">
				<span class="font-medium">Phone</span>
				<Input
					type="tel"
					bind:value={newCustomer.phone}
					disabled={mode !== 'new'}
					placeholder="080…"
				/>
			</label>
			<label class="flex flex-col gap-1.5 text-sm">
				<span class="font-medium">Email</span>
				<Input
					type="email"
					bind:value={newCustomer.email}
					disabled={mode !== 'new'}
					placeholder="customer@email.com"
				/>
			</label>
		</div>

		<label class="flex flex-col gap-1.5 text-sm">
			<span class="font-medium">Address</span>
			<Textarea
				bind:value={newCustomer.address}
				disabled={mode !== 'new'}
				rows={2}
				placeholder="Street, city, state…"
			/>
		</label>
	</Tabs.Content>
</Tabs.Root>
