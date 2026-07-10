// Effect 8 — GOLD RUSH: the mechanism winds up and the machine erupts a
// glittering fountain of coins that arc up and rain past the viewer.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { flashPulse, shockwave, dimLights } from './helpers.js';
import { luckyWord } from './luckyWord.js';

export const sound = 'buttonFall';
export const duration = 11000;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;
	const origin = new THREE.Vector3(0, -0.25, 0.45);

	// dim the lounge so the gold reads, wind the mechanism up
	const restore = dimLights(scene, 0.45, 800);
	machine.mechSpeed = 9;
	scene.fxLight.color.set(0xffc75a);
	scene.fxLight.position.set(0, -0.2, 1.2);
	await tween(1300, 'inCubic', (v) => {
		machine.setInnerGlow(v * 0.42, 0xffd27a);
		scene.fxLight.intensity = v * 4;
	});
	// glow settles once the coins fly, so they read against the dark lounge
	tween(700, 'outQuad', (v) => machine.setInnerGlow(0.42 - v * 0.22, 0xffd27a));

	// eruption!
	haptics.vibrate([70, 40, 70, 40, 150]);
	scene.shake(0.45);
	shockwave(scene.scene, origin, { color: 0xffd27a, maxScale: 4.5 });
	const bloom0 = scene.bloomPass.strength;
	tween(500, 'outQuad', (v) => (scene.bloomPass.strength = bloom0 + v * 0.15));

	const coins = particles.emitter({
		texture: sprites.coin,
		count: 420,
		emitRate: 110,
		origin,
		originSpread: 0.18,
		direction: new THREE.Vector3(0, 0.95, 0.28).normalize(),
		cone: 1.0,
		speed: [1.7, 3.6],
		gravity: new THREE.Vector3(0, -2.2, 0),
		drag: 0.998,
		life: [2, 3],
		size: [0.16, 0.3],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff3cf],
		spin: [-7, 7]
	});
	const glints = particles.emitter({
		texture: sprites.star4,
		count: 200,
		emitRate: 55,
		origin,
		originSpread: 0.3,
		direction: new THREE.Vector3(0, 0.9, 0.45).normalize(),
		cone: 1.2,
		speed: [1.8, 4],
		gravity: new THREE.Vector3(0, -2.4, 0),
		life: [1, 2],
		size: [0.02, 0.07],
		colors: [0xffffff, 0xfff3cf]
	});

	// keep it rumbling while the fountain flows
	const stopRumble = scene.addUpdatable(() => scene.shake(0.015));
	await delay(3100);
	coins.stop();
	glints.stop();
	stopRumble();

	// settle: last flash, then the gold dust in the air spells it out
	await flashPulse(machine, 0.85, 90, 800, 0xffe9ad);
	await luckyWord(ctx, { text: 'JACKPOT!', color: 0xf7ce6b, colorB: 0xfff3cf });
	machine.mechSpeed = 2;
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.42 * (1 - v));
		scene.fxLight.intensity = 4 * (1 - v);
		scene.bloomPass.strength = bloom0 + 0.15 * (1 - v);
	});
	await restore(1000);
	await delay(400);
}
