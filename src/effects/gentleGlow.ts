// Reduced-motion effect: no shaking, spinning or flying — just a warm, lovely
// glow and a few sparkles. Equally lucky.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 4500;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites } = ctx;
	machine.setInnerGlow(0, 0xfff3cf);
	scene.fxLight.color.set(0xffd27a);
	scene.fxLight.position.set(0, -0.3, 1.4);

	await tween(1600, 'inOutQuad', (v) => {
		machine.setInnerGlow(v * 0.9, 0xfff3cf);
		scene.fxLight.intensity = v * 4;
	});
	particles.burst({
		texture: sprites.star4,
		count: 24,
		origin: new THREE.Vector3(0, -0.32, 0.4),
		speed: [0.2, 0.8],
		gravity: new THREE.Vector3(0, 0.05, 0),
		life: [1, 2],
		size: [0.02, 0.06],
		colors: [0xfff3cf, 0xffffff]
	});
	await delay(1200);
	await tween(1500, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.9 * (1 - v));
		scene.fxLight.intensity = 4 * (1 - v);
	});
}
