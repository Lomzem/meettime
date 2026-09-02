import { expect, test } from '@playwright/test';

const url = '/';
const selectedSubjectsStorageKey = 'meettime-selected-subjects';

async function ready(page: import('@playwright/test').Page) {
	await expect(page.getByRole('combobox', { name: 'Subjects' })).toBeVisible();
}

async function selectFirstSubject(page: import('@playwright/test').Page) {
	await page.getByRole('combobox', { name: 'Subjects' }).click();
	await page.locator('[data-slot="command-item"]').first().click();
	await page.keyboard.press('Escape');
}

async function pageWidths(page: import('@playwright/test').Page) {
	return page.evaluate(() => ({
		document: document.documentElement.scrollWidth,
		table: document.querySelector('table')?.getBoundingClientRect().width ?? 0,
		viewport: innerWidth
	}));
}

test.beforeEach(async ({ page }) => {
	await page.goto(url);
	await page.evaluate(() => localStorage.clear());
	await page.reload();
	await ready(page);
});

test('Mod+K focuses search and remains disabled while a dialog is open', async ({ page }) => {
	const subjectPicker = page.locator('[data-slot="popover-trigger"][role="combobox"]');
	await page.keyboard.press('Control+K');
	await expect(page.getByPlaceholder('Search subjects…')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(subjectPicker).toBeFocused();

	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('switch', { name: 'Keyboard shortcut' })).toHaveCount(0);
	await page.keyboard.press('Control+K');
	await expect(page.getByRole('dialog')).toContainText('Settings');
	await expect(page.getByPlaceholder('Search subjects…')).toBeHidden();
});

test('display preferences persist and weekends default to off', async ({ page }) => {
	await page.getByRole('button', { name: 'Settings' }).click();
	expect(await page.getByRole('dialog').locator('label').allTextContents()).toEqual([
		'Weekends',
		'24-hour time',
		'Dark mode',
		'Animations'
	]);
	const weekends = page.getByRole('switch', { name: 'Weekends' });
	await expect(weekends).not.toBeChecked();
	await page.getByRole('switch', { name: 'Dark mode' }).click();
	await page.getByRole('switch', { name: 'Animations' }).click();
	await page.getByRole('switch', { name: '24-hour time' }).click();
	await weekends.click();
	await page.keyboard.press('Escape');
	await page.reload();

	await expect(page.locator('html')).toHaveClass(/dark/);
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('switch', { name: 'Animations' })).not.toBeChecked();
	await expect(page.getByRole('switch', { name: '24-hour time' })).toBeChecked();
	await expect(page.getByRole('switch', { name: 'Weekends' })).toBeChecked();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Control+K');
	await expect(page.getByPlaceholder('Search subjects…')).toBeFocused();
});

test('invalid preference values fall back to defaults', async ({ page }) => {
	await page.evaluate(() => {
		localStorage.setItem('meettime-time-format', 'invalid');
		localStorage.setItem('meettime-animations', 'invalid');
		localStorage.setItem('meettime-weekends', 'invalid');
	});
	await page.reload();

	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('switch', { name: 'Animations' })).toBeChecked();
	await expect(page.getByRole('switch', { name: '24-hour time' })).not.toBeChecked();
	await expect(page.getByRole('switch', { name: 'Weekends' })).not.toBeChecked();
});

test('selected subjects persist, reject stale values, and clear with focus restored', async ({
	page
}) => {
	const subjectPicker = page.getByRole('combobox', { name: 'Subjects' });
	const heatmap = page.getByRole('region', { name: 'Enrollment by day and time' });
	await expect(heatmap).toBeHidden();
	await selectFirstSubject(page);
	await expect(heatmap).toBeVisible();
	const legend = page.getByRole('img', { name: 'Relative enrollment: lower to higher.' });
	await expect(legend).toBeVisible();
	await expect(legend).toContainText('Lower enrollment');
	await expect(legend).toContainText('Higher enrollment');
	await expect(page.getByRole('rowheader', { name: '7:00 am' })).toBeVisible();
	await expect(page.getByRole('rowheader', { name: '7:00 pm' })).toBeVisible();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), selectedSubjectsStorageKey))
		.not.toBe('[]');

	await page.reload();
	await expect(subjectPicker).toContainText('1 selected');
	const selectedCode = await page.evaluate(
		(key) => (JSON.parse(localStorage.getItem(key) ?? '[]') as string[])[0],
		selectedSubjectsStorageKey
	);
	await page.evaluate(
		({ key, selectedCode }) => localStorage.setItem(key, JSON.stringify([selectedCode, 'UNKNOWN'])),
		{ key: selectedSubjectsStorageKey, selectedCode }
	);
	await page.reload();
	await expect(subjectPicker).toContainText('1 selected');

	const clearAll = page.getByRole('button', { name: 'Clear all' });
	await expect(clearAll).toHaveCSS('border-top-width', '1px');
	await clearAll.click();
	await expect(subjectPicker).toBeFocused();
	await expect(heatmap).toBeHidden();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), selectedSubjectsStorageKey))
		.toBe('[]');
	await page.reload();
	await expect(subjectPicker).toContainText('Select subjects');

	await page.evaluate(
		(key) => localStorage.setItem(key, 'invalid JSON'),
		selectedSubjectsStorageKey
	);
	await page.reload();
	await expect(subjectPicker).toContainText('Select subjects');
});

