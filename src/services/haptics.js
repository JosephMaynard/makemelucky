export class Haptics {
	constructor() {
		this.enabled = true;
	}

	vibrate(pattern) {
		if (!this.enabled) return;
		if (navigator.vibrate) {
			try {
				navigator.vibrate(pattern);
			} catch {
				/* some browsers throw when not user-activated */
			}
		}
	}
}
