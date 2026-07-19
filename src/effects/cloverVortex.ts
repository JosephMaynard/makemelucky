// Effect 9 — CYBER LUCK: the lounge drops into the matrix. Emerald code rains
// down the room — except the code is clovers, sevens and lucky katakana — until
// the button decodes the lot into one giant glowing clover.

import * as THREE from 'three';
import { tween, delay, rand, pick } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'luckySymbol';
export const duration = 10500;

let glyphTexCache: THREE.CanvasTexture[] | null = null;
function codeGlyphs(): THREE.CanvasTexture[] {
	if (glyphTexCache) return glyphTexCache;
	glyphTexCache = ['☘', '7', 'ラ', 'ッ', 'キ', '★', '¥', '☘'].map((g) => {
		const cv = document.createElement('canvas');
		cv.width = cv.height = 64;
		const c = cv.getContext('2d')!;
		c.fillStyle = '#fff';
		c.textAlign = 'center';
		c.textBaseline = 'middle';
		c.font = 'bold 46px monospace';
		c.fillText(g, 32, 34);
		return new THREE.CanvasTexture(cv);
	});
	return glyphTexCache;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.1, 900);
	scene.fxLight.color.set(0x39ff5e);
	scene.fxLight.position.set(0, 0, 1.5);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 4));
	machine.setInnerGlow(0, 0x39ff5e);
	tween(1600, 'inQuad', (v) => machine.setInnerGlow(v * 0.55, 0x39ff5e));
	audio.sfx('zap', { pitch: 0.8, gain: 0.5 });

	// ---- code rain: each column is an emitter whose origin plummets, leaving
	// a fading trail of glyphs behind it — pure Matrix, lounge edition
	const texes = codeGlyphs();
	const columns: { origin: THREE.Vector3; speed: number; emitter: ReturnType<typeof particles.emitter> }[] = [];
	for (let i = 0; i < 14; i++) {
		const origin = new THREE.Vector3(rand(-2.3, 2.3), rand(1.6, 4), rand(-0.35, 0.9));
		columns.push({
			origin,
			speed: rand(2.2, 4.2),
			emitter: particles.emitter({
				texture: pick(texes),
				count: 40,
				emitRate: rand(16, 26),
				origin,
				originSpread: 0.02,
				speed: [0, 0.05],
				gravity: new THREE.Vector3(0, 0, 0),
				life: [0.7, 1.3],
				size: [0.09, 0.15],
				colors: [0x39ff5e, 0x9dffb0, 0x1f9e3d, 0xeafff0],
				fadeIn: 0.05
			})
		});
	}
	let speedMul = 1;
	const stopRain = scene.addUpdatable((dt) => {
		for (const col of columns) {
			col.origin.y -= col.speed * speedMul * dt;
			if (col.origin.y < -2.2) {
				col.origin.set(rand(-2.3, 2.3), rand(2, 3.6), rand(-0.35, 0.9));
			}
		}
	});
	haptics.vibrate(25);

	await delay(4200);

	// the code compiles… faster and faster
	speedMul = 2.4;
	machine.setInnerGlow(0.85, 0x39ff5e);
	haptics.vibrate([20, 30, 20, 30, 80]);
	await delay(1400);

	// ---- decoded: the rain resolves into one giant emerald clover
	for (const col of columns) col.emitter.stop();
	stopRain();
	scene.shake(0.4);
	audio.sfx('zap', { pitch: 1.3, gain: 0.7 });
	shockwave(scene.scene, new THREE.Vector3(0, -0.32, 0.3), { color: 0x39ff5e, maxScale: 5 });
	// duck the green blaze so the clover motes read against the dark
	tween(600, 'outQuad', (v) => {
		machine.setInnerGlow(0.85 - v * 0.65, 0x39ff5e);
		scene.fxLight.intensity = 4 * (1 - v * 0.7);
	});
	await luckyWord(ctx, {
		text: '☘',
		color: 0x39ff5e,
		colorB: 0x9dffb0,
		width: 2.6,
		y: 0.9,
		gather: 1300,
		hold: 1400,
		strip: false // a strip behind a clover just looks like a lost road sign
	});
	await flashPulse(machine, 1, 80, 850, 0x8af284);

	tween(800, 'outQuad', (v) => {
		scene.fxLight.intensity = 4 * (1 - v);
		machine.setInnerGlow(0.85 * (1 - v), 0x39ff5e);
	});
	await restore(1000);
}
