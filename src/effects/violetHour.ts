// Effect — VIOLET HOUR: the lounge floods deep amethyst, a ring of crystals
// grows up out of the dark, the room holds its breath, and everything settles.
// Deliberately gentle — no shake, no camera move, nothing crosses the frame.
// This is the one short effect that reduced-motion visitors are allowed to see,
// so it must stay that way (see CALM in director.ts).

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import { backdropWipe } from '../gfx/quiltWipe';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'rimLight';
export const duration = 5800;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;

	const restore = dimLights(scene, 0.34, 900);
	// the leather turns amethyst from the centre out
	const wipe = backdropWipe(machine.backdrop, ctx.textures.quilt.map, 'violet');
	wipe.in(1700);
	scene.fxLight.color.set(0xa46cff);
	scene.fxLight.position.set(0, 0.2, 1.6);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3.2));
	machine.setInnerGlow(0, 0xa46cff);
	tween(1500, 'inOutQuad', (v) => machine.setInnerGlow(v * 0.42, 0xa46cff));

	// ---- a ring of amethyst points, grown from below the frame. Octahedra
	// stretched on Y read as crystal without any transmission cost.
	const crystalMat = new THREE.MeshStandardMaterial({
		color: 0x7b3fd0,
		emissive: 0x3d1478,
		emissiveIntensity: 1.1,
		metalness: 0.15,
		roughness: 0.22,
		flatShading: true
	});
	const geo = new THREE.ConeGeometry(0.17, 0.62, 6);
	const crystals: THREE.Mesh[] = [];
	const N = 16;
	for (let i = 0; i < N; i++) {
		const a = (i / N) * Math.PI * 2 + 0.2;
		const r = 1.72 + rand(-0.12, 0.2);
		const m = new THREE.Mesh(geo, crystalMat);
		// depth stays in front of the backdrop plane (z = -0.75) — the old ±0.5
		// swing pushed the top-left and bottom-right of the ring behind it
		m.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.78 - 0.42, -0.3 + Math.sin(a * 2) * 0.3);
		m.rotation.set(rand(-0.3, 0.3), rand(0, 6.28), a * 0.4 + rand(-0.2, 0.2));
		m.scale.set(0.001, 0.001, 0.001);
		m.userData.tall = rand(1.4, 2.6);
		m.userData.wide = rand(0.55, 0.9);
		scene.scene.add(m);
		crystals.push(m);
	}

	// slow lavender drift — the only motion in the whole piece
	const motes = particles.emitter({
		texture: sprites.softDot,
		count: 220,
		emitRate: 46,
		origin: new THREE.Vector3(0, -0.9, 0.3),
		originSpread: 2.1,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.42,
		speed: [0.1, 0.34],
		gravity: new THREE.Vector3(0, 0.06, 0),
		life: [2.2, 4],
		size: [0.012, 0.042],
		colors: [0xc9a2ff, 0x8f5cff, 0xe8d6ff],
		fadeIn: 0.3
	});

	const stopBreathe = scene.addUpdatable((_dt, t) => {
		for (let i = 0; i < crystals.length; i++) {
			const m = crystals[i];
			// a slow shimmer, each on its own clock
			m.rotation.y += 0.0022 + i * 0.00012;
			const breathe = 1 + Math.sin(t * 0.9 + i) * 0.03;
			if (m.userData.grown) {
				m.scale.set(m.userData.wide * breathe, m.userData.tall * breathe, m.userData.wide * breathe);
			}
		}
	});

	haptics.vibrate(18);
	audio.sfx('chime', { pitch: 0.72, gain: 0.4 });

	// ---- they grow, one after another, unhurried
	for (let i = 0; i < crystals.length; i++) {
		const m = crystals[i];
		tween(760, 'outCubic', (v) => {
			const s = Math.max(0.001, v);
			m.scale.set(m.userData.wide * s, m.userData.tall * s, m.userData.wide * s);
			if (v >= 1) m.userData.grown = true;
		});
		if (i % 3 === 0) audio.sfx('tick', { pitch: 1.5 + i * 0.09, gain: 0.16 });
		await delay(62); // more crystals, same overall grow time
	}
	await delay(420);

	// ---- the hour itself: one long swell of light, no bang
	audio.sfx('gong', { pitch: 0.66, gain: 0.5 });
	haptics.vibrate(20);
	flashPulse(machine, 0.42, 320, 900, 0xa46cff);
	tween(1200, 'inOutQuad', (v) => {
		const swell = Math.sin(v * Math.PI);
		crystalMat.emissiveIntensity = 1.1 + swell * 1.9;
		machine.setInnerGlow(0.42 + swell * 0.3, 0xa46cff);
		scene.fxLight.intensity = 3.2 + swell * 2.2;
	});
	particles.burst({
		texture: sprites.star4,
		count: 60,
		origin: new THREE.Vector3(0, -0.2, 0.4),
		originSpread: 1.6,
		speed: [0.2, 0.9],
		life: [1.2, 2.4],
		size: [0.02, 0.07],
		colors: [0xd8bcff, 0xa46cff, 0xfff0ff],
		fadeIn: 0.3
	});
	await luckyWord(ctx, {
		text: 'CHARMED',
		color: 0xc9a2ff,
		colorB: 0xf0e2ff,
		y: -1.25, // clear of the lit machine face — additive motes wash out on it
		gather: 800,
		hold: 900,
		scatter: 520
	});

	// ---- and back down
	motes.stop();
	await Promise.all(
		crystals.map((m, i) =>
			tween(620 + i * 26, 'inCubic', (v) => {
				const s = Math.max(0.001, 1 - v);
				m.scale.set(m.userData.wide * s, m.userData.tall * s, m.userData.wide * s);
			})
		)
	);
	stopBreathe();
	for (const m of crystals) scene.scene.remove(m);
	geo.dispose();
	crystalMat.dispose();
	wipe.out(1000);
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.42 * (1 - v));
		scene.fxLight.intensity = 3.2 * (1 - v);
	});
	await restore(1000);
}
