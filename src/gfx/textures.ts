// Procedural texture factory. Everything is painted on canvas at load time so the
// machine stays razor sharp at any resolution — the 2015 renders were only ~400px.

import * as THREE from 'three';
import { fbmTile, fbm } from './noise';

function makeCanvas(size: number, height = size): HTMLCanvasElement {
	const c = document.createElement('canvas');
	c.width = size;
	c.height = height;
	return c;
}

interface ToTextureOptions {
	srgb?: boolean;
	repeat?: number;
}

function toTexture(canvas: HTMLCanvasElement, { srgb = true, repeat = 1 }: ToTextureOptions = {}): THREE.CanvasTexture {
	const tex = new THREE.CanvasTexture(canvas);
	if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 8;
	if (repeat !== 1) {
		tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
		tex.repeat.set(repeat, repeat);
	}
	return tex;
}

/** Sobel a greyscale height canvas into a tangent-space normal map. */
function heightToNormal(heightCanvas: HTMLCanvasElement, strength = 2.0, wrap = false): HTMLCanvasElement {
	const w = heightCanvas.width;
	const h = heightCanvas.height;
	const src = heightCanvas.getContext('2d')!.getImageData(0, 0, w, h).data;
	const out = makeCanvas(w, h);
	const ctx = out.getContext('2d')!;
	const img = ctx.createImageData(w, h);
	const d = img.data;
	const at = (x: number, y: number) => {
		if (wrap) {
			x = (x + w) % w;
			y = (y + h) % h;
		} else {
			x = Math.max(0, Math.min(w - 1, x));
			y = Math.max(0, Math.min(h - 1, y));
		}
		return src[(y * w + x) * 4] / 255;
	};
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const tl = at(x - 1, y - 1), t = at(x, y - 1), tr = at(x + 1, y - 1);
			const l = at(x - 1, y), r = at(x + 1, y);
			const bl = at(x - 1, y + 1), b = at(x, y + 1), br = at(x + 1, y + 1);
			const dx = (tr + 2 * r + br - tl - 2 * l - bl) * strength;
			const dy = (bl + 2 * b + br - tl - 2 * t - tr) * strength;
			const len = Math.sqrt(dx * dx + dy * dy + 1);
			const i = (y * w + x) * 4;
			d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
			d[i + 1] = ((dy / len) * 0.5 + 0.5) * 255; // three.js expects +Y up (OpenGL style); canvas Y is down
			d[i + 2] = (1 / len) * 255;
			d[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return out;
}

/* ============================================================
   Quilted green leather (tiling)
   ============================================================ */

export interface QuiltTextures {
	map: THREE.CanvasTexture;
	normalMap: THREE.CanvasTexture;
	roughnessMap: THREE.CanvasTexture;
}

export function createQuiltTextures(size = 512): QuiltTextures {
	const albedo = makeCanvas(size);
	const height = makeCanvas(size);
	const rough = makeCanvas(size);
	const a = albedo.getContext('2d')!;
	const hcx = height.getContext('2d')!;
	const r = rough.getContext('2d')!;

	const ai = a.createImageData(size, size);
	const hi = hcx.createImageData(size, size);
	const ri = r.createImageData(size, size);

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / size;
			const v = y / size;
			// 45°-rotated diamond cell
			let qx = u + v;
			let qy = u - v;
			const fx = qx - Math.floor(qx);
			const fy = qy - Math.floor(qy);
			const dx = Math.min(fx, 1 - fx) * 2; // 0 at seam, 1 at pillow centre
			const dy = Math.min(fy, 1 - fy) * 2;
			let pillow = Math.pow(Math.max(0, dx * dy), 0.42);

			// fine, expensive-looking leather grain (kept subtle — think Gatsby lounge)
			const grain = fbmTile(u * 24, v * 24, 24, 4, 7) - 0.5;
			const micro = fbmTile(u * 96, v * 96, 96, 2, 13) - 0.5;
			let hgt = pillow * 0.92 + grain * 0.026 + micro * 0.01;

			// stitches: dotted thread line near the seams
			const seam = Math.min(dx, dy);
			if (seam < 0.035) {
				const along = (dx < dy ? qy : qx) * 60;
				const dash = along - Math.floor(along);
				if (dash < 0.45) hgt += 0.03; // little thread bumps
			}

			const i = (y * size + x) * 4;
			const hh = Math.max(0, Math.min(1, hgt));
			hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = hh * 255;
			hi.data[i + 3] = 255;

			// deep emerald albedo: dark seams, rich lifted pillow tops
			const shade = 0.16 + pillow * 0.84;
			const tint = 1 + grain * 0.16;
			ai.data[i] = 24 * shade * tint + 3;
			ai.data[i + 1] = 92 * shade * tint + 6;
			ai.data[i + 2] = 30 * shade * tint + 4;
			ai.data[i + 3] = 255;

			// glossy sheen on the pillow tops, satin in the seams
			const rr = 0.48 - pillow * 0.3 + micro * 0.05;
			const rv = Math.max(0.13, Math.min(0.62, rr)) * 255;
			ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = rv;
			ri.data[i + 3] = 255;
		}
	}
	a.putImageData(ai, 0, 0);
	hcx.putImageData(hi, 0, 0);
	r.putImageData(ri, 0, 0);

	const normal = heightToNormal(height, 1.3, true);
	const REP = 22;
	return {
		map: toTexture(albedo, { repeat: REP }),
		normalMap: toTexture(normal, { srgb: false, repeat: REP }),
		roughnessMap: toTexture(rough, { srgb: false, repeat: REP })
	};
}

