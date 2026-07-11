// Procedural lightning: midpoint-displaced bolts rendered as additive ribbons.
// Bloom turns them electric.

import * as THREE from 'three';
import { rand } from '../core/anim';

const MAX_POINTS = 96;

function displace(points: THREE.Vector3[], generations: number, jitter: number): THREE.Vector3[] {
	let pts = points;
	for (let g = 0; g < generations; g++) {
		const next: THREE.Vector3[] = [];
		for (let i = 0; i < pts.length - 1; i++) {
			const a = pts[i];
			const b = pts[i + 1];
			const mid = a.clone().add(b).multiplyScalar(0.5);
			const seg = b.clone().sub(a);
			const perp = new THREE.Vector3(-seg.y, seg.x, 0).normalize();
			mid.addScaledVector(perp, rand(-1, 1) * jitter * seg.length());
			mid.z += rand(-0.5, 0.5) * jitter * seg.length() * 0.4;
			next.push(a, mid);
		}
		next.push(pts[pts.length - 1]);
		pts = next;
	}
	return pts;
}

interface StrikeOptions {
	width?: number;
	life?: number;
	jitter?: number;
	generations?: number;
}

class Bolt {
	scene: THREE.Scene;
	positions: Float32Array;
	coreMat: THREE.MeshBasicMaterial;
	glowMat: THREE.MeshBasicMaterial;
	core: THREE.Mesh;
	glow: THREE.Mesh;
	active: boolean;
	timer: number;
	regen: number;
	start!: THREE.Vector3;
	end!: THREE.Vector3;
	width!: number;
	life!: number;
	jitter!: number;
	generations!: number;

	constructor(scene: THREE.Scene, color: THREE.ColorRepresentation = 0xcfe9ff) {
		this.scene = scene;
		// pre-allocated ribbon: MAX_POINTS points → (MAX_POINTS-1)*2 triangles
		const geo = new THREE.BufferGeometry();
		this.positions = new Float32Array(MAX_POINTS * 2 * 3);
		geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
		const indices = [];
		for (let i = 0; i < MAX_POINTS - 1; i++) {
			const a = i * 2;
			indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
		}
		geo.setIndex(indices);
		(geo as THREE.BufferGeometry & { frustumCulled: boolean }).frustumCulled = false;

		this.coreMat = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide
		});
		this.glowMat = this.coreMat.clone();
		this.glowMat.color = new THREE.Color(color);

		this.core = new THREE.Mesh(geo, this.coreMat);
		this.glow = new THREE.Mesh(geo.clone(), this.glowMat);
		this.core.frustumCulled = this.glow.frustumCulled = false;
		this.core.visible = this.glow.visible = false;
		scene.add(this.core, this.glow);

		this.active = false;
		this.timer = 0;
		this.regen = 0;
	}

	strike(start: THREE.Vector3, end: THREE.Vector3, { width = 0.03, life = 0.35, jitter = 0.18, generations = 5 }: StrikeOptions = {}) {
		this.start = start.clone();
		this.end = end.clone();
		this.width = width;
		this.life = life;
		this.timer = life;
		this.jitter = jitter;
		this.generations = generations;
		this.active = true;
		this.core.visible = this.glow.visible = true;
		this._build();
	}

	_build() {
		const pts = displace([this.start, this.end], this.generations, this.jitter);
		const n = Math.min(pts.length, MAX_POINTS);
		const posCore = this.core.geometry.attributes.position;
		const posGlow = this.glow.geometry.attributes.position;
		for (let i = 0; i < MAX_POINTS; i++) {
			const p = pts[Math.min(i, n - 1)];
			const pNext = pts[Math.min(i + 1, n - 1)];
			const pPrev = pts[Math.min(Math.max(i - 1, 0), n - 1)];
			const dir = pNext.clone().sub(pPrev);
			const perp = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
			// taper towards the ends
			const t = i / (n - 1);
			const taper = Math.sin(Math.min(1, t) * Math.PI) * 0.7 + 0.3;
			const wC = this.width * taper;
			const wG = this.width * 3.2 * taper;
			posCore.setXYZ(i * 2, p.x + perp.x * wC, p.y + perp.y * wC, p.z);
			posCore.setXYZ(i * 2 + 1, p.x - perp.x * wC, p.y - perp.y * wC, p.z);
			posGlow.setXYZ(i * 2, p.x + perp.x * wG, p.y + perp.y * wG, p.z - 0.01);
			posGlow.setXYZ(i * 2 + 1, p.x - perp.x * wG, p.y - perp.y * wG, p.z - 0.01);
		}
		posCore.needsUpdate = true;
		posGlow.needsUpdate = true;
	}

	update(dt: number) {
		if (!this.active) return;
		this.timer -= dt;
		this.regen -= dt;
		if (this.timer <= 0) {
			this.active = false;
			this.core.visible = this.glow.visible = false;
			this.coreMat.opacity = this.glowMat.opacity = 0;
			return;
		}
		if (this.regen <= 0) {
			this.regen = 0.05;
			this._build();
		}
		const flicker = 0.65 + Math.random() * 0.35;
		const fade = Math.min(1, this.timer / (this.life * 0.4));
		this.coreMat.opacity = 0.9 * flicker * fade;
		this.glowMat.opacity = 0.22 * flicker * fade;
	}

	dispose() {
		this.scene.remove(this.core, this.glow);
		this.core.geometry.dispose();
		this.glow.geometry.dispose();
		this.coreMat.dispose();
		this.glowMat.dispose();
	}
}

export class Lightning {
	scene: THREE.Scene;
	bolts: Bolt[];

	constructor(scene: THREE.Scene, poolSize = 10) {
		this.scene = scene;
		this.bolts = Array.from({ length: poolSize }, () => new Bolt(scene));
	}

	strike(start: THREE.Vector3, end: THREE.Vector3, opts?: StrikeOptions): Bolt {
		const bolt = this.bolts.find((b) => !b.active) || this.bolts[0];
		bolt.strike(start, end, opts);
		return bolt;
	}

	update(dt: number) {
		for (const b of this.bolts) b.update(dt);
	}

	clear() {
		for (const b of this.bolts) {
			b.active = false;
			b.core.visible = b.glow.visible = false;
		}
	}
}
