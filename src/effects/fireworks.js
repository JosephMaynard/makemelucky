// Effect 11 — FIREWORKS: the lounge goes dark and the machine throws its own
// private celebration — rockets, chrysanthemum bursts, ring shells, and a
// Sydney-Harbour-Bridge finale racing around the rim.

import * as THREE from 'three';
import { tween, delay, rand, pick } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'luckyFireworks';
export const duration = 11500;

const PALETTES = [
	[0xffd27a, 0xfff3cf, 0xffb54d],
	[0x6fe06a, 0xb8ffb0, 0x2fae4a],
	[0xff6a5c, 0xffb0a8, 0xff3d2a],
	[0x7ab8ff, 0xd0e8ff, 0x4a8ae0],
	[0xbf9aff, 0xe8d8ff, 0x8a5ce0]
];
const GOLD = [0xffd27a, 0xfff3cf, 0xffb54d];

/** The fancy one: shell explodes into a crisp expanding ring of stars. */
function ringShell(ctx, origin, palette, ringSpeed = 2.3, tilt = rand(-0.3, 0.3)) {
	const { particles, sprites } = ctx;
	const SPOKES = 30;
	for (let i = 0; i < SPOKES; i++) {
		const a = (i / SPOKES) * Math.PI * 2;
		const dir = new THREE.Vector3(
			Math.cos(a),
			Math.sin(a) * Math.cos(tilt),
			Math.sin(a) * Math.sin(tilt)
		).normalize();
		particles.burst({
			texture: sprites.softDot,
			count: 3,
			origin: origin.clone(),
			direction: dir,
			cone: 0.02,
			speed: [ringSpeed * 0.97, ringSpeed * 1.03],
			gravity: new THREE.Vector3(0, -0.35, 0),
			drag: 0.985,
			life: [1.3, 1.7],
			size: [0.05, 0.09],
			colors: [palette[0], palette[1]]
		});
	}
	// glitter left hanging in the middle of the hoop
	particles.burst({
		texture: sprites.star4,
		count: 24,
		origin: origin.clone(),
		speed: [0.3, 1],
		gravity: new THREE.Vector3(0, -0.3, 0),
		life: [0.8, 1.5],
		size: [0.04, 0.08],
		colors: [0xffffff, palette[1]]
	});
}