/* ============================================================
   Machine face — the full Celtic disc art
   Painted as one 2048px disc; height painted in parallel.
   Radius fractions map to machine radius 1.30 world units.
   ============================================================ */

const GOLD = ['#8a6a26', '#c9a959', '#f0d488', '#fff3cf'];
const SILVER = ['#5a646e', '#9aa7b2', '#ccd6de', '#f2f7fb'];

function metalGrad(
	ctx: CanvasRenderingContext2D,
	x0: number,
	y0: number,
	x1: number,
	y1: number,
	stops: readonly string[]
): CanvasGradient {
	const g = ctx.createLinearGradient(x0, y0, x1, y1);
	g.addColorStop(0, stops[1]);
	g.addColorStop(0.35, stops[3]);
	g.addColorStop(0.55, stops[2]);
	g.addColorStop(0.8, stops[0]);
	g.addColorStop(1, stops[1]);
	return g;
}

function drawTriquetra(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	radius: number,
	lineWidth: number,
	style: string | CanvasGradient,
	rotation = 0
) {
	// Three interlaced vesica arcs — the classic trinity knot.
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rotation);
	ctx.strokeStyle = style;
	ctx.lineWidth = lineWidth;
	ctx.lineCap = 'round';
	const r = radius * 0.62;
	for (let i = 0; i < 3; i++) {
		const a0 = (i / 3) * Math.PI * 2 - Math.PI / 2;
		const a1 = ((i + 1) / 3) * Math.PI * 2 - Math.PI / 2;
		const x0 = Math.cos(a0) * r;
		const y0 = Math.sin(a0) * r;
		const x1 = Math.cos(a1) * r;
		const y1 = Math.sin(a1) * r;
		const mx = Math.cos((a0 + a1) / 2) * radius * 1.35;
		const my = Math.sin((a0 + a1) / 2) * radius * 1.35;
		ctx.beginPath();
		ctx.moveTo(x0, y0);
		ctx.quadraticCurveTo(mx, my, x1, y1);
		ctx.stroke();
	}
	ctx.beginPath();
	ctx.arc(0, 0, r, 0, Math.PI * 2);
	ctx.stroke();
	ctx.restore();
}

function ringPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r0: number, r1: number) {
	ctx.beginPath();
	ctx.arc(cx, cy, r1, 0, Math.PI * 2);
	ctx.arc(cx, cy, r0, 0, Math.PI * 2, true);
}

export interface MachineFaceTextures {
	map: THREE.CanvasTexture;
	normalMap: THREE.CanvasTexture;
	roughnessMap: THREE.CanvasTexture;
	metalnessMap: THREE.CanvasTexture;
}

