<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import AppSidebar from '#lib/components/app-sidebar.svelte';
	import SiteHeader from '#lib/components/site-header.svelte';
	import CommandPalette from '#lib/components/command-palette.svelte';
	import { shortcuts } from '#lib/hooks/shortcuts.js';

	let { data, children } = $props();

	let paletteOpen = $state(false);

	const onkeydown = shortcuts({
		'mod+k': () => (paletteOpen = !paletteOpen),
		'mod+n': () => goto(resolve('/quotes/new')),
		'mod+,': () => goto(resolve('/settings'))
	});
</script>

<svelte:window {onkeydown} />

<Sidebar.Provider
	style="--sidebar-width: calc(var(--spacing) * 72); --header-height: calc(var(--spacing) * 12);"
>
	<AppSidebar variant="sidebar" collapsible="icon" brand={data.brand} />
	<Sidebar.Inset>
		<SiteHeader onSearch={() => (paletteOpen = true)} />
		{@render children()}
	</Sidebar.Inset>
</Sidebar.Provider>

<CommandPalette bind:open={paletteOpen} />
