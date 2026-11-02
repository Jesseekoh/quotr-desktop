<script lang="ts">
	import { Switch as SwitchPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils.js';

	let {
		checked = $bindable(false),
		class: className,
		...restProps
	}: SwitchPrimitive.RootProps = $props();
</script>

<SwitchPrimitive.Root
	bind:checked
	class={cn(
		'group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-input shadow-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
		className
	)}
	{...restProps}
>
	<span
		class="pointer-events-none block size-4 rounded-full bg-background shadow-lg ring-0 transition-transform group-data-[state=checked]:translate-x-4"
	></span>
</SwitchPrimitive.Root>