test('blocked browser storage does not prevent loading or controls', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new DOMException('Storage blocked', 'SecurityError');
		};
		Storage.prototype.setItem = () => {
			throw new DOMException('Storage blocked', 'SecurityError');
		};
	});
	await page.reload();
	await ready(page);

	await selectFirstSubject(page);
	await expect(page.getByRole('region', { name: 'Enrollment by day and time' })).toBeVisible();
	await page.getByRole('button', { name: 'Settings' }).click();
	const darkMode = page.getByRole('switch', { name: 'Dark mode' });
	await expect(darkMode).not.toBeChecked();
	await darkMode.click();
	await expect(darkMode).toBeChecked();
	await expect(page.locator('html')).toHaveClass(/dark/);
});

test('help dialog is modal, concise, and restores focus', async ({ page }) => {
	const help = page.getByRole('button', { name: 'Help' });
	await help.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toContainText('Select subjects to see enrollment by day and time.');
	await expect(dialog).toContainText(
		'The heatmap uses enrollment totals. It does not measure how many people are physically present.'
	);
	await expect(dialog).toContainText('The data comes from the Student Center. It updates daily.');
	const overlay = page.locator('[data-slot="dialog-overlay"]');
	const overlayStyle = await overlay.evaluate((element) => ({
		backgroundColor: getComputedStyle(element).backgroundColor,
		backdropFilter: getComputedStyle(element).backdropFilter
	}));
	expect(overlayStyle.backgroundColor).toContain('0.5');
	expect(overlayStyle.backdropFilter).toBe('none');
	const colors = await dialog
		.locator('p')
		.first()
		.evaluate((paragraph) => ({
			body: getComputedStyle(paragraph).color,
			dialog: getComputedStyle(paragraph.closest('[role="dialog"]')!).color
		}));
	expect(colors.body).toBe(colors.dialog);
	await page.keyboard.press('Escape');
	await expect(help).toBeFocused();
});

test('reduced motion suppresses feature animation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await selectFirstSubject(page);
	const duration = await page
		.getByRole('region', { name: 'Enrollment by day and time' })
		.evaluate((element) => getComputedStyle(element).animationDuration);
	expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});

test('five and seven days fit at 390px with the expected typography', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await selectFirstSubject(page);

	await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /Rubik Variable/);
	await expect(page.locator('tbody td').first()).toHaveCSS('font-family', /Geist Variable/);
	await expect(page.locator('tbody td').first()).toHaveCSS('font-variant-numeric', /tabular-nums/);

	for (const weekends of [false, true]) {
		if (weekends) {
			await page.getByRole('button', { name: 'Settings' }).click();
			await page.getByRole('switch', { name: 'Weekends' }).click();
			await page.keyboard.press('Escape');
			await expect(page.getByRole('columnheader', { name: 'Saturday' })).toBeVisible();
		} else {
			await expect(page.getByRole('columnheader', { name: 'Saturday' })).toBeHidden();
		}

		const widths = await pageWidths(page);
		expect(widths.document).toBeLessThanOrEqual(widths.viewport);
		expect(widths.table).toBeLessThanOrEqual(widths.viewport);
		const timeRows = await page.getByRole('rowheader').evaluateAll((headers) =>
			headers.map((header) => ({
				whiteSpace: getComputedStyle(header).whiteSpace,
				scrollWidth: header.scrollWidth,
				clientWidth: header.clientWidth
			}))
		);
		expect(timeRows.length).toBeGreaterThan(0);
		expect(timeRows.every(({ whiteSpace }) => whiteSpace === 'nowrap')).toBe(true);
		expect(timeRows.every(({ scrollWidth, clientWidth }) => scrollWidth <= clientWidth)).toBe(true);
	}
});
