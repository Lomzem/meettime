<script lang="ts">
	import { Command as CommandPrimitive } from 'bits-ui';
	import * as InputGroup from '$lib/components/ui/input-group/index.js';
	import MagnifyingGlassIcon from 'phosphor-svelte/lib/MagnifyingGlass';
	import XIcon from 'phosphor-svelte/lib/X';
	import { cn } from '$lib/utils.js';

	let {
		ref = $bindable(null),
		class: className,
		value = $bindable(''),
		...restProps
	}: CommandPrimitive.InputProps = $props();
</script>

<div data-slot="command-input-wrapper" class="p-1 pb-0">
	<InputGroup.Root
		class="h-8! rounded-lg! border-input/30 bg-input/30 shadow-none! *:data-[slot=input-group-addon]:pl-2!"
	>
		<CommandPrimitive.Input
			{value}
			data-slot="command-input"
			class={cn(
				'w-full text-base! outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
				className
			)}
			{...restProps}
		>
			{#snippet child({ props })}
				<InputGroup.Input {...props} bind:value bind:ref />
			{/snippet}
		</CommandPrimitive.Input>
		<InputGroup.Addon>
			<MagnifyingGlassIcon class="size-4 shrink-0 opacity-50" />
		</InputGroup.Addon>
		{#if value !== ''}
			<InputGroup.Addon align="inline-end">
				<InputGroup.Button
					type="button"
					size="icon-xs"
					aria-label="Clear subject search"
					onkeydown={(event) => {
						if (event.key === 'Enter') event.stopPropagation();
					}}
					onclick={() => {
						value = '';
						ref?.focus();
					}}
				>
					<XIcon aria-hidden="true" />
				</InputGroup.Button>
			</InputGroup.Addon>
		{/if}
	</InputGroup.Root>
</div>
