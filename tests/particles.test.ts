import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Particles } from '../src/gfx/particles';

// A stand-in texture — Burst only ever stores it as a shader uniform value in
// these tests; nothing here touches WebGL.
const texture = new THREE.Texture();

describe('Particles.setScale', () => {
	it('applies immediately to existing bursts', () => {
		const particles = new Particles(new THREE.Scene());
		const burst = particles.burst({ texture, count: 1 });
		particles.setScale(400);
		expect(burst.material.uniforms.uScale.value).toBeCloseTo(320, 6);
	});

	it('applies to bursts created after the call, not just the default', () => {
		const particles = new Particles(new THREE.Scene());
		particles.setScale(400);
		const burst = particles.burst({ texture, count: 1 });
		// setScale(400) => 400 * 0.8 = 320, per the existing scaling rule —
		// a fresh burst must not fall back to the shader's built-in 700
		expect(burst.material.uniforms.uScale.value).toBeCloseTo(320, 6);
	});

	it('a second setScale still rescales bursts made before AND after it', () => {
		const particles = new Particles(new THREE.Scene());
		const before = particles.burst({ texture, count: 1 });
		particles.setScale(500);
		const after = particles.burst({ texture, count: 1 });
		particles.setScale(250);
		expect(before.material.uniforms.uScale.value).toBeCloseTo(200, 6);
		expect(after.material.uniforms.uScale.value).toBeCloseTo(200, 6);
	});
});

describe('Particles drag', () => {
	/** Run `update(dt)` in fixed steps covering `totalTime` seconds and return
	 *  the resulting speed along x (from an initial [1,0,0]-direction burst
	 *  with zero gravity, so drag is the only thing changing velocity). */
	function speedAfter(drag: number, dt: number, totalTime: number): number {
		const particles = new Particles(new THREE.Scene());
		const burst = particles.burst({
			texture,
			count: 1,
			direction: new THREE.Vector3(1, 0, 0),
			cone: 0,
			speed: [2, 2],
			gravity: new THREE.Vector3(0, 0, 0),
			drag,
			life: [1000, 1000] // never dies mid-test
		});
		const steps = Math.round(totalTime / dt);
		for (let i = 0; i < steps; i++) burst.update(dt);
		return burst.velocities[0];
	}

	it('produces the same trajectory at 30, 60 and 90Hz over the same elapsed time', () => {
		const drag = 0.9; // "per frame at 60Hz" as the option is documented
		const totalTime = 1; // seconds
		const at60 = speedAfter(drag, 1 / 60, totalTime);
		const at30 = speedAfter(drag, 1 / 30, totalTime);
		const at90 = speedAfter(drag, 1 / 90, totalTime);
		// framerate-independent drag: Math.pow(drag, dt * 60) applied every
		// step converges to the same per-second decay regardless of step size
		expect(at30 / at60).toBeCloseTo(1, 2);
		expect(at90 / at60).toBeCloseTo(1, 2);
	});

	it('matches the analytic per-second decay drag**(60*totalTime)', () => {
		const drag = 0.95;
		const totalTime = 2;
		const speed = speedAfter(drag, 1 / 60, totalTime);
		const expected = 2 * Math.pow(drag, 60 * totalTime); // initial speed 2
		expect(speed).toBeCloseTo(expected, 4);
	});
});
