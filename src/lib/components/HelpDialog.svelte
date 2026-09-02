<script lang="ts">
	import QuestionIcon from 'phosphor-svelte/lib/Question';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	let {
		open = $bindable(false),
		termLabel,
		updated
	}: { open?: boolean; termLabel?: string; updated?: string } = $props();
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
			<Dialog.Title>How Meettime works</Dialog.Title>
			<Dialog.Description>A quick view of recurring class-time load.</Dialog.Description>
		</Dialog.Header>
		<div class="space-y-3 text-sm text-muted-foreground">
			<p>
				Each cell adds the published enrollment for selected subject-area classes with an
				in-person-capable meeting active on the refresh date that overlaps that 30-minute block.
				Fully online and ambiguous modes are excluded, and repeated meetings in one class are
				deduplicated.
			</p>
			<p>
				The color scale is relative to the largest visible cell, so it updates when subjects or
				enabled days change. Darker cells represent larger totals.
			</p>
			<p>
				Empty time rows are hidden. Turn on Weekends to include Saturday and Sunday. Data updates
				daily from Chico State class search.
			</p>
		</div>
		{#if termLabel && updated}
			<Dialog.Footer class="text-xs text-muted-foreground"
				>{termLabel} · Data refreshed {updated}</Dialog.Footer
			>
		{/if}
	</Dialog.Content>
</Dialog.Root>
