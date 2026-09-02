import { browser } from '$app/environment';
import type { TimeFormat } from '$lib/heatmap-view';

export const preferences = $state({
	animationsEnabled: true,
	shortcutsEnabled: true,
	timeFormat: '12h' as TimeFormat,
	initialized: false
});

export function loadPreferences(): void {
	if (!browser || preferences.initialized) return;

	try {
		const timeFormat = localStorage.getItem('meettime-time-format');
		const animations = localStorage.getItem('meettime-animations');
		const shortcuts = localStorage.getItem('meettime-shortcuts');

		if (timeFormat === '12h' || timeFormat === '24h') preferences.timeFormat = timeFormat;
		if (animations === 'on' || animations === 'off')
			preferences.animationsEnabled = animations === 'on';
		if (shortcuts === 'on' || shortcuts === 'off')
			preferences.shortcutsEnabled = shortcuts === 'on';
	} catch {
		// Browser storage is optional; keep validated defaults when it is unavailable.
	}

	preferences.initialized = true;
	persistPreferences();
}

export function persistPreferences(): void {
	if (!browser) return;

	document.documentElement.dataset.animations = preferences.animationsEnabled ? 'on' : 'off';
	if (!preferences.initialized) return;

	try {
		localStorage.setItem('meettime-time-format', preferences.timeFormat);
		localStorage.setItem('meettime-animations', preferences.animationsEnabled ? 'on' : 'off');
		localStorage.setItem('meettime-shortcuts', preferences.shortcutsEnabled ? 'on' : 'off');
	} catch {
		// Preference persistence must not prevent the schedule from working.
	}
}
