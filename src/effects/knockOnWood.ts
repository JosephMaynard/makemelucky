// Effect — KNOCK ON WOOD: the whole lounge turns to waxed oak, something
// unseen raps the machine three times, and on the third knock the luck sticks —
// gold comes up out of the grain. Under five seconds. The oldest superstition
// there is, and the cheapest to honour.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { backdropWipe } from '../gfx/quiltWipe';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 5200;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();
	const homeY = machine.group.position.y;
	const homeZ = machine.group.position.z;

	const restore = dimLights(scene, 0.55, 400);
	const wipe = backdropWipe(machine.backdrop, ctx.textures.quilt.map, 'oak');
	wipe.in(1300);
	scene.fxLight.color.set(0xffc478);
	scene.fxLight.position.set(-0.8, 1.2, 1.8);
	tween(500, 'outQuad', (v) => (scene.fxLight.intensity = v * 2.8));
	machine.setInnerGlow(0.22, 0xffc478);

	// The knock recoil: the machine takes the rap and springs back. Driven by a
	// single value the sim reads, so overlapping knocks can't fight each other.
	let recoil = 0;
	const stopRock = scene.addUpdatable(() => {
		machine.group.position.z = homeZ - recoil * 0.3;
		machine.group.position.y = homeY - recoil * 0.05;
	});

	/** One rap: dust off the grain, a ring, a thud, and the machine flinching. */
	const knock = (angle: number, strength: number) => {
		const at = new THREE.Vector3(
			btn.x + Math.cos(angle) * 0.92,
			btn.y + Math.sin(angle) * 0.92,
			0.42
		);
		audio.sfx('clack', { pitch: 0.5 + rand(-0.04, 0.04), gain: 0.55 * strength });
		audio.sfx('boom', { pitch: 0.75, gain: 0.28 * strength });
		haptics.vibrate(40 * strength);
		scene.shake(0.26 * strength);
		tween(420, 'outElastic', (v) => (recoil = strength * (1 - v)));
		shockwave(scene.scene, at, {
			color: 0xffc478,
			maxScale: 2.4 + strength * 1.6,
			duration: 560,
			z: 0.44
		});
		// sawdust knocked out of the grain
		particles.burst({
			texture: sprites.softDot,
			count: 34,
			origin: at.clone(),
			originSpread: 0.08,
			direction: new THREE.Vector3(Math.cos(angle) * 0.4, 0.5, 1),
			cone: 0.7,
			speed: [0.5, 1.7],
			gravity: new THREE.Vector3(0, -2.4, 0),
			life: [0.5, 1.1],
			size: [0.02, 0.06],
			colors: [0xc79a5e, 0xe8c48e, 0x9c6f3c],
			fadeIn: 0.05
		});
	};

	// ---- knock. knock. KNOCK.
	await delay(520);
	knock(1.9, 0.7);
	await delay(300);
	knock(0.5, 0.8);
	await delay(300);
	knock(4.5, 1);
	machine.mechSpeed = 4;

	// ---- and it holds. The grain lights up from underneath.
	await delay(340);
	audio.sfx('chime', { pitch: 0.85, gain: 0.5 });
	haptics.vibrate([20, 30, 70]);
	tween(900, 'outCubic', (v) => {
		machine.setInnerGlow(0.22 + v * 0.5, 0xffc478);
		scene.fxLight.intensity = 2.8 + v * 2.4;
	});
	flashPulse(machine, 0.55, 140, 700, 0xffd9a0);
	// gold rising OUT of the wood, slow and dense
	const grain = particles.emitter({
		texture: sprites.star4,
		count: 220,
		emitRate: 130,
		origin: new THREE.Vector3(btn.x, btn.y - 2.1, 0.3),
		originSpread: 1.7,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.35,
		speed: [1.6, 3.2],
		gravity: new THREE.Vector3(0, -0.5, 0),
		life: [1, 2],
		size: [0.03, 0.09],
		colors: [0xffd27a, 0xfff0cf, 0xd9a842],
		fadeIn: 0.1
	});
	particles.burst({
		texture: sprites.clover,
		count: 26,
		origin: new THREE.Vector3(btn.x, btn.y - 0.5, 0.5),
		originSpread: 0.7,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.8,
		speed: [1.4, 3.2],
		gravity: new THREE.Vector3(0, -3, 0),
		life: [1, 1.9],
		size: [0.07, 0.15],
		colors: [0x6fd48a, 0x9ae8ae, 0x4fae6a],
		spin: [-5, 5]
	});

	await luckyWord(ctx, {
		text: 'TOUCH WOOD',
		color: 0xffd9a0,
		colorB: 0xfff3cf,
		gather: 750,
		hold: 900,
		scatter: 520
	});

	// ---- teardown
	grain.stop();
	machine.mechSpeed = 1;
	stopRock();
	machine.group.position.y = homeY;
	machine.group.position.z = homeZ;
	wipe.out(950);
	tween(800, 'outQuad', (v) => {
		machine.setInnerGlow(0.72 * (1 - v));
		scene.fxLight.intensity = 5.2 * (1 - v);
	});
	await restore(800);
}
