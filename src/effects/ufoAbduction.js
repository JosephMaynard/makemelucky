// Effect 18 — UFO ABDUCTION: a flying saucer wobbles in, tractor-beams the
// button up for inspection, decides it's too lucky to steal, and bolts.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';
import { dimLights, flashPulse, shockwave } from './helpers.js';

export const sound = 'rimLight';
export const duration = 11000;

function buildSaucer() {
	const g = new THREE.Group();
	const hull = new THREE.Mesh(
		new THREE.SphereGeometry(0.62, 32, 16),
		new THREE.MeshStandardMaterial({ color: 0x8a94a2, metalness: 1, roughness: 0.25, envMapIntensity: 1.6 })
	);
	hull.scale.set(1, 0.28, 1);
	const dome = new THREE.Mesh(
		new THREE.SphereGeometry(0.26, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
		new THREE.MeshPhysicalMaterial({
			color: 0x9fe8d8,
			metalness: 0,
			roughness: 0.05,
			transparent: true,
			opacity: 0.75,
			emissive: 0x2a8a72,
			emissiveIntensity: 0.6
		})
	);
	dome.position.y = 0.12;
	g.add(hull, dome);
	// blinking rim lights
	const lights = [];
	for (let i = 0; i < 10; i++) {
		const a = (i / 10) * Math.PI * 2;
		const lamp = new THREE.Mesh(
			new THREE.SphereGeometry(0.045, 10, 8),
			new THREE.MeshBasicMaterial({ color: 0x9fdcff })
		);
		lamp.position.set(Math.cos(a) * 0.52, -0.02, Math.sin(a) * 0.52);
		g.add(lamp);
		lights.push(lamp);
	}
	return { g, lights };
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.22, 900);
	const saucer = buildSaucer();
	saucer.g.position.set(-4.2, 2.6, 0.4);
	scene.scene.add(saucer.g);

	// blink loop + hover wobble
	let hovering = true;
	let blink = 0;
	const stopHover = scene.addUpdatable((dt, t) => {
		blink += dt * 9;
		saucer.lights.forEach((l, i) => {
			l.material.color.setHex((Math.floor(blink) + i) % 10 < 5 ? 0x9fdcff : 0x2a4a6a);
		});
		if (hovering) {
			saucer.g.rotation.z = Math.sin(t * 2.2) * 0.06;
			saucer.g.position.y += Math.sin(t * 1.7) * 0.0016;
		}
	});

	// wobble in and park above the machine
	haptics.vibrate(25);
	await tween(1800, 'inOutQuad', (v) => {
		saucer.g.position.x = -4.2 + v * 4.2;
		saucer.g.position.y = 2.6 - Math.sin(v * Math.PI) * 0.35 - v * 1.5;
	});

	// tractor beam on
	const beamMat = new THREE.MeshBasicMaterial({
		color: 0x9fe8d8,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide
	});
	const beam = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.7, 32, 1, true), beamMat);
	beam.position.set(0, 0.2, 0.35);
	scene.scene.add(beam);
	scene.fxLight.color.set(0x9fe8d8);
	scene.fxLight.position.set(0, 0.6, 1.4);
	haptics.vibrate([30, 40, 80]);
	await tween(700, 'inOutQuad', (v) => {
		beamMat.opacity = v * 0.22;
		scene.fxLight.intensity = v * 5;
	});

	// the button rises, rotating slowly in the beam
	const button = machine.buttonGroup;
	const home = button.parent;
	scene.scene.attach(button); // keep world transform, then animate freely
	const startY = button.position.y;
	const startZ = button.position.z;
	const dust = particles.emitter({
		texture: sprites.softDot,
		count: 120,
		emitRate: 45,
		origin: new THREE.Vector3(0, -0.1, 0.4),
		originSpread: 0.35,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.5,
		speed: [0.4, 1],
		gravity: new THREE.Vector3(0, 0.2, 0),
		life: [0.8, 1.6],
		size: [0.015, 0.045],
		colors: [0x9fe8d8, 0xd8fff2]
	});
	await tween(2300, 'inOutQuad', (v) => {
		// it pops forward out of its housing first, THEN rises and spins,
		// so the rim never carves through the outer rings
		button.position.z = startZ + Math.min(v * 4, 1) * 0.55;
		button.position.y = startY + v * 0.95;
		button.rotation.y = Math.max(0, (v - 0.22) / 0.78) * Math.PI * 3;
		button.rotation.x = Math.sin(v * Math.PI * 2) * 0.2;
	});

	// scanning pause… nope, too lucky. Put it back.
	await delay(900);
	haptics.vibrate([20, 30, 20]);
	dust.stop();
	await tween(900, 'inQuad', (v) => {
		button.position.y = startY + 0.95 - v * 0.95;
		// finish the spin early, tuck back into the housing at the very end
		button.rotation.y = Math.PI * 3 * Math.max(0, 1 - v * 1.4);
		button.rotation.x = 0;
		button.position.z = startZ + 0.55 * (1 - Math.max(0, (v - 0.72) / 0.28));
	});
	home.attach(button);
	button.position.set(0, 0, 0);
	button.rotation.set(0, 0, 0);
	button.scale.setScalar(1);
	scene.shake(0.3);
	shockwave(scene.scene, new THREE.Vector3(0, -0.32, 0.3), { color: 0x9fe8d8, maxScale: 3.5 });

	// beam off, saucer bolts with a streak
	await tween(400, 'outQuad', (v) => {
		beamMat.opacity = 0.22 * (1 - v);
		scene.fxLight.intensity = 5 * (1 - v);
	});
	hovering = false;
	haptics.vibrate([40, 30, 100]);
	particles.burst({
		texture: sprites.streak,
		count: 10,
		origin: saucer.g.position.clone(),
		direction: new THREE.Vector3(1, 0.25, 0).normalize(),
		cone: 0.25,
		speed: [6, 10],
		gravity: new THREE.Vector3(0, 0, 0),
		life: [0.4, 0.7],
		size: [0.4, 0.7],
		colors: [0x9fe8d8, 0xffffff]
	});
	await tween(650, 'inQuart', (v) => {
		saucer.g.position.x = v * 5.2;
		saucer.g.position.y = 1.1 + v * 2.1;
		saucer.g.rotation.z = -v * 0.4;
	});

	stopHover();
	scene.scene.remove(saucer.g, beam);
	beam.geometry.dispose();
	beamMat.dispose();
	await flashPulse(machine, 0.6, 100, 700, 0xcdf5ea);
	await restore(900);
}
