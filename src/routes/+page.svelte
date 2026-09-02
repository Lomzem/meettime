<script lang="ts">
	import { base } from '$app/paths';
	import { onMount, tick } from 'svelte';
	import { createHotkey, formatForDisplay } from '@tanstack/svelte-hotkeys';
	import Fuse from 'fuse.js';
	import CaretUpDownIcon from 'phosphor-svelte/lib/CaretUpDown';
	import XIcon from 'phosphor-svelte/lib/X';
	import HelpDialog from '$lib/components/HelpDialog.svelte';
	import ScheduleHeatmap from '$lib/components/ScheduleHeatmap.svelte';
	import SettingsDialog from '$lib/components/SettingsDialog.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command';
	import { Kbd } from '$lib/components/ui/kbd';
	import * as Popover from '$lib/components/ui/popover';
	import { loadPreferences, persistPreferences } from '$lib/preferences.svelte';
	import {
		sumSelectedSubjects,
		validateDataset,
		type ScheduleDataset,
		type SubjectSchedule
	} from '$lib/schedule';

	type SearchableSubject = SubjectSchedule & { aliases: string[] };

	const aliases: Record<string, string[]> = {
		ABUS: ['ag business'],
		AGRI: ['ag', 'agriculture'],
		BIOL: ['bio', 'biology'],
		CHEM: ['chem', 'chemistry'],
		CSCI: ['cs', 'comp sci', 'computer science'],
		EECE: ['electrical engineering', 'computer engineering'],
		MATH: ['math', 'mathematics'],
		PHYS: ['physics'],
		PSYC: ['psych', 'psychology']
	};
	const selectedSubjectsStorageKey = 'meettime-selected-subjects';

	function loadSelectedCodes(dataset: ScheduleDataset): string[] {
		try {
			const stored = localStorage.getItem(selectedSubjectsStorageKey);
			if (stored === null) return [];
			const parsed: unknown = JSON.parse(stored);
			if (!Array.isArray(parsed)) return [];
			const codes = parsed.filter((code): code is string => typeof code === 'string');
			if (codes.length !== parsed.length) return [];
			const validCodes = new Set(dataset.subjects.map(({ code }) => code));
			return [...new Set(codes.filter((code) => validCodes.has(code)))];
		} catch {
			return [];
		}
	}

	let dataset = $state<ScheduleDataset | null>(null);
	let loadError = $state('');
	let pickerOpen = $state(false);
	let query = $state('');
	let selectedCodes = $state<string[]>([]);
	let selectionLoaded = $state(false);
	let settingsOpen = $state(false);
	let helpOpen = $state(false);
	let shortcutLabel = $state('Ctrl+K');
	let subjectPickerButton = $state<HTMLButtonElement | null>(null);
	let subjectSearchInput = $state<HTMLInputElement | null>(null);
	let revealHeatmap = $state(false);
	let hasRevealedHeatmap = false;

	let searchableSubjects = $derived<SearchableSubject[]>(
		dataset?.subjects.map((subject) => ({ ...subject, aliases: aliases[subject.code] ?? [] })) ?? []
	);
	let fuse = $derived(
		new Fuse(searchableSubjects, {
			threshold: 0.35,
			ignoreLocation: true,
			keys: [
				{ name: 'label', weight: 0.6 },
				{ name: 'code', weight: 0.3 },
				{ name: 'aliases', weight: 0.1 }
			]
		})
	);
	let filteredSubjects = $derived(
		query.trim() ? fuse.search(query.trim()).map(({ item }) => item) : searchableSubjects
	);
	let selectedSet = $derived(new Set(selectedCodes));
	let selectedSubjects = $derived(searchableSubjects.filter(({ code }) => selectedSet.has(code)));
	let totals = $derived(dataset ? sumSelectedSubjects(dataset, selectedSet) : []);
	let updated = $derived(
		dataset
			? new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					timeZone: 'America/Los_Angeles'
				}).format(new Date(dataset.generatedAt))
			: ''
	);

	createHotkey(
		'Mod+K',
		() => {
			subjectPickerButton?.focus();
			pickerOpen = true;
			void tick().then(() => subjectSearchInput?.focus());
		},
		() => ({
			enabled: !!dataset && !settingsOpen && !helpOpen,
			ignoreInputs: true,
			preventDefault: true,
			stopPropagation: true,
			requireReset: true
		})
	);

	onMount(async () => {
		loadPreferences();
		shortcutLabel = formatForDisplay('Mod+K');

		try {
			const response = await fetch(`${base}/schedule.json`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const loadedDataset = validateDataset(await response.json());
			dataset = loadedDataset;
			selectedCodes = loadSelectedCodes(loadedDataset);
			selectionLoaded = true;
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Unknown error';
		}
	});

	$effect(() => persistPreferences());

	$effect(() => {
		if (!selectionLoaded) return;
		try {
			localStorage.setItem(selectedSubjectsStorageKey, JSON.stringify(selectedCodes));
		} catch {
			// Subject selection remains usable when browser storage is unavailable.
		}
	});

	$effect(() => {
		if (!pickerOpen) query = '';
	});

	function toggleSubject(code: string) {
		const addingFirstSubject = selectedCodes.length === 0 && !selectedSet.has(code);
		selectedCodes = selectedSet.has(code)
			? selectedCodes.filter((selected) => selected !== code)
			: [...selectedCodes, code];
		if (addingFirstSubject && !hasRevealedHeatmap) {
			hasRevealedHeatmap = true;
			revealHeatmap = true;
			setTimeout(() => (revealHeatmap = false), 180);
		}
	}

	async function clearSubjects() {
		pickerOpen = false;
		selectedCodes = [];
		await tick();
		subjectPickerButton?.focus();
	}
</script>

<svelte:head>
	<title>Chico State Meettime</title>
	<meta name="description" content="Find meeting times at Chico State." />
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
	<header class="flex items-start justify-between gap-3 border-b pb-3 sm:items-center">
		<div class="min-w-0 sm:flex sm:items-baseline sm:gap-3">
			<h1 class="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
				Chico State <span class="text-primary">Meettime</span>
			</h1>
			{#if dataset}
				<p class="text-xs text-muted-foreground sm:text-sm">
					{dataset.term.label} · Updated {updated}
				</p>
			{/if}
		</div>
		<div class="flex shrink-0 gap-2">
			<HelpDialog bind:open={helpOpen} />
			<SettingsDialog bind:open={settingsOpen} />
		</div>
	</header>

	{#if loadError}
		<p role="alert" class="text-sm text-destructive">Could not load schedule data: {loadError}</p>
	{:else if !dataset}
		<p class="text-sm text-muted-foreground">Loading…</p>
	{:else}
		<section
			aria-labelledby="subjects-label"
			class="flex max-w-3xl flex-col gap-3 rounded-lg border bg-card p-3"
		>
			<div class="flex w-full flex-col gap-1.5">
				<span id="subjects-label" class="text-sm font-medium">Subjects</span>
				<Popover.Root bind:open={pickerOpen}>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								bind:ref={subjectPickerButton}
								variant="outline"
								class="w-full justify-between font-normal"
								role="combobox"
								aria-labelledby="subjects-label"
								aria-expanded={pickerOpen}
							>
								{selectedCodes.length ? `${selectedCodes.length} selected` : 'Select subjects'}
								<span class="flex items-center gap-2">
									<Kbd class="hidden md:inline-flex" aria-hidden="true">{shortcutLabel}</Kbd>
									<CaretUpDownIcon class="size-4 text-muted-foreground" />
								</span>
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content align="start" class="w-(--bits-popover-anchor-width) gap-0 p-0">
						<Command.Root shouldFilter={false} loop label="Subjects">
							<Command.Input
								bind:ref={subjectSearchInput}
								bind:value={query}
								placeholder="Search subjects…"
							/>
							<Command.List class="max-h-72" aria-multiselectable="true">
								{#if filteredSubjects.length === 0}
									<div class="py-6 text-center text-sm text-muted-foreground">
										No subjects found.
									</div>
								{:else}
									<Command.Group>
										{#each filteredSubjects as subject (subject.code)}
											<Command.Item
												value={subject.code}
												checked={selectedSet.has(subject.code)}
												onSelect={() => toggleSubject(subject.code)}
											>
												<span>{subject.label}</span>
												<span class="text-muted-foreground">({subject.code})</span>
											</Command.Item>
										{/each}
									</Command.Group>
								{/if}
							</Command.List>
						</Command.Root>
					</Popover.Content>
				</Popover.Root>
			</div>

			{#if selectedSubjects.length > 0}
				<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div class="flex flex-wrap gap-2" aria-label="Selected subjects">
						{#each selectedSubjects as subject (subject.code)}
							<Badge variant="secondary" class="chip-enter h-7 gap-1 pl-2.5">
								{subject.label} ({subject.code})
								<button
									type="button"
									class="-mr-1 inline-flex size-6 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
									onclick={() => toggleSubject(subject.code)}
									aria-label={`Remove ${subject.label}`}
								>
									<XIcon class="size-3" />
								</button>
							</Badge>
						{/each}
					</div>
					<Button variant="ghost" size="sm" class="self-end" onclick={clearSubjects}
						>Clear all</Button
					>
				</div>
			{/if}
		</section>

		{#if selectedCodes.length > 0}
			<ScheduleHeatmap {dataset} {totals} reveal={revealHeatmap} />
		{/if}
	{/if}
</main>
