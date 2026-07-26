// Effect — WISHING WELL: the iris opens on black water and coins are thrown in
// FROM the viewer's side of the glass, tumbling away from the camera into the
// dark. Each one lands with a plink and a ring of ripples. Then the well answers:
// a single slow bubble climbs out of the bore and pops into a wish.
//
// The throw direction is the whole trick — nothing else in the roster moves away
// from the camera, so the depth reads instantly as "down a well".

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import { backdropWipe } from '../gfx/quiltWipe';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'buttonFall';
export const duration = 9800;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();

	const restore = dimLights(scene, 0.26, 900);
	scene.crossfadeEnvironment('nightSky', 900);
	// moonlit stone: the room goes cold before the water appears
	const wipe = backdropWipe(machine.backdrop, ctx.textures.quilt.map, 'ice');
	wipe.in(2000);
	scene.fxLight.color.set(0x86c5e8);
	scene.fxLight.position.set(0, 0.6, 1.6);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.6));

	// ---- open the well. Three things have to happen together or it reads as a
	// broken machine rather than a shaft: the iris opens, the button SINKS out of
	// sight down it (left where it is, it covers the entire water surface), and
	// the water is wide enough to fill the whole opening — otherwise you just see
	// the lounge wall through the gap.
	const btnHome = machine.buttonGroup.position.clone();
	const opening = machine.openIris(0.62, 1300);
	machine.portal.visible = false;
	machine.setInnerGlow(0.06, 0x86c5e8);
	tween(1300, 'inOutQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z - v * 1.5;
		machine.buttonGroup.scale.setScalar(1 - v * 0.75);
	});

	// The water surface. This started life as a ripple SHADER and never drew a
	// single pixel — injected test meshes at the same position rendered fine, so
	// the geometry and depth were right and the custom material was not. Rings
	// are what the rest of this codebase reaches for anyway (see helpers'
	// shockwave), they read better under bloom, and they cannot silently fail.
	//
	// It lives inside machine.centre so it tracks the machine's own origin — the
	// group hangs at scene y -0.32 and scene-space discs float too high.
	const waterMat = new THREE.MeshStandardMaterial({
		color: 0x07161f,
		roughness: 0.08,
		metalness: 0.35,
		envMapIntensity: 1.6
	});
	const water = new THREE.Mesh(new THREE.CircleGeometry(1.12, 64), waterMat);
	water.position.set(0, 0, -0.12);
	water.visible = false;
	machine.centre.add(water);

	const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
	/** One ring of ripples spreading from where a coin went in. */
	const ripple = (x: number, y: number, scale = 1) => {
		for (let i = 0; i < 2; i++) {
			const mat = new THREE.MeshBasicMaterial({
				color: 0x9fd8e8,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide
			});
			const ring = new THREE.Mesh(ringGeo, mat);
			ring.position.set(x, y, -0.1);
			ring.renderOrder = 6;
			machine.centre.add(ring);
			tween(900 + i * 260, 'outCubic', (v) => {
				ring.scale.setScalar(0.04 + v * 0.62 * scale);
				// swells in fast, then thins out as it spreads
				mat.opacity = Math.sin(Math.min(1, v * 1.6) * Math.PI) * (i ? 0.3 : 0.55);
			}).then(() => {
				machine.centre.remove(ring);
				mat.dispose();
			});
		}
	};

	await opening;
	water.visible = true;
	tween(600, 'inOutQuad', (v) => {
		waterMat.color.setRGB(0.027 * v, 0.086 * v, 0.122 * v);
	});

	// ---- the coins, thrown from behind the glass. They spawn near the camera
	// (z 4.2 of 5.35) and fly AWAY, so perspective shrinks them down the shaft.
	const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24);
	const coinMat = new THREE.MeshStandardMaterial({
		color: 0xd9a842,
		metalness: 0.95,
		roughness: 0.3,
		emissive: 0x4a3410,
		emissiveIntensity: 0.6
	});
	const throwCoin = async (offX: number, offY: number, flightMs: number) => {
		const coin = new THREE.Mesh(coinGeo, coinMat);
		const spin = new THREE.Group();
		spin.add(coin);
		coin.rotation.x = Math.PI / 2;
		spin.position.set(btn.x + offX, btn.y + offY + 1.1, 4.2);
		spin.scale.setScalar(0.12);
		scene.scene.add(spin);
		audio.sfx('swoosh', { pitch: 1.5, gain: 0.3 });
		const tumble = rand(5, 8);
		const land = new THREE.Vector3(btn.x + offX * 0.16, btn.y + offY * 0.16, -0.1);
		await tween(flightMs, 'inQuad', (v) => {
			spin.position.lerpVectors(
				new THREE.Vector3(btn.x + offX, btn.y + offY + 1.1, 4.2),
				land,
				v
			);
			// a shallow arc up before it drops in
			spin.position.y += Math.sin(Math.PI * v) * 0.22;
			spin.rotation.x = v * tumble;
			spin.rotation.z = v * tumble * 0.4;
			spin.scale.setScalar(0.12 * (1 - v * 0.35));
		});
		scene.scene.remove(spin);
		// plink
		audio.sfx('pop', { pitch: rand(1.5, 2.1), gain: 0.4 });
		audio.sfx('ding', { pitch: rand(1.6, 2.2), gain: 0.22 });
		haptics.vibrate(14);
		ripple(offX * 0.4, offY * 0.4);
		particles.burst({
			texture: sprites.softDot,
			count: 16,
			origin: new THREE.Vector3(btn.x + offX * 0.16, btn.y + offY * 0.16, 0.05),
			originSpread: 0.05,
			direction: new THREE.Vector3(0, 1, 0.35),
			cone: 0.55,
			speed: [0.5, 1.5],
			gravity: new THREE.Vector3(0, -3.4, 0),
			life: [0.35, 0.8],
			size: [0.02, 0.06],
			colors: [0xdfeef2, 0x9fd8e8, 0xffffff],
			fadeIn: 0.03
		});
		machine.setInnerGlow(0.1, 0x86c5e8);
	};

	await delay(260);
	await throwCoin(-0.5, 0.1, 780);
	await delay(240);
	await throwCoin(0.55, -0.05, 720);
	await delay(200);
	await throwCoin(-0.15, 0.2, 660);
	await delay(160);
	await throwCoin(0.28, 0.12, 600);

	// ---- the well answers
	await delay(420);
	audio.sfx('gulp', { pitch: 0.55, gain: 0.5 });
	haptics.vibrate([18, 50, 24]);
	ripple(0, 0, 1.7); // the well stirs from the middle
	tween(900, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.1 + v * 0.42, 0x9fd8e8);
		scene.fxLight.intensity = 1.6 + v * 2.4;
	});
	// a fat bubble climbs out of the shaft, wobbling
	const bubbleMat = new THREE.MeshPhysicalMaterial({
		color: 0xbfe8f4,
		transparent: true,
		opacity: 0.42,
		roughness: 0.06,
		metalness: 0,
		clearcoat: 1,
		side: THREE.DoubleSide
	});
	const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 24), bubbleMat);
	bubble.position.set(btn.x, btn.y, 0.1);
	bubble.scale.setScalar(0.001);
	scene.scene.add(bubble);
	const rising = particles.emitter({
		texture: sprites.softDot,
		count: 120,
		emitRate: 42,
		origin: new THREE.Vector3(btn.x, btn.y, 0.2),
		originSpread: 0.18,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.3,
		speed: [0.3, 0.9],
		life: [0.9, 1.8],
		size: [0.02, 0.06],
		colors: [0xbfe8f4, 0xffffff, 0x86c5e8],
		fadeIn: 0.2
	});
	await tween(1500, 'outQuad', (v) => {
		bubble.scale.setScalar(Math.max(0.001, v * (1 + Math.sin(v * 9) * 0.06)));
		bubble.position.y = btn.y + v * 0.85;
		bubble.position.x = btn.x + Math.sin(v * 7) * 0.07;
		bubble.position.z = 0.1 + v * 0.7;
		bubbleMat.opacity = 0.42 + v * 0.24;
	});

	// ---- pop
	audio.sfx('pop', { pitch: 0.85, gain: 0.6 });
	audio.sfx('chime', { pitch: 1.15, gain: 0.5 });
	haptics.vibrate([25, 30, 80]);
	scene.shake(0.2);
	rising.stop();
	flashPulse(machine, 0.5, 110, 640, 0xd8f2ff);
	particles.burst({
		texture: sprites.star4,
		count: 70,
		origin: bubble.position.clone(),
		speed: [1.2, 3.4],
		gravity: new THREE.Vector3(0, -1.6, 0),
		life: [0.6, 1.4],
		size: [0.03, 0.1],
		colors: [0xffffff, 0xbfe8f4, 0xffe6a8]
	});
	scene.scene.remove(bubble);
	bubble.geometry.dispose();
	bubbleMat.dispose();

	await luckyWord(ctx, {
		text: 'WISH MADE',
		color: 0xbfe8f4,
		colorB: 0xffe6a8,
		gather: 800,
		hold: 1000,
		scatter: 550
	});

	// ---- teardown: the water drains, the button floats back up, the well closes
	tween(700, 'inOutQuad', (v) => waterMat.color.setRGB(0.027 * (1 - v), 0.086 * (1 - v), 0.122 * (1 - v)));
	tween(900, 'outCubic', (v) => {
		machine.buttonGroup.position.z = btnHome.z - 1.5 * (1 - v);
		machine.buttonGroup.scale.setScalar(0.25 + v * 0.75);
	});
	await machine.closeIris(1100);
	machine.buttonGroup.position.copy(btnHome);
	machine.buttonGroup.scale.setScalar(1);
	machine.centre.remove(water);
	water.geometry.dispose();
	ringGeo.dispose();
	waterMat.dispose();
	coinGeo.dispose();
	coinMat.dispose();
	machine.portal.visible = false;
	wipe.out(1000);
	scene.crossfadeEnvironment('lounge');
	tween(800, 'outQuad', (v) => {
		machine.setInnerGlow(0.52 * (1 - v));
		scene.fxLight.intensity = 4 * (1 - v);
	});
	await restore(900);
}
