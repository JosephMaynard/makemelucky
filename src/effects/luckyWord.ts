// Shared set-piece: scattered motes from all over the screen drift together to
// spell a word (or one giant glyph) across the middle of the screen, a smoked-
// glass strip fading in behind it for contrast, then everything bursts apart.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import type { EffectContext } from '../types';

function textPoints(text: string): [number, number][] {
	const cv = document.createElement('canvas');
	cv.width = 512;
	cv.height = 160;
	const c = cv.getContext('2d')!;
	c.fillStyle = '#fff';
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	const family = "'Roboto Slab', Georgia, serif";
	let size = text.length <= 2 ? 148 : 108;
	c.font = `bold ${size}px ${family}`;
	const w = c.measureText(text).width;
	if (w > 470) {
		size = Math.floor((size * 470) / w); // long phrases shrink to fit
		c.font = `bold ${size}px ${family}`;
	}
	c.fillText(text, 256, 84);
	const img = c.getImageData(0, 0, 512, 160).data;
	const pts: [number, number][] = [];
	for (let y = 0; y < 160; y += 2) {
		for (let x = 0; x < 512; x += 2) {
			if (img[(y * 512 + x) * 4 + 3] > 120) pts.push([x, y]);
		}
	}
	return pts;
}

// smoked-glass backdrop: black rounded strip with feathered edges
let stripTexCache: THREE.CanvasTexture | null = null;
export function stripTexture(): THREE.CanvasTexture {
	if (stripTexCache) return stripTexCache;
	const cv = document.createElement('canvas');
	cv.width = 512;
	cv.height = 128;
	const c = cv.getContext('2d')!;
	c.filter = 'blur(7px)';
	c.fillStyle = '#000';
	c.beginPath();
	c.roundRect(24, 22, 464, 84, 34);
	c.fill();
	c.fill();
	c.fill(); // stacked fills = dense core, feathered edge
	// a gold hairline so the box reads as smoked glass, not a dim patch
	c.filter = 'blur(0.6px)';
	c.strokeStyle = 'rgba(240, 212, 136, 0.55)';
	c.lineWidth = 2.5;
	c.beginPath();
	c.roundRect(24, 22, 464, 84, 34);
	c.stroke();
	stripTexCache = new THREE.CanvasTexture(cv);
	return stripTexCache;
}

export interface LuckyWordOptions {
	text?: string;
	color?: THREE.ColorRepresentation;
	colorB?: THREE.ColorRepresentation;
	gather?: number;
	hold?: number;
	scatter?: number;
	width?: number;
	y?: number;
	z?: number;
	strip?: boolean;
}

