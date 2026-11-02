<script lang="ts">
	import SearchIcon from '@tabler/icons-svelte/icons/search';
	import { page } from '$app/state';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Kbd } from '#lib/components/ui/kbd/index.js';
	import DarkModeToggle from '#lib/components/dark-mode-toggle.svelte';
	import { shortcutLabel } from '#lib/hooks/shortcuts.js';

	let { onSearch }: { onSearch: () => void } = $props();

	const TITLES: [prefix: string, title: string][] = [
		['/dashboard', 'Dashboard'],
		['/quotes/new', 'New quote'],
		['/quotes', 'Quotes'],
		['/invoices', 'Invoices'],
		['/products', 'Products'],
		['/settings', 'Settings']
	];

	let title = $derived(
		TITLES.find(([prefix]) => page.url.pathname.startsWith(prefix))?.[1] ?? 'Quotr'
	);
</script>

<header
	data-app-header
	class="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)"
>
	<div class="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
		<Sidebar.Trigger class="-ms-1" title="Toggle sidebar ({shortcutLabel('mod+b')})" />
		<Separator orientation="vertical" class="mx-2 data-vertical:h-4 data-vertical:self-auto" />
		<h1 class="text-base font-medium">{title}</h1>
		<div class="ms-auto flex items-center gap-2">
			<Button
				variant="outline"
				size="sm"
				class="w-56 justify-start text-muted-foreground"
				onclick={onSearch}
			>
				<SearchIcon class="size-4" />
				<span>Search…</span>
				<Kbd class="ms-auto">{shortcutLabel('mod+k')}</Kbd>
			</Button>
			<DarkModeToggle />
		</div>
	</div>
</header>
