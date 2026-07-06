// Effect 7 — SLOT REELS: three pulls of the one-armed bandit. The whole Celtic
// face spins up and slams to a stop, three times, then pays out.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';
import { flashPulse } from './helpers.js';

export const sound = 'spinningRim';
export const duration = 9000;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	await machine.openClamps(450);

	let base = 0;
	for (let pull = 0; pull < 3; pull++) {
		// wind up… and stop dead on a quarter-boundary
		const quarterTurns = 8 + pull * 4 + Math.floor(rand(0, 3)) * 2;
		const target = base + quarterTurns * (Math.PI / 2);
		await tween(1400 + pull * 260, (t) => {
			// fast start, hard braking finish — slot-machine feel
			return 1 - Math.pow(1 - t, 3.2);
		}, (v) => {
			machine.faceSpin.rotation.z = base + (target - base) * v;
		});
		base = target;

		// CLUNK
		scene.shake(0.32);
		haptics.vibrate([20, 30, 70]);
		machine.setInnerGlow(0.55, 0xfff3cf);
		tween(360, 'outQuad', (v) => machine.setInnerGlow(0.55 * (1 - v)));
		for (let q = 0; q < 4; q++) {
			const ang = Math.PI * 0.25 + (q * Math.PI) / 2;
			particles.burst({
				texture: sprites.spark,
				count: 7,
				origin: new THREE.Vector3(Math.cos(ang) * 1.15, Math.sin(ang) * 1.15 - 0.32, 0.2),
				speed: [0.6, 1.8],
				life: [0.25, 0.55],
				size: [0.02, 0.06],
				colors: [0xfff3cf, 0xffd27a]
			});
		}
		await delay(320);
	}
	machine.faceSpin.rotation.z = 0;

	// JACKPOT — triple flash and a spray of coins
	await machine.closeClamps(400);
	haptics.vibrate([60, 60, 60, 60, 140]);
	for (let i = 0; i < 3; i++) {
		flashPulse(machine, 0.75, 60, 320, 0xffd27a);
		particles.burst({
			texture: sprites.coin,
			count: 26,
			origin: new THREE.Vector3(0, -0.32, 0.4),
			direction: new THREE.Vector3(0, 0.5, 1),
			cone: 1.6,
			speed: [2, 4.6],
			gravity: new THREE.Vector3(0, -3.2, 0),
			life: [1, 1.9],
			size: [0.1, 0.2],
			colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
			spin: [-6, 6]
		});
		scene.shake(0.2);
		await delay(380);
	}
	await delay(900);
}
