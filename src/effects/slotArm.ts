// Effect — SLOT ARM: the machine turns one-armed bandit. A giant gold lever
// slides in from the right, PULLS, and spins the Celtic face like a reel that
// ratchets to a stop on TRIPLE JACKPOT — dings, coins and a shockwave.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse, shockwave, disposeObject } from './helpers';

// Each 7 lands in its own casino reel window: deep maroon glass in a chunky
// gold bezel with corner studs — one shared texture, three planes.
let reelWinTexCache: THREE.CanvasTexture | null = null;
function reelWindowTexture(): THREE.CanvasTexture {
	if (reelWinTexCache) return reelWinTexCache;
	const cv = document.createElement('canvas');
	cv.width = 256;
	cv.height = 296;
	const c = cv.getContext('2d')!;
	const rr = (inset: number, r: number) => {
		c.beginPath();
		c.roundRect(inset, inset, 256 - inset * 2, 296 - inset * 2, r);
	};
	// deep maroon glass
	const glass = c.createLinearGradient(0, 0, 0, 296);
	glass.addColorStop(0, '#31070f');
	glass.addColorStop(0.5, '#0c0105');
	glass.addColorStop(1, '#20040b');
	c.fillStyle = glass;
	rr(10, 34);
	c.fill();
	// glass sheen across the top
	const sheen = c.createLinearGradient(0, 10, 0, 130);
	sheen.addColorStop(0, 'rgba(255,255,255,0.13)');
	sheen.addColorStop(1, 'rgba(255,255,255,0)');
	c.fillStyle = sheen;
	rr(10, 34);
	c.fill();
	// chunky gold bezel
	const gold = c.createLinearGradient(0, 0, 0, 296);
	gold.addColorStop(0, '#f6e2a4');
	gold.addColorStop(0.45, '#caa254');
	gold.addColorStop(1, '#8a6a26');
	c.strokeStyle = gold;
	c.lineWidth = 13;
	rr(10, 34);
	c.stroke();
	// inner hairline
	c.strokeStyle = 'rgba(240,212,136,0.6)';
	c.lineWidth = 3;
	rr(26, 22);
	c.stroke();
	// corner studs
	c.fillStyle = '#f2d488';
	for (const [x, y] of [[30, 30], [226, 30], [30, 266], [226, 266]] as const) {
		c.beginPath();
		c.arc(x, y, 6, 0, Math.PI * 2);
		c.fill();
	}
	reelWinTexCache = new THREE.CanvasTexture(cv);
	return reelWinTexCache;
}
import type { EffectContext } from '../types';

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

export async function play(ctx: EffectContext): Promise<void> {
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
	// hauls TOWARD the player — the knob arcs out of the screen and down past
	// the pivot, like a real bandit arm, then springs back over-centre
	await tween(480, 'outCubic', (v) => (lever.rotation.x = v * 2.3));
	tween(1500, 'outElastic', (v) => (lever.rotation.x = 2.3 * (1 - v))); // wobble home

	// ---- the reel: accelerate → hold → ratcheting decel, clicks home at z=0.
	// While it spins, the WIN LINE fills in — a smoked-glass box across the
	// middle of the screen where the 7s land one by one, like reels stopping.
	let stopReel = () => {};
	const reelDone = new Promise<void>((resolve) => {
		let rot = 0;
		let vel = 0;
		let phaseT = 0;
		let mode = 'accel';
		let lastTick = 0;
		let ticks = 0;
		stopReel = scene.addUpdatable((dt: number) => {
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

	// three empty reel windows tick on across the payline while the reel turns
	const winGeo = new THREE.PlaneGeometry(0.66, 0.76);
	const slots = [-0.72, 0, 0.72];
	const windows = slots.map((x, i) => {
		const m = new THREE.MeshBasicMaterial({
			map: reelWindowTexture(),
			transparent: true,
			opacity: 0,
			depthTest: false,
			depthWrite: false
		});
		const win = new THREE.Mesh(winGeo, m);
		win.renderOrder = 9;
		win.position.set(x, -0.1, 1.28);
		scene.scene.add(win);
		void (async () => {
			await delay(120 + i * 110);
			audio.sfx('tick', { pitch: 1.4 + i * 0.2, gain: 0.35 });
			await tween(380, 'outBack', (v) => {
				m.opacity = Math.min(1, v) * 0.96;
				win.scale.setScalar(1.35 - 0.35 * v);
			});
		})();
		return win;
	});

	// three golden 7s pop out of the button into their windows MID-SPIN
	const sevens: THREE.Sprite[] = [];
	for (let i = 0; i < 3; i++) {
		await delay(i === 0 ? 900 : 950);
		audio.sfx('ding', { pitch: 1 + i * 0.15 });
		machine.setInnerGlow(0.6, 0xffd27a);
		tween(320, 'outQuad', (v) => machine.setInnerGlow(0.6 * (1 - v), 0xffd27a));
		scene.shake(0.18);
		haptics.vibrate([18, 26]);
		const seven = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: sprites.seven,
				color: 0xffd75e,
				transparent: true,
				depthTest: false
			})
		);
		seven.renderOrder = 10;
		seven.position.set(0, -0.32, 0.9);
		seven.scale.setScalar(0.05);
		scene.scene.add(seven);
		sevens.push(seven);
		const tx = slots[i];
		tween(450, 'outBack', (v) => {
			seven.position.set(tx * v, -0.32 + 0.22 * v, 0.9 + v * 0.45);
			seven.scale.setScalar(0.05 + v * 0.55);
		});
	}
	await reelDone;
	haptics.vibrate([30, 40, 30]);

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
	// the payline drifts up and melts away, each 7 rising with its window
	await Promise.all(
		sevens.map((seven, i) => {
			const fy = seven.position.y;
			const win = windows[i];
			return tween(550 + i * 90, 'inQuad', (v) => {
				seven.position.y = fy + v * 0.5;
				seven.material.opacity = 1 - v;
				win.position.y = -0.1 + v * 0.5;
				win.material.opacity = 0.96 * (1 - v);
			});
		})
	);
	for (const seven of sevens) {
		scene.scene.remove(seven);
		seven.material.dispose();
	}
	for (const win of windows) {
		scene.scene.remove(win);
		win.material.dispose();
	}
	winGeo.dispose(); // window texture is cached module-wide, keep it
	await machine.closeClamps(450);

	// ---- the lever slides back out to the right
	await delay(500);
	await tween(750, 'inCubic', (v) => (lever.position.x = pivotX + v * 1.9));

	// ---- teardown: restore everything exactly
	stopReel(); // defensive — the reel already stopped itself
	machine.faceSpin.rotation.z = 0;
	scene.scene.remove(lever);
	disposeObject(lever);
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	await restore(900);
}
