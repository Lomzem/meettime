import { Schema } from 'effect';

export const DAYS = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
] as const;
export type Day = (typeof DAYS)[number];

export const TermSchema = Schema.Struct({
	code: Schema.String,
	label: Schema.String
});

export const SubjectScheduleSchema = Schema.Struct({
	code: Schema.String,
	label: Schema.String,
	values: Schema.Array(Schema.Array(Schema.Int))
});

export const ScheduleDatasetSchema = Schema.Struct({
	schemaVersion: Schema.Literal(1),
	generatedAt: Schema.String,
	asOfDate: Schema.String,
	term: TermSchema,
	bucketMinutes: Schema.Literal(30),
	days: Schema.Array(Schema.String),
	times: Schema.Array(Schema.String),
	subjects: Schema.Array(SubjectScheduleSchema)
});

export type ScheduleDataset = typeof ScheduleDatasetSchema.Type;
export type SubjectSchedule = typeof SubjectScheduleSchema.Type;

export interface SourceMeeting {
	readonly days: string;
	readonly start_time: string;
	readonly end_time: string;
	readonly start_dt: string;
	readonly end_dt: string;
}

export interface SourceClass {
	readonly class_nbr: number;
	readonly subject: string;
	readonly subject_descr: string;
	readonly instruction_mode: string;
	readonly enrollment_total: number;
	readonly meetings: ReadonlyArray<SourceMeeting>;
}

export interface AggregateOptions {
	readonly generatedAt: string;
	readonly asOfDate: string;
	readonly term: { readonly code: string; readonly label: string };
}

const INCLUDED_MODES = new Set(['P', 'H', 'S', 'X']);
const EXCLUDED_MODES = new Set(['I', 'J', 'U', 'V', 'K']);
const DAY_TOKENS: ReadonlyArray<readonly [string, Day]> = [
	['Mo', 'Monday'],
	['Tu', 'Tuesday'],
	['We', 'Wednesday'],
	['Th', 'Thursday'],
	['Fr', 'Friday'],
	['Sa', 'Saturday'],
	['Su', 'Sunday']
];
const BUCKET_MINUTES = 30;

function parseDate(value: string, field: string): string {
	const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
	if (!match) throw new Error(`Invalid ${field}: ${value}`);
	const [, month, day, year] = match;
	const iso = `${year}-${month}-${day}`;
	const date = new Date(`${iso}T00:00:00Z`);
	if (
		date.getUTCFullYear() !== Number(year) ||
		date.getUTCMonth() + 1 !== Number(month) ||
		date.getUTCDate() !== Number(day)
	) {
		throw new Error(`Invalid ${field}: ${value}`);
	}
	return iso;
}

function parseTime(value: string): number {
	const match = /^(\d{2})\.(\d{2})\.(\d{2})\.\d{6}$/.exec(value);
	if (!match) throw new Error(`Invalid meeting time: ${value}`);
	const [, hours, minutes, seconds] = match.map(Number);
	if (hours > 23 || minutes > 59 || seconds > 59) throw new Error(`Invalid meeting time: ${value}`);
	return hours * 60 + minutes + seconds / 60;
}

function parseDays(value: string): Day[] {
	const days: Day[] = [];
	let remaining = value;
	while (remaining.length > 0) {
		const token = DAY_TOKENS.find(([candidate]) => remaining.startsWith(candidate));
		if (!token) throw new Error(`Invalid meeting days: ${value}`);
		days.push(token[1]);
		remaining = remaining.slice(token[0].length);
	}
	if (days.length === 0 || new Set(days).size !== days.length)
		throw new Error(`Invalid meeting days: ${value}`);
	return days;
}

