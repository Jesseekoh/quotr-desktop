<script lang="ts">
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import type { WithoutChildren } from '#lib/utils.js';
	import type { Icon } from '@tabler/icons-svelte';
	import type { ComponentProps } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';

	let {
		items,
		...restProps
	}: { items: { title: string; url: Pathname; icon: Icon }[] } & WithoutChildren<
		ComponentProps<typeof Sidebar.Group>
	> = $props();

	function isActive(url: string) {
		if (!url.startsWith('/')) return false;
		return page.url.pathname === url || page.url.pathname.startsWith(`${url}/`);
	}
</script>

<Sidebar.Group {...restProps}>
	<Sidebar.GroupContent>
		<Sidebar.Menu>
			{#each items as item (item.title)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						class="data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90"
						isActive={isActive(item.url)}
					>
						{#snippet child({ props })}
							<a href={resolve(item.url)} {...props}>
								<item.icon />
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
