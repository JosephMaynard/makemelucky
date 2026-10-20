// PostHog, cookieless: memory persistence, no identifying cookies — no banner needed.
// Set VITE_POSTHOG_KEY (and optionally VITE_POSTHOG_HOST) to enable in production.

// posthog-js is loaded on demand, not bundled: it is 71KB gzipped and every
// visitor was paying for it even with no key configured. The import only
// happens once VITE_POSTHOG_KEY exists, and events raised before it lands are
// queued rather than dropped.
type PostHog = typeof import('posthog-js').default;

let posthog: PostHog | null = null;
const queued: [string, Record<string, unknown> | undefined][] = [];

export function initAnalytics(): void {
	const key = import.meta.env.VITE_POSTHOG_KEY;
	if (!key || !import.meta.env.PROD) return;
	import('posthog-js')
		.then(({ default: ph }) => {
			ph.init(key, {
				api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
				persistence: 'memory',
				autocapture: false,
				capture_pageview: true,
				disable_session_recording: true,
				disable_surveys: true
			});
			posthog = ph;
			for (const [event, props] of queued.splice(0)) ph.capture(event, props);
			observeSectionViews(['luck-numbers', 'lucky-charms', 'luck-dossier', 'more-projects']);
			observePromoClicks();
		})
		.catch(() => {
			queued.length = 0; // blocked or offline; nobody is counting today
		});
}

export function track(event: string, props?: Record<string, unknown>, opts?: { beacon?: boolean }): void {
	if (posthog) posthog.capture(event, props, opts?.beacon ? { send_instantly: true, transport: 'sendBeacon' } : undefined);
	else if (import.meta.env.PROD && import.meta.env.VITE_POSTHOG_KEY && queued.length < 40) {
		queued.push([event, props]);
	}
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

// `project_clicked` for the "More from the maker" cards. The click navigates
// away, so the event goes out as a beacon rather than waiting in the batch.
function observePromoClicks(): void {
	for (const a of document.querySelectorAll<HTMLAnchorElement>('.promo-card')) {
		a.addEventListener('click', () => {
			let project = a.hostname;
			try {
				project = new URL(a.href).hostname.replace(/^www\./, '');
			} catch { /* keep the raw hostname */ }
			track('project_clicked', { project }, { beacon: true });
		});
	}
}
