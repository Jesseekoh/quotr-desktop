<script lang="ts" module>
	export type BusinessDetails = {
		businessName: string;
		email: string;
		phone: string;
		address: string;
	};
</script>

<script lang="ts">
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';

	let {
		values = $bindable(),
		requireName = false,
		autofocus = false
	}: { values: BusinessDetails; requireName?: boolean; autofocus?: boolean } = $props();
</script>

<div class="flex flex-col gap-5">
	<div class="flex flex-col gap-2">
		<Label for="business-name">Business name{requireName ? '' : ' (optional)'}</Label>
		<!-- svelte-ignore a11y_autofocus -->
		<Input
			id="business-name"
			bind:value={values.businessName}
			maxlength={255}
			required={requireName}
			{autofocus}
			placeholder="e.g. Sunrise Solar Ltd"
		/>
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<div class="flex flex-col gap-2">
			<Label for="business-email">Email (optional)</Label>
			<Input
				id="business-email"
				type="email"
				bind:value={values.email}
				maxlength={255}
				placeholder="sales@sunrisesolar.ng"
			/>
		</div>
		<div class="flex flex-col gap-2">
			<Label for="business-phone">Phone (optional)</Label>
			<Input
				id="business-phone"
				type="tel"
				bind:value={values.phone}
				maxlength={255}
				placeholder="0803 000 0000"
			/>
		</div>
	</div>

	<div class="flex flex-col gap-2">
		<Label for="business-address">Address (optional)</Label>
		<Textarea
			id="business-address"
			bind:value={values.address}
			rows={2}
			placeholder="Street, city, state"
		/>
	</div>
</div>
