<script lang="ts">
	import CirclePlusFilledIcon from '@tabler/icons-svelte/icons/circle-plus-filled';
	import DashboardIcon from '@tabler/icons-svelte/icons/dashboard';
	import DatabaseIcon from '@tabler/icons-svelte/icons/database';
	import FileDescriptionIcon from '@tabler/icons-svelte/icons/file-description';
	import FileInvoiceIcon from '@tabler/icons-svelte/icons/file-invoice';
	import InnerShadowTopIcon from '@tabler/icons-svelte/icons/inner-shadow-top';
	import SettingsIcon from '@tabler/icons-svelte/icons/settings';
	import { resolve } from '$app/paths';
	import * as Sidebar from '#lib/components/ui/sidebar/index.js';
	import { Kbd } from '#lib/components/ui/kbd/index.js';
	import type { BrandSettings } from '#lib/api/types.js';
	import { shortcutLabel } from '#lib/hooks/shortcuts.js';
	import NavMain from './nav-main.svelte';
	import NavSecondary from './nav-secondary.svelte';
	import type { ComponentProps } from 'svelte';
	import type { Pathname } from '$app/types';

	let { brand, ...restProps }: { brand: BrandSettings } & ComponentProps<typeof Sidebar.Root> =
		$props();

	const navMain: { title: string; url: Pathname; icon: typeof DashboardIcon }[] = [
		{ title: 'Dashboard', url: '/dashboard', icon: DashboardIcon },
		{ title: 'Quotes', url: '/quotes', icon: FileDescriptionIcon },
		{ title: 'Invoices', url: '/invoices', icon: FileInvoiceIcon },
		{ title: 'Products', url: '/products', icon: DatabaseIcon }
	];

	const navSecondary: { title: string; url: Pathname; icon: typeof SettingsIcon }[] = [
		{ title: 'Settings', url: '/settings', icon: SettingsIcon }
	];
</script>

<Sidebar.Root collapsible="offcanvas" {...restProps}>
	<Sidebar.Header>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton class="data-[slot=sidebar-menu-button]:!p-1.5">
					{#snippet child({ props })}
						<a href={resolve('/dashboard')} {...props}>
							<InnerShadowTopIcon class="size-5!" />
							<span class="text-base font-semibold">Quotr.</span>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
			<Sidebar.MenuItem class="mt-2">
				<Sidebar.MenuButton
					class="min-w-8 bg-primary text-primary-foreground duration-200 ease-linear hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground"
					tooltipContent="New quote"
				>
					{#snippet child({ props })}
						<a href={resolve('/quotes/new')} {...props}>
							<CirclePlusFilledIcon />
							<span>New quote</span>
							<Kbd class="ms-auto bg-primary-foreground/15 text-primary-foreground">
								{shortcutLabel('mod+n')}
							</Kbd>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Header>
	<Sidebar.Content>
		<NavMain items={navMain} />
		<NavSecondary items={navSecondary} class="mt-auto" />
	</Sidebar.Content>
	<Sidebar.Footer>
		<Sidebar.Menu>
			<Sidebar.MenuItem>
				<Sidebar.MenuButton size="lg" tooltipContent="Business settings">
					{#snippet child({ props })}
						<a href={resolve('/settings')} {...props}>
							<div
								class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white"
							>
								{#if brand.logo}
									<img src={brand.logo} alt="" class="max-h-full max-w-full object-contain" />
								{:else}
									<span class="text-xs font-semibold text-neutral-700">
										{(brand.businessName ?? 'Q').slice(0, 2).toUpperCase()}
									</span>
								{/if}
							</div>
							<div class="grid flex-1 text-start text-sm leading-tight">
								<span class="truncate font-medium">{brand.businessName ?? 'Your business'}</span>
								<span class="truncate text-xs text-muted-foreground">
									{brand.email ?? brand.phone ?? 'Business details'}
								</span>
							</div>
						</a>
					{/snippet}
				</Sidebar.MenuButton>
			</Sidebar.MenuItem>
		</Sidebar.Menu>
	</Sidebar.Footer>
</Sidebar.Root>
