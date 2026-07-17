// Effect 13 — FIREFLIES: dusk falls and a swarm of golden-green fireflies
// drifts out of the mechanism, dances around the machine, then streams home
// into the button.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 12000;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.2, 1100);
	scene.fxLight.color.set(0xd8e07a);
	scene.fxLight.position.set(0, 0, 1.4);
	tween(1100, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3));
	machine.setInnerGlow(0, 0xd8e07a);
	tween(2000, 'inQuad', (v) => machine.setInnerGlow(v * 0.35, 0xd8e07a));

	// wandering flight: livelier curl noise, a slow carousel swirl around the
	// machine, and pulsing eddies — plus the soft leash that keeps them close
	let T = 0;
	let attraction = 0.16;
	const stopClock = scene.addUpdatable((dt) => (T += dt));
	const field = (x: number, y: number, z: number): [number, number, number] => {
		const dx = x;
		const dy = y + 0.32;
		const dz = z - 0.5;
		// the swarm slowly orbits the button, surging and relaxing
		const swirl = 0.5 + Math.sin(T * 0.55) * 0.25;
		return [
			Math.sin(y * 2.6 + T * 1.9) * 1.5 + Math.sin(z * 3.1 + T * 0.8) * 0.5 - dx * attraction - dy * swirl,
			Math.sin(x * 2.2 + T * 1.5) * 1.25 + Math.cos(z * 2.4 + T * 1.2) * 0.4 - dy * attraction + dx * swirl,
			Math.cos(x * 1.8 + y * 1.3 + T * 1.1) * 0.7 - dz * attraction
		];
	};

	const swarm = particles.emitter({
		texture: sprites.softDot,
		count: 400,
		emitRate: 140,
		origin: new THREE.Vector3(0, -0.32, 0.35),
		originSpread: 1.2,
		speed: [0.3, 1.1],
		gravity: new THREE.Vector3(0, 0, 0),
		drag: 0.97,
		life: [4, 6.5],
		size: [0.06, 0.16],
		colors: [0xd8e07a, 0xf5f0a0, 0x9fdc6a, 0xffe9ad],
		fadeIn: 0.25,
		field
	});
	haptics.vibrate(20);

	// let them wander wide…
	await delay(3000);
	attraction = 0.12; // roam further out
	await delay(2400);

	// …then the swarm gets organised: the fireflies spell out the good news
	attraction = 4.5;
	haptics.vibrate([20, 40, 20, 40, 90]);
	await delay(700);
	swarm.stop();
	await luckyWord(ctx, { text: 'GOOD FORTUNE', color: 0xd8e07a, colorB: 0xf5f0a0, gather: 1700 });
	scene.shake(0.25);
	particles.burst({
		texture: sprites.star4,
		count: 36,
		origin: new THREE.Vector3(0, -0.32, 0.45),
		speed: [0.6, 2],
		life: [0.6, 1.4],
		size: [0.03, 0.08],
		colors: [0xf5f0a0, 0xd8e07a, 0xffffff]
	});
	await flashPulse(machine, 0.8, 110, 850, 0xf0eba0);

	stopClock();
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.35 * (1 - v));
		scene.fxLight.intensity = 3 * (1 - v);
	});
	await restore(1100);
}
