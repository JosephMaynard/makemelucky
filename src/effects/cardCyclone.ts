// Effect 20 — CARD CYCLONE: a tornado of playing cards whirls around the
// machine, then five of them snap into a royal flush right in your face.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'charmAward';
export const duration = 10500;

const SUITS: Record<string, [string, string]> = { h: ['♥', '#c22318'], d: ['♦', '#c22318'], s: ['♠', '#1c1a16'], c: ['♣', '#1c1a16'] };
let cardCache: THREE.MeshStandardMaterial[] | null = null;

function cardTexture(rank: string, suitKey: string) {
	const [glyph, color] = SUITS[suitKey];
	const cv = document.createElement('canvas');
	cv.width = 192;
	cv.height = 268;
	const ctx = cv.getContext('2d')!;
	const g = ctx.createLinearGradient(0, 0, 0, 268);
	g.addColorStop(0, '#fdfbf4');
	g.addColorStop(1, '#efe9da');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 192, 268);
	ctx.strokeStyle = 'rgba(60,50,30,0.4)';
	ctx.lineWidth = 6;
	ctx.strokeRect(4, 4, 184, 260);
	ctx.fillStyle = color;
	ctx.textAlign = 'center';
	ctx.font = 'bold 46px Georgia, serif';
	ctx.fillText(rank, 32, 54);
	ctx.font = '38px Georgia, serif';
	ctx.fillText(glyph, 32, 92);
	ctx.save();
	ctx.translate(160, 214);
	ctx.rotate(Math.PI);
	ctx.font = 'bold 46px Georgia, serif';
	ctx.fillText(rank, 0, 0);
	ctx.font = '38px Georgia, serif';
	ctx.fillText(glyph, 0, 38);
	ctx.restore();
	ctx.font = '110px Georgia, serif';
	ctx.fillText(glyph, 96, 172);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

function buildDeck() {
	// the royal flush of hearts first, then a swirl of extras
	const specs = [
		['10', 'h'], ['J', 'h'], ['Q', 'h'], ['K', 'h'], ['A', 'h'],
		['A', 's'], ['7', 'd'], ['3', 'c'], ['9', 's'], ['J', 'c'],
		['5', 'd'], ['Q', 's'], ['2', 'h'], ['8', 'd'], ['K', 'c'],
		['4', 's'], ['6', 'h'], ['A', 'd']
	];
	return specs.map(([r, s]) =>
		new THREE.MeshStandardMaterial({
			map: cardTexture(r, s),
			roughness: 0.55,
			metalness: 0,
			side: THREE.DoubleSide
		})
	);
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;
	if (!cardCache) cardCache = buildDeck();

	const restore = dimLights(scene, 0.32, 800);
	scene.fxLight.color.set(0xfff3cf);
	scene.fxLight.position.set(0, 0.4, 1.6);
	tween(800, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3));

	const geo = new THREE.PlaneGeometry(0.3, 0.42);
	const cards = cardCache.map((mat, i) => {
		const m = new THREE.Mesh(geo, mat);
		m.userData.orbit = {
			ang: (i / cardCache!.length) * Math.PI * 2,
			radius: rand(1.15, 2.05),
			y: rand(-1.3, -0.6),
			speed: rand(2.2, 3.6),
			rise: rand(0.45, 0.8),
			tumble: rand(2, 5)
		};
		m.position.set(10, 0, 0); // parked offscreen until the sim places it
		scene.scene.add(m);
		return m;
	});

	// the cyclone: cards spiral up and around the machine
	let spinning = true;
	const stopSpin = scene.addUpdatable((dt, t) => {
		if (!spinning) return;
		for (const card of cards) {
			const o = card.userData.orbit;
			o.ang += o.speed * dt;
			o.y += o.rise * dt;
			if (o.y > 1.5) o.y = -1.45; // recycle to the floor
			// deep z swing: well in front of the machine, or fully behind it —
			// never slicing through the face rings
			card.position.set(Math.cos(o.ang) * o.radius, o.y, 0.72 + Math.sin(o.ang) * 0.98);
			card.rotation.set(Math.sin(t * o.tumble + o.ang) * 0.6, o.ang + Math.PI / 2, t * o.tumble * 0.35);
		}
	});
	haptics.vibrate([20, 40, 20]);
	audio.sfx('swoosh', { gain: 0.5 });
	const wind = particles.emitter({
		texture: sprites.softDot,
		count: 160,
		emitRate: 55,
		origin: new THREE.Vector3(0, -0.4, 0.5),
		originSpread: 1.6,
		speed: [0.2, 0.6],
		gravity: new THREE.Vector3(0, 0.5, 0),
		life: [0.7, 1.4],
		size: [0.015, 0.04],
		colors: [0xfff3cf, 0xffffff]
	});

	await delay(4200);

	// ROYAL FLUSH! the first five cards snap into a fan facing the camera
	spinning = false;
	wind.stop();
	haptics.vibrate([30, 40, 30, 40, 90]);
	const flush = cards.slice(0, 5);
	const extras = cards.slice(5);
	// the rest scatter away and fade
	for (const card of extras) {
		const dir = card.position.clone().setZ(0).normalize();
		tween(700, 'inQuad', (v) => {
			card.position.addScaledVector(dir, v * 0.22);
			card.scale.setScalar(1 - v);
		});
	}
	await Promise.all(
		flush.map((card, i) => {
			const from = { p: card.position.clone(), r: card.rotation.clone() };
			const to = {
				x: (i - 2) * 0.44,
				y: -0.05 + Math.abs(i - 2) * -0.07,
				z: 1.7,
				rz: (i - 2) * -0.18
			};
			audio.sfx('swoosh', { pitch: 1.1 + i * 0.08, gain: 0.6 });
			return tween(650 + i * 80, 'outBack', (v) => {
				card.position.set(
					from.p.x + (to.x - from.p.x) * v,
					from.p.y + (to.y - from.p.y) * v,
					from.p.z + (to.z - from.p.z) * v
				);
				card.rotation.set(from.r.x * (1 - v), from.r.y * (1 - v), from.r.z + (to.rz - from.r.z) * v);
				card.scale.setScalar(1 + v * 0.35);
			});
		})
	);
	audio.sfx('gong', { pitch: 1.2, gain: 0.7 });

	// hold the winning hand, sparkling
	scene.shake(0.25);
	particles.burst({
		texture: sprites.star4,
		count: 50,
		origin: new THREE.Vector3(0, -0.1, 1.6),
		speed: [0.8, 2.6],
		life: [0.6, 1.3],
		size: [0.03, 0.09],
		colors: [0xffffff, 0xffd27a, 0xff9ad0]
	});
	machine.setInnerGlow(0.5, 0xffd27a);
	await flashPulse(machine, 0.8, 90, 700, 0xfff3cf);
	await delay(1100);

	// the hand bows out — cards flip away over the top
	haptics.vibrate(25);
	await Promise.all(
		flush.map((card, i) =>
			tween(550 + i * 60, 'inQuad', (v) => {
				card.position.y += 0.045;
				card.rotation.x = v * Math.PI * 2;
				card.scale.setScalar(1.35 * (1 - v));
			})
		)
	);

	stopSpin();
	for (const card of cards) {
		scene.scene.remove(card);
		card.scale.setScalar(1);
	}
	geo.dispose();
	tween(600, 'outQuad', (v) => {
		machine.setInnerGlow(0.5 * (1 - v));
		scene.fxLight.intensity = 3 * (1 - v);
	});
	await restore(900);
}
