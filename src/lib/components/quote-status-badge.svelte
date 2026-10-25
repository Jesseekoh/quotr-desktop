<script lang="ts">
	import CircleCheckFilledIcon from '@tabler/icons-svelte/icons/circle-check-filled';
	import ClockIcon from '@tabler/icons-svelte/icons/clock';
	import FileTextIcon from '@tabler/icons-svelte/icons/file-text';
	import SendIcon from '@tabler/icons-svelte/icons/send';
	import XIcon from '@tabler/icons-svelte/icons/x';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { isQuoteExpired } from '#lib/utils/quotes.js';

	let { status, sentAt = null }: { status: string; sentAt?: Date | string | null } = $props();

	// Sent quotes that passed the expiry window are shown as EXPIRED.
	const display = $derived(isQuoteExpired(status, sentAt) ? 'EXPIRED' : status);

	const labels: Record<string, string> = {
		DRAFT: 'Draft',
		SENT: 'Sent',
		ACCEPTED: 'Accepted',
		REJECTED: 'Rejected',
		EXPIRED: 'Expired'
	};
</script>

<Badge variant="outline" class="px-1.5 text-muted-foreground">
	{#if display === 'ACCEPTED'}
		<CircleCheckFilledIcon class="fill-green-500 dark:fill-green-400" />
	{:else if display === 'REJECTED'}
		<XIcon class="text-red-500" />
	{:else if display === 'EXPIRED'}
		<ClockIcon class="text-amber-500" />
	{:else if display === 'SENT'}
		<SendIcon class="text-blue-500 dark:text-blue-400" />
	{:else}
		<FileTextIcon />
	{/if}
	{labels[display] ?? display}
</Badge>
