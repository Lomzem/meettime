import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { replaceScheduleFile } from './schedule-file';

let directory = '';

afterEach(async () => {
	if (directory) await rm(directory, { force: true, recursive: true });
});

describe('atomic schedule replacement', () => {
	it('keeps the previous file when new data is invalid', async () => {
		directory = await mkdtemp(join(tmpdir(), 'meettime-'));
		const path = join(directory, 'schedule.json');
		await writeFile(path, 'previous\n');

		await expect(replaceScheduleFile(path, { schemaVersion: 1 })).rejects.toThrow();
		expect(await readFile(path, 'utf8')).toBe('previous\n');
	});
});