export function createMachineFaceTextures(size = 2048): MachineFaceTextures {
	const albedo = makeCanvas(size);
	const height = makeCanvas(1024);
	const rough = makeCanvas(1024);
	const metal = makeCanvas(1024);
	const A = albedo.getContext('2d')!;
	const H = height.getContext('2d')!;
	const R = rough.getContext('2d')!;
	const M = metal.getContext('2d')!;
	const c = size / 2;
	const hs = 1024 / size; // height-canvas scale

	// scale helpers paint both albedo (full res) and height (half res)
	const both = (fn: (ctx: CanvasRenderingContext2D, scale: number, isHeight?: boolean) => void) => {
		fn(A, 1);
		H.save();
		H.scale(hs, hs);
		fn(H, 1, true);
		H.restore();
	};

	// ---- base fills
	A.fillStyle = 'rgba(0,0,0,0)';
	A.clearRect(0, 0, size, size);
	H.fillStyle = '#000';
	H.fillRect(0, 0, 1024, 1024);
	R.fillStyle = '#666';
	R.fillRect(0, 0, 1024, 1024);
	M.fillStyle = '#000';
	M.fillRect(0, 0, 1024, 1024);

	const px = (f: number) => f * c; // radius fraction → px

	// ============ OUTER ORNAMENT BAND (silver + gold knotwork), r 0.78–0.985
	both((ctx) => {
		ringPath(ctx, c, c, px(0.79), px(0.985));
		ctx.fillStyle = metalGrad(ctx, 0, 0, size, size, SILVER);
		ctx.fill();
	});
	// height: raised dome across the band
	H.save();
	ringPath(H, 512, 512, px(0.79) * hs, px(0.985) * hs);
	const domeG = H.createRadialGradient(512, 512, px(0.78) * hs, 512, 512, px(0.985) * hs);
	domeG.addColorStop(0, '#404040');
	domeG.addColorStop(0.5, '#e0e0e0');
	domeG.addColorStop(1, '#303030');
	H.fillStyle = domeG;
	H.fill();
	H.restore();
	// metalness: silver band = metallic
	M.save();
	ringPath(M, 512, 512, px(0.79) * hs, px(0.985) * hs);
	M.fillStyle = '#e8e8e8';
	M.fill();
	M.restore();
	R.save();
	ringPath(R, 512, 512, px(0.79) * hs, px(0.985) * hs);
	R.fillStyle = '#4a4a4a';
	R.fill();
	R.restore();

	// gold interlaced chain along the outer band — small overlapping links
	{
		const n = 56;
		const rMid = px(0.8825);
		const rC = px(0.038);
		for (let i = 0; i < n; i++) {
			const ang = (i / n) * Math.PI * 2;
			const x = c + Math.cos(ang) * rMid;
			const y = c + Math.sin(ang) * rMid;
			A.save();
			A.strokeStyle = metalGrad(A, x - rC, y - rC, x + rC, y + rC, GOLD);
			A.lineWidth = px(0.011);
			A.beginPath();
			A.arc(x, y, rC, 0, Math.PI * 2);
			A.stroke();
			A.restore();
			H.save();
			H.strokeStyle = '#e8e8e8';
			H.lineWidth = px(0.011) * hs;
			H.beginPath();
			H.arc(x * hs, y * hs, rC * hs, 0, Math.PI * 2);
			H.stroke();
			H.restore();
		}
		// triquetra medallion stamps over the chain — every knot rotated with its
		// place on the ring, so they all lead the same way going clockwise
		const nm = 12;
		for (let i = 0; i < nm; i++) {
			const ang = ((i + 0.5) / nm) * Math.PI * 2;
			const x = c + Math.cos(ang) * rMid;
			const y = c + Math.sin(ang) * rMid;
			drawTriquetra(A, x, y, px(0.068), px(0.02), metalGrad(A, x - 50, y - 50, x + 50, y + 50, GOLD), ang + Math.PI);
			H.save();
			H.scale(hs, hs);
			drawTriquetra(H, x, y, px(0.068), px(0.02), '#ffffff', ang + Math.PI);
			H.restore();
		}
	}

	// ============ SILVER RAILS at 0.775 and 0.99
	for (const rf of [0.785, 0.99]) {
		both((ctx) => {
			ctx.strokeStyle = metalGrad(ctx, 0, c - px(rf), size, c + px(rf), SILVER);
			ctx.lineWidth = px(0.018);
			ctx.beginPath();
			ctx.arc(c, c, px(rf), 0, Math.PI * 2);
			ctx.stroke();
		});
		H.save();
		H.strokeStyle = '#fff';
		H.lineWidth = px(0.014) * hs;
		H.beginPath();
		H.arc(512, 512, px(rf) * hs, 0, Math.PI * 2);
		H.stroke();
		H.restore();
	}

	// ============ BLUE-GREY CELTIC BAND, r 0.555–0.785
	A.save();
	ringPath(A, c, c, px(0.555), px(0.785));
	const blueG = A.createRadialGradient(c, c, px(0.555), c, c, px(0.785));
	blueG.addColorStop(0, '#2c3550');
	blueG.addColorStop(0.45, '#485578');
	blueG.addColorStop(0.75, '#394563');
	blueG.addColorStop(1, '#232c44');
	A.fillStyle = blueG;
	A.fill();
	A.restore();
	H.save();
	ringPath(H, 512, 512, px(0.555) * hs, px(0.785) * hs);
	const bandDome = H.createRadialGradient(512, 512, px(0.555) * hs, 512, 512, px(0.785) * hs);
	bandDome.addColorStop(0, '#3a3a3a');
	bandDome.addColorStop(0.5, '#c8c8c8');
	bandDome.addColorStop(1, '#383838');
	H.fillStyle = bandDome;
	H.fill();
	H.restore();
	M.save();
	ringPath(M, 512, 512, px(0.555) * hs, px(0.785) * hs);
	M.fillStyle = '#565656';
	M.fill();
	M.restore();

	// gold triquetras + trinity dots on the blue band
	{
		const n = 8;
		const rMid = px(0.67);
		for (let i = 0; i < n; i++) {
			const ang = (i / n) * Math.PI * 2 + Math.PI / n;
			const x = c + Math.cos(ang) * rMid;
			const y = c + Math.sin(ang) * rMid;
			drawTriquetra(A, x, y, px(0.055), px(0.014), metalGrad(A, x - 45, y - 45, x + 45, y + 45, GOLD), ang + Math.PI);
			H.save();
			H.scale(hs, hs);
			drawTriquetra(H, x, y, px(0.055), px(0.014), '#e8e8e8', ang + Math.PI);
			H.restore();
		}
		// silver rivet studs between them
		for (let i = 0; i < n; i++) {
			const ang = (i / n) * Math.PI * 2;
			for (const rr of [0.595, 0.745]) {
				const x = c + Math.cos(ang) * px(rr);
				const y = c + Math.sin(ang) * px(rr);
				const g = A.createRadialGradient(x - 3, y - 3, 0, x, y, px(0.02));
				g.addColorStop(0, '#ffffff');
				g.addColorStop(0.4, '#c9d4dc');
				g.addColorStop(1, '#4a545e');
				A.fillStyle = g;
				A.beginPath();
				A.arc(x, y, px(0.018), 0, Math.PI * 2);
				A.fill();
				H.fillStyle = '#fff';
				H.beginPath();
				H.arc(x * hs, y * hs, px(0.016) * hs, 0, Math.PI * 2);
				H.fill();
			}
		}
		// fine gold pinstripes + thin radial deco spokes (Art Deco touch)
		for (const rf of [0.572, 0.768]) {
			A.strokeStyle = 'rgba(240,212,136,0.75)';
			A.lineWidth = px(0.005);
			A.beginPath();
			A.arc(c, c, px(rf), 0, Math.PI * 2);
			A.stroke();
		}
		A.strokeStyle = 'rgba(240,212,136,0.4)';
		A.lineWidth = px(0.004);
		for (let i = 0; i < 32; i++) {
			const ang = (i / 32) * Math.PI * 2 + Math.PI / 32;
			A.beginPath();
			A.moveTo(c + Math.cos(ang) * px(0.578), c + Math.sin(ang) * px(0.578));
			A.lineTo(c + Math.cos(ang) * px(0.762), c + Math.sin(ang) * px(0.762));
			A.stroke();
		}
	}

	// ============ STAR MAP on the blue band — little gold and silver stars
	// scattered like the night-sky disc of an expensive perpetual calendar
	{
		const star = (x: number, y: number, r: number, color: string, rot: number) => {
			A.save();
			A.translate(x, y);
			A.rotate(rot);
			A.fillStyle = color;
			A.beginPath();
			for (let k = 0; k < 8; k++) {
				const rr = k % 2 ? r * 0.36 : r;
				const a = (k / 8) * Math.PI * 2;
				if (k === 0) A.moveTo(rr, 0);
				else A.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
			}
			A.closePath();
			A.fill();
			A.restore();
		};
		const R0 = 0.585;
		const R1 = 0.752;
		const bandR = () => Math.sqrt(R0 * R0 + (R1 * R1 - R0 * R0) * Math.random());
		for (let i = 0; i < 105; i++) {
			const ang = Math.random() * Math.PI * 2;
			const rf = bandR();
			const x = c + Math.cos(ang) * px(rf);
			const y = c + Math.sin(ang) * px(rf);
			const goldStar = Math.random() < 0.55;
			const a = 0.35 + Math.random() * 0.55;
			const r = px(0.0035 + Math.pow(Math.random(), 2.2) * 0.007);
			star(x, y, r, goldStar ? `rgba(240,212,136,${a})` : `rgba(216,226,236,${a})`, Math.random() * Math.PI);
			if (r > px(0.007)) {
				// the brightest stars get a raised sparkle in the relief
				H.fillStyle = 'rgba(255,255,255,0.5)';
				H.beginPath();
				H.arc(x * hs, y * hs, px(0.002) * hs, 0, Math.PI * 2);
				H.fill();
			}
		}
		// a dust of pin-prick stars between them
		for (let i = 0; i < 130; i++) {
			const ang = Math.random() * Math.PI * 2;
			const rf = bandR();
			const a = 0.2 + Math.random() * 0.45;
			A.fillStyle = Math.random() < 0.5 ? `rgba(240,212,136,${a})` : `rgba(216,226,236,${a})`;
			A.beginPath();
			A.arc(c + Math.cos(ang) * px(rf), c + Math.sin(ang) * px(rf), px(0.0012 + Math.random() * 0.0014), 0, Math.PI * 2);
			A.fill();
		}
	}

	// ============ MECHANISM WINDOW, r 0.475–0.555 (left open in geometry — real
	// cogs live in here; painted dark as a fallback where still covered)
	A.save();
	ringPath(A, c, c, px(0.475), px(0.555));
	A.fillStyle = '#0c0e14';
	A.fill();
	A.restore();
	// machining grooves so the window floor isn't flat black
	A.strokeStyle = 'rgba(150,165,190,0.14)';
	A.lineWidth = px(0.004);
	for (const rf of [0.49, 0.512, 0.534]) {
		A.beginPath();
		A.arc(c, c, px(rf), 0, Math.PI * 2);
		A.stroke();
	}

	// ============ GOLD BEAD RING, r 0.395–0.475
	A.save();
	ringPath(A, c, c, px(0.395), px(0.475));
	A.fillStyle = metalGrad(A, c - px(0.475), c - px(0.475), c + px(0.475), c + px(0.475), GOLD);
	A.fill();
	A.restore();
	M.save();
	ringPath(M, 512, 512, px(0.395) * hs, px(0.475) * hs);
	M.fillStyle = '#f0f0f0';
	M.fill();
	M.restore();
	{
		const n = 40;
		const rMid = px(0.435);
		const rb = px(0.031);
		for (let i = 0; i < n; i++) {
			const ang = (i / n) * Math.PI * 2;
			const x = c + Math.cos(ang) * rMid;
			const y = c + Math.sin(ang) * rMid;
			const g = A.createRadialGradient(x - rb * 0.35, y - rb * 0.35, 0, x, y, rb);
			g.addColorStop(0, '#fff8dd');
			g.addColorStop(0.45, '#e5c26c');
			g.addColorStop(1, '#8a6a26');
			A.fillStyle = g;
			A.beginPath();
			A.arc(x, y, rb, 0, Math.PI * 2);
			A.fill();
			H.fillStyle = '#fff';
			H.beginPath();
			H.arc(x * hs, y * hs, rb * hs * 0.9, 0, Math.PI * 2);
			H.fill();
		}
	}

	// ============ CENTRE WELL r < 0.355 (hidden behind button)
	A.save();
	A.beginPath();
	A.arc(c, c, px(0.40), 0, Math.PI * 2);
	const wellG = A.createRadialGradient(c, c, 0, c, c, px(0.40));
	wellG.addColorStop(0, '#26150f');
	wellG.addColorStop(1, '#120a06');
	A.fillStyle = wellG;
	A.fill();
	A.restore();

	// ============ light machining noise over all metal
	{
		const img = A.getImageData(0, 0, size, size);
		const d = img.data;
		for (let i = 0; i < d.length; i += 4) {
			if (d[i + 3] === 0) continue;
			const n = (Math.random() - 0.5) * 10;
			d[i] += n;
			d[i + 1] += n;
			d[i + 2] += n;
		}
		A.putImageData(img, 0, 0);
	}

	const normal = heightToNormal(height, 2.6);
	return {
		map: toTexture(albedo),
		normalMap: toTexture(normal, { srgb: false }),
		roughnessMap: toTexture(rough, { srgb: false }),
		metalnessMap: toTexture(metal, { srgb: false })
	};
}

