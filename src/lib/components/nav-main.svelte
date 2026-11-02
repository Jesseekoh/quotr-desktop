<script lang="ts">
	// import CirclePlusFilledIcon from '@tabler/icons-svelte/icons/circle-plus-filled';
	// import MailIcon from '@tabler/icons-svelte/icons/mail';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import type { Icon } from '@tabler/icons-svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { Pathname } from '$app/types';

	let { items }: { items: { title: string; url: Pathname; icon?: Icon }[] } = $props();

	// Keep a section highlighted on its nested pages too (e.g. /quotes/abc → Quotes).
	function isActive(url: string) {
		return page.url.pathname === url || page.url.pathname.startsWith(`${url}/`);
	}
</script>

<Sidebar.Group>
	<Sidebar.GroupLabel>Navigation</Sidebar.GroupLabel>
	<Sidebar.GroupContent class="flex flex-col gap-2">
		<!-- <Sidebar.Menu>
			<Sidebar.MenuItem class="flex items-center gap-2">
				<Sidebar.MenuButton
					class="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
					tooltipContent="Quick create"
				>
					<CirclePlusFilledIcon />
					<span>Quick Create</span>
				</Sidebar.MenuButton>
				<Button
					size="icon"
					class="size-8 group-data-[collapsible=icon]:opacity-0"
					variant="outline"
				>
					<MailIcon />
					<span class="sr-only">Inbox</span>
				</Button>
			</Sidebar.MenuItem>
		</Sidebar.Menu> -->
		<Sidebar.Menu>
			{#each items as item (item.title)}
				<Sidebar.MenuItem>
					<Sidebar.MenuButton
						class="h-10 p-3 data-[active=true]:bg-primary data-[active=true]:font-semibold data-[active=true]:text-primary-foreground data-[active=true]:hover:bg-primary/90"
						tooltipContent={item.title}
						isActive={isActive(item.url)}
					>
						{#snippet child({ props })}
							<a href={resolve(item.url)} {...props}>
								{#if item.icon}
									<item.icon />
								{/if}
								<span>{item.title}</span>
							</a>
						{/snippet}
					</Sidebar.MenuButton>
				</Sidebar.MenuItem>
			{/each}
		</Sidebar.Menu>
	</Sidebar.GroupContent>
</Sidebar.Group>
