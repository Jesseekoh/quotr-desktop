<script lang="ts">
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { buttonVariants } from '#lib/components/ui/button/index.js';
	import { confirmState } from '#lib/hooks/confirm.svelte.js';

	let request = $derived(confirmState.pending);
</script>

<AlertDialog.Root
	open={request !== null}
	onOpenChange={(open) => {
		if (!open) confirmState.settle(false);
	}}
>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{request?.title}</AlertDialog.Title>
			{#if request?.description}
				<AlertDialog.Description>{request.description}</AlertDialog.Description>
			{/if}
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => confirmState.settle(false)}>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				class={request?.destructive ? buttonVariants({ variant: 'destructive' }) : undefined}
				onclick={() => confirmState.settle(true)}
			>
				{request?.confirmLabel ?? 'Continue'}
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
