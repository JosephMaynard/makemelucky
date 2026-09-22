import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PressController } from '../src/ui/pressController';

// The controller takes its clock as an option, so the dedupe window is driven
// here rather than by whatever performance.now() happens to say.
let clock = 0;
const now = () => clock;

interface Harness {
	target: HTMLElement;
	controller: PressController;
	downs: number;
	ups: number;
	holds: number[];
	/** Resolve the press operation currently in flight (see `slow`). */
	settle: () => void;
}

/** `slow: true` keeps each completed press pending until settle() is called —
 *  that is the daily ritual's 1.3-second announcement, in miniature. */
function harness(slow = false, blocked = () => false): Harness {
	document.body.innerHTML = '<button id="press-target"></button>';
	const target = document.getElementById('press-target')!;
	const h = { target, downs: 0, ups: 0, holds: [] as number[] } as Harness;
	let release: (() => void) | null = null;
	h.settle = () => {
		release?.();
		release = null;
	};
	h.controller = new PressController({
		target,
		now,
		blocked,
		clickHoldMs: 140,
		dedupeMs: 500,
		onDown: () => {
			h.downs += 1;
		},
		onUp: () => {
			h.ups += 1;
		},
		onComplete: (hold) => {
			h.holds.push(hold);
			if (!slow) return;
			return new Promise<void>((resolve) => {
				release = resolve;
			});
		}
	});
	return h;
}

const fire = (target: HTMLElement, type: string): void => {
	const event = new Event(type, { bubbles: true, cancelable: true });
	(event as unknown as { pointerId: number }).pointerId = 1;
	target.dispatchEvent(event);
};

const key = (target: HTMLElement, type: 'keydown' | 'keyup', k: string): void => {
	target.dispatchEvent(new KeyboardEvent(type, { key: k, bubbles: true, cancelable: true }));
};

// let the async run() wrapper finish its finally block
const flush = async (): Promise<void> => {
	for (let i = 0; i < 4; i++) await Promise.resolve();
};

beforeEach(() => {
	clock = 1000;
	vi.useFakeTimers();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('PressController activation paths', () => {
	it('credits exactly one press for a click-only activation', () => {
		const h = harness();
		h.target.click(); // what assistive technology sends: no pointer, no keys
		expect(h.downs).toBe(1);
		expect(h.holds).toEqual([]); // still held down

		clock += 140;
		vi.advanceTimersByTime(140);
		expect(h.ups).toBe(1);
		expect(h.holds).toHaveLength(1);
		expect(h.holds[0]).toBeCloseTo(0.14, 5);
	});

	it('credits one press for a pointer release followed by the browser click', () => {
		const h = harness();
		fire(h.target, 'pointerdown');
		clock += 220;
		fire(h.target, 'pointerup');
		expect(h.holds).toHaveLength(1);

		h.target.click(); // the compatibility click every pointer gesture ends with
		vi.advanceTimersByTime(500);
		expect(h.downs).toBe(1);
		expect(h.holds).toHaveLength(1);
	});

	it('credits one press for Enter, whose click arrives before the key is released', () => {
		const h = harness();
		key(h.target, 'keydown', 'Enter');
		h.target.click(); // browsers fire this at keydown for a native button
		clock += 300;
		key(h.target, 'keyup', 'Enter');
		vi.advanceTimersByTime(500);

		expect(h.downs).toBe(1);
		expect(h.holds).toHaveLength(1);
		expect(h.holds[0]).toBeCloseTo(0.3, 5);
	});

	it('credits one press for Space, whose click arrives after the key is released', () => {
		const h = harness();
		key(h.target, 'keydown', ' ');
		clock += 8200; // long enough for the Steady Hand charm
		key(h.target, 'keyup', ' ');
		h.target.click();
		vi.advanceTimersByTime(500);

		expect(h.downs).toBe(1);
		expect(h.holds).toHaveLength(1);
		expect(h.holds[0]).toBeGreaterThanOrEqual(8);
	});

	it('accepts a click that arrives long after the last release', async () => {
		const h = harness();
		fire(h.target, 'pointerdown');
		clock += 100;
		fire(h.target, 'pointerup');
		expect(h.holds).toHaveLength(1);
		await flush(); // the first press finishes and hands the button back

		clock += 5000; // a separate, deliberate activation
		h.target.click();
		clock += 140;
		vi.advanceTimersByTime(140);
		expect(h.holds).toHaveLength(2);
	});

	it('lets the button back up without crediting a cancelled pointer or a lost focus', () => {
		const h = harness();
		fire(h.target, 'pointerdown');
		fire(h.target, 'pointercancel');
		expect(h.ups).toBe(1);
		expect(h.holds).toEqual([]);

		clock += 5000;
		key(h.target, 'keydown', 'Enter');
		h.target.dispatchEvent(new Event('blur'));
		expect(h.ups).toBe(2);
		expect(h.holds).toEqual([]);
	});
});

describe('PressController exclusivity', () => {
	it('credits one press for two releases inside the ritual delay', async () => {
		const h = harness(true);
		fire(h.target, 'pointerdown');
		clock += 120;
		fire(h.target, 'pointerup');
		expect(h.holds).toHaveLength(1);

		// 100ms later, mid-announcement: the director is not "running" yet
		clock += 100;
		fire(h.target, 'pointerdown');
		clock += 20;
		fire(h.target, 'pointerup');
		expect(h.downs).toBe(1);
		expect(h.holds).toHaveLength(1);

		// ...and the ritual finishing hands the button back
		h.settle();
		await flush();
		clock += 1000;
		fire(h.target, 'pointerdown');
		clock += 50;
		fire(h.target, 'pointerup');
		expect(h.holds).toHaveLength(2);
	});

	it('refuses a click, a key and a pointer while a press is in flight', async () => {
		const h = harness(true);
		h.target.click();
		clock += 140;
		vi.advanceTimersByTime(140);
		expect(h.holds).toHaveLength(1);

		clock += 2000; // well past the dedupe window: this is refusal, not dedupe
		h.target.click();
		key(h.target, 'keydown', 'Enter');
		fire(h.target, 'pointerdown');
		vi.advanceTimersByTime(500);
		expect(h.downs).toBe(1);
		expect(h.holds).toHaveLength(1);

		h.settle();
		await flush();
	});

	it('refuses a press while something else (an effect) is already running', () => {
		let running = true;
		const h = harness(false, () => running);
		h.target.click();
		fire(h.target, 'pointerdown');
		key(h.target, 'keydown', 'Enter');
		vi.advanceTimersByTime(500);
		expect(h.downs).toBe(0);
		expect(h.holds).toEqual([]);

		running = false;
		clock += 1000;
		h.target.click();
		clock += 140;
		vi.advanceTimersByTime(140);
		expect(h.holds).toHaveLength(1);
	});

	it('run() serialises the console path against the button', async () => {
		const h = harness();
		let released: (() => void) | null = null;
		const summoned = h.controller.run(() => new Promise<string>((r) => { released = () => r('rainbow'); }));

		clock += 1000;
		h.target.click(); // a press during a console-summoned effect is refused
		vi.advanceTimersByTime(500);
		expect(h.downs).toBe(0);

		const second = await h.controller.run(() => 'nope');
		expect(second).toBeNull();

		released!();
		expect(await summoned).toBe('rainbow');
		await flush();
		expect(h.controller.busy).toBe(false);
	});
});
