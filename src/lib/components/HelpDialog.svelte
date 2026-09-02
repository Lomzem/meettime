<script lang="ts">
	import QuestionIcon from 'phosphor-svelte/lib/Question';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="icon" aria-label="Help" title="Help">
				<QuestionIcon />
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="gap-4 p-4 sm:p-6">
		<Dialog.Header>
			<Dialog.Title>Help</Dialog.Title>
		</Dialog.Header>
		<div class="space-y-2 text-sm text-muted-foreground">
			<p>Select subjects to see class times.</p>
			<p>Darker cells have higher enrollment.</p>
			<p>
				The table shows 7:00 am to 7:00 pm and other class times. Use Settings to show weekends.
			</p>
		</div>
	</Dialog.Content>
</Dialog.Root>
