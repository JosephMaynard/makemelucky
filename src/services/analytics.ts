// PostHog, cookieless: memory persistence, no identifying cookies — no banner needed.
// Set VITE_POSTHOG_KEY (and optionally VITE_POSTHOG_HOST) to enable in production.

import posthog from 'posthog-js';

let ready = false;

export function initAnalytics(): void {
	const key = import.meta.env.VITE_POSTHOG_KEY;
	if (!key || !import.meta.env.PROD) return;
	posthog.init(key, {
		api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
		persistence: 'memory',
		autocapture: false,
		capture_pageview: true,
		disable_session_recording: true,
		disable_surveys: true
	});
	ready = true;
	observeSectionViews(['luck-numbers', 'lucky-charms', 'luck-dossier']);
}

export function track(event: string, props?: Record<string, unknown>): void {
	if (ready) posthog.capture(event, props);
}

// fires `section_viewed` once per session per id, the first time ≥40% of the
// section is on screen. No-ops quietly where IntersectionObserver doesn't
// exist (older browsers, tests/happy-dom).
const viewedSections = new Set<string>();

export function observeSectionViews(ids: string[]): void {
	if (typeof IntersectionObserver === 'undefined') return;
	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting || viewedSections.has(entry.target.id)) continue;
				viewedSections.add(entry.target.id);
				observer.unobserve(entry.target);
				track('section_viewed', { id: entry.target.id });
			}
		},
		{ threshold: 0.4 }
	);
	for (const id of ids) {
		const el = document.getElementById(id);
		if (el) observer.observe(el);
	}
}
