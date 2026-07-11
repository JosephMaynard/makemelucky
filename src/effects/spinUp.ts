// Effect 2 — SPIN-UP: the clamps release and the whole Celtic face spins to a
// gyroscopic blur, throwing sparks, before slamming back into place.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { flashPulse } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'spinningRim';
export const duration = 8000;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, lightning } = ctx;

	await machine.openClamps(550);
	haptics.vibrate(40);

	// energy arcs leap from the clamps into the button while the face spins
	let arcing = true;
	const button = new THREE.Vector3(0, -0.32, 0.32);
	const clampPos = new THREE.Vector3();
	(async () => {
		while (arcing) {
			const deco = machine.decos[Math.floor(rand(0, 4))];
			deco.userData.clamp.getWorldPosition(clampPos);
			clampPos.z = 0.3;
			lightning.strike(clampPos, button, { width: rand(0.012, 0.022), life: rand(0.14, 0.24), jitter: 0.3 });
			scene.fxLight.color.set(0xbfe8ff);
			scene.fxLight.position.set(clampPos.x * 0.5, clampPos.y * 0.5, 1.1);
			scene.fxLight.intensity = rand(2, 4);
			machine.setInnerGlow(rand(0.25, 0.5), 0xbfe8ff);
			await delay(rand(120, 340));
		}
	})();

	const bloom0 = scene.bloomPass.strength;
	tween(2000, 'inQuad', () => {}); // spacer
	tween(2600, 'inOutQuad', (v) => (scene.bloomPass.strength = bloom0 + v * 0.45));

	// spark shower helper while spinning fast
	let spinSpeed = 0; // rad/s, tracked for spark spawning
	let sparkTimer = 0;
	const stopSparks = scene.addUpdatable((dt) => {
		if (spinSpeed < 6) return;
		sparkTimer -= dt;
		if (sparkTimer > 0) return;
		sparkTimer = 0.05;
		const ang = rand(0, Math.PI * 2);
		const r = 1.3;
		const origin = new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r - 0.32, 0.15);
		const tangent = new THREE.Vector3(-Math.sin(ang), Math.cos(ang), 0);
		particles.burst({
			texture: sprites.spark,
			count: 6,
			origin,
			direction: tangent,
			cone: 0.7,
			speed: [1.5, 3.2],
			gravity: new THREE.Vector3(0, -2.5, 0),
			life: [0.25, 0.7],
			size: [0.025, 0.07],
			colors: [0xfff3cf, 0xffd27a, 0xffffff]
		});
	});

	// accelerate → hold → decelerate, with a hint of camera roll
	const TOTAL_TURNS = 11 * Math.PI * 2;
	let lastRot = 0;
	await tween(5200, (t) => {
		// smooth-in, long fast middle, smooth-out
		const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
		return e;
	}, (v, tRaw) => {
		const rot = v * TOTAL_TURNS;
		spinSpeed = (rot - lastRot) * 60;
		lastRot = rot;
		machine.faceSpin.rotation.z = rot;
		scene.cameraRoll = -Math.sin(tRaw * Math.PI) * 0.035;
		if (tRaw > 0.2 && tRaw < 0.85) scene.shake(0.02);
	});
	spinSpeed = 0;
	machine.faceSpin.rotation.z = 0;
	scene.cameraRoll = 0;
	stopSparks();
	arcing = false;
	lightning.clear();
	scene.fxLight.intensity = 0;

	// clunk home
	scene.shake(0.35);
	haptics.vibrate([50, 40, 90]);
	await machine.closeClamps(450);
	tween(1400, 'outQuad', (v) => (scene.bloomPass.strength = bloom0 + 0.45 * (1 - v)));
	machine.setInnerGlow(0, 0xfff3cf);
	tween(300, 'outQuad', (v) => machine.setInnerGlow(v * 0.9, 0xfff3cf));
	await flashPulse(machine, 0.8, 120, 800, 0xfff3cf);
	await tween(500, 'outQuad', (v) => machine.setInnerGlow(0.9 * (1 - v)));
}
