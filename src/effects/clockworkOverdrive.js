// Effect 12 — CLOCKWORK OVERDRIVE: time itself gets wound up. A great golden
// chapter ring materialises over the machine, hands race, the movement screams,
// and everything strikes the lucky hour at once.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { dimLights, flashPulse, shockwave } from './helpers.js';
import { createClockRingTexture } from '../gfx/textures.js';

export const sound = 'spinningRim';
export const duration = 9000;

let clockTex = null;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;
	if (!clockTex) clockTex = createClockRingTexture(1024);

	const restore = dimLights(scene, 0.3, 800);
	scene.fxLight.color.set(0xffd27a);
	scene.fxLight.position.set(0, -0.2, 1.5);
	tween(800, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 4.5));

	// the chapter ring fades in over the machine
	const ringMat = new THREE.MeshBasicMaterial({
		map: clockTex,
		transparent: true,
		opacity: 0,
		color: 0xffd27a,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide
	});
	const ring = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), ringMat);
	ring.position.set(0, -0.32, 0.85);
	scene.scene.add(ring);

	// two golden hands
	const mkHand = (len, w) => {
		const hand = new THREE.Mesh(
			new THREE.PlaneGeometry(w, len),
			new THREE.MeshBasicMaterial({
				color: 0xffe9ad,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide
			})
		);
		hand.geometry.translate(0, len / 2, 0); // pivot at the base
		hand.position.set(0, -0.32, 0.9);
		scene.scene.add(hand);
		return hand;
	};
	const hourHand = mkHand(0.85, 0.075);
	const minuteHand = mkHand(1.3, 0.05);

	await tween(900, 'inOutQuad', (v) => {
		ringMat.opacity = v * 0.85;
		hourHand.material.opacity = v * 0.9;
		minuteHand.material.opacity = v * 0.9;
	});

	// wind time up — mechanism races, hands whirl faster and faster
	machine.mechSpeed = 2;
	let handSpeed = 0.6;
	let tickTimer = 0;
	const stopTime = scene.addUpdatable((dt) => {
		minuteHand.rotation.z -= dt * handSpeed;
		hourHand.rotation.z -= dt * handSpeed / 12;
		ring.rotation.z += dt * 0.05;
		tickTimer -= dt;
		if (tickTimer <= 0) {
			tickTimer = Math.max(0.09, 0.5 / handSpeed);
			haptics.vibrate(12);
			scene.shake(0.05);
		}
	});
	machine.setInnerGlow(0, 0xffd27a);
	await tween(4200, 'inCubic', (v) => {
		handSpeed = 0.6 + v * 34;
		machine.mechSpeed = 2 + v * 13;
		machine.setInnerGlow(v * 0.55, 0xffd27a);
	});
	shockwave(scene.scene, new THREE.Vector3(0, -0.32, 0.4), { color: 0xffd27a, maxScale: 4 });
	await delay(600);

	// THE LUCKY HOUR — hands snap to midnight, everything strikes at once
	stopTime();
	await Promise.all([
		tween(340, 'outBack', (v) => {
			minuteHand.rotation.z = minuteHand.rotation.z * (1 - v);
			hourHand.rotation.z = hourHand.rotation.z * (1 - v);
		})
	]);
	haptics.vibrate([80, 50, 80, 50, 220]);
	scene.shake(0.6);
	shockwave(scene.scene, new THREE.Vector3(0, -0.32, 0.4), { color: 0xfff3cf, maxScale: 6, duration: 900 });
	particles.burst({
		texture: sprites.star4,
		count: 80,
		origin: new THREE.Vector3(0, -0.32, 0.5),
		speed: [1.5, 4.5],
		life: [0.6, 1.4],
		size: [0.04, 0.12],
		colors: [0xffd27a, 0xfff3cf, 0xffffff]
	});
	await flashPulse(machine, 1, 80, 900, 0xffe9ad);

	// time settles back down
	machine.mechSpeed = 2;
	await Promise.all([
		tween(900, 'inOutQuad', (v) => {
			ringMat.opacity = 0.85 * (1 - v);
			hourHand.material.opacity = 0.9 * (1 - v);
			minuteHand.material.opacity = 0.9 * (1 - v);
			machine.setInnerGlow(0.55 * (1 - v), 0xffd27a);
			scene.fxLight.intensity = 4.5 * (1 - v);
		}),
		restore(1000)
	]);
	for (const m of [ring, hourHand, minuteHand]) {
		scene.scene.remove(m);
		m.geometry.dispose();
		m.material.dispose();
	}
}
