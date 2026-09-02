import { rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { validateDataset } from './schedule.js';

export async function replaceScheduleFile(path: string, value: unknown): Promise<void> {
	const temporaryPath = join(dirname(path), `.schedule-${process.pid}.tmp`);
	try {
		const encoded = `${JSON.stringify(value)}\n`;
		await writeFile(temporaryPath, encoded, 'utf8');
		validateDataset(JSON.parse(encoded));
		await rename(temporaryPath, path);
	} catch (cause) {
		await rm(temporaryPath, { force: true });
		throw cause;
	}
}
