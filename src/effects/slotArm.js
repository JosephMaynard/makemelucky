// Effect — SLOT ARM: the machine turns one-armed bandit. A giant gold lever
// slides in from the right, PULLS, and spins the Celtic face like a reel that
// ratchets to a stop on TRIPLE JACKPOT — dings, coins and a shockwave.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { dimLights, flashPulse, shockwave } from './helpers.js';

export const sound = 'spinningRim';
export const duration = 10500;

/** Gold shaft + red ball knob, built so the group origin is the pivot and the
 *  shaft points straight up. Rotating the group swings the whole arm. */
function buildLever() {
	const pivot = new THREE.Group();
	const gold = new THREE.MeshStandardMaterial({ color: 0xd9b05e, metalness: 1, roughness: 0.26, envMapIntensity: 1.3 });
	const red = new THREE.MeshStandardMaterial({ color: 0xc21f2e, metalness: 0.2, roughness: 0.34 });
	const dark = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.85, roughness: 0.5 });

	const hub = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), dark);
	pivot.add(hub);
	const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 12, 24), gold);
	pivot.add(collar);
	const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.062, 1.05, 20), gold);
	shaft.position.y = 0.52;
	pivot.add(shaft);
	const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 18), red);
	knob.position.y = 1.08;
	pivot.add(knob);
	return pivot;
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.5, 700);
	scene.fxLight.color.set(0xffe6a8);
	scene.fxLight.position.set(1.2, 0.1, 1.6);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.4));

	// ---- the lever slides in from off the right edge, pointing up. On narrow
	// screens it hugs (even overlaps) the machine edge so it stays in frame.
	const lever = buildLever();
	const cam = scene.camera;
	const halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (5.35 - 0.78) * cam.aspect;
	const pivotX = Math.min(1.95, halfW - 0.45);
	lever.position.set(pivotX + 1.75, -0.1, 0.78);
	scene.scene.add(lever);
	haptics.vibrate(20);
	await tween(700, 'outCubic', (v) => (lever.position.x = pivotX + 1.75 - v * 1.75));
	await delay(600);

	// ---- THE PULL: clamps release, arm hauls down with a clack, springs back
	machine.openClamps(420);
	audio.sfx('clack');
	haptics.vibrate([40, 40, 90]);
	// swings INWARD across the face — outward carries the knob off-screen
	await tween(480, 'outCubic', (v) => (lever.rotation.z = v * 2.05));
	tween(1500, 'outElastic', (v) => (lever.rotation.z = 2.05 * (1 - v))); // wobble home

	// ---- the reel: accelerate → hold → ratcheting decel, clicks home at z=0
	let stopReel = () => {};
	await new Promise((resolve) => {
		let rot = 0;
		let vel = 0;
		let phaseT = 0;
		let mode = 'accel';
		let lastTick = 0;
		let ticks = 0;
		stopReel = scene.addUpdatable((dt) => {
			phaseT += dt;
			if (mode === 'accel') {
				vel += 26 * dt;
				if (vel >= 10) { vel = 10; mode = 'hold'; phaseT = 0; }
			} else if (mode === 'hold') {
				scene.shake(0.02);
				if (phaseT > 2.1) mode = 'decel';
			} else {
				vel -= 6.8 * dt;
				// ratchet ticks every ~0.7 rad as it eases down (capped)
				while (rot - lastTick >= 0.7 && ticks < 16) {
					audio.sfx('tick', { pitch: 1, gain: 0.5 });
					lastTick += 0.7;
					ticks++;
				}
				if (vel <= 0.15) {
					vel = 0;
					machine.faceSpin.rotation.z = 0; // click EXACTLY into place
					stopReel();
					resolve();
					return;
				}
			}
			rot += vel * dt;
			machine.faceSpin.rotation.z = rot;
		});
	});

	// ---- TRIPLE JACKPOT: three rising dings, each a gold glow pulse
	haptics.vibrate([30, 40, 30]);
	for (let i = 0; i < 3; i++) {
		audio.sfx('ding', { pitch: 1 + i * 0.15 });
		machine.setInnerGlow(0.6, 0xffd27a);
		tween(320, 'outQuad', (v) => machine.setInnerGlow(0.6 * (1 - v), 0xffd27a));
		scene.shake(0.18);
		haptics.vibrate([18, 26]);
		await delay(420);
	}

	// ---- payout: coin fountain + shockwave + flash, clamps slam home
	const origin = new THREE.Vector3(0, -0.32, 0.42);
	audio.sfx('boom');
	scene.shake(0.42);
	haptics.vibrate([60, 50, 140]);
	shockwave(scene.scene, origin, { color: 0xffd27a, maxScale: 4, z: 0.42 });
	particles.burst({
		texture: sprites.coin,
		count: 64,
		origin: origin.clone(),
		direction: new THREE.Vector3(0, 1, 0.32).normalize(),
		cone: 1.3,
		speed: [2, 4.6],
		gravity: new THREE.Vector3(0, -3.2, 0),
		life: [1, 2],
		size: [0.1, 0.2],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff3cf],
		spin: [-6, 6]
	});
	particles.burst({
		texture: sprites.star4,
		count: 30,
		origin: origin.clone(),
		speed: [1, 3],
		life: [0.5, 1.2],
		size: [0.03, 0.09],
		colors: [0xffffff, 0xffe9ad]
	});
	await flashPulse(machine, 0.85, 90, 750, 0xffe9ad);
	await machine.closeClamps(450);

	// ---- the lever slides back out to the right
	await delay(500);
	await tween(750, 'inCubic', (v) => (lever.position.x = pivotX + v * 1.9));

	// ---- teardown: restore everything exactly
	stopReel(); // defensive — the reel already stopped itself
	machine.faceSpin.rotation.z = 0;
	scene.scene.remove(lever);
	const disposed = new Set();
	lever.traverse((o) => {
		if (o.geometry && !disposed.has(o.geometry)) { o.geometry.dispose(); disposed.add(o.geometry); }
		if (o.material && !disposed.has(o.material)) { o.material.dispose(); disposed.add(o.material); }
	});
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	await restore(900);
}
