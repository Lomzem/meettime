import { describe, expect, it } from 'vitest';
import {
	aggregateSchedule,
	sumSelectedSubjects,
	type SourceClass,
	type SourceMeeting
} from './schedule';

const options = {
	generatedAt: '2026-09-02T12:00:00.000Z',
	asOfDate: '2026-09-02',
	term: { code: '2268', label: 'Fall 2026' }
};

const meeting = (overrides: Partial<SourceMeeting> = {}): SourceMeeting => ({
	days: 'Mo',
	start_time: '10.00.00.000000',
	end_time: '10.50.00.000000',
	start_dt: '08/24/2026',
	end_dt: '12/18/2026',
	...overrides
});

const course = (overrides: Partial<SourceClass> = {}): SourceClass => ({
	class_nbr: 1,
	subject: 'CSCI',
	subject_descr: 'Computer Science',
	instruction_mode: 'P',
	enrollment_total: 30,
	meetings: [meeting()],
	...overrides
});

function value(
	dataset: ReturnType<typeof aggregateSchedule>,
	subject: string,
	day: string,
	time: string
) {
	const item = dataset.subjects.find(({ code }) => code === subject)!;
	return item.values[dataset.days.indexOf(day)][dataset.times.indexOf(time)];
}

describe('schedule aggregation', () => {
	it('expands one class across half-hour buckets but not the ending boundary', () => {
		const dataset = aggregateSchedule([course()], options);
		expect(value(dataset, 'CSCI', 'Monday', '10:00')).toBe(30);
		expect(value(dataset, 'CSCI', 'Monday', '10:30')).toBe(30);

		const boundary = aggregateSchedule(
			[course({ meetings: [meeting({ end_time: '10.30.00.000000' })] })],
			options
		);
		expect(boundary.times).toEqual(['10:00']);
	});

	it('adds overlapping classes and selected subjects', () => {
		const dataset = aggregateSchedule(
			[
				course(),
				course({ class_nbr: 2, enrollment_total: 20 }),
				course({
					class_nbr: 3,
					subject: 'MATH',
					subject_descr: 'Mathematics',
					enrollment_total: 12
				})
			],
			options
		);
		expect(value(dataset, 'CSCI', 'Monday', '10:00')).toBe(50);
		const selected = sumSelectedSubjects(dataset, new Set(['CSCI', 'MATH']));
		expect(selected[0][dataset.times.indexOf('10:00')]).toBe(62);
	});

	it('expands meetings on several weekdays and several buckets', () => {
		const dataset = aggregateSchedule(
			[
				course({
					meetings: [
						meeting({ days: 'MoWeFr', start_time: '09.30.00.000000', end_time: '11.00.00.000000' })
					]
				})
			],
			options
		);
		for (const day of ['Monday', 'Wednesday', 'Friday']) {
			expect(value(dataset, 'CSCI', day, '09:30')).toBe(30);
			expect(value(dataset, 'CSCI', day, '10:30')).toBe(30);
		}
	});

	it('excludes online and inactive classes', () => {
		const dataset = aggregateSchedule(
			[
				course(),
				course({
					class_nbr: 2,
					subject: 'MATH',
					subject_descr: 'Mathematics',
					instruction_mode: 'J'
				}),
				course({
					class_nbr: 3,
					subject: 'BIOL',
					subject_descr: 'Biological Sciences',
					meetings: [meeting({ start_dt: '10/01/2026' })]
				})
			],
			options
		);
		expect(dataset.subjects.map(({ code }) => code)).toEqual(['CSCI']);
	});

	it('deduplicates repeated records and meetings within a class', () => {
		const duplicate = course({ meetings: [meeting(), meeting()] });
		const dataset = aggregateSchedule([duplicate, duplicate], options);
		expect(value(dataset, 'CSCI', 'Monday', '10:00')).toBe(30);
	});

	it('keeps distinct combined listings as separate enrollment allocations', () => {
		const dataset = aggregateSchedule(
			[course({ enrollment_total: 12 }), course({ class_nbr: 2, enrollment_total: 6 })],
			options
		);
		expect(value(dataset, 'CSCI', 'Monday', '10:00')).toBe(18);
	});

	it.each([
		[course({ enrollment_total: -1 }), 'Invalid enrollment'],
		[
			course({ meetings: [meeting({ start_time: '', end_time: '10.00.00.000000' })] }),
			'Incomplete meeting time'
		],
		[course({ meetings: [meeting({ days: 'MWF' })] }), 'Invalid meeting days'],
		[course({ instruction_mode: 'NEW' }), 'Unknown instruction mode'],
		[course({ meetings: [meeting({ start_time: '25.00.00.000000' })] }), 'Invalid meeting time']
	])('rejects malformed source records', (input, message) => {
		expect(() => aggregateSchedule([input], options)).toThrow(message);
	});

	it('rejects conflicting duplicate class records', () => {
		expect(() => aggregateSchedule([course(), course({ enrollment_total: 31 })], options)).toThrow(
			'Conflicting duplicate class'
		);
	});
});
