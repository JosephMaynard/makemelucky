// CPU-simulated, GPU-rendered point particles with per-particle size/alpha/spin.

import * as THREE from 'three';
import { rand, pick } from '../core/anim';

/** Acceleration field sampled per particle, e.g. a vortex. */
type ForceField = (x: number, y: number, z: number) => readonly [number, number, number];

export interface BurstOptions {
	texture: THREE.Texture;
	count?: number;
	origin?: THREE.Vector3;
	originSpread?: number;
	direction?: THREE.Vector3 | null;
	cone?: number;
	speed?: readonly [number, number];
	gravity?: THREE.Vector3;
	drag?: number;
	life?: readonly [number, number];
	size?: readonly [number, number];
	colors?: readonly THREE.ColorRepresentation[];
	spin?: readonly [number, number];
	emitRate?: number;
	fadeIn?: number;
	field?: ForceField | null;
}

export interface EmitterOptions extends BurstOptions {}

/** The resolved options a Burst keeps after applying its defaults. */
interface BurstConfig {
	origin: THREE.Vector3;
	originSpread: number;
	direction: THREE.Vector3 | null;
	cone: number;
	speed: readonly [number, number];
	gravity: THREE.Vector3;
	drag: number;
	life: readonly [number, number];
	size: readonly [number, number];
	colors: readonly THREE.ColorRepresentation[];
	spin: readonly [number, number];
	fadeIn: number;
	field: ForceField | null;
}

const VERT = /* glsl */ `
	attribute float aSize;
	attribute float aAlpha;
	attribute float aRot;
	attribute vec3 aColor;
	varying float vAlpha;
	varying float vRot;
	varying vec3 vColor;
	uniform float uScale;
	void main() {
		vAlpha = aAlpha;
		vRot = aRot;
		vColor = aColor;
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		gl_PointSize = aSize * uScale / -mv.z;
		gl_Position = projectionMatrix * mv;
	}
`;

const FRAG = /* glsl */ `
	uniform sampler2D uMap;
	varying float vAlpha;
	varying float vRot;
	varying vec3 vColor;
	void main() {
		vec2 uv = gl_PointCoord - 0.5;
		float c = cos(vRot), s = sin(vRot);
		uv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c) + 0.5;
		vec4 tex = texture2D(uMap, uv);
		gl_FragColor = vec4(vColor, 1.0) * tex * vAlpha;
	}
`;

class Burst {
	scene: THREE.Scene;
	opts: BurstConfig;
	count: number;
	emitRate: number;
	emitting: boolean;
	_emitAcc: number;
	dead: boolean;
	positions: Float32Array;
	velocities: Float32Array;
	lifes: Float32Array;
	maxLifes: Float32Array;
	sizes: Float32Array;
	alphas: Float32Array;
	rots: Float32Array;
	rotSpeeds: Float32Array;
	cols: Float32Array;
	material: THREE.ShaderMaterial;
	points: THREE.Points;

	constructor(scene: THREE.Scene, opts: BurstOptions) {
		const {
			texture,
			count = 100,
			origin = new THREE.Vector3(),
			originSpread = 0,
			direction = null, // THREE.Vector3 or null for omni
			cone = Math.PI, // spread angle around direction
			speed = [1, 2],
			gravity = new THREE.Vector3(0, -1.2, 0),
			drag = 0.985,
			life = [0.6, 1.4],
			size = [0.04, 0.12],
			colors = [0xffffff],
			spin = [-3, 3],
			emitRate = 0, // 0 = one-shot burst; >0 = continuous particles/sec
			fadeIn = 0.08,
			field = null // (x, y, z) => [ax, ay, az] acceleration field, e.g. a vortex
		} = opts;

		this.scene = scene;
		this.opts = { origin, originSpread, direction, cone, speed, gravity, drag, life, size, colors, spin, fadeIn, field };
		this.count = count;
		this.emitRate = emitRate;
		this.emitting = emitRate > 0;
		this._emitAcc = 0;
		this.dead = false;

		this.positions = new Float32Array(count * 3);
		this.velocities = new Float32Array(count * 3);
		this.lifes = new Float32Array(count); // remaining
		this.maxLifes = new Float32Array(count);
		this.sizes = new Float32Array(count);
		this.alphas = new Float32Array(count);
		this.rots = new Float32Array(count);
		this.rotSpeeds = new Float32Array(count);
		this.cols = new Float32Array(count * 3);

		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
		geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
		geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
		geo.setAttribute('aRot', new THREE.BufferAttribute(this.rots, 1));
		geo.setAttribute('aColor', new THREE.BufferAttribute(this.cols, 3));

		this.material = new THREE.ShaderMaterial({
			uniforms: { uMap: { value: texture }, uScale: { value: 700 } },
			vertexShader: VERT,
			fragmentShader: FRAG,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});

		this.points = new THREE.Points(geo, this.material);
		this.points.frustumCulled = false;
		scene.add(this.points);

		if (!this.emitting) {
			for (let i = 0; i < count; i++) this._spawn(i);
		} else {
			this.lifes.fill(0);
		}
	}

