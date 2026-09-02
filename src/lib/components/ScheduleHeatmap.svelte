<script lang="ts">
	import { formatTimeLabel, getVisibleTimeIndexes } from '$lib/heatmap-view';
	import { preferences } from '$lib/preferences.svelte';
	import type { ScheduleDataset } from '$lib/schedule';

	let {
		dataset,
		totals,
		showWeekends,
		reveal
	}: {
		dataset: ScheduleDataset;
		totals: number[][];
		showWeekends: boolean;
		reveal: boolean;
	} = $props();

	let visibleDayCount = $derived(showWeekends ? 7 : 5);
	let visibleTimeIndexes = $derived(getVisibleTimeIndexes(dataset.times, totals, visibleDayCount));
	let maximum = $derived(Math.max(0, ...totals.slice(0, visibleDayCount).flat()));

	function heatClass(value: number): string {
		if (value === 0 || maximum === 0) return 'bg-muted text-muted-foreground';
		const ratio = value / maximum;
		if (ratio <= 0.2) return 'bg-chart-1/15 text-foreground';
		if (ratio <= 0.4) return 'bg-chart-1/30 text-foreground';
		if (ratio <= 0.8) return 'bg-chart-1/50 text-foreground';
		return 'bg-chart-1 text-primary-foreground';
	}
</script>

<section
	aria-labelledby="heatmap-heading"
	class:heatmap-enter={reveal}
	class="flex min-w-0 flex-col gap-3"
>
	<h2 id="heatmap-heading" class="text-lg font-semibold">Schedule heatmap</h2>
	{#if visibleTimeIndexes.length === 0}
		<p
			role="status"
			aria-live="polite"
			class="rounded-lg border p-6 text-center text-sm text-muted-foreground"
		>
			No class times for the selected subjects on the enabled days.
		</p>
	{:else}
		<div class="rounded-lg border">
			<table class="w-full table-fixed border-collapse text-center text-xs sm:text-sm">
				<caption class="sr-only">Enrollment by weekday and time</caption>
				<colgroup>
					<col class="w-14 sm:w-20" />
					{#each dataset.days.slice(0, visibleDayCount) as day (day)}<col />{/each}
				</colgroup>
				<thead>
					<tr>
						<th
							scope="col"
							class="sticky top-0 z-10 border-b bg-background px-0.5 py-1.5 text-left font-medium sm:px-3 sm:py-2"
							>Time</th
						>
						{#each dataset.days.slice(0, visibleDayCount) as day (day)}
							<th
								scope="col"
								class="sticky top-0 z-10 border-b bg-background px-0.5 py-1.5 font-medium sm:px-3 sm:py-2"
							>
								<span class="sm:hidden" aria-hidden="true">{day.slice(0, 3)}</span>
								<span class="sr-only sm:not-sr-only sm:inline">{day}</span>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each visibleTimeIndexes as timeIndex (dataset.times[timeIndex])}
						{@const time = formatTimeLabel(dataset.times[timeIndex], preferences.timeFormat)}
						<tr>
							<th
								scope="row"
								class="border-t px-0.5 py-1.5 text-left text-[11px] leading-tight font-normal sm:px-3 sm:py-2 sm:text-sm"
								>{time}</th
							>
							{#each dataset.days.slice(0, visibleDayCount) as day, dayIndex (day)}
								<td
									class={`border-t px-0.5 py-1.5 text-xs font-medium tabular-nums transition-colors duration-150 sm:p-2 sm:text-sm ${heatClass(totals[dayIndex][timeIndex])}`}
								>
									<span class="sr-only">{day} at {time}: </span>{totals[dayIndex][timeIndex]}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>
