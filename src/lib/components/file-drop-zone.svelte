<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '#lib/utils.js';

	// Click to browse, or drop a file from the file manager. Tauri's own drop
	// handling is turned off (dragDropEnabled: false) so drops reach the page.
	let {
		accept,
		extensions,
		disabled = false,
		onFile,
		class: className,
		children
	}: {
		/** `accept` attribute for the browse dialog. */
		accept: string;
		/** Lower-case extensions (no dot) allowed for dropped files. */
		extensions: string[];
		disabled?: boolean;
		onFile: (file: File) => void;
		class?: string;
		children: Snippet<[{ dragging: boolean }]>;
	} = $props();

	let input = $state<HTMLInputElement>();
	let dragDepth = $state(0);
	let dragging = $derived(dragDepth > 0);

	function accepts(file: File) {
		const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
		return extensions.includes(extension);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		if (disabled) return;
		const file = Array.from(event.dataTransfer?.files ?? []).find(accepts);
		if (file) onFile(file);
	}

	function handleChange(event: Event & { currentTarget: HTMLInputElement }) {
		const file = event.currentTarget.files?.[0];
		// Reset so choosing the same file again still fires a change.
		event.currentTarget.value = '';
		if (file) onFile(file);
	}
</script>

<button
	type="button"
	{disabled}
	class={cn(
		'flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm transition-colors outline-none hover:bg-muted/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60',
		dragging && 'border-primary bg-muted/60',
		className
	)}
	onclick={() => input?.click()}
	ondragenter={(event) => {
		event.preventDefault();
		dragDepth++;
	}}
	ondragover={(event) => event.preventDefault()}
	ondragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
	ondrop={handleDrop}
>
	{@render children({ dragging })}
</button>
<input
	bind:this={input}
	type="file"
	{accept}
	class="sr-only"
	tabindex="-1"
	onchange={handleChange}
/>