	_spawn(i: number) {
		const o = this.opts;
		this.positions[i * 3] = o.origin.x + rand(-o.originSpread, o.originSpread);
		this.positions[i * 3 + 1] = o.origin.y + rand(-o.originSpread, o.originSpread);
		this.positions[i * 3 + 2] = o.origin.z + rand(-o.originSpread, o.originSpread) * 0.3;

		let dir;
		if (o.direction) {
			// random direction within cone around o.direction
			dir = o.direction.clone();
			const perp1 = new THREE.Vector3(1, 0, 0).cross(dir);
			if (perp1.lengthSq() < 0.01) perp1.set(0, 1, 0).cross(dir);
			perp1.normalize();
			const perp2 = dir.clone().cross(perp1).normalize();
			const a = rand(0, Math.PI * 2);
			const r = Math.sin(rand(0, o.cone / 2));
			dir
				.multiplyScalar(Math.cos(rand(0, o.cone / 2)))
				.addScaledVector(perp1, Math.cos(a) * r)
				.addScaledVector(perp2, Math.sin(a) * r)
				.normalize();
		} else {
			dir = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-0.4, 0.4)).normalize();
		}
		const sp = rand(o.speed[0], o.speed[1]);
		this.velocities[i * 3] = dir.x * sp;
		this.velocities[i * 3 + 1] = dir.y * sp;
		this.velocities[i * 3 + 2] = dir.z * sp;

		const life = rand(o.life[0], o.life[1]);
		this.lifes[i] = life;
		this.maxLifes[i] = life;
		this.sizes[i] = rand(o.size[0], o.size[1]);
		this.rots[i] = rand(0, Math.PI * 2);
		this.rotSpeeds[i] = rand(o.spin[0], o.spin[1]);
		const c = new THREE.Color(pick(o.colors));
		this.cols[i * 3] = c.r;
		this.cols[i * 3 + 1] = c.g;
		this.cols[i * 3 + 2] = c.b;
		this.alphas[i] = 0;
	}

	stop() {
		this.emitting = false;
	}

	update(dt: number) {
		const o = this.opts;
		let alive = 0;

		if (this.emitting) {
			this._emitAcc += dt * this.emitRate;
			let toEmit = Math.floor(this._emitAcc);
			this._emitAcc -= toEmit;
			for (let i = 0; i < this.count && toEmit > 0; i++) {
				if (this.lifes[i] <= 0) {
					this._spawn(i);
					toEmit--;
				}
			}
		}

		for (let i = 0; i < this.count; i++) {
			if (this.lifes[i] <= 0) {
				this.alphas[i] = 0;
				continue;
			}
			alive++;
			this.lifes[i] -= dt;
			const t = 1 - this.lifes[i] / this.maxLifes[i]; // 0→1 over life
			this.velocities[i * 3] += o.gravity.x * dt;
			this.velocities[i * 3 + 1] += o.gravity.y * dt;
			this.velocities[i * 3 + 2] += o.gravity.z * dt;
			if (o.field) {
				const a = o.field(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
				this.velocities[i * 3] += a[0] * dt;
				this.velocities[i * 3 + 1] += a[1] * dt;
				this.velocities[i * 3 + 2] += a[2] * dt;
			}
			this.velocities[i * 3] *= o.drag;
			this.velocities[i * 3 + 1] *= o.drag;
			this.velocities[i * 3 + 2] *= o.drag;
			this.positions[i * 3] += this.velocities[i * 3] * dt;
			this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
			this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
			this.rots[i] += this.rotSpeeds[i] * dt;
			const fadeIn = Math.min(1, t / Math.max(0.001, o.fadeIn));
			this.alphas[i] = fadeIn * (1 - t) * (1 - t) * 1.2;
		}

		this.points.geometry.attributes.position.needsUpdate = true;
		this.points.geometry.attributes.aAlpha.needsUpdate = true;
		this.points.geometry.attributes.aRot.needsUpdate = true;
		// emitters write size/colour at spawn time, after the first GPU upload
		this.points.geometry.attributes.aSize.needsUpdate = true;
		this.points.geometry.attributes.aColor.needsUpdate = true;

		if (alive === 0 && !this.emitting) {
			this.dispose();
		}
	}

	dispose() {
		if (this.dead) return;
		this.dead = true;
		this.scene.remove(this.points);
		this.points.geometry.dispose();
		this.material.dispose();
	}
}

export class Particles {
	scene: THREE.Scene;
	bursts: Set<Burst>;

	constructor(scene: THREE.Scene) {
		this.scene = scene;
		this.bursts = new Set();
	}

	burst(opts: BurstOptions): Burst {
		const b = new Burst(this.scene, opts);
		this.bursts.add(b);
		return b;
	}

	/** Continuous emitter; call .stop() on the returned object to end it. */
	emitter(opts: EmitterOptions): Burst {
		return this.burst({ ...opts, emitRate: opts.emitRate || 60 });
	}

	update(dt: number) {
		for (const b of this.bursts) {
			b.update(dt);
			if (b.dead) this.bursts.delete(b);
		}
	}

	setScale(pixelHeight: number) {
		for (const b of this.bursts) b.material.uniforms.uScale.value = pixelHeight * 0.8;
	}
}