async function launchRocket(ctx, x, apexY, palette, kind = 'peony') {
	const { scene, particles, sprites, haptics, audio } = ctx;
	const origin = new THREE.Vector3(x * 0.3, -0.6, 0.3);

	// discrete launch — a soft whoosh as the shell leaves the tube
	audio.sfx('swoosh', { gain: 0.35, pitch: 1.3 });

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
		origin.z = 0.35 + v * 0.4; // arc TOWARD the camera — bursts bloom up front
	});
	trail.stop();

	// burst!
	haptics.vibrate(35);
	// booms scale with apex height as a proxy for burst size; the grand-finale
	// willows get their own lower, fuller boom
	const sizeScale = Math.min(1, Math.max(0, (apexY - 1) / 1.4));
	audio.sfx('boom', {
		pitch: kind === 'willow' ? 0.7 : 0.85 + Math.random() * 0.35,
		gain: kind === 'willow' ? 1 : 0.5 + sizeScale * 0.5
	});
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
		size: [1.15, 1.15],
		colors: [palette[1]]
	});
	if (kind === 'willow') {
		// golden willow: long drooping trails of embers
		particles.burst({
			texture: sprites.softDot,
			count: 320,
			origin: origin.clone(),
			speed: [0.9, 2.2],
			gravity: new THREE.Vector3(0, -0.55, 0),
			drag: 0.994,
			life: [2.4, 3.8],
			size: [0.035, 0.08],
			colors: GOLD
		});
	} else if (kind === 'ring') {
		ringShell(ctx, origin, palette, rand(2, 2.6));
	} else {
		particles.burst({
			texture: sprites.softDot,
			count: 340,
			origin: origin.clone(),
			speed: [1.8, 4.2],
			gravity: new THREE.Vector3(0, -0.9, 0),
			drag: 0.982,
			life: [1, 2.2],
			size: [0.05, 0.12],
			colors: palette
		});
		particles.burst({
			texture: sprites.star4,
			count: 90,
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
				count: 110,
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

/** Sydney-Harbour-Bridge finale: fountains race around the machine's rim from
 *  bottom-middle up BOTH sides at once, meeting at the top. */
async function bridgeRun(ctx) {
	const { particles, sprites, haptics, audio } = ctx;
	const R = 1.42;
	const CX = 0;
	const CY = -0.32;
	const spray = (th) => {
		const p = new THREE.Vector3(CX + Math.cos(th) * R, CY + Math.sin(th) * R, 0.55);
		const dir = new THREE.Vector3(Math.cos(th), Math.sin(th), 0.22).normalize();
		particles.burst({
			texture: sprites.spark,
			count: 24,
			origin: p,
			direction: dir,
			cone: 0.32,
			speed: [1.4, 3],
			gravity: new THREE.Vector3(0, -1.6, 0),
			life: [0.55, 1.1],
			size: [0.045, 0.1],
			colors: [0xffd27a, 0xfff3cf, 0xffffff]
		});
		// a hot core at the muzzle so the racing point itself reads
		particles.burst({
			texture: sprites.softDot,
			count: 3,
			origin: p.clone(),
			speed: [0.05, 0.2],
			life: [0.2, 0.35],
			size: [0.14, 0.2],
			colors: [0xfff3cf, 0xffffff]
		});
	};
	const STEPS = 13;
	for (let i = 0; i <= STEPS; i++) {
		const a = (i / STEPS) * Math.PI;
		if (i === 0 || i === STEPS) {
			spray(-Math.PI / 2 + a); // bottom start and top meeting point fire once
		} else {
			spray(-Math.PI / 2 - a); // racing up the left…
			spray(-Math.PI / 2 + a); // …and the right, in lockstep
		}
		if (i % 2 === 0) audio.sfx('pop', { pitch: 1.1 + Math.random() * 0.3, gain: 0.5 });
		haptics.vibrate(8);
		await delay(145);
	}
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.18, 1200);
	machine.setInnerGlow(0.35, 0xffd27a);
	await delay(600);
	const inFlight = [];

	// opening statement — a lone shell, then a pair
	inFlight.push(launchRocket(ctx, 0.2, 2, pick(PALETTES)));
	await delay(600);
	inFlight.push(launchRocket(ctx, -1.8, 1.6, pick(PALETTES)), launchRocket(ctx, 1.9, 1.8, pick(PALETTES)));
	await delay(650);

	// the display proper — rapid-fire and overlapping, with ring shells mixed in
	const volley = [-2.3, 1.2, -0.6, 2.4, 0.1, -1.5, 1.7, -2.6, 0.8, 2.1, -0.2, 1.4, -1.1, 2.5, -1.9, 0.5];
	for (let i = 0; i < volley.length; i++) {
		const kind = i === 5 || i === 11 ? 'ring' : 'peony';
		inFlight.push(launchRocket(ctx, volley[i], rand(1, 2.4), pick(PALETTES), kind));
		await delay(rand(120, 260));
	}
	await delay(350);

	// a wall of simultaneous shells + golden willows + one big hoop
	haptics.vibrate([50, 60, 50, 60, 200]);
	inFlight.push(
		launchRocket(ctx, -2.4, 1.9, PALETTES[0]),
		launchRocket(ctx, -1.2, 2.3, PALETTES[1]),
		launchRocket(ctx, 0, 2.5, PALETTES[3], 'ring'),
		launchRocket(ctx, 1.2, 2.2, PALETTES[4]),
		launchRocket(ctx, 2.4, 1.8, PALETTES[2]),
		launchRocket(ctx, -0.6, 1.5, GOLD, 'willow'),
		launchRocket(ctx, 0.7, 1.7, GOLD, 'willow')
	);
	await Promise.all(inFlight);

	// THE BRIDGE — sparks race around the machine's rim and meet at the top
	// (keep the glow whisper-quiet: anything more fogs the whole finale gold)
	machine.setOuterGlow(0.08, 0xffd27a);
	await bridgeRun(ctx);

	// they meet — a crown ring shell right above the machine
	audio.sfx('boom', { pitch: 0.7, gain: 1 });
	scene.shake(0.35);
	haptics.vibrate([60, 50, 160]);
	const crown = new THREE.Vector3(0, 1.18, 0.55);
	ringShell(ctx, crown, GOLD, 2.2, 0); // face-on hoop, dead centre
	particles.burst({
		texture: sprites.star4,
		count: 60,
		origin: crown.clone(),
		speed: [0.8, 2.4],
		gravity: new THREE.Vector3(0, -0.6, 0),
		life: [0.9, 1.8],
		size: [0.04, 0.1],
		colors: [0xffffff, 0xffd27a, 0xfff3cf]
	});
	flashPulse(machine, 0.4, 100, 700, 0xffe9ad); // gentle — the crown hoop is the star here
	audio.stopTrack('luckyFireworks', 900);
	tween(800, 'outQuad', (v) => machine.setOuterGlow(0.08 * (1 - v)));

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
	await delay(1400);
	rain.stop();
	tween(700, 'outQuad', (v) => machine.setInnerGlow(0.35 * (1 - v)));
	await restore(1300);
}
