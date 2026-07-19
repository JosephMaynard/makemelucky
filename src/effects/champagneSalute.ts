// Effect 25 — CHAMPAGNE SALUTE: the machine shakes itself like a magnum on a
// podium, the button-cork blasts off past your ear, and the whole scene fills
// with foam, rising bubbles and golden fizz. To your continued luck. 🍾

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { disposeObject, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 8500;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;

	const BTN = machine.buttonWorldPosition();

	// ---- the shake-up: pressure builds, the machine trembles with intent
	scene.fxLight.color.set(0xffe9b0);
	scene.fxLight.position.set(0.4, 0.8, 1.3);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3));
	machine.setInnerGlow(0.1, 0xffe9b0);
	const rumble = tween(1500, 'inQuad', (v) => {
		scene.shake(v * 0.05); // continuous small trauma → rising tremble
		machine.setInnerGlow(0.1 + v * 0.5, 0xffe9b0);
	});
	for (let i = 0; i < 5; i++) {
		delay(i * 280).then(() => audio.sfx('tick', { pitch: 1.1 + i * 0.16, gain: 0.4 + i * 0.1 }));
	}
	await rumble;
	haptics.vibrate([20, 30, 20, 30, 50]);

	// ---- POP. The cork departs at escape velocity.
	const cork = new THREE.Group();
	const corkMat = new THREE.MeshStandardMaterial({ color: 0xc89858, roughness: 0.7, metalness: 0.05 });
	const capMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.8 });
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.12, 20), corkMat);
	const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.02, 20), capMat);
	cap.position.y = 0.07;
	cork.add(body, cap);
	cork.position.copy(BTN);
	cork.rotation.x = Math.PI / 2; // nose toward camera
	scene.scene.add(cork);

	audio.sfx('pop', { pitch: 0.85, gain: 1.4 });
	audio.sfx('boom', { pitch: 1.5, gain: 0.35 });
	scene.shake(0.6);
	haptics.vibrate(80);
	machine.pressDown().then(() => machine.pressUp()); // recoil

	// foam blast: a hard white cone straight at the camera, then lazy drift
	particles.burst({
		texture: sprites.softDot,
		count: 150,
		origin: BTN.clone().add(new THREE.Vector3(0, 0, 0.1)),
		direction: new THREE.Vector3(0, 0.25, 1),
		cone: 0.38,
		speed: [1.6, 4.6],
		drag: 1.6,
		gravity: new THREE.Vector3(0, -0.9, 0),
		life: [0.7, 1.6],
		size: [0.03, 0.11],
		colors: [0xffffff, 0xfff6e0, 0xffe9b0]
	});
	particles.burst({
		texture: sprites.spark,
		count: 60,
		origin: BTN.clone().add(new THREE.Vector3(0, 0, 0.1)),
		direction: new THREE.Vector3(0, 0.3, 1),
		cone: 0.5,
		speed: [2.2, 5.2],
		life: [0.4, 0.9],
		size: [0.012, 0.04],
		colors: [0xffd27a, 0xfff3cf]
	});
	shockwave(scene.scene, BTN, { color: 0xfff0c8, maxScale: 3.6, duration: 650, z: BTN.z + 0.15 });
	flashPulse(machine, 0.85, 60, 500, 0xfff6e0);

	// cork flight: past the camera's right ear, tumbling end over end
	const corkEnd = new THREE.Vector3(1.9, 1.6, 5.8);
	const corkArc = tween(950, 'outQuad', (v) => {
		cork.position.lerpVectors(BTN, corkEnd, v);
		cork.position.y += Math.sin(v * Math.PI) * 0.35; // a lofted arc, not a laser
		cork.rotation.x = Math.PI / 2 + v * 9;
		cork.rotation.z = v * 5;
	});

	// ---- the toast: bubbles rise through everything for a long, happy moment
	let T = 0;
	const stopClock = scene.addUpdatable((dt) => (T += dt));
	const bubbles = particles.emitter({
		texture: sprites.softDot,
		count: 220,
		emitRate: 55,
		origin: new THREE.Vector3(0, -1.4, 0.4),
		originSpread: 2.4,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.12,
		speed: [0.25, 0.6],
		gravity: new THREE.Vector3(0, 0.3, 0), // buoyancy: bubbles accelerate upward
		life: [2.2, 3.8],
		size: [0.008, 0.038],
		colors: [0xfff6e0, 0xffe9b0, 0xffffff],
		fadeIn: 0.45,
		// wobble: bubbles never rise straight
		field: (x) => [Math.sin(x * 9 + T * 2) * 0.35, 0, 0]
	});

	await corkArc;
	scene.scene.remove(cork);
	disposeObject(cork);

	// clink-clink — a toast among friends
	audio.sfx('gong', { pitch: 2.2, gain: 0.4 }); // small bright bells, long ring — glasses touched
	delay(260).then(() => audio.sfx('gong', { pitch: 2.5, gain: 0.35 }));
	await luckyWord(ctx, {
		text: 'CHEERS!',
		color: 0xffd27a,
		colorB: 0xfff6e0,
		y: 0.95,
		hold: 1700
	});

	// ---- last call: fizz settles, lights come home
	await delay(900);
	bubbles.stop();
	stopClock();
	tween(1100, 'outQuad', (v) => {
		scene.fxLight.intensity = 3 * (1 - v);
		machine.setInnerGlow(0.6 * (1 - v), 0xffe9b0);
	});
	await delay(1100);
	machine.setInnerGlow(0.2);
}
