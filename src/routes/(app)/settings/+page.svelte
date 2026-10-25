<script lang="ts">
	import FolderOpenIcon from '@tabler/icons-svelte/icons/folder-open';
	import { invalidate } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Kbd } from '#lib/components/ui/kbd/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import BusinessFields, {
		type BusinessDetails
	} from '#lib/components/brand/business-fields.svelte';
	import LogoPicker from '#lib/components/brand/logo-picker.svelte';
	import { updateBrandSettings } from '#lib/api/settings.js';
	import { errorMessage } from '#lib/api/types.js';
	import { shortcutLabel, shortcuts } from '#lib/hooks/shortcuts.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Start from the saved settings, then track local edits.
	// svelte-ignore state_referenced_locally
	let details = $state<BusinessDetails>({
		businessName: data.brand.businessName ?? '',
		email: data.brand.email ?? '',
		phone: data.brand.phone ?? '',
		address: data.brand.address ?? ''
	});
	let logo = $derived(data.brand.logo);
	let saving = $state(false);
	let processing = $state(false);

	async function save(event?: Event) {
		event?.preventDefault();
		if (saving || processing) return;
		saving = true;
		try {
			await updateBrandSettings({ ...details, logo });
			await invalidate('app:brand');
			toast.success('Business details saved');
		} catch (cause) {
			toast.error(errorMessage(cause, 'Failed to save business details'));
		} finally {
			saving = false;
		}
	}

	async function openDataFolder() {
		try {
			const [{ appDataDir, join }, { revealItemInDir }] = await Promise.all([
				import('@tauri-apps/api/path'),
				import('@tauri-apps/plugin-opener')
			]);
			await revealItemInDir(await join(await appDataDir(), 'quotr.db'));
		} catch {
			toast.error("Couldn't open the data folder");
		}
	}
</script>

<svelte:head>
	<title>Settings · Quotr</title>
</svelte:head>

<svelte:window onkeydown={shortcuts({ 'mod+s': () => save() })} />

<div class="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 lg:px-6">
	<div>
		<h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
		<p class="text-sm text-muted-foreground">Manage your business details and app data.</p>
	</div>

	<form class="flex flex-col gap-6" onsubmit={save}>
		<Card.Root>
			<Card.Header>
				<Card.Title>Business</Card.Title>
				<Card.Description>
					Your logo, name and contact details appear at the top of exported PDFs.
				</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-5">
				<div class="flex flex-col gap-2">
					<Label>Logo</Label>
					<LogoPicker bind:logo bind:processing />
				</div>
				<BusinessFields bind:values={details} />
			</Card.Content>
			<Card.Footer class="justify-end gap-3">
				<span class="text-xs text-muted-foreground">
					<Kbd>{shortcutLabel('mod+s')}</Kbd> to save
				</span>
				<Button type="submit" disabled={saving || processing}>
					{saving ? 'Saving…' : 'Save changes'}
				</Button>
			</Card.Footer>
		</Card.Root>
	</form>

	<Card.Root>
		<Card.Header>
			<Card.Title>Data</Card.Title>
			<Card.Description>
				Quotes, invoices and your catalog are stored in a single file on this computer. Copy
				<span class="font-mono text-xs">quotr.db</span> to back it up.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button type="button" variant="outline" onclick={openDataFolder}>
				<FolderOpenIcon class="size-4" />
				Show data folder
			</Button>
		</Card.Content>
	</Card.Root>
</div>
