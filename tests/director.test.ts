import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { Director } from '../src/effects/director';
import { QUIPS } from '../src/ui/quips';
import type { EffectContext } from '../src/types';

// The director's constructor only stores ctx — the bag logic never touches it.
const dummyCtx = {} as EffectContext;

// Mocked so play() is controllable per-test and never touches THREE/audio/etc.
vi.mock('../src/effects/powerSurge', () => ({
	sound: 'powerStreams',
	duration: 7000,
	play: vi.fn()
}));
vi.mock('../src/effects/gentleGlow', () => ({
	sound: 'lucky',
	duration: 4500,
	play: vi.fn()
}));

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

describe('Director.play()', () => {
	// stub EffectContext: only the fields play() actually touches
	const ctx = {
		scene: { reducedMotion: false },
		machine: { mechSpeed: 1, resetToIdle: vi.fn() },
		audio: { play: vi.fn(), stopAllLoops: vi.fn() },
		lightning: { clear: vi.fn() }
	} as unknown as EffectContext;

	beforeEach(async () => {
		vi.clearAllMocks();
		ctx.scene.reducedMotion = false;
		ctx.machine.mechSpeed = 1;
		const powerSurge = await import('../src/effects/powerSurge');
		const gentleGlow = await import('../src/effects/gentleGlow');
		(powerSurge.play as Mock).mockReset();
		(gentleGlow.play as Mock).mockReset();
	});

	it('happy path: sets mechSpeed to 5 during play, restores to 1 after, returns the name', async () => {
		const powerSurge = await import('../src/effects/powerSurge');
		let mechSpeedDuringPlay: number | undefined;
		(powerSurge.play as Mock).mockImplementation(async () => {
			mechSpeedDuringPlay = ctx.machine.mechSpeed;
		});
		const director = new Director(ctx);
		director.forced = 'powerSurge';
		const name = await director.play();
		expect(name).toBe('powerSurge');
		expect(mechSpeedDuringPlay).toBe(5);
		expect(ctx.machine.mechSpeed).toBe(1);
	});

	it('crash path: resolves (does not throw), cleans up, restores mechSpeed', async () => {
		const powerSurge = await import('../src/effects/powerSurge');
		(powerSurge.play as Mock).mockRejectedValue(new Error('effect boom'));
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
		const director = new Director(ctx);
		director.forced = 'powerSurge';
		const name = await director.play();
		expect(name).toBe('powerSurge');
		expect(ctx.machine.resetToIdle).toHaveBeenCalledTimes(1);
		expect(ctx.audio.stopAllLoops).toHaveBeenCalledTimes(1);
		expect(ctx.lightning.clear).toHaveBeenCalledTimes(1);
		expect(ctx.machine.mechSpeed).toBe(1);
		consoleError.mockRestore();
	});

	it('re-entrancy: a second play() while the first is in-flight returns null', async () => {
		const powerSurge = await import('../src/effects/powerSurge');
		let resolveFirst!: () => void;
		(powerSurge.play as Mock).mockImplementation(() => new Promise<void>((resolve) => (resolveFirst = resolve)));
		const director = new Director(ctx);
		director.forced = 'powerSurge';
		const first = director.play();
		const second = await director.play();
		expect(second).toBeNull();
		resolveFirst();
		await first;
	});

	it('reducedMotion forces gentleGlow, overriding the bag/forced choice', async () => {
		const gentleGlow = await import('../src/effects/gentleGlow');
		(gentleGlow.play as Mock).mockResolvedValue(undefined);
		ctx.scene.reducedMotion = true;
		const director = new Director(ctx);
		director.forced = 'powerSurge'; // reducedMotion should win over this
		const name = await director.play();
		expect(name).toBe('gentleGlow');
	});
});
