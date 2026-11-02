<script lang="ts">
	import { Badge } from '#lib/components/ui/badge/index.js';

	let { status }: { status: string } = $props();

	const labels: Record<string, string> = { UNPAID: 'Unpaid', PAID: 'Paid', VOID: 'Void' };
</script>

<Badge variant={status === 'PAID' ? 'default' : status === 'VOID' ? 'secondary' : 'outline'}>
	{labels[status] ?? status}
</Badge>
