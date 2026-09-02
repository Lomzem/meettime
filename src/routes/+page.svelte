<script lang="ts">
	import { base } from '$app/paths';
	import { onMount } from 'svelte';
	import Fuse from 'fuse.js';
	import CaretUpDownIcon from 'phosphor-svelte/lib/CaretUpDown';
	import XIcon from 'phosphor-svelte/lib/X';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Command from '$lib/components/ui/command';
	import * as Popover from '$lib/components/ui/popover';
	import { Switch } from '$lib/components/ui/switch';
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

	let dataset = $state<ScheduleDataset | null>(null);
	let loadError = $state('');
	let pickerOpen = $state(false);
	let query = $state('');
	let selectedCodes = $state<string[]>([]);
	let showWeekends = $state(false);

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
	let visibleDayCount = $derived(showWeekends ? 7 : 5);
	let maximum = $derived(
		totals.length === 0 ? 0 : Math.max(0, ...totals.slice(0, visibleDayCount).flat())
	);
	let updated = $derived(
		dataset
			? new Intl.DateTimeFormat('en-US', {
					month: 'short',
					day: 'numeric',
					timeZone: 'America/Los_Angeles'
				}).format(new Date(dataset.generatedAt))
			: ''
	);

	onMount(async () => {
		try {
			const response = await fetch(`${base}/schedule.json`);
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			dataset = validateDataset(await response.json());
		} catch (error) {
			loadError = error instanceof Error ? error.message : 'Unknown error';
		}
	});

	function toggleSubject(code: string) {
		selectedCodes = selectedSet.has(code)
			? selectedCodes.filter((selected) => selected !== code)
			: [...selectedCodes, code];
	}

	function heatClass(value: number): string {
		if (value === 0 || maximum === 0) return 'bg-muted text-muted-foreground';
		const ratio = value / maximum;
		if (ratio <= 0.2) return 'bg-chart-1/15 text-foreground';
		if (ratio <= 0.4) return 'bg-chart-1/30 text-foreground';
		if (ratio <= 0.8) return 'bg-chart-1/50 text-foreground';
		return 'bg-chart-1 text-primary-foreground';
	}
</script>

<svelte:head>
	<title>Chico State Meettime</title>
	<meta
		name="description"
		content="Find meeting times using Chico State scheduled in-person class enrollment."
	/>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
	<header class="flex flex-col gap-1 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
		<div>
			<h1 class="text-2xl font-semibold tracking-tight sm:text-3xl">Chico State Meettime</h1>
			<p class="text-sm text-muted-foreground">Scheduled in-person enrollment, not attendance.</p>
		</div>
		{#if dataset}
			<p class="text-sm text-muted-foreground">{dataset.term.label} · Updated {updated}</p>
		{/if}
	</header>

	{#if loadError}
		<p role="alert" class="text-sm text-destructive">Could not load schedule data: {loadError}</p>
	{:else if !dataset}
		<p class="text-sm text-muted-foreground">Loading…</p>
	{:else}
		<section aria-labelledby="subjects-label" class="flex flex-col gap-3">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
				<div class="flex w-full max-w-xl flex-col gap-1.5">
					<span id="subjects-label" class="text-sm font-medium">Subject areas</span>
					<Popover.Root bind:open={pickerOpen}>
						<Popover.Trigger>
							{#snippet child({ props })}
								<Button
									{...props}
									variant="outline"
									class="w-full justify-between font-normal"
									role="combobox"
									aria-labelledby="subjects-label"
									aria-expanded={pickerOpen}
								>
									{selectedCodes.length
										? `${selectedCodes.length} selected`
										: 'Select subject areas'}
									<CaretUpDownIcon class="size-4 text-muted-foreground" />
								</Button>
							{/snippet}
						</Popover.Trigger>
						<Popover.Content align="start" class="w-(--bits-popover-anchor-width) gap-0 p-0">
							<Command.Root shouldFilter={false} loop label="Subject areas">
								<Command.Input bind:value={query} placeholder="Search subjects…" />
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

				<label class="flex h-9 items-center gap-2 text-sm" for="weekends">
					<Switch id="weekends" bind:checked={showWeekends} />
					Weekends
				</label>
			</div>

			{#if selectedSubjects.length > 0}
				<div class="flex flex-wrap gap-2" aria-label="Selected subject areas">
					{#each selectedSubjects as subject (subject.code)}
						<Badge variant="secondary" class="h-7 gap-1 pl-2.5">
							{subject.label} ({subject.code})
							<button
								type="button"
								class="-mr-1 inline-flex size-5 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
								onclick={() => toggleSubject(subject.code)}
								aria-label={`Remove ${subject.label}`}
							>
								<XIcon class="size-3" />
							</button>
						</Badge>
					{/each}
				</div>
			{/if}
		</section>

		{#if selectedCodes.length === 0}
			<p class="py-12 text-center text-sm text-muted-foreground">Select subject areas.</p>
		{:else}
			<section aria-labelledby="heatmap-heading" class="flex min-w-0 flex-col gap-3">
				<h2 id="heatmap-heading" class="text-lg font-semibold">Scheduled enrollment</h2>
				<div class="overflow-x-auto rounded-lg border">
					<table class="w-full min-w-3xl border-collapse text-center text-sm">
						<caption class="sr-only">Scheduled in-person enrollment by weekday and time</caption>
						<thead>
							<tr>
								<th
									scope="col"
									class="sticky left-0 z-10 min-w-20 border-b bg-background px-3 py-2 text-left font-medium"
								>
									Time
								</th>
								{#each dataset.days.slice(0, visibleDayCount) as day (day)}
									<th scope="col" class="min-w-28 border-b px-3 py-2 font-medium">{day}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each dataset.times as time, timeIndex (time)}
								<tr>
									<th
										scope="row"
										class="sticky left-0 z-10 border-t bg-background px-3 py-2 text-left font-normal"
									>
										{time}
									</th>
									{#each dataset.days.slice(0, visibleDayCount) as day, dayIndex (day)}
										<td
											class={`border-t p-2 font-medium tabular-nums ${heatClass(totals[dayIndex][timeIndex])}`}
										>
											<span class="sr-only">{day} at {time}: </span>{totals[dayIndex][timeIndex]}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}
	{/if}
</main>
