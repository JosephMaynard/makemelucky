// Keeps the screen awake while an effect plays. The long set-pieces run for
// half a minute and the visitor's last touch was the button press at the
// start, so a phone on a 30-second idle timer dims (or locks) right in the
// middle of the finale. The Screen Wake Lock API holds it open; the lock is
// dropped again the moment the machine goes idle so we never keep a screen on
// that nobody is watching.
//
// The browser releases the lock itself whenever the page is hidden (tab
// switch, screen lock), so a lock we still want has to be re-requested when
// the page comes back. Unsupported browsers, low-battery refusals and
// insecure contexts all fail quietly — this is a nicety, never a requirement.

export class WakeLock {
	private sentinel: WakeLockSentinel | null = null;
	private wanted = false;
	private releaseTimer: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		if (typeof document === 'undefined') return;
		document.addEventListener('visibilitychange', () => {
			if (this.wanted && !document.hidden) void this.acquire();
		});
	}

	get supported(): boolean {
		return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
	}

	/** Hold the screen awake until release() is called. */
	hold(): void {
		this.wanted = true;
		if (this.releaseTimer) {
			clearTimeout(this.releaseTimer);
			this.releaseTimer = null;
		}
		void this.acquire();
	}

	/** Let the screen go again, after `graceMs` — long enough to read the
	 *  screen panel's parting quip before the idle timer takes over. */
	release(graceMs = 0): void {
		this.wanted = false;
		if (this.releaseTimer) clearTimeout(this.releaseTimer);
		this.releaseTimer = setTimeout(() => {
			this.releaseTimer = null;
			if (this.wanted) return; // a new effect started inside the grace period
			const s = this.sentinel;
			this.sentinel = null;
			s?.release().catch(() => { /* already gone */ });
		}, graceMs);
	}

	private async acquire(): Promise<void> {
		if (!this.supported || this.sentinel || document.hidden) return;
		try {
			const sentinel = await navigator.wakeLock.request('screen');
			// the request is async: if release() ran while we waited, let go now
			if (!this.wanted) {
				sentinel.release().catch(() => { /* already gone */ });
				return;
			}
			this.sentinel = sentinel;
			sentinel.addEventListener('release', () => {
				if (this.sentinel === sentinel) this.sentinel = null;
			});
		} catch {
			// refused (battery saver, permissions policy, insecure context)
		}
	}
}