export async function luckyWord(ctx: EffectContext, opts: LuckyWordOptions = {}): Promise<void> {
	const {
		text = 'LUCKY',
		color = 0xffd27a,
		colorB = 0xfff3cf,
		gather = 1500,
		hold = 1500,
		scatter = 900,
		width = 3.1,
		y: yPos = -0.1, // straight across the middle, over the button
		z = 1.25,
		strip: wantStrip = true
	} = opts;
	const { scene, sprites, haptics, audio } = ctx;

	let pts = textPoints(text);
	while (pts.length > 2000) pts = pts.filter((_, i) => i % 2 === 0);
	const n = pts.length;
	// never wider than the visible frame (phones are narrow)
	const cam = scene.camera;
	const visW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (5.35 - z) * cam.aspect * 2;
	const scale = Math.min(width, visW * 0.92) / 512;

	const positions = new Float32Array(n * 3);
	const colors = new Float32Array(n * 3);
	const start = new Float32Array(n * 3);
	const target = new Float32Array(n * 3);
	const stagger = new Float32Array(n);
	const cA = new THREE.Color(color);
	const cB = new THREE.Color(colorB);
	for (let i = 0; i < n; i++) {
		const [px, py] = pts[i];
		target[i * 3] = (px - 256) * scale;
		target[i * 3 + 1] = yPos + (80 - py) * scale;
		target[i * 3 + 2] = z + rand(-0.03, 0.03);
		start[i * 3] = rand(-2.6, 2.6);
		start[i * 3 + 1] = rand(-1.7, 1.6);
		start[i * 3 + 2] = z + rand(-0.5, 0.5);
		stagger[i] = rand(0, 0.35);
		const c = Math.random() < 0.5 ? cA : cB;
		colors[i * 3] = c.r;
		colors[i * 3 + 1] = c.g;
		colors[i * 3 + 2] = c.b;
		positions[i * 3] = start[i * 3];
		positions[i * 3 + 1] = start[i * 3 + 1];
		positions[i * 3 + 2] = start[i * 3 + 2];
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	const mat = new THREE.PointsMaterial({
		map: sprites.star4,
		size: 0.072,
		vertexColors: true,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false,
		sizeAttenuation: true
	});
	const points = new THREE.Points(geo, mat);
	points.renderOrder = 9; // the word floats over everything
	scene.scene.add(points);

	// the backdrop strip: starts big and invisible, shrinks + fades in as the
	// letters land, and leaves the same way
	const stripGeo = new THREE.PlaneGeometry(512 * scale * 1.06, Math.max(0.62, 160 * scale * 0.78));
	const stripMat = new THREE.MeshBasicMaterial({
		map: stripTexture(),
		transparent: true,
		opacity: 0,
		depthTest: false,
		depthWrite: false
	});
	const strip = new THREE.Mesh(stripGeo, stripMat);
	strip.renderOrder = 8; // just under the motes
	strip.position.set(0, yPos, z - 0.03);
	strip.visible = wantStrip;
	scene.scene.add(strip);

	// gather: every mote drifts from its scatter position to its letter pixel
	const ease = (t: number) => 1 - Math.pow(1 - t, 3);
	let P = 0;
	let shimmerT = 0;
	const stopGather = scene.addUpdatable((dt) => {
		shimmerT += dt;
		for (let i = 0; i < n; i++) {
			const p = ease(Math.min(1, Math.max(0, (P - stagger[i]) / 0.65)));
			const j = Math.sin(shimmerT * 7 + i * 1.7) * 0.012 * (p >= 1 ? 1 : 0.4);
			positions[i * 3] = start[i * 3] + (target[i * 3] - start[i * 3]) * p + j;
			positions[i * 3 + 1] = start[i * 3 + 1] + (target[i * 3 + 1] - start[i * 3 + 1]) * p + j * 0.7;
			positions[i * 3 + 2] = start[i * 3 + 2] + (target[i * 3 + 2] - start[i * 3 + 2]) * p;
		}
		geo.attributes.position.needsUpdate = true;
		// strip arrives with the last motes
		const s = ease(Math.min(1, Math.max(0, (P - 0.5) / 0.45)));
		stripMat.opacity = 0.9 * s;
		strip.scale.setScalar(1.35 - 0.35 * s);
	});

	tween(500, 'outQuad', (v) => (mat.opacity = v));
	await tween(gather, 'linear', (v) => (P = v));
	audio.sfx('chime', { pitch: 1.1 });
	haptics.vibrate([15, 25, 40]);
	await delay(hold);

	// dissipate: the word blows apart from its own centre, the strip grows away
	stopGather();
	const vel = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		vel[i * 3] = target[i * 3] * rand(0.7, 1.4) + rand(-0.5, 0.5);
		vel[i * 3 + 1] = (target[i * 3 + 1] - yPos) * rand(0.7, 1.4) + rand(0.3, 1.1);
		vel[i * 3 + 2] = rand(-0.3, 0.6);
	}
	const stopScatter = scene.addUpdatable((dt) => {
		for (let i = 0; i < n; i++) {
			positions[i * 3] += vel[i * 3] * dt;
			positions[i * 3 + 1] += (vel[i * 3 + 1] -= 2.2 * dt) * dt;
			positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
		}
		geo.attributes.position.needsUpdate = true;
	});
	await tween(scatter, 'inQuad', (v) => {
		mat.opacity = 1 - v;
		stripMat.opacity = 0.9 * (1 - v);
		strip.scale.setScalar(1 + 0.35 * v);
	});
	stopScatter();
	scene.scene.remove(points, strip);
	geo.dispose();
	mat.dispose();
	stripGeo.dispose();
	stripMat.dispose(); // texture is cached module-wide, keep it
}
