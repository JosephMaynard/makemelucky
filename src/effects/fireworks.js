// Effect 11 — FIREWORKS: the lounge goes dark and the machine throws its own
// private celebration — rockets, chrysanthemum bursts, sparkle rain.

import * as THREE from 'three';
import { tween, delay, rand, pick } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'powerStreams';
export const duration = 10000;

const PALETTES = [
	[0xffd27a, 0xfff3cf, 0xffb54d],
	[0x6fe06a, 0xb8ffb0, 0x2fae4a],
	[0xff6a5c, 0xffb0a8, 0xff3d2a],
	[0x7ab8ff, 0xd0e8ff, 0x4a8ae0],
	[0xbf9aff, 0xe8d8ff, 0x8a5ce0]
];

async function launchRocket(ctx, x, apexY, palette, kind = 'peony') {
	const { scene, particles, sprites, haptics } = ctx;
	const origin = new THREE.Vector3(x * 0.3, -0.6, 0.3);

	// the rising comet: an emitter whose origin we drag along an arc
	const trail = particles.emitter({
		texture: sprites.softDot,
		count: 120,
		emitRate: 130,
		origin,
		originSpread: 0.01,
		speed: [0.02, 0.1],
		gravity: new THREE.Vector3(0, -0.35, 0),
		life: [0.25, 0.5],
		size: [0.015, 0.045],
		colors: [0xfff3cf, palette[0]]
	});
	await tween(rand(750, 950), 'outQuad', (v) => {
		origin.x = x * 0.3 + x * 0.7 * v;
		origin.y = -0.6 + (apexY + 0.6) * v;
		origin.z = 0.3 - v * 0.4;
	});
	trail.stop();

	// burst!
	haptics.vibrate(35);
	scene.fxLight.color.set(palette[0]);
	scene.fxLight.position.set(origin.x, origin.y, 1);
	scene.fxLight.intensity = 14;
	tween(650, 'outQuad', (v) => (scene.fxLight.intensity = 14 * (1 - v)));
	scene.shake(0.16);
	// core flash
	particles.burst({
		texture: sprites.softDot,
		count: 1,
		origin: origin.clone(),
		speed: [0, 0],
		gravity: new THREE.Vector3(0, 0, 0),
		life: [0.32, 0.32],
		size: [0.9, 0.9],
		colors: [palette[1]]
	});
	if (kind === 'willow') {
		// golden willow: long drooping trails of embers
		particles.burst({
			texture: sprites.softDot,
			count: 260,
			origin: origin.clone(),
			speed: [0.9, 2.2],
			gravity: new THREE.Vector3(0, -0.55, 0),
			drag: 0.994,
			life: [2.4, 3.8],
			size: [0.035, 0.08],
			colors: [0xffd27a, 0xf0b855, 0xfff3cf]
		});
	} else {
		particles.burst({
			texture: sprites.softDot,
			count: 210,
			origin: origin.clone(),
			speed: [1.8, 4],
			gravity: new THREE.Vector3(0, -0.9, 0),
			drag: 0.982,
			life: [1, 2.2],
			size: [0.05, 0.12],
			colors: palette
		});
		particles.burst({
			texture: sprites.star4,
			count: 50,
			origin: origin.clone(),
			speed: [1, 2.8],
			gravity: new THREE.Vector3(0, -0.75, 0),
			drag: 0.985,
			life: [1.4, 2.7],
			size: [0.05, 0.12],
			colors: [0xffffff, palette[1]]
		});
		// double-break: a second, smaller crack inside the bloom
		delay(rand(240, 420)).then(() => {
			particles.burst({
				texture: sprites.softDot,
				count: 70,
				origin: origin.clone().add(new THREE.Vector3(rand(-0.2, 0.2), rand(-0.3, 0), 0)),
				speed: [0.8, 1.8],
				gravity: new THREE.Vector3(0, -0.8, 0),
				drag: 0.984,
				life: [0.7, 1.4],
				size: [0.03, 0.07],
				colors: [0xffffff, palette[2]]
			});
		});
	}
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.18, 1200);
	machine.setInnerGlow(0.35, 0xffd27a);
	await delay(1000);
	const inFlight = [];

	// opening statement — a lone shell, then a pair
	inFlight.push(launchRocket(ctx, 0.2, 2, pick(PALETTES)));
	await delay(700);
	inFlight.push(launchRocket(ctx, -1.8, 1.6, pick(PALETTES)), launchRocket(ctx, 1.9, 1.8, pick(PALETTES)));
	await delay(800);

	// the display proper — rapid-fire, overlapping, sky filling up
	const volley = [-2.3, 1.2, -0.6, 2.4, 0.1, -1.5, 1.7, -2.6, 0.8, 2.1, -0.2, 1.4];
	for (let i = 0; i < volley.length; i++) {
		inFlight.push(launchRocket(ctx, volley[i], rand(1, 2.4), pick(PALETTES)));
		await delay(rand(140, 320)); // barely time to breathe between shells
	}
	await delay(500);

	// grand finale — a wall of simultaneous shells + golden willows
	haptics.vibrate([50, 60, 50, 60, 200]);
	inFlight.push(
		launchRocket(ctx, -2.4, 1.9, PALETTES[0]),
		launchRocket(ctx, -1.2, 2.3, PALETTES[1]),
		launchRocket(ctx, 0, 2.5, PALETTES[3]),
		launchRocket(ctx, 1.2, 2.2, PALETTES[4]),
		launchRocket(ctx, 2.4, 1.8, PALETTES[2]),
		launchRocket(ctx, -0.6, 1.5, [0xffd27a, 0xfff3cf, 0xffb54d], 'willow'),
		launchRocket(ctx, 0.7, 1.7, [0xffd27a, 0xfff3cf, 0xffb54d], 'willow')
	);
	await Promise.all(inFlight);
	flashPulse(machine, 0.9, 100, 900, 0xffe9ad);

	// sparkle rain drifting down through the dark
	const rain = particles.emitter({
		texture: sprites.star4,
		count: 160,
		emitRate: 50,
		origin: new THREE.Vector3(0, 2, 0.3),
		originSpread: 2.2,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.3,
		speed: [0.3, 0.8],
		gravity: new THREE.Vector3(0, -0.5, 0),
		life: [1.5, 2.8],
		size: [0.012, 0.04],
		colors: [0xfff3cf, 0xffffff, 0xffd27a]
	});
	await delay(1600);
	rain.stop();
	tween(700, 'outQuad', (v) => machine.setInnerGlow(0.25 * (1 - v)));
	await restore(1300);
}
