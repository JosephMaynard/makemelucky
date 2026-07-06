// Effect 9 — CLOVER VORTEX: the room darkens to deep emerald and a spiral of
// clovers whirls around the machine before being drunk into the button.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { dimLights, flashPulse, shockwave } from './helpers.js';

export const sound = 'luckySymbol';
export const duration = 9000;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;
	const centre = { x: 0, y: -0.32, z: 0.55 };

	const restore = dimLights(scene, 0.16, 900);
	scene.fxLight.color.set(0x51d84b);
	scene.fxLight.position.set(0, -0.2, 1.5);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 6));
	machine.setInnerGlow(0, 0x6fe06a);
	tween(2000, 'inQuad', (v) => machine.setInnerGlow(v * 0.7, 0x6fe06a));

	// the vortex field: tangential swirl + gentle inward pull
	let inwardPull = 0.7;
	const field = (x, y, z) => {
		const dx = x - centre.x;
		const dy = y - centre.y;
		const r = Math.max(0.25, Math.hypot(dx, dy));
		const tx = -dy / r;
		const ty = dx / r;
		const swirl = 2.6 / r;
		return [
			tx * swirl - (dx / r) * inwardPull,
			ty * swirl - (dy / r) * inwardPull,
			(centre.z - z) * 0.5
		];
	};

	const vortex = particles.emitter({
		texture: sprites.clover,
		count: 240,
		emitRate: 60,
		origin: new THREE.Vector3(centre.x, centre.y, centre.z),
		originSpread: 2.4,
		speed: [0.1, 0.5],
		gravity: new THREE.Vector3(0, 0, 0),
		drag: 0.99,
		life: [3.5, 5.5],
		size: [0.11, 0.2],
		colors: [0x51d84b, 0x8af284, 0x2fae4a],
		spin: [-4, 4],
		fadeIn: 0.15,
		field
	});
	const motes = particles.emitter({
		texture: sprites.softDot,
		count: 300,
		emitRate: 80,
		origin: new THREE.Vector3(centre.x, centre.y, centre.z),
		originSpread: 2.6,
		speed: [0.05, 0.3],
		gravity: new THREE.Vector3(0, 0, 0),
		drag: 0.99,
		life: [2, 4],
		size: [0.01, 0.04],
		colors: [0x8af284, 0xd8ffd0],
		fadeIn: 0.2,
		field
	});

	haptics.vibrate(40);
	await delay(4600);

	// ---- the button drinks the vortex
	inwardPull = 9; // everything spirals in hard
	haptics.vibrate([30, 40, 30, 40, 140]);
	await delay(900);
	vortex.stop();
	motes.stop();
	scene.shake(0.5);
	shockwave(scene.scene, new THREE.Vector3(centre.x, centre.y, 0.3), { color: 0x51d84b, maxScale: 5 });
	particles.burst({
		texture: sprites.clover,
		count: 40,
		origin: new THREE.Vector3(centre.x, centre.y, 0.4),
		direction: new THREE.Vector3(0, 0.2, 1),
		cone: 2.1,
		speed: [1.5, 4.5],
		gravity: new THREE.Vector3(0, -0.8, 0),
		life: [1.2, 2.2],
		size: [0.1, 0.22],
		colors: [0x51d84b, 0x8af284],
		spin: [-4, 4]
	});
	await flashPulse(machine, 1, 80, 850, 0x8af284);

	tween(800, 'outQuad', (v) => {
		scene.fxLight.intensity = 6 * (1 - v);
		machine.setInnerGlow(0.7 * (1 - v), 0x6fe06a);
	});
	await restore(1000);
}
