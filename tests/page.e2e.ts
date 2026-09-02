import { expect, test } from '@playwright/test';

const url = '/';

async function ready(page: import('@playwright/test').Page) {
	await page.goto(url);
	await expect(page.getByRole('combobox', { name: 'Subject areas' })).toBeVisible();
}

async function selectFirstSubject(page: import('@playwright/test').Page) {
	await page.getByRole('combobox', { name: 'Subject areas' }).click();
	await page.locator('[data-slot="command-item"]').first().click();
	await page.keyboard.press('Escape');
}

test.beforeEach(async ({ page }) => {
	await page.goto(url);
	await page.evaluate(() => localStorage.clear());
});

test('Mod+K focuses search and is disabled while a dialog is open', async ({ page }) => {
	await ready(page);
	const subjectPicker = page.locator('[data-slot="popover-trigger"][role="combobox"]');
	await page.keyboard.press('Control+K');
	await expect(page.getByPlaceholder('Search subjects…')).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(subjectPicker).toBeFocused();

	await page.getByRole('button', { name: 'Settings' }).click();
	await page.keyboard.press('Control+K');
	await expect(page.getByRole('dialog')).toContainText('Settings');
	await expect(page.getByPlaceholder('Search subjects…')).toBeHidden();
});

test('preferences persist across reloads', async ({ page }) => {
	await ready(page);
	await page.getByRole('button', { name: 'Settings' }).click();
	await page.getByRole('switch', { name: 'Dark mode' }).click();
	await page.getByRole('switch', { name: 'Animations' }).click();
	await page.getByRole('switch', { name: '24-hour time' }).click();
	await page.getByRole('switch', { name: 'Keyboard shortcut' }).click();
	await page.keyboard.press('Escape');
	await page.reload();

	await expect(page.locator('html')).toHaveClass(/dark/);
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('switch', { name: 'Animations' })).not.toBeChecked();
	await expect(page.getByRole('switch', { name: '24-hour time' })).toBeChecked();
	await expect(page.getByRole('switch', { name: 'Keyboard shortcut' })).not.toBeChecked();
	await page.keyboard.press('Escape');
	await page.keyboard.press('Control+K');
	await expect(page.getByPlaceholder('Search subjects…')).toBeHidden();
});

test('invalid preference values fall back to defaults', async ({ page }) => {
	await ready(page);
	await page.evaluate(() => {
		localStorage.setItem('meettime-time-format', 'invalid');
		localStorage.setItem('meettime-animations', 'invalid');
		localStorage.setItem('meettime-shortcuts', 'invalid');
	});
	await page.reload();

	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(page.getByRole('switch', { name: 'Animations' })).toBeChecked();
	await expect(page.getByRole('switch', { name: '24-hour time' })).not.toBeChecked();
	await expect(page.getByRole('switch', { name: 'Keyboard shortcut' })).toBeChecked();
});

test('blocked browser storage does not prevent loading or theme changes', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.addInitScript(() => {
		Storage.prototype.getItem = () => {
			throw new DOMException('Storage blocked', 'SecurityError');
		};
		Storage.prototype.setItem = () => {
			throw new DOMException('Storage blocked', 'SecurityError');
		};
	});
	await ready(page);

	await page.getByRole('button', { name: 'Settings' }).click();
	const darkMode = page.getByRole('switch', { name: 'Dark mode' });
	await expect(darkMode).not.toBeChecked();
	await darkMode.click();
	await expect(darkMode).toBeChecked();
	await expect(page.locator('html')).toHaveClass(/dark/);

	await page.reload();
	await expect(page.getByRole('combobox', { name: 'Subject areas' })).toBeVisible();
	await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('closing a dialog restores focus to its trigger', async ({ page }) => {
	await ready(page);
	const help = page.getByRole('button', { name: 'Help' });
	await help.click();
	await page.keyboard.press('Escape');
	await expect(help).toBeFocused();
});

test('reduced motion suppresses feature animation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await ready(page);
	await selectFirstSubject(page);
	const duration = await page
		.locator('[aria-labelledby="heatmap-heading"]')
		.evaluate((element) => getComputedStyle(element).animationDuration);
	expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
});

test('five and seven days fit at 390px', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await ready(page);
	await selectFirstSubject(page);

	for (const weekends of [false, true]) {
		if (weekends) await page.getByRole('switch', { name: 'Weekends' }).click();
		await expect(page.locator('table')).toBeVisible();
		const widths = await page.evaluate(() => ({
			document: document.documentElement.scrollWidth,
			table: document.querySelector('table')?.getBoundingClientRect().width ?? 0,
			viewport: innerWidth
		}));
		expect(widths.document).toBeLessThanOrEqual(widths.viewport);
		expect(widths.table).toBeLessThanOrEqual(widths.viewport);
	}
});
