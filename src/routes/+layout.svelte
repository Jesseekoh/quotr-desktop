<script lang="ts">
	import './layout.css';
	import { Toaster } from 'svelte-sonner';
	import { ModeWatcher } from 'mode-watcher';
	import ConfirmDialog from '#lib/components/confirm-dialog.svelte';

	let { children } = $props();
</script>

{@render children()}
<Toaster />
<ModeWatcher />
<ConfirmDialog />
