// Effect 3 — RUNE CIRCLE: the lights dim and blazing gold spell-circles ignite
// around the machine, Doctor-Strange style, before collapsing into the button.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'luckySymbol';
export const duration = 8500;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, glyphTextures, haptics } = ctx;

	const restore = dimLights(scene, 0.22, 900);
	scene.fxLight.color.set(0xffb54d);
	scene.fxLight.position.set(0, -0.2, 1.6);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 5));

	// three spell rings: big tilted, medium counter-rotating, small over the button
	const rings: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
	const ringDefs = [
		{ size: 3.1, z: 0.75, tiltX: 0.35, tiltY: 0.1, speed: 0.55, tex: 0 },
		{ size: 2.2, z: 0.95, tiltX: -0.22, tiltY: -0.14, speed: -0.85, tex: 1 },
		{ size: 1.15, z: 1.15, tiltX: 0.1, tiltY: 0, speed: 1.4, tex: 2 }
	];
	for (const def of ringDefs) {
		const mat = new THREE.MeshBasicMaterial({
			map: glyphTextures[def.tex],
			transparent: true,
			opacity: 0,
			color: 0xffb54d,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.size, def.size), mat);
		mesh.position.set(0, -0.32, def.z);
		mesh.rotation.set(def.tiltX, def.tiltY, rand(0, Math.PI * 2));
		mesh.userData.speed = def.speed;
		scene.scene.add(mesh);
		rings.push(mesh);
	}

	const stopSpin = scene.addUpdatable((dt) => {
		for (const r of rings) r.rotation.z += r.userData.speed * dt;
	});

	// ignite one by one
	for (let i = 0; i < rings.length; i++) {
		const mat = rings[i].material;
		haptics.vibrate(35);
		tween(650, 'outBack', (v) => {
			rings[i].scale.setScalar(0.4 + 0.6 * v);
			mat.opacity = Math.min(1, v * 1.4);
		});
		await delay(420);
	}

	// ember fountain while the circles burn
	const embers = particles.emitter({
		texture: sprites.softDot,
		count: 260,
		emitRate: 90,
		origin: new THREE.Vector3(0, -0.6, 0.8),
		originSpread: 1.1,
		direction: new THREE.Vector3(0, 1, 0.15),
		cone: 1.2,
		speed: [0.2, 0.7],
		gravity: new THREE.Vector3(0, 0.25, 0),
		life: [0.9, 2.2],
		size: [0.012, 0.045],
		colors: [0xffb54d, 0xff8a3d, 0xffe3a0]
	});

	machine.setInnerGlow(0, 0xffb54d);
	tween(2400, 'inOutQuad', (v) => machine.setInnerGlow(v * 0.75, 0xffb54d));
	await delay(3100);

	// collapse into the button
	embers.stop();
	stopSpin();
	haptics.vibrate([40, 50, 40, 50, 110]);
	await Promise.all(
		rings.map((r, i) =>
			tween(620 + i * 90, 'inCubic', (v) => {
				r.scale.setScalar((1 - v) * 1 + 0.02);
				r.position.z = r.position.z * (1 - v) + 0.25 * v;
				r.material.opacity = 1 - v * v;
			})
		)
	);
	scene.shake(0.45);
	particles.burst({
		texture: sprites.spark,
		count: 70,
		origin: new THREE.Vector3(0, -0.32, 0.3),
		speed: [1, 4],
		life: [0.4, 1],
		size: [0.03, 0.1],
		colors: [0xffb54d, 0xffe3a0, 0xffffff]
	});
	await flashPulse(machine, 0.95, 90, 750, 0xffcf7a);

	for (const r of rings) {
		scene.scene.remove(r);
		r.geometry.dispose();
		r.material.dispose();
	}
	tween(600, 'outQuad', (v) => {
		scene.fxLight.intensity = 5 * (1 - v);
		machine.setInnerGlow(0.75 * (1 - v), 0xffb54d);
	});
	await restore(900);
}
