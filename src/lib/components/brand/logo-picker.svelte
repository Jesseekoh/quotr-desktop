<script lang="ts">
	import PhotoIcon from '@tabler/icons-svelte/icons/photo';
	import TrashIcon from '@tabler/icons-svelte/icons/trash';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import FileDropZone from '#lib/components/file-drop-zone.svelte';
	import { LOGO_ACCEPT, LOGO_EXTENSIONS, toPngDataUrl } from '#lib/utils/logo.js';

	let {
		logo = $bindable(null),
		processing = $bindable(false)
	}: { logo?: string | null; processing?: boolean } = $props();

	async function handleFile(file: File) {
		if (!file.type.startsWith('image/')) {
			toast.error('Choose an image file.');
			return;
		}
		processing = true;
		try {
			logo = await toPngDataUrl(file);
		} catch {
			toast.error("Couldn't read that image. Try a PNG or JPEG.");
		} finally {
			processing = false;
		}
	}
</script>

<div class="flex flex-col gap-2">
	<FileDropZone
		accept={LOGO_ACCEPT}
		extensions={LOGO_EXTENSIONS}
		disabled={processing}
		onFile={handleFile}
		class="h-36"
	>
		{#snippet children({ dragging })}
			{#if logo && !dragging}
				<!-- Shown on white, as it will be on the printed page. -->
				<div class="flex h-full w-full items-center justify-center rounded-md bg-white p-3">
					<img src={logo} alt="Business logo" class="max-h-full max-w-full object-contain" />
				</div>
			{:else}
				<PhotoIcon class="size-8 text-muted-foreground" />
				<span class="font-medium">
					{processing
						? 'Processing…'
						: dragging
							? 'Drop to use this logo'
							: 'Drop your logo here, or click to browse'}
				</span>
				<span class="text-xs text-muted-foreground">PNG, JPEG, WebP or SVG</span>
			{/if}
		{/snippet}
	</FileDropZone>
	<div class="flex items-center justify-between gap-2">
		<p class="text-xs text-muted-foreground">
			A wide logo on a transparent background works best. It prints at the top of every quote and
			invoice.
		</p>
		{#if logo}
			<Button type="button" variant="ghost" size="sm" onclick={() => (logo = null)}>
				<TrashIcon class="size-4" />
				Remove
			</Button>
		{/if}
	</div>
</div>
