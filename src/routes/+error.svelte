<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { Button } from '#lib/components/ui/button/index.js';
</script>

<div class="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
	<p class="text-sm font-medium text-muted-foreground">{page.status}</p>
	<h1 class="text-2xl font-semibold tracking-tight">Something went wrong</h1>
	<p class="max-w-md text-sm text-muted-foreground">{page.error?.message}</p>
	<Button href={resolve('/dashboard')} variant="outline" class="mt-2">Back to dashboard</Button>
</div>
