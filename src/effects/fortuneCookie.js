// Effect — FORTUNE COOKIE: a giant tan cookie floats in, bobbing, strains
// against itself and CRACKS open. A glowing paper slip rises to the camera —
// YOU WILL BE LUCKY ☘ — holds, then dissolves into a shower of stars.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'charmAward';
export const duration = 9500;

/** The little cream fortune slip, drawn once per play. */
function fortuneTexture() {
	const cv = document.createElement('canvas');
	cv.width = 512;
	cv.height = 224;
	const ctx = cv.getContext('2d');
	ctx.fillStyle = '#f3ead2';
	ctx.fillRect(0, 0, 512, 224);
	// a soft printed border
	ctx.strokeStyle = 'rgba(120,90,40,0.4)';
	ctx.lineWidth = 6;
	ctx.strokeRect(12, 12, 488, 200);
	ctx.strokeStyle = 'rgba(120,90,40,0.2)';
	ctx.lineWidth = 2;
	ctx.strokeRect(24, 24, 464, 176);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = '#2a2114';
	ctx.font = 'italic 40px Georgia, serif';
	ctx.fillText('YOU WILL BE', 256, 80);
	ctx.font = 'bold 76px Georgia, serif';
	ctx.fillText('LUCKY', 214, 150);
	ctx.fillStyle = '#2e7d32';
	ctx.font = '66px Georgia, serif';
	ctx.fillText('☘', 372, 150);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.4, 700);
	scene.fxLight.color.set(0xffe6b0);
	scene.fxLight.position.set(0, 0.2, 1.8);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.6));

	// ---- the cookie: two folded tan lobes leaning into a pinched central seam
	const cookieMat = new THREE.MeshStandardMaterial({
		color: 0xd7a24a,
		roughness: 0.6,
		metalness: 0,
		transparent: true
	});
	const lobeGeo = new THREE.SphereGeometry(0.55, 30, 20);
	const cookie = new THREE.Group();
	const halves = [];
	for (const side of [-1, 1]) {
		const half = new THREE.Mesh(lobeGeo, cookieMat);
		half.scale.set(1.15, 0.82, 0.58);
		half.position.x = side * 0.24;
		half.rotation.z = side * 0.5; // fold the two wings toward each other
		half.userData.side = side;
		cookie.add(half);
		halves.push(half);
	}
	cookie.position.set(0, -1.2, 0.9);
	cookie.scale.setScalar(0.01);
	scene.scene.add(cookie);

	// continuous bob + wobble; later phases retune or switch it off
	const bob = { baseY: 0.1, amp: 0.06, wob: 0.05, on: true };
	const stopBob = scene.addUpdatable((dt, t) => {
		if (!bob.on) return;
		cookie.position.y = bob.baseY + Math.sin(t * 1.8) * bob.amp;
		cookie.rotation.z = Math.sin(t * 1.3) * bob.wob;
	});

	// float in to centre-front
	haptics.vibrate(20);
	await tween(1050, 'outBack', (v) => cookie.scale.setScalar(v));
	await delay(650);

	// STRAIN — three squeezing pulses, the cookie fighting to stay whole
	for (let i = 0; i < 3; i++) {
		haptics.vibrate(28 + i * 16);
		await tween(200, 'outQuad', (v) => cookie.scale.setScalar(1 - v * 0.09));
		await tween(180, 'inQuad', (v) => cookie.scale.setScalar(0.91 + v * 0.09));
		await delay(180);
	}

	// CRACK! the halves burst apart
	bob.on = false;
	cookie.rotation.z = 0;
	cookie.position.set(0, bob.baseY, 0.9);
	audio.sfx('pop');
	haptics.vibrate([40, 30, 90]);
	scene.shake(0.35);
	const centre = cookie.position.clone();
	particles.burst({
		texture: sprites.softDot,
		count: 42,
		origin: centre.clone(),
		speed: [0.6, 2.3],
		gravity: new THREE.Vector3(0, -2.6, 0),
		life: [0.5, 1.1],
		size: [0.03, 0.11],
		colors: [0xd7a24a, 0xc08a34, 0xe8c079, 0xfff0cf]
	});
	particles.burst({
		texture: sprites.spark,
		count: 24,
		origin: centre.clone(),
		speed: [1, 3.1],
		life: [0.25, 0.6],
		size: [0.03, 0.08],
		colors: [0xffffff, 0xffe6b0, 0xffd27a]
	});
	// each half swings open then keeps tumbling away and fading
	for (const half of halves) {
		const s = half.userData.side;
		const from = { x: half.position.x, y: half.position.y, rz: half.rotation.z };
		tween(2600, 'outQuad', (v) => {
			half.position.x = from.x + s * (v * 0.5 + v * v * 1.1);
			half.position.y = from.y + Math.sin(v * Math.PI) * 0.15 - v * v * 1.25;
			half.rotation.z = from.rz + s * v * 2.2;
			half.rotation.x = v * 3;
		});
	}
	tween(2600, 'linear', (v) => (cookieMat.opacity = 1 - v));

	// ---- the fortune slip rises out and toward the camera
	await delay(450);
	const slipTex = fortuneTexture();
	const slipMat = new THREE.MeshBasicMaterial({
		map: slipTex,
		transparent: true,
		side: THREE.DoubleSide,
		opacity: 0
	});
	const slipGeo = new THREE.PlaneGeometry(0.92, 0.4);
	const slip = new THREE.Mesh(slipGeo, slipMat);
	slip.position.set(0, bob.baseY, 0.95);
	slip.scale.setScalar(0.4);
	scene.scene.add(slip);
	// a soft glow riding just behind the paper
	const glowMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xffe6b0,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const glow = new THREE.Sprite(glowMat);
	glow.scale.setScalar(2.2);
	scene.scene.add(glow);

	audio.sfx('chime');
	await tween(950, 'outCubic', (v) => {
		slip.position.z = 0.95 + v * 0.65; // toward the camera, to z ~1.6
		slip.scale.setScalar(0.4 + v * 0.9);
		slipMat.opacity = Math.min(1, v * 1.6);
		glow.position.set(slip.position.x, slip.position.y, slip.position.z - 0.15);
		glowMat.opacity = v * 0.8;
	});

	// hold the fortune, shimmering
	await delay(300);
	const holdStop = scene.addUpdatable((dt, t) => {
		slip.rotation.z = Math.sin(t * 2) * 0.04;
		slip.position.y = bob.baseY + Math.sin(t * 1.6) * 0.03;
		glow.position.y = slip.position.y;
		glowMat.opacity = 0.72 + Math.sin(t * 4) * 0.12;
	});
	await delay(1600);
	holdStop();

	// ---- dissolve into star sparkles, and the big finale flash
	audio.sfx('chime', { pitch: 1.3 });
	particles.burst({
		texture: sprites.star4,
		count: 72,
		origin: slip.position.clone(),
		originSpread: 0.4,
		speed: [0.6, 2.7],
		life: [0.6, 1.5],
		size: [0.03, 0.1],
		colors: [0xffffff, 0xffe6b0, 0xffd27a, 0x9adfff]
	});
	tween(500, 'inQuad', (v) => {
		slipMat.opacity = 1 - v;
		slip.scale.setScalar(1.3 + v * 0.4);
		glowMat.opacity = 0.72 * (1 - v);
	});
	scene.shake(0.2);
	await flashPulse(machine, 0.8, 90, 750, 0xffe9ad);

	// ---- teardown: restore the scene exactly
	stopBob();
	scene.scene.remove(cookie, slip, glow);
	lobeGeo.dispose();
	cookieMat.dispose();
	slipGeo.dispose();
	slipMat.dispose();
	slipTex.dispose();
	glowMat.dispose();
	scene.fxLight.intensity = 0;
	await restore(900);
}
