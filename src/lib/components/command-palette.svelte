<script lang="ts">
	import CirclePlusIcon from '@tabler/icons-svelte/icons/circle-plus';
	import DashboardIcon from '@tabler/icons-svelte/icons/dashboard';
	import DatabaseIcon from '@tabler/icons-svelte/icons/database';
	import FileDescriptionIcon from '@tabler/icons-svelte/icons/file-description';
	import FileInvoiceIcon from '@tabler/icons-svelte/icons/file-invoice';
	import MoonIcon from '@tabler/icons-svelte/icons/moon';
	import PackageIcon from '@tabler/icons-svelte/icons/package';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings';
	import UploadIcon from '@tabler/icons-svelte/icons/upload';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toggleMode } from 'mode-watcher';
	import * as Command from '#lib/components/ui/command/index.js';
	import { getQuotes } from '#lib/api/quotes.js';
	import { getInvoices } from '#lib/api/invoices.js';
	import { getProducts } from '#lib/api/products.js';
	import type { CatalogProduct } from '#lib/api/types.js';
	import { shortcutLabel } from '#lib/hooks/shortcuts.js';
	import { formatNaira } from '#lib/utils/format.js';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	type Entry = { id: string; label: string; detail: string };

	let search = $state('');
	let quotes = $state<Entry[]>([]);
	let invoices = $state<Entry[]>([]);
	let products = $state<CatalogProduct[]>([]);

	// Quotes and invoices are few enough to load whole; refresh on every open.
	$effect(() => {
		if (!open) {
			search = '';
			return;
		}
		Promise.all([getQuotes(), getInvoices()]).then(([quoteRows, invoiceRows]) => {
			quotes = quoteRows.map((quote) => ({
				id: quote.id,
				label: quote.quoteNumber,
				detail: quote.customer.name
			}));
			invoices = invoiceRows.map((invoice) => ({
				id: invoice.id,
				label: invoice.invoiceNumber,
				detail: invoice.customer.name
			}));
		});
	});

	// The catalog can hold thousands of rows, so only search it once there's a query.
	let productTimer: ReturnType<typeof setTimeout>;
	$effect(() => {
		const term = search.trim();
		clearTimeout(productTimer);
		if (term.length < 2) {
			products = [];
			return;
		}
		productTimer = setTimeout(async () => {
			const rows = await getProducts({ search: term });
			if (search.trim() === term) products = rows.slice(0, 8);
		}, 150);
		return () => clearTimeout(productTimer);
	});

	function matches(entry: Entry) {
		const term = search.trim().toLowerCase();
		return (
			!term || entry.label.toLowerCase().includes(term) || entry.detail.toLowerCase().includes(term)
		);
	}

	let visibleQuotes = $derived(quotes.filter(matches).slice(0, search ? 8 : 5));
	let visibleInvoices = $derived(invoices.filter(matches).slice(0, search ? 8 : 5));

	const actions = [
		{
			label: 'New quote',
			icon: CirclePlusIcon,
			shortcut: 'mod+n',
			run: () => goto(resolve('/quotes/new'))
		},
		{
			label: 'Import products from Excel',
			icon: UploadIcon,
			run: () => goto(`${resolve('/products')}?import=1`)
		},
		{ label: 'Dashboard', icon: DashboardIcon, run: () => goto(resolve('/dashboard')) },
		{ label: 'Quotes', icon: FileDescriptionIcon, run: () => goto(resolve('/quotes')) },
		{ label: 'Invoices', icon: FileInvoiceIcon, run: () => goto(resolve('/invoices')) },
		{ label: 'Products', icon: DatabaseIcon, run: () => goto(resolve('/products')) },
		{
			label: 'Settings',
			icon: SettingsIcon,
			shortcut: 'mod+,',
			run: () => goto(resolve('/settings'))
		},
		{ label: 'Toggle dark mode', icon: MoonIcon, run: toggleMode }
	];

	let visibleActions = $derived(
		actions.filter((action) => action.label.toLowerCase().includes(search.trim().toLowerCase()))
	);

	function run(action: () => unknown) {
		open = false;
		action();
	}
</script>

<Command.Dialog
	bind:open
	shouldFilter={false}
	title="Search"
	description="Jump to a quote, invoice or product, or run an action."
>
	<Command.Input placeholder="Search quotes, invoices, products…" bind:value={search} />
	<Command.List class="max-h-[60vh]">
		<Command.Empty>No results.</Command.Empty>
		{#if visibleActions.length}
			<Command.Group heading="Actions">
				{#each visibleActions as action (action.label)}
					<Command.Item value={`action:${action.label}`} onSelect={() => run(action.run)}>
						<action.icon />
						{action.label}
						{#if action.shortcut}
							<Command.Shortcut>{shortcutLabel(action.shortcut)}</Command.Shortcut>
						{/if}
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
		{#if visibleQuotes.length}
			<Command.Group heading={search ? 'Quotes' : 'Recent quotes'}>
				{#each visibleQuotes as quote (quote.id)}
					<Command.Item
						value={`quote:${quote.id}`}
						onSelect={() => run(() => goto(resolve('/(app)/quotes/[id]', { id: quote.id })))}
					>
						<FileDescriptionIcon />
						<span class="font-medium">{quote.label}</span>
						<span class="truncate text-muted-foreground">{quote.detail}</span>
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
		{#if visibleInvoices.length}
			<Command.Group heading={search ? 'Invoices' : 'Recent invoices'}>
				{#each visibleInvoices as invoice (invoice.id)}
					<Command.Item
						value={`invoice:${invoice.id}`}
						onSelect={() => run(() => goto(resolve('/(app)/invoices/[id]', { id: invoice.id })))}
					>
						<FileInvoiceIcon />
						<span class="font-medium">{invoice.label}</span>
						<span class="truncate text-muted-foreground">{invoice.detail}</span>
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
		{#if products.length}
			<Command.Group heading="Products">
				{#each products as product (product.id)}
					<Command.Item
						value={`product:${product.id}`}
						onSelect={() =>
							run(() =>
								goto(`${resolve('/products')}?search=${encodeURIComponent(product.brand)}`)
							)}
					>
						<PackageIcon />
						<span class="min-w-0 flex-1 truncate">
							<span class="font-medium">{product.brand}</span>
							<span class="text-muted-foreground">· {product.specification}</span>
						</span>
						<span class="shrink-0 text-xs text-muted-foreground">
							{product.categoryName ?? 'Uncategorised'} · {formatNaira(product.enduserPrice)}
						</span>
					</Command.Item>
				{/each}
			</Command.Group>
		{/if}
	</Command.List>
</Command.Dialog>
