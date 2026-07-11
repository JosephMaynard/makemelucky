import { describe, it, expect } from 'vitest';
import { easings, tween, updateTweens, delay, lerp, rand, pick, shuffle } from '../src/core/anim';
import type { EasingName } from '../src/core/anim';

describe('easings', () => {
	it('every easing starts at 0 and ends at 1', () => {
		for (const name of Object.keys(easings) as EasingName[]) {
			expect(easings[name](0), `${name}(0)`).toBeCloseTo(0, 6);
			expect(easings[name](1), `${name}(1)`).toBeCloseTo(1, 6);
		}
	});

	it('linear is the identity', () => {
		expect(easings.linear(0.37)).toBe(0.37);
	});
});

describe('tween', () => {
	it('calls onUpdate immediately with 0, then resolves at 1 when time passes', async () => {
		const values: number[] = [];
		const done = tween(100, 'linear', (v) => values.push(v));
		expect(values).toEqual([0]);
		updateTweens(performance.now() + 50);
		updateTweens(performance.now() + 200);
		await done;
		expect(values.at(-1)).toBe(1);
		// intermediate frame landed strictly between the endpoints
		expect(values.length).toBeGreaterThanOrEqual(3);
		expect(values[1]).toBeGreaterThan(0);
		expect(values[1]).toBeLessThan(1);
	});

	it('a finished tween is removed and not updated again', async () => {
		let calls = 0;
		const done = tween(10, 'linear', () => calls++);
		updateTweens(performance.now() + 100);
		await done;
		const after = calls;
		updateTweens(performance.now() + 200);
		expect(calls).toBe(after);
	});
});

describe('delay', () => {
	it('resolves after the given time', async () => {
		const t0 = performance.now();
		await delay(20);
		expect(performance.now() - t0).toBeGreaterThanOrEqual(15);
	});
});

describe('small helpers', () => {
	it('lerp interpolates', () => {
		expect(lerp(0, 10, 0.5)).toBe(5);
		expect(lerp(-2, 2, 0)).toBe(-2);
		expect(lerp(-2, 2, 1)).toBe(2);
	});

	it('rand stays within its bounds', () => {
		for (let i = 0; i < 200; i++) {
			const v = rand(1.5, 2.5);
			expect(v).toBeGreaterThanOrEqual(1.5);
			expect(v).toBeLessThan(2.5);
		}
	});

	it('pick returns a member of the array', () => {
		const arr = ['a', 'b', 'c'] as const;
		for (let i = 0; i < 50; i++) expect(arr).toContain(pick(arr));
	});

	it('shuffle preserves the elements and does not mutate the input', () => {
		const input = [1, 2, 3, 4, 5, 6, 7, 8];
		const copy = [...input];
		const out = shuffle(input);
		expect(input).toEqual(copy);
		expect([...out].sort((a, b) => a - b)).toEqual(copy);
	});
});
