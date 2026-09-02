import { describe, expect, it } from 'vitest';
import { formatTimeLabel, getVisibleTimeIndexes } from './heatmap-view';

describe('formatTimeLabel', () => {
	it.each([
		['00:00', '12:00 am'],
		['06:30', '6:30 am'],
		['12:00', '12:00 pm'],
		['13:30', '1:30 pm']
	])('formats 12-hour boundaries', (time, expected) => {
		expect(formatTimeLabel(time, '12h')).toBe(expected);
	});

	it('keeps validated labels unchanged in 24-hour mode', () => {
		expect(formatTimeLabel('13:30', '24h')).toBe('13:30');
	});
});

describe('getVisibleTimeIndexes', () => {
	const times = ['08:00', '08:30', '09:00'];
	const totals = [
		[0, 2, 0],
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0],
		[3, 0, 0],
		[0, 0, 4]
	];

	it('uses weekdays unless weekends are enabled', () => {
		expect(getVisibleTimeIndexes(times, totals, 5)).toEqual([1]);
		expect(getVisibleTimeIndexes(times, totals, 7)).toEqual([0, 1, 2]);
	});

	it('returns no rows when all enabled values are zero', () => {
		expect(
			getVisibleTimeIndexes(
				times,
				totals.map(() => [0, 0, 0]),
				7
			)
		).toEqual([]);
	});
});
