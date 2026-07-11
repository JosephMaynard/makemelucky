export class Haptics {
	enabled: boolean;

	constructor() {
		this.enabled = true;
	}

	vibrate(pattern: number | number[]) {
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