/* ============================================================
   Red button cap + label
   ============================================================ */

export interface ButtonTextures {
	map: THREE.CanvasTexture;
	/** Wispy highlight clouds, rotated very slowly over the cap — a living ruby. */
	sheen: THREE.CanvasTexture;
}

/** Wispy fbm cloud layer, painted small and scaled up soft — ruby inclusions. */
function rubyClouds(size: number, seed: number): HTMLCanvasElement {
	const n = 176;
	const cv = makeCanvas(n);
	const c = cv.getContext('2d')!;
	const img = c.createImageData(n, n);
	const d = img.data;
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			const v = fbm(x * 0.032, y * 0.032, 4, seed);
			const w = fbm(x * 0.09 + 31, y * 0.09 + 57, 3, seed + 5);
			const i = (y * n + x) * 4;
			if (v < 0.5) {
				// pure-crimson veins sinking into the depths (full saturation —
				// any grey in here reads as dirt on the dome)
				d[i] = 122;
				d[i + 1] = 0;
				d[i + 2] = 26;
				d[i + 3] = Math.min(1, (0.5 - v) * 2.2) * 115;
			} else {
				// rosy inclusions catching the light
				d[i] = 255;
				d[i + 1] = 96;
				d[i + 2] = 112;
				d[i + 3] = Math.min(1, (v - 0.5) * 1.9) * 80;
			}
			// fine second-octave shimmer
			d[i + 3] = Math.min(255, d[i + 3] + Math.max(0, w - 0.62) * 70);
		}
	}
	c.putImageData(img, 0, 0);
	const out = makeCanvas(size);
	const o = out.getContext('2d')!;
	o.imageSmoothingEnabled = true;
	o.imageSmoothingQuality = 'high';
	o.drawImage(cv, 0, 0, size, size);
	return out;
}

