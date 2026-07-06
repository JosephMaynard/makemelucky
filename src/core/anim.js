// Tiny promise-based tween helpers — no animation library needed.

export const easings = {
	linear: (t) => t,
	inQuad: (t) => t * t,
	outQuad: (t) => t * (2 - t),
	inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
	inCubic: (t) => t * t * t,
	outCubic: (t) => --t * t * t + 1,
	inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
	inQuart: (t) => t * t * t * t,
	outQuart: (t) => 1 - --t * t * t * t,
	inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
	outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
	// Overshooting spring-back, like a released button
	outBack: (t) => {
		const c1 = 1.70158;
		const c3 = c1 + 1;
		return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
	},
	outElastic: (t) => {
		if (t === 0 || t === 1) return t;
		return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
	}
};

const active = new Set();

/** Advance all running tweens. Called once per frame by the scene loop. */
export function updateTweens(now) {
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
 * Resolves when finished. v is the eased 0→1 value.
 */
export function tween(duration, easing, onUpdate) {
	return new Promise((resolve) => {
		const tw = {
			start: performance.now(),
			duration: Math.max(1, duration),
			ease: typeof easing === 'function' ? easing : easings[easing] || easings.linear,
			onUpdate,
			resolve
		};
		onUpdate(0, 0);
		active.add(tw);
	});
}

export function delay(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Linear interpolate */
export const lerp = (a, b, t) => a + (b - a) * t;

/** Random in range */
export const rand = (min, max) => min + Math.random() * (max - min);

/** Random pick from array */
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function shuffle(array) {
	const a = array.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}
