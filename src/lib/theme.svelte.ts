import { browser } from '$app/environment';

type ThemeMode = 'light' | 'dark' | 'system';

const storageKey = 'mode-watcher-mode';
let initialized = false;

export const theme = $state({
	mode: 'system' as ThemeMode,
	dark: false
});

function applyTheme(mode: ThemeMode): void {
	const dark =
		mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
	theme.mode = mode;
	theme.dark = dark;
	document.documentElement.classList.toggle('dark', dark);
	document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

export function loadTheme(): (() => void) | undefined {
	if (!browser || initialized) return;
	initialized = true;

	let mode: ThemeMode = 'system';
	try {
		const stored = localStorage.getItem(storageKey);
		if (stored === 'light' || stored === 'dark' || stored === 'system') mode = stored;
	} catch {
		// Browser storage is optional; use the system theme when it is unavailable.
	}
	applyTheme(mode);

	const systemTheme = matchMedia('(prefers-color-scheme: dark)');
	const updateSystemTheme = () => {
		if (theme.mode === 'system') applyTheme('system');
	};
	systemTheme.addEventListener('change', updateSystemTheme);

	return () => {
		systemTheme.removeEventListener('change', updateSystemTheme);
		initialized = false;
	};
}

export function setTheme(mode: ThemeMode): void {
	if (!browser) return;
	applyTheme(mode);
	try {
		localStorage.setItem(storageKey, mode);
	} catch {
		// The in-memory toggle still works when persistence is unavailable.
	}
}