export function createButtonTextures(size = 1024): ButtonTextures {
	const cap = makeCanvas(size);
	const ctx = cap.getContext('2d')!;
	const cx = size / 2;
	const g = ctx.createRadialGradient(cx - size * 0.12, cx - size * 0.16, size * 0.05, cx, cx, cx);
	g.addColorStop(0, '#ef4a48');
	g.addColorStop(0.42, '#bd1a28');
	g.addColorStop(0.8, '#870e1c');
	g.addColorStop(1, '#4e0812');
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, size, size);
	// deep ruby clouds — mineral depths painted under the label
	ctx.drawImage(rubyClouds(size, 11), 0, 0);
	// subtle enamel noise
	for (let i = 0; i < 9000; i++) {
		const x = Math.random() * size;
		const y = Math.random() * size;
		ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
		ctx.fillRect(x, y, 1.5, 1.5);
	}
	// gold coin-dot border (the "ooooo" edge of the V2 button)
	const n = 60;
	const rEdge = cx * 0.92;
	for (let i = 0; i < n; i++) {
		const ang = (i / n) * Math.PI * 2;
		const x = cx + Math.cos(ang) * rEdge;
		const y = cx + Math.sin(ang) * rEdge;
		const rg = ctx.createRadialGradient(x - 2, y - 2, 0, x, y, cx * 0.022);
		rg.addColorStop(0, '#fff3cf');
		rg.addColorStop(0.5, '#e5c26c');
		rg.addColorStop(1, '#8a6a26');
		ctx.fillStyle = rg;
		ctx.beginPath();
		ctx.arc(x, y, cx * 0.02, 0, Math.PI * 2);
		ctx.fill();
	}
	// label
	ctx.fillStyle = '#ffffff';
	ctx.shadowColor = 'rgba(80,0,0,0.85)';
	ctx.shadowBlur = size * 0.02;
	ctx.shadowOffsetY = size * 0.008;
	ctx.textAlign = 'center';
	ctx.font = `700 ${size * 0.148}px 'Roboto Slab', Georgia, serif`;
	ctx.fillText('Make Me', cx, cx - size * 0.028);
	ctx.font = `700 ${size * 0.175}px 'Roboto Slab', Georgia, serif`;
	ctx.fillText('Lucky', cx, cx + size * 0.135);

	// the sheen layer: rosy light-cloud wisps that drift over the dome. It is a
	// separate texture so it can rotate slowly without taking the label with it.
	const sn = 176;
	const scv = makeCanvas(sn);
	const sc = scv.getContext('2d')!;
	const simg = sc.createImageData(sn, sn);
	const sd = simg.data;
	const half = (sn - 1) / 2;
	for (let y = 0; y < sn; y++) {
		for (let x = 0; x < sn; x++) {
			const v = fbm(x * 0.06 + 83, y * 0.06 + 19, 4, 41);
			const dist = Math.hypot(x - half, y - half) / half;
			const edge = Math.max(0, Math.min(1, (0.9 - dist) / 0.35)); // fade before the rim
			const i = (y * sn + x) * 4;
			sd[i] = 255;
			sd[i + 1] = 205;
			sd[i + 2] = 210;
			sd[i + 3] = Math.min(1, Math.max(0, v - 0.52) * 2.1) * edge * 120;
		}
	}
	sc.putImageData(simg, 0, 0);
	const sheenCv = makeCanvas(512);
	const so = sheenCv.getContext('2d')!;
	so.imageSmoothingEnabled = true;
	so.imageSmoothingQuality = 'high';
	so.drawImage(scv, 0, 0, 512, 512);
	const sheen = toTexture(sheenCv);
	sheen.center.set(0.5, 0.5); // rotates about the dome centre

	return { map: toTexture(cap), sheen };
}

