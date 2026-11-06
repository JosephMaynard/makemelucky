// PostHog, cookieless: memory persistence, no identifying cookies — no banner needed.
// Set VITE_POSTHOG_KEY (and optionally VITE_POSTHOG_HOST) to enable in production.

// posthog-js is loaded on demand, not bundled: it is 71KB gzipped and every
// visitor was paying for it even with no key configured. The import only
// happens once VITE_POSTHOG_KEY exists, and events raised before it lands are
// queued rather than dropped.
declare const __BUILD__: string; // injected by vite.config.ts define
type PostHog = typeof import('posthog-js').default;

let posthog: PostHog | null = null;
const queued: [string, Record<string, unknown> | undefined][] = [];
const earlyErrors: [unknown, Record<string, unknown> | undefined][] = [];

const wanted = (): boolean => Boolean(import.meta.env.PROD && import.meta.env.VITE_POSTHOG_KEY);

export function initAnalytics(): void {
	if (!wanted()) return;
	const key = import.meta.env.VITE_POSTHOG_KEY as string;
	// Errors thrown while posthog-js is still on its way (boot is exactly when
	// things go wrong) are kept and handed over once it lands. After that its
	// own exception autocapture owns window.onerror, so these listeners go.
	const onError = (e: ErrorEvent): void => trackError(e.error ?? e.message, { early: true });
	const onRejection = (e: PromiseRejectionEvent): void => trackError(e.reason, { early: true, unhandled_rejection: true });
	window.addEventListener('error', onError);
	window.addEventListener('unhandledrejection', onRejection);
	const unlisten = (): void => {
		window.removeEventListener('error', onError);
		window.removeEventListener('unhandledrejection', onRejection);
	};
	import('posthog-js')
		.then(({ default: ph }) => {
			ph.init(key, {
				api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
				persistence: 'memory',
				autocapture: false,
				capture_pageview: true,
				capture_exceptions: true,
				disable_session_recording: true,
				disable_surveys: true
			});
			ph.register({ build: __BUILD__ });
			posthog = ph;
			unlisten();
			for (const [event, props] of queued.splice(0)) ph.capture(event, props);
			for (const [err, props] of earlyErrors.splice(0)) ph.captureException(err, props);
			observeSectionViews(['luck-numbers', 'lucky-charms', 'luck-dossier', 'more-projects']);
			observePromoClicks();
		})
		.catch(() => {
			unlisten();
			queued.length = 0; // blocked or offline; nobody is counting today
			earlyErrors.length = 0;
		});
}

export function track(event: string, props?: Record<string, unknown>, opts?: { beacon?: boolean }): void {
	if (posthog) posthog.capture(event, props, opts?.beacon ? { send_instantly: true, transport: 'sendBeacon' } : undefined);
	else if (wanted() && queued.length < 40) queued.push([event, props]);
}

/** An exception for PostHog's error tracking: grouped by stack, linked to the
 *  page load it happened in. Anything that is caught and recovered from but
 *  still worth a look (a failed boot, a model that would not load) goes here. */
export function trackError(err: unknown, props?: Record<string, unknown>): void {
	if (posthog) posthog.captureException(err, props);
	else if (wanted() && earlyErrors.length < 10) earlyErrors.push([err, props]);
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
