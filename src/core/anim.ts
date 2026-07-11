// Tiny promise-based tween helpers — no animation library needed.

export const easings = {
	linear: (t: number) => t,
	inQuad: (t: number) => t * t,
	outQuad: (t: number) => t * (2 - t),
	inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
	inCubic: (t: number) => t * t * t,
	outCubic: (t: number) => --t * t * t + 1,
	inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
	inQuart: (t: number) => t * t * t * t,
	outQuart: (t: number) => 1 - --t * t * t * t,
	inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
	outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
	// Overshooting spring-back, like a released button
	outBack: (t: number) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	},
	outElastic: (t: number) => {
		if (t === 0 || t === 1) return t;
		return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
	}
};

export type EasingName = keyof typeof easings;

interface Tween {
	start: number;
	duration: number;
	ease: (t: number) => number;
	onUpdate: (v: number, t: number) => void;
	resolve: () => void;
}

const active = new Set<Tween>();

/** Advance all running tweens. Called once per frame by the scene loop. */
export function updateTweens(now: number) {
	for (const tw of active) {
		const t = Math.min(1, (now - tw.start) / tw.duration);
		tw.onUpdate(tw.ease(t), t);
		if (t >= 1) {
			active.delete(tw);
			tw.resolve();
		}
	}
}

/**
 * tween(600, 'outCubic', (v) => { mesh.scale.setScalar(v) })
 * Resolves when finished. v is the eased 0→1 value; a custom easing function
 * may be passed instead of a name, and onUpdate also receives the raw t.
 */
export function tween(
	duration: number,
	easing: EasingName | ((t: number) => number),
	onUpdate: (v: number, t: number) => void
): Promise<void> {
	return new Promise<void>((resolve) => {
		const tw: Tween = {
			start: performance.now(),
			duration: Math.max(1, duration),
			ease: typeof easing === 'function' ? easing : easings[easing] || easings.linear,
			onUpdate,
			resolve
		};
		tw.onUpdate(0, 0);
		active.add(tw);
	});
}

export function delay(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Linear interpolate */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Random in range */
export const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Random pick from array */
export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export function shuffle<T>(array: readonly T[]): T[] {
	const a = array.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
