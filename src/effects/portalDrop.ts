// Effect 4 — PORTAL DROP: the clamps release, the iris opens onto a bright sky,
// and the button tumbles away into the clouds… then springs back charged with luck.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { flashPulse, shockwave } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'buttonFall';
export const duration = 10000;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics } = ctx;

	await machine.openClamps(600);
	haptics.vibrate(40);

	// iris open + camera pushes in slightly
	scene.fxLight.color.set(0xeaf6ff);
	tween(1600, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3.5));
	scene.fxLight.position.set(0, -0.3, 0.6);
	const rigZ = scene.rig.position.z;
	tween(2400, 'inOutCubic', (v) => (scene.rig.position.z = rigZ - v * 0.55));
	await machine.openIris(0.72, 1700); // just clear of the portal edge — no big gap

	// the button drops away, tumbling
	haptics.vibrate(60);
	const drop = tween(2100, 'inQuart', (v) => {
		machine.buttonGroup.position.z = -1.7 * v;
		machine.buttonGroup.rotation.z = v * 1.8;
		machine.buttonGroup.rotation.x = v * 0.5;
		machine.buttonGroup.scale.setScalar(1 - v * 0.8);
	});
	// cloud puffs as it passes through
	delay(1500).then(() => {
		particles.burst({
			// (was ctx.cloudSpriteTex, which never existed — always fell back to softDot)
			texture: ctx.textures.cloudSprite,
			count: 22,
			origin: new THREE.Vector3(0, -0.32, -0.3),
			originSpread: 0.5,
			speed: [0.15, 0.5],
			gravity: new THREE.Vector3(0, 0, 0.1),
			life: [1.2, 2.4],
			size: [0.3, 0.8],
			colors: [0xffffff, 0xdfeaff],
			spin: [-0.6, 0.6]
		});
	});
	await drop;

	// a beat — staring into the open sky
	await delay(700);

	// button rockets back with an overshoot
	haptics.vibrate([30, 40, 90]);
	shockwave(scene.scene, new THREE.Vector3(0, -0.32, 0), { color: 0xffffff, maxScale: 3 });
	await tween(1250, 'outElastic', (v) => {
		machine.buttonGroup.position.z = -1.7 * (1 - v);
		machine.buttonGroup.rotation.z = 1.8 * (1 - v);
		machine.buttonGroup.rotation.x = 0.5 * (1 - v);
		machine.buttonGroup.scale.setScalar(0.2 + 0.8 * v);
	});
	scene.shake(0.4);
	particles.burst({
		texture: sprites.star4,
		count: 46,
		origin: new THREE.Vector3(0, -0.32, 0.4),
		speed: [1, 3.4],
		life: [0.5, 1.2],
		size: [0.03, 0.1],
		colors: [0xffffff, 0xfff3cf, 0xbfe8ff]
	});

	// close everything back up
	tween(1800, 'inOutCubic', (v) => (scene.rig.position.z = rigZ - 0.55 * (1 - v)));
	tween(1200, 'outQuad', (v) => (scene.fxLight.intensity = 3.5 * (1 - v)));
	await machine.closeIris(1500);
	await machine.closeClamps(550);
	await flashPulse(machine, 0.7, 100, 700, 0xeaf6ff);
}