/* ============================================================
   Dr Strange style glyph ring
   ============================================================ */

export function createGlyphRingTexture(size = 1024, seed = 1): THREE.CanvasTexture {
	const cv = makeCanvas(size);
	const ctx = cv.getContext('2d')!;
	const c = size / 2;
	let s = seed * 9301 + 49297;
	const rnd = () => {
		s = (s * 9301 + 49297) % 233280;
		return s / 233280;
	};
	ctx.strokeStyle = '#ffffff';
	ctx.lineCap = 'round';

	// double boundary circles
	for (const rf of [0.97, 0.62]) {
		ctx.lineWidth = size * (rf > 0.9 ? 0.012 : 0.008);
		ctx.beginPath();
		ctx.arc(c, c, c * rf, 0, Math.PI * 2);
		ctx.stroke();
	}
	// runic glyphs in the band between the circles
	const n = 26;
	for (let i = 0; i < n; i++) {
		const ang = (i / n) * Math.PI * 2;
		const rMid = c * 0.795;
		ctx.save();
		ctx.translate(c + Math.cos(ang) * rMid, c + Math.sin(ang) * rMid);
		ctx.rotate(ang + Math.PI / 2);
		ctx.lineWidth = size * 0.01;
		const gs = c * 0.13; // glyph size
		const strokes = 2 + Math.floor(rnd() * 3);
		for (let k = 0; k < strokes; k++) {
			ctx.beginPath();
			const x0 = (rnd() - 0.5) * gs;
			const y0 = (rnd() - 0.5) * gs;
			if (rnd() < 0.5) {
				ctx.moveTo(x0, y0);
				ctx.lineTo((rnd() - 0.5) * gs, (rnd() - 0.5) * gs);
			} else {
				ctx.arc(x0 * 0.5, y0 * 0.5, gs * (0.2 + rnd() * 0.3), rnd() * Math.PI * 2, rnd() * Math.PI * 2 + 2);
			}
			ctx.stroke();
		}
		ctx.restore();
	}
	// inner geometry: triangle / star lines
	ctx.lineWidth = size * 0.006;
	const points = 3 + Math.floor(rnd() * 3);
	ctx.beginPath();
	for (let i = 0; i <= points; i++) {
		const ang = (i * (points === 4 ? 2 : 1) / points) * Math.PI * 2 - Math.PI / 2;
		const x = c + Math.cos(ang) * c * 0.6;
		const y = c + Math.sin(ang) * c * 0.6;
		i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
	}
	ctx.stroke();

	const tex = toTexture(cv, { srgb: false });
	return tex;
}

