import { describe, it, expect } from 'vitest';
import { Director } from '../src/effects/director';
import { QUIPS } from '../src/ui/quips';
import type { EffectContext } from '../src/types';

// The director's constructor only stores ctx — the bag logic never touches it.
const dummyCtx = {} as EffectContext;

describe('Director', () => {
	it('exposes the effect names, unique and without gentleGlow', () => {
		const director = new Director(dummyCtx);
		expect(director.names.length).toBeGreaterThanOrEqual(20);
		expect(new Set(director.names).size).toBe(director.names.length);
		expect(director.names).not.toContain('gentleGlow'); // reduced-motion only
	});

	it('shuffle bag: every cycle plays each effect once, never the same twice in a row', () => {
		const director = new Director(dummyCtx);
		const n = director.names.length;
		const plays: string[] = [];
		for (let i = 0; i < n * 5; i++) {
			const name = director._next();
			director.last = name; // play() does this bookkeeping; the reshuffle guard reads it
			plays.push(name);
		}
		// no immediate repeats, including across reshuffle boundaries
		for (let i = 1; i < plays.length; i++) {
			expect(plays[i], `position ${i}`).not.toBe(plays[i - 1]);
		}
		// each full cycle is a permutation of all effect names
		const sorted = [...director.names].sort();
		for (let c = 0; c < 5; c++) {
			expect([...plays.slice(c * n, (c + 1) * n)].sort()).toEqual(sorted);
		}
	});
});

describe('QUIPS', () => {
	it('every effect has a quip and every quip has an effect', () => {
		const director = new Director(dummyCtx);
		expect(Object.keys(QUIPS).sort()).toEqual([...director.names].sort());
	});

	it('quips are two short lines', () => {
		for (const [name, quip] of Object.entries(QUIPS)) {
			expect(quip, name).toHaveLength(2);
			for (const line of quip) expect(line.length, name).toBeLessThanOrEqual(18);
		}
	});
});
