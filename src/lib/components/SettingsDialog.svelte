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
			<Dialog.Description>Adjust display and keyboard preferences.</Dialog.Description>
		</Dialog.Header>

		<div class="divide-y">
			<div class="flex items-center justify-between gap-4 py-3 first:pt-0">
				<div>
					<label for="dark-mode" class="font-medium">Dark mode</label>
					<p id="dark-mode-description" class="text-xs text-muted-foreground">
						Use the dark color scheme.
					</p>
				</div>
				<Switch
					id="dark-mode"
					checked={theme.dark}
					onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
					aria-describedby="dark-mode-description"
				/>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<div>
					<label for="animations" class="font-medium">Animations</label>
					<p id="animations-description" class="text-xs text-muted-foreground">
						Use brief interface motion.
					</p>
				</div>
				<Switch
					id="animations"
					bind:checked={preferences.animationsEnabled}
					aria-describedby="animations-description"
				/>
			</div>
			<div class="flex items-center justify-between gap-4 py-3">
				<div>
					<label for="time-format" class="font-medium">24-hour time</label>
					<p id="time-format-description" class="text-xs text-muted-foreground">
						Show times such as 13:30.
					</p>
				</div>
				<Switch
					id="time-format"
					checked={preferences.timeFormat === '24h'}
					onCheckedChange={(checked) => (preferences.timeFormat = checked ? '24h' : '12h')}
					aria-describedby="time-format-description"
				/>
			</div>
			<div class="flex items-center justify-between gap-4 py-3 last:pb-0">
				<div>
					<label for="keyboard-shortcut" class="font-medium">Keyboard shortcut</label>
					<p id="keyboard-shortcut-description" class="text-xs text-muted-foreground">
						Open subject search with Mod+K.
					</p>
				</div>
				<Switch
					id="keyboard-shortcut"
					bind:checked={preferences.shortcutsEnabled}
					aria-describedby="keyboard-shortcut-description"
				/>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
