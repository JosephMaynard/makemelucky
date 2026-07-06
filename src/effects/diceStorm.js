// Effect 16 — DICE STORM: five giant ivory dice tumble across the lounge,
// bouncing off the floor and walls, before settling into a jackpot flash.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'buttonFall';
export const duration = 9500;

let dieMaterials = null;

function makeDieMaterials() {
	const PIPS = {
		1: [[0, 0]],
		2: [[-1, -1], [1, 1]],
		3: [[-1, -1], [0, 0], [1, 1]],
		4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
		5: [[-1, -1], [-1, 1], [0, 0], [1, -1], [1, 1]],
		6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
	};
	const mats = [];
	for (const n of [1, 6, 2, 5, 3, 4]) { // opposite faces sum to 7
		const cv = document.createElement('canvas');
		cv.width = cv.height = 256;
		const ctx = cv.getContext('2d');
		const g = ctx.createLinearGradient(0, 0, 256, 256);
		g.addColorStop(0, '#fdf8ea');
		g.addColorStop(1, '#e8dfc8');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 256, 256);
		ctx.strokeStyle = 'rgba(120,100,60,0.35)';
		ctx.lineWidth = 10;
		ctx.strokeRect(5, 5, 246, 246);
		ctx.fillStyle = '#1c1a16';
		for (const [px, py] of PIPS[n]) {
			ctx.beginPath();
			ctx.arc(128 + px * 62, 128 + py * 62, 24, 0, Math.PI * 2);
			ctx.fill();
		}
		const tex = new THREE.CanvasTexture(cv);
		tex.colorSpace = THREE.SRGBColorSpace;
		mats.push(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, metalness: 0 }));
	}
	return mats;
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;
	if (!dieMaterials) dieMaterials = makeDieMaterials();

	const restore = dimLights(scene, 0.5, 700);
	scene.fxLight.color.set(0xfff3cf);
	scene.fxLight.position.set(0, 0.5, 2);
	scene.fxLight.intensity = 2.5;

	const FLOOR = -1.28;
	const dice = [];
	for (let i = 0; i < 5; i++) {
		const die = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.42), dieMaterials);
		// z stays in front of the machine (face + clamps reach z≈0.45)
		die.position.set(-3.2 - i * 0.7, rand(0.4, 1.6), rand(0.68, 1));
		die.userData.vel = new THREE.Vector3(rand(2.8, 4), rand(0.5, 2), rand(-0.1, 0.1));
		die.userData.ang = new THREE.Vector3(rand(-7, 7), rand(-7, 7), rand(-7, 7));
		die.userData.entering = true;
		scene.scene.add(die);
		dice.push(die);
	}

	let tumbling = true;
	const stopSim = scene.addUpdatable((dt) => {
		if (!tumbling) return;
		for (const die of dice) {
			const v = die.userData.vel;
			v.y -= 4.2 * dt;
			die.position.addScaledVector(v, dt);
			die.rotation.x += die.userData.ang.x * dt;
			die.rotation.y += die.userData.ang.y * dt;
			die.rotation.z += die.userData.ang.z * dt;
			if (die.position.y < FLOOR && v.y < 0) {
				die.position.y = FLOOR;
				v.y *= -0.52;
				v.x *= 0.9;
				die.userData.ang.multiplyScalar(0.75);
				if (Math.abs(v.y) > 0.7) {
					scene.shake(0.12);
					haptics.vibrate(18);
					particles.burst({
						texture: sprites.spark,
						count: 8,
						origin: die.position.clone(),
						speed: [0.4, 1.2],
						life: [0.2, 0.5],
						size: [0.02, 0.05],
						colors: [0xfff3cf, 0xffffff]
					});
				}
			}
			// only reflect when moving outward — dice spawn beyond the left wall
			if (die.position.x > 2.1 && v.x > 0) v.x = -v.x * 0.85;
			if (die.position.x < -2.1 && v.x < 0 && !die.userData.entering) v.x = -v.x * 0.85;
			if (die.position.x > -2.1) die.userData.entering = false;
			// and never drift back into the machine face
			if (die.position.z < 0.68 && v.z < 0) v.z = -v.z;
			if (die.position.z > 1.05 && v.z > 0) v.z = -v.z;
		}
	});

	await delay(3800);
	tumbling = false;
	stopSim();

	// snap every die to a SIX on TOP — the face that counts is the one facing
	// the ceiling. (material order puts the 6 on -x; rotation.z = -π/2 turns
	// -x up, then a lean toward the camera presents it to the player)
	haptics.vibrate([25, 40, 25]);
	const near = (from, to) => to + Math.round((from - to) / (Math.PI * 2)) * Math.PI * 2;
	// hop into a tidy centred row, in current left-to-right order
	const slots = [-1.3, -0.65, 0, 0.65, 1.3];
	const row = [...dice].sort((a, b) => a.position.x - b.position.x);
	await Promise.all(
		row.map((die, i) => {
			const from = die.rotation.clone();
			const fx = die.position.x;
			const fz = die.position.z;
			const snap = { x: near(from.x, 0.5), y: near(from.y, 0), z: near(from.z, -Math.PI / 2) };
			return tween(420 + i * 70, 'outBack', (v) => {
				die.rotation.x = from.x + (snap.x - from.x) * v;
				die.rotation.y = from.y + (snap.y - from.y) * v;
				die.rotation.z = from.z + (snap.z - from.z) * v;
				die.position.x = fx + (slots[i] - fx) * v;
				die.position.z = fz + (0.85 - fz) * v;
				die.position.y = FLOOR + Math.sin(v * Math.PI) * 0.15 + v * 0.08;
			});
		})
	);

	// LUCKY ROLL! everything comes up gold
	await delay(500);
	scene.shake(0.35);
	haptics.vibrate([60, 50, 60, 50, 140]);
	for (const die of dice) {
		particles.burst({
			texture: sprites.star4,
			count: 22,
			origin: die.position.clone(),
			speed: [0.8, 2.4],
			life: [0.5, 1.2],
			size: [0.03, 0.09],
			colors: [0xffd27a, 0xfff3cf, 0xffffff]
		});
	}
	await flashPulse(machine, 0.85, 90, 750, 0xffe9ad);

	// the dice detonate one by one into glitter sparkles
	await Promise.all(
		dice.map((die, i) =>
			delay(i * 90).then(async () => {
				await tween(160, 'inQuad', (v) => die.scale.setScalar(1 + v * 0.35));
				scene.shake(0.18);
				haptics.vibrate(20);
				particles.burst({
					texture: sprites.star4,
					count: 46,
					origin: die.position.clone(),
					speed: [1, 3.4],
					life: [0.6, 1.5],
					size: [0.03, 0.1],
					colors: [0xffd27a, 0xfff3cf, 0xffffff, 0x9adfff]
				});
				particles.burst({
					texture: sprites.softDot,
					count: 20,
					origin: die.position.clone(),
					speed: [0.4, 1.4],
					life: [0.5, 1],
					size: [0.05, 0.12],
					colors: [0xfff3cf, 0xffffff]
				});
				die.visible = false;
			})
		)
	);
	for (const die of dice) {
		scene.scene.remove(die);
		die.geometry.dispose();
	}
	scene.fxLight.intensity = 0;
	await restore(900);
}
