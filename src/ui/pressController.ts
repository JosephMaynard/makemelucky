// Every way of pressing the big red button, behind one door.
//
// A button can be activated three ways, and the machine used to hear only two
// of them. Pointer and keyboard were wired up; a bare `click` — what assistive
// technology sends when someone activates the button through a screen reader —
// fell straight through and nothing happened. All three now arrive here.
//
// The other job is refusing overlapping presses. The daily ritual holds the
// screen for 1.3 seconds before the effect starts, and during that gap nothing
// downstream looks "running", so a second press used to be accepted and two
// performances fought over the machine. The controller stays busy from the
// moment a press is accepted until the whole operation settles.

export interface PressControllerOptions {
	/** The accessible button sitting over the 3D one. */
	target: HTMLElement;
	/** A second opinion on whether a press can start (e.g. director.running). */
	blocked?: () => boolean;
	/** The button goes down: a new press has been accepted. */
	onDown: () => void;
	/** The button comes back up, whether or not the press counted. */
	onUp: () => void;
	/** The press counted. The controller stays busy until this settles. */
	onComplete: (holdSeconds: number) => void | Promise<void>;
	/** Clock, injectable for tests. */
	now?: () => number;
	/** How long a bare click holds the button down before releasing it. */
	clickHoldMs?: number;
	/** A click this soon after a handled release is the same press, not a new one. */
	dedupeMs?: number;
}

export class PressController {
	/** True from the instant a press is accepted until its operation settles. */
	busy: boolean;

	private o: PressControllerOptions;
	private now: () => number;
	private clickHoldMs: number;
	private dedupeMs: number;
	private pointerHeld: boolean;
	private keyHeld: boolean;
	private clickHeld: boolean;
	private holdStart: number;
	private lastRelease: number;

	constructor(options: PressControllerOptions) {
		this.o = options;
		this.busy = false;
		this.now = options.now ?? (() => performance.now());
		this.clickHoldMs = options.clickHoldMs ?? 140;
		this.dedupeMs = options.dedupeMs ?? 500;
		this.pointerHeld = false;
		this.keyHeld = false;
		this.clickHeld = false;
		this.holdStart = 0;
		this.lastRelease = -Infinity;

		const target = options.target;
		target.addEventListener('pointerdown', this._onPointerDown);
		target.addEventListener('pointerup', this._onPointerUp);
		target.addEventListener('pointercancel', this._onPointerCancel);
		target.addEventListener('keydown', this._onKeyDown);
		target.addEventListener('keyup', this._onKeyUp);
		target.addEventListener('blur', this._onBlur);
		target.addEventListener('click', this._onClick);
	}

	/** Is a press in flight (ours, or whatever else `blocked` knows about)? */
	refuses(): boolean {
		return this.busy || this.held || !!this.o.blocked?.();
	}

	/** Run one exclusive press-scoped operation. Returns null if refused —
	 *  this is also the console's door in, so `showEffect()` and the button
	 *  cannot talk over each other. */
	async run<T>(fn: () => T | Promise<T>): Promise<T | null> {
		if (this.busy || this.o.blocked?.()) return null;
		this.busy = true;
		try {
			return await fn();
		} finally {
			this.busy = false;
		}
	}

	dispose(): void {
		const target = this.o.target;
		target.removeEventListener('pointerdown', this._onPointerDown);
		target.removeEventListener('pointerup', this._onPointerUp);
		target.removeEventListener('pointercancel', this._onPointerCancel);
		target.removeEventListener('keydown', this._onKeyDown);
		target.removeEventListener('keyup', this._onKeyUp);
		target.removeEventListener('blur', this._onBlur);
		target.removeEventListener('click', this._onClick);
	}

	private get held(): boolean {
		return this.pointerHeld || this.keyHeld || this.clickHeld;
	}

	private _begin(): void {
		this.holdStart = this.now();
		this.o.onDown();
	}

	/** Up without credit: a cancelled pointer, or focus lost mid-hold. The
	 *  release is still stamped, so the click that may follow the same gesture
	 *  cannot resurrect it as a fresh press. */
	private _abort(): void {
		this.lastRelease = this.now();
		this.o.onUp();
	}

	private _finish(): void {
		this.lastRelease = this.now();
		const holdSeconds = (this.now() - this.holdStart) / 1000;
		this.o.onUp();
		void this.run(() => this.o.onComplete(holdSeconds));
	}

	private _onPointerDown = (e: PointerEvent): void => {
		if (this.refuses()) return;
		e.preventDefault();
		// without capture, dragging off before releasing strands the button down
		try {
			this.o.target.setPointerCapture(e.pointerId);
		} catch { /* stale pointer */ }
		this.pointerHeld = true;
		this._begin();
	};

	private _onPointerUp = (): void => {
		if (!this.pointerHeld) return;
		this.pointerHeld = false;
		this._finish();
	};

	private _onPointerCancel = (): void => {
		if (!this.pointerHeld) return;
		this.pointerHeld = false;
		this._abort();
	};

	// Keyboard activation mirrors the pointer path, hold included. The press
	// ends when the key comes up, so the eight-second Steady Hand charm is
	// reachable without a mouse.
	private _onKeyDown = (e: KeyboardEvent): void => {
		if (e.key !== 'Enter' && e.key !== ' ') return;
		if (e.repeat || this.refuses()) return;
		e.preventDefault();
		this.keyHeld = true;
		this._begin();
	};

	private _onKeyUp = (e: KeyboardEvent): void => {
		if (!this.keyHeld || (e.key !== 'Enter' && e.key !== ' ')) return;
		e.preventDefault();
		this.keyHeld = false;
		this._finish();
	};

	// focus lost mid-hold: let the button back up without crediting a press
	private _onBlur = (): void => {
		if (!this.keyHeld) return;
		this.keyHeld = false;
		this._abort();
	};

	// The semantic activation path. Browsers also fire a click after a pointer
	// release (and after Enter/Space on a native button), so a click that
	// arrives while we are mid-gesture, or hard on the heels of a release we
	// already credited, is the same press wearing a different hat.
	private _onClick = (e: MouseEvent): void => {
		if (this.held) return;
		if (this.now() - this.lastRelease < this.dedupeMs) return;
		if (this.refuses()) return;
		e.preventDefault();
		this.clickHeld = true;
		this._begin();
		setTimeout(() => {
			if (!this.clickHeld) return;
			this.clickHeld = false;
			this._finish();
		}, this.clickHoldMs);
	};
}
