export type TimeFormat = '12h' | '24h';

export function formatTimeLabel(time: string, format: TimeFormat): string {
	if (format === '24h') return time;
	const [hours, minutes] = time.split(':').map(Number);
	const suffix = hours < 12 ? 'am' : 'pm';
	return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

export function getVisibleTimeIndexes(
	times: ReadonlyArray<string>,
	totals: ReadonlyArray<ReadonlyArray<number>>,
	visibleDayCount: number
): number[] {
	return times
		.map((time, index) => ({ time, index }))
		.filter(
			({ time, index }) =>
				(time >= '07:00' && time <= '19:00') ||
				totals.slice(0, visibleDayCount).some((dayTotals) => dayTotals[index] > 0)
		)
		.map(({ index }) => index);
}