/** Ornate clock chapter ring — roman numerals + minute track, for Time effects. */
export function createClockRingTexture(size = 1024): THREE.CanvasTexture {
	const cv = makeCanvas(size);
	const ctx = cv.getContext('2d')!;
	const c = size / 2;
	ctx.strokeStyle = '#ffffff';
	ctx.fillStyle = '#ffffff';
	ctx.lineWidth = size * 0.008;
	ctx.beginPath();
	ctx.arc(c, c, c * 0.96, 0, Math.PI * 2);
	ctx.stroke();
	ctx.lineWidth = size * 0.005;
	ctx.beginPath();
	ctx.arc(c, c, c * 0.7, 0, Math.PI * 2);
	ctx.stroke();
	// minute track
	for (let i = 0; i < 60; i++) {
		const ang = (i / 60) * Math.PI * 2 - Math.PI / 2;
		const long = i % 5 === 0;
		ctx.lineWidth = size * (long ? 0.008 : 0.004);
		ctx.beginPath();
		ctx.moveTo(c + Math.cos(ang) * c * (long ? 0.9 : 0.925), c + Math.sin(ang) * c * (long ? 0.9 : 0.925));
		ctx.lineTo(c + Math.cos(ang) * c * 0.955, c + Math.sin(ang) * c * 0.955);
		ctx.stroke();
	}
	// roman numerals
	const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
	ctx.font = `700 ${size * 0.072}px Georgia, serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	for (let i = 0; i < 12; i++) {
		const ang = (i / 12) * Math.PI * 2 - Math.PI / 2;
		const x = c + Math.cos(ang) * c * 0.8;
		const y = c + Math.sin(ang) * c * 0.8;
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(ang + Math.PI / 2);
		ctx.fillText(numerals[i], 0, 0);
		ctx.restore();
	}
	return toTexture(cv, { srgb: false });
}

/* ============================================================
   Particle sprites
   ============================================================ */

function spriteCanvas(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): THREE.CanvasTexture {
	const cv = makeCanvas(size);
	const ctx = cv.getContext('2d')!;
	draw(ctx, size);
	return toTexture(cv, { srgb: false });
}

export interface SpriteSet {
	softDot: THREE.CanvasTexture;
	spark: THREE.CanvasTexture;
	star4: THREE.CanvasTexture;
	clover: THREE.CanvasTexture;
	horseshoe: THREE.CanvasTexture;
	seven: THREE.CanvasTexture;
	coin: THREE.CanvasTexture;
	streak: THREE.CanvasTexture;
}

export function createParticleSprites(): SpriteSet {
	const softDot = spriteCanvas(128, (ctx, s) => {
		const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, s, s);
	});

	const spark = spriteCanvas(128, (ctx, s) => {
		const c = s / 2;
		const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.4);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, s, s);
		// cross flare
		ctx.strokeStyle = 'rgba(255,255,255,0.9)';
		ctx.lineCap = 'round';
		for (const [dx, dy] of [[1, 0], [0, 1]]) {
			ctx.lineWidth = 3;
			ctx.beginPath();
			ctx.moveTo(c - dx * c * 0.95, c - dy * c * 0.95);
			ctx.lineTo(c + dx * c * 0.95, c + dy * c * 0.95);
			ctx.stroke();
		}
	});

	const star4 = spriteCanvas(128, (ctx, s) => {
		const c = s / 2;
		ctx.fillStyle = '#fff';
		ctx.beginPath();
		for (let i = 0; i < 8; i++) {
			const ang = (i / 8) * Math.PI * 2 - Math.PI / 2;
			const r = i % 2 === 0 ? c * 0.95 : c * 0.16;
			const x = c + Math.cos(ang) * r;
			const y = c + Math.sin(ang) * r;
			i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
		}
		ctx.closePath();
		ctx.fill();
	});

	const clover = spriteCanvas(256, (ctx, s) => {
		const c = s / 2;
		ctx.fillStyle = '#fff';
		// four heart-shaped leaves
		for (let i = 0; i < 4; i++) {
			ctx.save();
			ctx.translate(c, c);
			ctx.rotate((i / 4) * Math.PI * 2);
			ctx.beginPath();
			ctx.moveTo(0, -s * 0.04);
			ctx.bezierCurveTo(-s * 0.16, -s * 0.30, -s * 0.30, -s * 0.10, 0, s * 0.02);
			ctx.moveTo(0, -s * 0.04);
			ctx.bezierCurveTo(s * 0.16, -s * 0.30, s * 0.30, -s * 0.10, 0, s * 0.02);
			ctx.translate(0, -s * 0.16);
			ctx.fill();
			ctx.restore();
		}
		// stem
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = s * 0.035;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(c, c + s * 0.05);
		ctx.quadraticCurveTo(c + s * 0.1, c + s * 0.25, c + s * 0.05, c + s * 0.38);
		ctx.stroke();
	});

	const horseshoe = spriteCanvas(256, (ctx, s) => {
		const c = s / 2;
		ctx.strokeStyle = '#fff';
		ctx.lineWidth = s * 0.12;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.arc(c, c - s * 0.04, s * 0.3, Math.PI * 0.85, Math.PI * 0.15, false);
		ctx.stroke();
		// nail dots
		ctx.fillStyle = '#000';
		for (const t of [0.9, 1.05, -0.05, 0.1]) {
			const ang = Math.PI * t;
			ctx.beginPath();
			ctx.arc(c + Math.cos(ang) * s * 0.3, c - s * 0.04 + Math.sin(ang) * s * 0.3, s * 0.025, 0, Math.PI * 2);
			ctx.fill();
		}
	});

	const seven = spriteCanvas(256, (ctx, s) => {
		ctx.fillStyle = '#fff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `700 ${s * 0.8}px 'Roboto Slab', Georgia, serif`;
		ctx.fillText('7', s / 2, s / 2 + s * 0.04);
	});

	const coin = spriteCanvas(256, (ctx, s) => {
		// solid minted disc — reads as a coin even under additive blending
		const c = s / 2;
		const g = ctx.createRadialGradient(c - s * 0.08, c - s * 0.1, 0, c, c, s * 0.42);
		g.addColorStop(0, 'rgba(255,255,255,1)');
		g.addColorStop(0.75, 'rgba(255,255,255,0.85)');
		g.addColorStop(1, 'rgba(255,255,255,0.55)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(c, c, s * 0.42, 0, Math.PI * 2);
		ctx.fill();
		// punch the details out so they read dark against the glow
		ctx.globalCompositeOperation = 'destination-out';
		ctx.lineWidth = s * 0.025;
		ctx.strokeStyle = 'rgba(0,0,0,0.9)';
		ctx.beginPath();
		ctx.arc(c, c, s * 0.33, 0, Math.PI * 2);
		ctx.stroke();
		ctx.font = `700 ${s * 0.34}px Georgia, serif`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = 'rgba(0,0,0,0.85)';
		ctx.fillText('★', c, c + s * 0.01);
		ctx.globalCompositeOperation = 'source-over';
	});

	const streak = spriteCanvas(256, (ctx, s) => {
		// horizontal comet streak for shooting stars / speed lines
		const g = ctx.createLinearGradient(0, 0, s, 0);
		g.addColorStop(0, 'rgba(255,255,255,0)');
		g.addColorStop(0.75, 'rgba(255,255,255,0.75)');
		g.addColorStop(0.92, 'rgba(255,255,255,1)');
		g.addColorStop(1, 'rgba(255,255,255,0)');
		ctx.fillStyle = g;
		const h = s * 0.1;
		ctx.beginPath();
		ctx.ellipse(s / 2, s / 2, s / 2, h, 0, 0, Math.PI * 2);
		ctx.fill();
	});

	return { softDot, spark, star4, clover, horseshoe, seven, coin, streak };
}

/* ============================================================
   Sky / cloud texture for the portal + tunnel
   ============================================================ */

export function createSkyTexture(size = 1024): THREE.CanvasTexture {
	const cv = makeCanvas(size);
	const ctx = cv.getContext('2d')!;
	const img = ctx.createImageData(size, size);
	const d = img.data;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const u = x / size;
			const v = y / size;
			// two layers of billowing cloud with proper contrast
			const big = fbmTile(u * 14, v * 14, 14, 5, 42);
			const wisp = fbmTile(u * 30, v * 30, 30, 4, 91);
			const n = big * 0.7 + wisp * 0.3;
			let cloud = Math.max(0, Math.min(1, (n - 0.55) * 8));
			cloud = Math.pow(cloud, 1.35);
			// blue sky gradient
			const skyR = 92 + v * 52;
			const skyG = 150 + v * 46;
			const skyB = 224 + v * 18;
			// cloud shading: bright tops, softly grey bellies
			const belly = 1 - Math.max(0, Math.min(1, (n - 0.6) * 2)) * 0.22;
			const i = (y * size + x) * 4;
			d[i] = skyR + (255 * belly - skyR) * cloud;
			d[i + 1] = skyG + (253 * belly - skyG) * cloud;
			d[i + 2] = skyB + (250 * belly - skyB) * cloud;
			d[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	const tex = toTexture(cv);
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	return tex;
}

/** Soft cloud puff sprite (alpha only). */
export function createCloudSprite(size = 256): THREE.CanvasTexture {
	const cv = makeCanvas(size);
	const ctx = cv.getContext('2d')!;
	const img = ctx.createImageData(size, size);
	const d = img.data;
	const c = size / 2;
	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const dx = (x - c) / c;
			const dy = (y - c) / c;
			const dist = Math.sqrt(dx * dx + dy * dy);
			const fall = Math.max(0, 1 - dist);
			const n = fbm(x / 40, y / 40, 4, 17);
			const alpha = Math.max(0, Math.min(1, fall * fall * (n + 0.25) * 1.6));
			const i = (y * size + x) * 4;
			d[i] = d[i + 1] = d[i + 2] = 255;
			d[i + 3] = alpha * 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return toTexture(cv, { srgb: false });
}
