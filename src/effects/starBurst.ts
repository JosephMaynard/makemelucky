// Effect 6 — STAR BURST: the button charges up and detonates a constellation of
// luck — clovers, horseshoes, sevens, coins and stars showering past the viewer.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 10500;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics } = ctx;
	const origin = new THREE.Vector3(0, -0.32, 0.35);

	// ---- charge: golden glow builds, small sparks gather
	machine.setInnerGlow(0, 0xffd27a);
	scene.fxLight.color.set(0xffd27a);
	scene.fxLight.position.set(0, -0.3, 1.4);
	const charge = tween(1900, 'inCubic', (v) => {
		machine.setInnerGlow(v, 0xffd27a);
		scene.fxLight.intensity = v * 6;
	});
	const gather = particles.emitter({
		texture: sprites.softDot,
		count: 90,
		emitRate: 45,
		origin: origin.clone(),
		originSpread: 0.3,
		speed: [0.1, 0.5],
		gravity: new THREE.Vector3(0, 0.3, 0.15),
		life: [0.5, 1.1],
		size: [0.015, 0.05],
		colors: [0xffd27a, 0xfff3cf]
	});
	await charge;
	gather.stop();

	// ---- detonation
	haptics.vibrate([80, 50, 150]);
	scene.shake(0.5);
	shockwave(scene.scene, origin, { color: 0xffd27a, maxScale: 5.5, duration: 850 });

	const toward = new THREE.Vector3(0, 0.1, 1); // out towards the viewer
	const symbolBursts = [
		{ texture: sprites.clover, colors: [0x51d84b, 0x8af284], count: 34 },
		{ texture: sprites.horseshoe, colors: [0xf0d488, 0xd9a842], count: 28 },
		{ texture: sprites.seven, colors: [0xffc75a, 0xffe9ad], count: 28 },
		{ texture: sprites.coin, colors: [0xf7ce6b, 0xffdf8e], count: 26 },
		{ texture: sprites.star4, colors: [0xffffff, 0xfff3cf, 0xbfe8ff], count: 50 }
	];
	for (const def of symbolBursts) {
		particles.burst({
			texture: def.texture,
			count: def.count,
			origin: origin.clone(),
			direction: toward.clone(),
			cone: 2.3,
			speed: [1.6, 5],
			gravity: new THREE.Vector3(0, -0.7, 0),
			drag: 0.992,
			life: [1.6, 3],
			size: [0.14, 0.32],
			colors: def.colors,
			spin: [-3, 3]
		});
	}
	// comet streaks shooting diagonally
	particles.burst({
		texture: sprites.streak,
		count: 16,
		origin: origin.clone(),
		direction: toward.clone(),
		cone: 1.4,
		speed: [5, 10],
		gravity: new THREE.Vector3(0, -0.4, 0),
		life: [0.5, 0.9],
		size: [0.3, 0.7],
		colors: [0xffffff, 0xfff3cf]
	});

	await flashPulse(machine, 1, 70, 900, 0xffe9ad);

	// ---- the drifting debris regroups to spell it out (dim the blaze first,
	// or the additive motes vanish against the glow)
	tween(600, 'outQuad', (v) => {
		machine.setInnerGlow(1 - v * 0.85, 0xffd27a);
		scene.fxLight.intensity = 6 * (1 - v * 0.8);
	});
	await luckyWord(ctx, { color: 0xffd27a, colorB: 0xffffff });

	// ---- gentle sparkle rain to finish
	const rain = particles.emitter({
		texture: sprites.star4,
		count: 120,
		emitRate: 40,
		origin: new THREE.Vector3(0, 1.6, 0.6),
		originSpread: 1.6,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.4,
		speed: [0.4, 1],
		gravity: new THREE.Vector3(0, -0.6, 0),
		life: [1.2, 2.4],
		size: [0.015, 0.05],
		colors: [0xfff3cf, 0xffffff]
	});
	tween(2200, 'outQuad', (v) => {
		machine.setInnerGlow((1 - v) * 1);
		scene.fxLight.intensity = 6 * (1 - v);
	});
	await delay(2000);
	rain.stop();
}
