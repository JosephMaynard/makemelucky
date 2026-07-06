// Effect 1 — POWER SURGE: wild lightning arcs feed the button until it overloads.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';
import { shockwave, flashPulse, offscreenPoint } from './helpers.js';

export const sound = 'powerStreams';
export const duration = 7000;

export async function play(ctx) {
	const { scene, machine, particles, lightning, sprites, haptics } = ctx;
	const button = machine.buttonWorldPosition();
	button.z = 0.3;

	machine.setInnerGlow(0, 0xbfe8ff);
	scene.fxLight.color.set(0x9fd4ff);

	let running = true;
	const boltLoop = (async () => {
		let interval = 340;
		while (running) {
			const from = offscreenPoint(rand(0, Math.PI * 2));
			lightning.strike(from, button, { width: rand(0.02, 0.045), life: rand(0.25, 0.4) });
			scene.fxLight.intensity = rand(3, 6);
			scene.fxLight.position.set(button.x, button.y, 1.2);
			scene.shake(0.18);
			haptics.vibrate(30);
			particles.burst({
				texture: sprites.spark,
				count: 14,
				origin: button.clone(),
				speed: [0.8, 2.4],
				life: [0.25, 0.6],
				size: [0.03, 0.09],
				colors: [0xffffff, 0xbfe8ff, 0x9fd4ff]
			});
			await delay(interval + rand(-80, 80));
			interval = Math.max(120, interval - 28); // arcs come faster and faster
		}
	})();

	// glow builds underneath
	tween(4200, 'inQuad', (v) => machine.setInnerGlow(v * 0.45));

	// crawling arcs between the clamps partway through
	await delay(1800);
	const clampArcs = (async () => {
		while (running) {
			const a = rand(0, Math.PI * 2);
			const b = a + rand(0.8, 2.4);
			const r = 1.15;
			lightning.strike(
				new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r - 0.32, 0.28),
				new THREE.Vector3(Math.cos(b) * r, Math.sin(b) * r - 0.32, 0.28),
				{ width: 0.018, life: 0.22, jitter: 0.24 }
			);
			await delay(rand(90, 220));
		}
	})();

	await delay(1200);
	shockwave(scene.scene, button, { maxScale: 3.4 });
	haptics.vibrate([40, 60, 40]);
	await delay(900);
	shockwave(scene.scene, button, { maxScale: 4.2 });
	await delay(900);

	// ---- overload finale
	running = false;
	await Promise.all([boltLoop, clampArcs]);
	lightning.clear();
	scene.shake(0.65);
	haptics.vibrate([60, 40, 120]);
	particles.burst({
		texture: sprites.spark,
		count: 90,
		origin: button.clone(),
		speed: [1.5, 5],
		life: [0.4, 1.1],
		size: [0.04, 0.14],
		colors: [0xffffff, 0xbfe8ff, 0x86c5ff]
	});
	shockwave(scene.scene, button, { maxScale: 6, duration: 900 });
	await flashPulse(machine, 1.0, 80, 700, 0xdff0ff);

	scene.fxLight.intensity = 0;
	await tween(600, 'outQuad', (v) => machine.setInnerGlow(0.45 * (1 - v)));
}
