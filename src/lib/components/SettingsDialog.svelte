<script lang="ts">
	import GearIcon from 'phosphor-svelte/lib/Gear';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Switch } from '$lib/components/ui/switch';
	import { preferences } from '$lib/preferences.svelte';
	import { setTheme, theme } from '$lib/theme.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" size="icon" aria-label="Settings" title="Settings">
				<GearIcon />
			</Button>
		{/snippet}
	</Dialog.Trigger>
	<Dialog.Content class="gap-4 p-4 sm:p-6">
		<Dialog.Header>
			<Dialog.Title>Settings</Dialog.Title>
		</Dialog.Header>

		<div class="divide-y">
			<div class="flex items-center justify-between gap-4 py-3 first:pt-0">
				<label for="dark-mode" class="font-medium">Dark mode</label>
				<Switch
					id="dark-mode"
					checked={theme.dark}
					onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
				/>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<label for="time-format" class="font-medium">24-hour time</label>
				<Switch
					id="time-format"
					checked={preferences.timeFormat === '24h'}
					onCheckedChange={(checked) => (preferences.timeFormat = checked ? '24h' : '12h')}
				/>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<label for="weekends" class="font-medium">Weekends</label>
				<Switch id="weekends" bind:checked={preferences.showWeekends} />
			</div>
			<div class="flex items-center justify-between gap-4 py-3 last:pb-0">
				<label for="animations" class="font-medium">Animations</label>
				<Switch id="animations" bind:checked={preferences.animationsEnabled} />
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