function formatTime(minutes: number): string {
	return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function classFingerprint(value: SourceClass): string {
	return JSON.stringify(value);
}

export function aggregateSchedule(
	input: ReadonlyArray<SourceClass>,
	options: AggregateOptions
): ScheduleDataset {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(options.asOfDate)) throw new Error('Invalid asOfDate');

	const classes = new Map<number, SourceClass>();
	for (const item of input) {
		if (!Number.isInteger(item.class_nbr)) throw new Error('Invalid class number');
		if (!Number.isInteger(item.enrollment_total) || item.enrollment_total < 0) {
			throw new Error(`Invalid enrollment for class ${item.class_nbr}`);
		}
		const existing = classes.get(item.class_nbr);
		if (existing && classFingerprint(existing) !== classFingerprint(item)) {
			throw new Error(`Conflicting duplicate class ${item.class_nbr}`);
		}
		classes.set(item.class_nbr, item);
	}

	type TimedMeeting = {
		subject: string;
		label: string;
		day: Day;
		start: number;
		end: number;
		enrollment: number;
	};
	const timedMeetings: TimedMeeting[] = [];
	const meetingKeys = new Set<string>();

	for (const item of classes.values()) {
		if (!INCLUDED_MODES.has(item.instruction_mode) && !EXCLUDED_MODES.has(item.instruction_mode)) {
			throw new Error(
				`Unknown instruction mode ${item.instruction_mode} for class ${item.class_nbr}`
			);
		}
		if (EXCLUDED_MODES.has(item.instruction_mode)) continue;
		if (!item.subject.trim() || !item.subject_descr.trim())
			throw new Error(`Invalid subject for class ${item.class_nbr}`);

		for (const meeting of item.meetings) {
			const noStart = meeting.start_time === '';
			const noEnd = meeting.end_time === '';
			if (noStart && noEnd && (meeting.days === '' || meeting.days === 'TBA')) continue;
			if (noStart && noEnd) continue;
			if (noStart !== noEnd) throw new Error(`Incomplete meeting time for class ${item.class_nbr}`);
			if (meeting.days === 'TBA' || meeting.days === '')
				throw new Error(`Timed meeting without days for class ${item.class_nbr}`);

			const startDate = parseDate(meeting.start_dt, 'meeting start date');
			const endDate = parseDate(meeting.end_dt, 'meeting end date');
			if (startDate > endDate)
				throw new Error(`Invalid meeting date range for class ${item.class_nbr}`);
			if (options.asOfDate < startDate || options.asOfDate > endDate) continue;

			const start = parseTime(meeting.start_time);
			const end = parseTime(meeting.end_time);
			if (end <= start) throw new Error(`Invalid meeting time range for class ${item.class_nbr}`);

			for (const day of parseDays(meeting.days)) {
				const key = `${item.class_nbr}|${day}|${start}|${end}`;
				if (meetingKeys.has(key)) continue;
				meetingKeys.add(key);
				timedMeetings.push({
					subject: item.subject.trim(),
					label: item.subject_descr.trim(),
					day,
					start,
					end,
					enrollment: item.enrollment_total
				});
			}
		}
	}

	if (timedMeetings.length === 0) throw new Error('No active in-person meetings found');

	const firstBucket = Math.min(
		...timedMeetings.map(({ start }) => Math.floor(start / BUCKET_MINUTES) * BUCKET_MINUTES)
	);
	const lastBucket = Math.max(
		...timedMeetings.map(
			({ end }) => Math.ceil(end / BUCKET_MINUTES) * BUCKET_MINUTES - BUCKET_MINUTES
		)
	);
	const bucketStarts = Array.from(
		{ length: (lastBucket - firstBucket) / BUCKET_MINUTES + 1 },
		(_, index) => firstBucket + index * BUCKET_MINUTES
	);
	const times = bucketStarts.map(formatTime);
	const subjectLabels = new Map<string, string>();
	const subjectValues = new Map<string, number[][]>();

	for (const meeting of timedMeetings) {
		const existingLabel = subjectLabels.get(meeting.subject);
		if (existingLabel && existingLabel !== meeting.label)
			throw new Error(`Conflicting label for ${meeting.subject}`);
		subjectLabels.set(meeting.subject, meeting.label);
		let values = subjectValues.get(meeting.subject);
		if (!values) {
			values = DAYS.map(() => times.map(() => 0));
			subjectValues.set(meeting.subject, values);
		}
		const dayIndex = DAYS.indexOf(meeting.day);
		for (let timeIndex = 0; timeIndex < bucketStarts.length; timeIndex += 1) {
			const bucketStart = bucketStarts[timeIndex];
			if (bucketStart < meeting.end && bucketStart + BUCKET_MINUTES > meeting.start) {
				values[dayIndex][timeIndex] += meeting.enrollment;
			}
		}
	}

	const dataset: ScheduleDataset = {
		schemaVersion: 1,
		generatedAt: options.generatedAt,
		asOfDate: options.asOfDate,
		term: options.term,
		bucketMinutes: BUCKET_MINUTES,
		days: [...DAYS],
		times,
		subjects: [...subjectValues.entries()]
			.map(([code, values]) => ({ code, label: subjectLabels.get(code)!, values }))
			.sort((left, right) => left.label.localeCompare(right.label))
	};
	validateDataset(dataset);
	return dataset;
}

export function validateDataset(input: unknown): ScheduleDataset {
	const dataset = Schema.decodeUnknownSync(ScheduleDatasetSchema)(input);
	if (dataset.subjects.length === 0 || dataset.times.length === 0)
		throw new Error('Dataset is empty');
	if (
		dataset.days.length !== DAYS.length ||
		dataset.days.some((day, index) => day !== DAYS[index])
	) {
		throw new Error('Dataset days are invalid');
	}
	const subjectCodes = new Set<string>();
	for (const subject of dataset.subjects) {
		if (!subject.code || !subject.label || subjectCodes.has(subject.code))
			throw new Error('Dataset subjects are invalid');
		subjectCodes.add(subject.code);
		if (subject.values.length !== dataset.days.length)
			throw new Error(`Invalid day matrix for ${subject.code}`);
		for (const row of subject.values) {
			if (
				row.length !== dataset.times.length ||
				row.some((value) => !Number.isInteger(value) || value < 0)
			) {
				throw new Error(`Invalid values for ${subject.code}`);
			}
		}
	}
	return dataset;
}

export function sumSelectedSubjects(
	dataset: ScheduleDataset,
	selectedCodes: ReadonlySet<string>
): number[][] {
	const selected = dataset.subjects.filter(({ code }) => selectedCodes.has(code));
	return dataset.days.map((_, dayIndex) =>
		dataset.times.map((_, timeIndex) =>
			selected.reduce((sum, subject) => sum + subject.values[dayIndex][timeIndex], 0)
		)
	);
}
