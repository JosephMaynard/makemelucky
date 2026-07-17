// Effect 24 — GENIE OF THE MACHINE: the iris cracks open and the mechanism
// exhales a slow plume of teal smoke that swirls upward, refuses to disperse,
// and instead condenses into the words you were hoping for. Then the machine
// clears its throat and swallows the whole apparition back down. Wish granted;
// receipts retained.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'spinningRim';
export const duration = 10000;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, textures, sprites, audio, haptics } = ctx;

	const MOUTH = new THREE.Vector3(0, 0.05, 0.4); // just in front of the open iris

	// ---- the machine stirs: half-light, teal innards, iris cracks open
	const restore = dimLights(scene, 0.35, 900);
	scene.fxLight.color.set(0x46f0e0);
	scene.fxLight.position.set(0, 0.6, 1.1);
	tween(1100, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3.5));
	machine.setInnerGlow(0, 0x46f0e0);
	tween(1400, 'inOutQuad', (v) => machine.setInnerGlow(v * 0.6, 0x46f0e0));
	await machine.openIris(0.45, 1200);
	haptics.vibrate(35);

	// ---- the exhale: smoke that swirls up into a hovering column
	const stopWoo = audio.sfxLoop('wooWoo', { pitch: 0.7, gain: 0.5 });
	let T = 0;
	const stopClock = scene.addUpdatable((dt) => (T += dt));
	// a gentle vortex: rises, orbits the column axis, and is leashed to it
	const field = (x: number, y: number, _z: number): [number, number, number] => {
		const dx = x - MOUTH.x;
		const dy = y - 1.0;
		return [
			-dx * 0.9 + Math.sin(y * 3.2 + T * 2.1) * 0.5 - dy * 0.0,
			0.35 + Math.cos(x * 2.8 + T * 1.6) * 0.3,
			Math.sin(x * 1.7 + y * 2.2 + T) * 0.12
		];
	};
	const smoke = particles.emitter({
		texture: textures.cloudSprite,
		count: 260,
		emitRate: 90,
		origin: MOUTH,
		originSpread: 0.14,
		direction: new THREE.Vector3(0, 1, 0.15),
		cone: 0.4,
		speed: [0.25, 0.7],
		drag: 0.5,
		life: [1.6, 2.8],
		size: [0.1, 0.32],
		colors: [0x46f0e0, 0x2ec8b8, 0x9a5cff, 0x60e8ff],
		spin: [-0.8, 0.8],
		fadeIn: 0.35,
		field
	});
	audio.sfx('swoosh', { pitch: 0.6, gain: 0.9 });
	await delay(2400);

	// ---- condensation: the smoke thins as the words gather out of it
	audio.sfx('chime', { pitch: 0.9, gain: 0.8 });
	smoke.stop();
	haptics.vibrate(25);
	await luckyWord(ctx, {
		text: 'WISH GRANTED',
		color: 0x46f0e0,
		colorB: 0xbf9aff,
		y: 0.95,
		gather: 1100,
		hold: 1500,
		scatter: 500
	});

	// ---- the inhale. The machine takes it all back — sharply.
	stopWoo(250);
	audio.sfx('gulp', { pitch: 0.85, gain: 1.2 });
	haptics.vibrate([15, 40, 60]);
	// everything loose gets dragged into the mouth
	const inhale = particles.emitter({
		texture: sprites.softDot,
		count: 120,
		emitRate: 200,
		origin: new THREE.Vector3(0, 1.0, 0.5),
		originSpread: 1.6,
		direction: null,
		speed: [0.05, 0.15],
		life: [0.5, 0.9],
		size: [0.012, 0.045],
		colors: [0x46f0e0, 0x9a5cff],
		fadeIn: 0.1,
		field: (x, y, z) => {
			const dx = MOUTH.x - x, dy = MOUTH.y - y, dz = MOUTH.z - z;
			const d = Math.max(0.2, Math.hypot(dx, dy, dz));
			const pull = 26 / (d * d);
			return [dx / d * pull, dy / d * pull, dz / d * pull];
		}
	});
	tween(700, 'inQuad', (v) => machine.setInnerGlow(0.6 + v * 0.4, 0x46f0e0));
	await delay(650);
	inhale.stop();

	// the swallow lands: iris snaps shut, one satisfied thump
	scene.shake(0.4);
	audio.sfx('boom', { pitch: 1.1, gain: 0.6 });
	shockwave(scene.scene, MOUTH, { color: 0x46f0e0, maxScale: 3.2, duration: 600 });
	flashPulse(machine, 0.7, 80, 550, 0x46f0e0);
	await machine.closeIris(700);

	stopClock();
	tween(900, 'outQuad', (v) => {
		scene.fxLight.intensity = 3.5 * (1 - v);
		machine.setInnerGlow(1 - v, 0x46f0e0);
	});
	await restore(1000);
	machine.setInnerGlow(0.2);
}
