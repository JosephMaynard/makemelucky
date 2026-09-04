import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { Director, CALM_EFFECTS } from '../src/effects/director';
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

// A stand-in for the bits of the scene/machine that play() and the crash
// recovery reach for. Fresh per test so the recovery assertions can't leak.
function stubCtx(): EffectContext {
	const vec = () => ({
		x: 0,
		y: 0,
		z: 0,
		clone() { return { ...this, clone: this.clone, copy: this.copy }; },
		copy(v: unknown) { Object.assign(this, v); return this; }
	});
	return {
		scene: {
			reducedMotion: false,
			updatables: new Set<() => void>(),
			keyLight: { intensity: 2 },
			fillLight: { intensity: 0.55 },
			rimLight: { intensity: 0 },
			fxLight: { intensity: 0 },
			scene: { environmentIntensity: 1.35, background: null, environment: null, fog: null },
			environmentName: 'lounge',
			cameraRoll: 0,
			parallaxStrength: 1,
			setVignetteBoost: vi.fn(),
			envTexture: vi.fn(() => null)
		},
		machine: {
			mechSpeed: 1,
			resetToIdle: vi.fn(),
			group: { position: vec(), rotation: vec() },
			buttonGroup: { position: vec(), rotation: vec(), scale: vec(), parent: null },
			backdrop: { visible: true, material: { userData: {} } }
		},
		particles: { clear: vi.fn() },
		audio: { play: vi.fn(), preload: vi.fn(), ready: vi.fn(async () => {}), stopAllLoops: vi.fn(), stopAllTracks: vi.fn() },
		lightning: { clear: vi.fn() }
	} as unknown as EffectContext;
}

describe('Director.play()', () => {
	let ctx = stubCtx();

	beforeEach(async () => {
		vi.clearAllMocks();
		ctx = stubCtx();
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
		// play() now awaits the effect's dynamic import before it calls play(),
		// so the mock's resolver doesn't exist until that chunk lands
		await vi.waitFor(() => expect(resolveFirst).toBeTypeOf('function'));
		resolveFirst();
		await first;
	});

	it('reducedMotion draws from the calm shortlist, overriding the forced choice', async () => {
		const gentleGlow = await import('../src/effects/gentleGlow');
		(gentleGlow.play as Mock).mockResolvedValue(undefined);
		ctx.scene.reducedMotion = true;
		const director = new Director(ctx);
		director.forced = 'jollyRoger'; // a pirate ship is not a calm effect
		const name = await director.play();
		expect(CALM_EFFECTS).toContain(name);
		expect(name).not.toBe('jollyRoger');
	});

	it('reducedMotion honours a forced choice that IS calm', async () => {
		ctx.scene.reducedMotion = true;
		const director = new Director(ctx);
		director.forced = 'gentleGlow';
		expect(await director.play()).toBe('gentleGlow');
	});
});

describe('Director crash recovery', () => {
	let ctx = stubCtx();
	beforeEach(async () => {
		vi.clearAllMocks();
		ctx = stubCtx();
		const powerSurge = await import('../src/effects/powerSurge');
		(powerSurge.play as Mock).mockReset();
	});

	it('unhooks sims the dead effect registered, and clears its particles', async () => {
		const powerSurge = await import('../src/effects/powerSurge');
		const leaked = () => {};
		(powerSurge.play as Mock).mockImplementation(async () => {
			ctx.scene.updatables.add(leaked); // an effect's own sim loop
			throw new Error('effect boom');
		});
		const preexisting = () => {};
		ctx.scene.updatables.add(preexisting); // main.ts's machine/particles tick
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const director = new Director(ctx);
		director.forced = 'powerSurge';
		await director.play();

		expect(ctx.scene.updatables.has(leaked)).toBe(false);
		expect(ctx.scene.updatables.has(preexisting)).toBe(true); // not ours to kill
		expect(ctx.particles.clear).toHaveBeenCalledTimes(1);
		expect(ctx.audio.stopAllTracks).toHaveBeenCalledTimes(1);
		consoleError.mockRestore();
	});

	it('restores the lights, vignette and camera roll it found', async () => {
		const powerSurge = await import('../src/effects/powerSurge');
		(powerSurge.play as Mock).mockImplementation(async () => {
			ctx.scene.keyLight.intensity = 0.1; // dimLights, mid-effect
			ctx.scene.cameraRoll = 0.4;
			ctx.machine.backdrop.visible = false;
			throw new Error('effect boom');
		});
		const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

		const director = new Director(ctx);
		director.forced = 'powerSurge';
		await director.play();

		expect(ctx.scene.keyLight.intensity).toBe(2);
		expect(ctx.scene.cameraRoll).toBe(0);
		expect(ctx.machine.backdrop.visible).toBe(true);
		expect(ctx.scene.setVignetteBoost).toHaveBeenCalledWith(0);
		expect(ctx.scene.environmentName).toBe('lounge');
		consoleError.mockRestore();
	});
});
