import { join } from 'node:path';
import { Data, Effect, Schema } from 'effect';
import { replaceScheduleFile } from '../src/lib/schedule-file.js';
import { aggregateSchedule, type SourceClass } from '../src/lib/schedule.js';

const MAIN_URL =
	'https://cmsweb.csuchico.edu/psp/CCHIPRD/EMPLOYEE/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_Main';
const PAGE_URL =
	'https://cmsweb.csuchico.edu/psc/CCHIPRD/EMPLOYEE/SA/s/WEBLIB_HCX_CM.H_CLASS_SEARCH.FieldFormula.IScript_ClassSearch';
const OUTPUT_PATH = join(import.meta.dir, '..', 'static', 'schedule.json');

const MeetingSchema = Schema.Struct({
	days: Schema.String,
	start_time: Schema.String,
	end_time: Schema.String,
	start_dt: Schema.String,
	end_dt: Schema.String
});
const ClassSchema = Schema.Struct({
	class_nbr: Schema.Int,
	subject: Schema.String,
	subject_descr: Schema.String,
	instruction_mode: Schema.String,
	enrollment_total: Schema.Int,
	meetings: Schema.Array(MeetingSchema)
});
const PageSchema = Schema.Struct({
	pageCount: Schema.Int,
	classes: Schema.Array(ClassSchema)
});
const TermConfigSchema = Schema.Struct({
	institution: Schema.Literal('CHICO'),
	term: Schema.String,
	term_descr: Schema.String
});

class UpdateError extends Data.TaggedError('UpdateError')<{
	readonly message: string;
	readonly cause?: unknown;
}> {}

class CookieSession {
	readonly #cookies = new Map<string, string>();

	async fetch(input: string | URL): Promise<Response> {
		let url = new URL(input);
		for (let redirects = 0; redirects <= 10; redirects += 1) {
			const response = await fetch(url, {
				redirect: 'manual',
				headers:
					this.#cookies.size > 0
						? { cookie: [...this.#cookies].map(([key, value]) => `${key}=${value}`).join('; ') }
						: undefined
			});
			for (const cookie of response.headers.getSetCookie()) {
				const pair = cookie.split(';', 1)[0];
				const separator = pair.indexOf('=');
				if (separator > 0) this.#cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
			}
			if (response.status < 300 || response.status >= 400) return response;
			const location = response.headers.get('location');
			if (!location) throw new Error(`Redirect from ${url} did not include a location`);
			url = new URL(location, url);
		}
		throw new Error(`Too many redirects while requesting ${input}`);
	}
}

function decodeHtmlAttribute(value: string): string {
	return value.replaceAll('&amp;', '&').replaceAll('&#38;', '&').replaceAll('&quot;', '"');
}

async function expectText(response: Response, stage: string): Promise<string> {
	if (!response.ok) throw new Error(`${stage}: HTTP ${response.status}`);
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.toLowerCase().includes('text/html'))
		throw new Error(`${stage}: expected HTML, received ${contentType}`);
	return response.text();
}

async function expectJson(response: Response, stage: string): Promise<unknown> {
	if (!response.ok) throw new Error(`${stage}: HTTP ${response.status}`);
	const contentType = response.headers.get('content-type') ?? '';
	if (!contentType.toLowerCase().includes('application/json')) {
		throw new Error(`${stage}: expected JSON, received ${contentType}`);
	}
	try {
		return await response.json();
	} catch (cause) {
		throw new Error(`${stage}: invalid JSON`, { cause });
	}
}

function decodeTermConfig(html: string) {
	const match = /atob\(`([A-Za-z0-9+/=]+)`\)/.exec(html);
	if (!match) throw new Error('term discovery: embedded configuration was not found');
	try {
		return Schema.decodeUnknownSync(TermConfigSchema)(
			JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'))
		);
	} catch (cause) {
		throw new Error('term discovery: embedded configuration is invalid', { cause });
	}
}

async function discoverTerm(session: CookieSession, override?: string) {
	const shellHtml = await expectText(await session.fetch(MAIN_URL), 'term discovery shell');
	const iframeMatch = /<iframe[^>]+src="([^"]+)"/i.exec(shellHtml);
	if (!iframeMatch) throw new Error('term discovery: class-search frame was not found');
	const iframeUrl = new URL(decodeHtmlAttribute(iframeMatch[1]), MAIN_URL);
	if (override) iframeUrl.searchParams.set('term', override);
	const config = decodeTermConfig(
		await expectText(await session.fetch(iframeUrl), 'term discovery frame')
	);
	if (override && config.term !== override)
		throw new Error(`term discovery: override ${override} was not accepted`);
	if (!/^\d{4}$/.test(config.term) || !config.term_descr.trim()) {
		throw new Error(`term discovery: invalid term metadata (${config.term}/${config.term_descr})`);
	}
	return { code: config.term, label: config.term_descr.trim() };
}

async function fetchPage(session: CookieSession, term: string, page: number) {
	const url = new URL(PAGE_URL);
	url.search = new URLSearchParams({
		institution: 'CHICO',
		term,
		enrl_stat: '',
		crse_attr: '',
		crse_attr_value: '',
		page: String(page)
	}).toString();
	const input = await expectJson(await session.fetch(url), `page ${page}`);
	try {
		return Schema.decodeUnknownSync(PageSchema)(input);
	} catch (cause) {
		throw new Error(`page ${page}: response schema changed`, { cause });
	}
}

function losAngelesDate(now: Date): string {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: 'America/Los_Angeles',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(now);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((value) => value.type === type)?.value;
	return `${part('year')}-${part('month')}-${part('day')}`;
}

async function update(): Promise<void> {
	const session = new CookieSession();
	const terminalTerm = process.env.TERM?.trim();
	const override =
		process.env.SCHEDULE_TERM?.trim() ||
		(/^\d{4}$/.test(terminalTerm ?? '') ? terminalTerm : undefined);
	const term = await discoverTerm(session, override);
	console.log(`Term: ${term.label} (${term.code})`);

	const firstPage = await fetchPage(session, term.code, 1);
	if (firstPage.pageCount < 1) throw new Error('page 1: invalid pageCount');
	const classes: SourceClass[] = [...firstPage.classes];
	console.log(`Fetched page 1 of ${firstPage.pageCount}`);
	for (let page = 2; page <= firstPage.pageCount; page += 1) {
		const response = await fetchPage(session, term.code, page);
		if (response.pageCount !== 0 && response.pageCount !== firstPage.pageCount) {
			throw new Error(`page ${page}: conflicting pageCount ${response.pageCount}`);
		}
		classes.push(...response.classes);
		console.log(`Fetched page ${page} of ${firstPage.pageCount}`);
	}
	if (classes.length === 0) throw new Error('No classes returned');

	const now = new Date();
	const dataset = aggregateSchedule(classes, {
		generatedAt: now.toISOString(),
		asOfDate: losAngelesDate(now),
		term
	});
	await replaceScheduleFile(OUTPUT_PATH, dataset);
	console.log(`Published ${dataset.subjects.length} subjects to ${OUTPUT_PATH}`);
}

const program = Effect.tryPromise({
	try: update,
	catch: (cause) =>
		new UpdateError({ message: cause instanceof Error ? cause.message : String(cause), cause })
});

Effect.runPromise(program).catch((error) => {
	console.error(`Schedule update failed: ${error.message}`);
	process.exitCode = 1;
});
