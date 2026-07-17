// Effect 21 — HORSESHOE TOSS: someone off-stage hurls a giant golden
// horseshoe. It tumbles across the lounge and rings the button. Ringer!

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave, disposeObject } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'luckySymbol';
export const duration = 9000;

function buildHorseshoe() {
	const g = new THREE.Group();
	const gold = new THREE.MeshStandardMaterial({
		color: 0xe2b964,
		metalness: 1,
		roughness: 0.22,
		envMapIntensity: 1.8
	});
	const dark = new THREE.MeshStandardMaterial({ color: 0x2a2620, metalness: 0.8, roughness: 0.45 });
	// the shoe: an open torus, gap pointing up so the luck can't run out.
	// Big enough to ring OUTSIDE the button collar so it reads as its own thing.
	const RS = 0.72;
	const ARC = Math.PI * 1.45;
	const shoe = new THREE.Mesh(new THREE.TorusGeometry(RS, 0.11, 14, 48, ARC), gold);
	shoe.rotation.z = Math.PI / 2 - ARC / 2; // centre the gap at 12 o'clock
	g.add(shoe);
	// end caps
	for (const side of [Math.PI / 2 - ARC / 2, Math.PI / 2 + ARC / 2]) {
		const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 12), gold);
		cap.position.set(Math.cos(side) * RS, Math.sin(side) * RS, 0);
		cap.rotation.x = Math.PI / 2;
		g.add(cap);
	}
	// nail studs along the outer face
	for (let i = 0; i < 7; i++) {
		const a = Math.PI / 2 + ARC / 2 - ((i + 0.5) / 7) * ARC;
		const stud = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), dark);
		stud.position.set(Math.cos(a) * RS, Math.sin(a) * RS, 0.115);
		g.add(stud);
	}
	return g;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.4, 700);
	scene.fxLight.color.set(0xffe9ad);
	scene.fxLight.position.set(0, 0.3, 1.6);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3.2));

	const shoe = buildHorseshoe();
	shoe.position.set(-3.1, 1.3, 0.62);
	scene.scene.add(shoe);
	const glitterTrail = particles.emitter({
		texture: sprites.star4,
		count: 120,
		emitRate: 60,
		origin: shoe.position,
		originSpread: 0.25,
		speed: [0.05, 0.3],
		gravity: new THREE.Vector3(0, -0.3, 0),
		life: [0.5, 1.1],
		size: [0.02, 0.06],
		colors: [0xffe9ad, 0xffd27a, 0xffffff]
	});

	// the throw: a tumbling parabolic arc onto the button; a slight forward
	// tilt keeps it reading as a thrown object rather than part of the face
	haptics.vibrate(30);
	audio.sfx('swoosh', { gain: 0.6, pitch: 0.9 });
	const target = new THREE.Vector3(0, -0.32, 0.78);
	await tween(1500, 'inOutQuad', (v) => {
		shoe.position.x = -3.1 + v * 3.1;
		shoe.position.y = 1.3 + Math.sin(v * Math.PI) * 0.7 - v * 1.62;
		shoe.position.z = 0.62 + v * 0.16;
		shoe.rotation.z = -v * Math.PI * 4; // four full tumbles, lands gap-up
		shoe.rotation.x = 0.55 * (1 - v) + 0.18;
	});
	shoe.position.copy(target);
	shoe.rotation.z = 0;
	shoe.rotation.x = 0.18;

	// CLANG — it rings the button
	audio.sfx('clang');
	glitterTrail.stop();
	scene.shake(0.45);
	haptics.vibrate([50, 40, 100]);
	shockwave(scene.scene, target, { color: 0xffe9ad, maxScale: 3.2, z: 0.62 });
	particles.burst({
		texture: sprites.spark,
		count: 36,
		origin: target.clone(),
		speed: [1, 3.2],
		life: [0.3, 0.8],
		size: [0.025, 0.07],
		colors: [0xffffff, 0xffe9ad, 0xffd27a]
	});
	// settle wobble, like a tossed ring finding its rest
	await tween(900, 'outQuad', (v) => {
		shoe.rotation.z = Math.sin(v * Math.PI * 4) * 0.16 * (1 - v);
		shoe.position.z = 0.78 - Math.sin(v * Math.PI) * 0.05;
	});

	// a ringer! the machine celebrates
	machine.setInnerGlow(0.55, 0xffe9ad);
	const shoeFountain = particles.emitter({
		texture: sprites.horseshoe,
		count: 26,
		emitRate: 22,
		origin: new THREE.Vector3(0, -0.3, 0.6),
		originSpread: 0.3,
		direction: new THREE.Vector3(0, 1, 0.2).normalize(),
		cone: 0.8,
		speed: [0.8, 1.6],
		gravity: new THREE.Vector3(0, -1.2, 0),
		life: [1, 1.9],
		size: [0.08, 0.16],
		colors: [0xffd27a, 0xffe9ad],
		spin: [-5, 5]
	});
	await flashPulse(machine, 0.85, 90, 750, 0xffe9ad);
	await delay(1400);
	shoeFountain.stop();

	// it lifts off, spins triumphantly and sails away over the camera
	haptics.vibrate([25, 30, 60]);
	await tween(900, 'inQuad', (v) => {
		shoe.position.y = -0.32 + v * 1.1;
		shoe.position.z = 0.78 + v * 3.3;
		shoe.rotation.z = v * Math.PI * 2;
		shoe.rotation.x = 0.18 + v * 0.6;
	});

	scene.scene.remove(shoe);
	disposeObject(shoe); // gold/dark materials are shared across several meshes — deduped
	tween(600, 'outQuad', (v) => {
		machine.setInnerGlow(0.55 * (1 - v));
		scene.fxLight.intensity = 3.2 * (1 - v);
	});
	await restore(900);
}
