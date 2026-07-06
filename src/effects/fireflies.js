// Effect 13 — FIREFLIES: dusk falls and a swarm of golden-green fireflies
// drifts out of the mechanism, dances around the machine, then streams home
// into the button.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'lucky';
export const duration = 9500;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.2, 1100);
	scene.fxLight.color.set(0xd8e07a);
	scene.fxLight.position.set(0, 0, 1.4);
	tween(1100, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3));
	machine.setInnerGlow(0, 0xd8e07a);
	tween(2000, 'inQuad', (v) => machine.setInnerGlow(v * 0.35, 0xd8e07a));

	// wandering flight: gentle pseudo-curl noise + a soft leash to the machine
	let T = 0;
	let attraction = 0.16;
	const stopClock = scene.addUpdatable((dt) => (T += dt));
	const field = (x, y, z) => {
		const dx = x;
		const dy = y + 0.32;
		const dz = z - 0.5;
		return [
			Math.sin(y * 2.6 + T * 1.4) * 1.1 - dx * attraction,
			Math.sin(x * 2.2 + T * 1.1) * 0.9 - dy * attraction,
			Math.cos(x * 1.8 + y * 1.3 + T * 0.9) * 0.5 - dz * attraction
		];
	};

	const swarm = particles.emitter({
		texture: sprites.softDot,
		count: 240,
		emitRate: 80,
		origin: new THREE.Vector3(0, -0.32, 0.35),
		originSpread: 1.2,
		speed: [0.3, 0.9],
		gravity: new THREE.Vector3(0, 0, 0),
		drag: 0.97,
		life: [4, 6.5],
		size: [0.04, 0.1],
		colors: [0xd8e07a, 0xf5f0a0, 0x9fdc6a, 0xffe9ad],
		fadeIn: 0.25,
		field
	});
	haptics.vibrate(20);

	// let them wander wide…
	await delay(3000);
	attraction = 0.12; // roam further out
	await delay(2400);

	// …then call them all home to the button
	attraction = 4.5;
	haptics.vibrate([20, 40, 20, 40, 90]);
	await delay(1300);
	swarm.stop();
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
