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
}

export function track(event: string, props?: Record<string, unknown>): void {
	if (ready) posthog.capture(event, props);
}
