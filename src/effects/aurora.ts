// Effect 10 — AURORA: the lights fall and ethereal ribbons of green-violet
// light wave over the machine like the northern lights paying a visit.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'rimLight';
export const duration = 8400;

const VERT = /* glsl */ `
	uniform float uTime;
	uniform float uPhase;
	varying vec2 vUv;
	void main() {
		vUv = uv;
		vec3 p = position;
		p.y += sin(p.x * 0.9 + uTime * 1.1 + uPhase) * 0.35
		     + sin(p.x * 1.7 - uTime * 0.7 + uPhase * 2.0) * 0.18;
		p.z += cos(p.x * 1.2 + uTime * 0.8 + uPhase) * 0.22;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}
`;

const FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uAlpha;
	uniform vec3 uColorA;
	uniform vec3 uColorB;
	varying vec2 vUv;
	void main() {
		float band = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
		float curtain = 0.55 + 0.45 * sin(vUv.x * 26.0 - uTime * 2.4)
		                     * sin(vUv.x * 7.0 + uTime * 1.1);
		vec3 col = mix(uColorA, uColorB, 0.5 + 0.5 * sin(vUv.x * 3.0 + uTime * 0.6));
		gl_FragColor = vec4(col, band * curtain * uAlpha);
	}
`;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.3, 1100);
	scene.fxLight.color.set(0x46f0b4);
	scene.fxLight.position.set(0, 1, 1.2);
	tween(1100, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 4));

	const ribbons: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
	const defs: { y: number; z: number; colA: number; colB: number; phase: number; flip?: boolean }[] = [
		{ y: 1.1, z: -0.35, colA: 0x2ee6a0, colB: 0x6a7dff, phase: 0 },
		{ y: 1.55, z: -0.5, colA: 0x46f0b4, colB: 0x9a5cff, phase: 2.1 },
		{ y: 2.0, z: -0.62, colA: 0x8ff0ff, colB: 0x5cff9a, phase: 4.4 },
		// and below — the lights pool along the floor of the scene too
		{ y: -1.5, z: -0.4, colA: 0x2ee6a0, colB: 0x8a5cff, phase: 1.2, flip: true },
		{ y: -1.95, z: -0.55, colA: 0x5cff9a, colB: 0x6a7dff, phase: 3.6, flip: true }
	];
	for (const def of defs) {
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uPhase: { value: def.phase },
				uAlpha: { value: 0 },
				uColorA: { value: new THREE.Color(def.colA) },
				uColorB: { value: new THREE.Color(def.colB) }
			},
			vertexShader: VERT,
			fragmentShader: FRAG,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.15, 160, 1), mat);
		mesh.position.set(0, def.y, def.z);
		mesh.rotation.x = def.flip ? 0.15 : -0.15;
		scene.scene.add(mesh);
		ribbons.push(mesh);
	}

	const stopWave = scene.addUpdatable((dt, t) => {
		for (const r of ribbons) r.material.uniforms.uTime.value = t;
	});

	// shimmer motes drifting upward through the light
	const motes = particles.emitter({
		texture: sprites.softDot,
		count: 200,
		emitRate: 40,
		origin: new THREE.Vector3(0, 0.6, 0.1),
		originSpread: 2.2,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.5,
		speed: [0.08, 0.3],
		gravity: new THREE.Vector3(0, 0.05, 0),
		life: [2, 4],
		size: [0.008, 0.03],
		colors: [0x8ff0ff, 0x46f0b4, 0xbf9aff],
		fadeIn: 0.25
	});

	haptics.vibrate(25);
	machine.setInnerGlow(0, 0x46f0b4);
	tween(1700, 'inOutQuad', (v) => machine.setInnerGlow(v * 0.5, 0x46f0b4));

	// fade the curtains in, let them dance
	await Promise.all(
		ribbons.map((r, i) => tween(1000 + i * 210, 'inOutQuad', (v) => (r.material.uniforms.uAlpha.value = v * 0.75)))
	);
	await delay(2100);

	// the crescendo: the whole sky surges once — bright, then breathless
	ctx.audio.sfx('gong', { pitch: 0.8, gain: 0.55 }); // deep, distant, serene
	scene.shake(0.18); // barely a tremor; this one stays serene
	haptics.vibrate(20);
	tween(900, 'inOutQuad', (v) => {
		const surge = 0.75 + Math.sin(v * Math.PI) * 0.25;
		for (const r of ribbons) r.material.uniforms.uAlpha.value = surge;
		machine.setInnerGlow(0.5 + Math.sin(v * Math.PI) * 0.4, 0x46f0b4);
	});
	// a slow soft bloom of motes released at once, like a breath let out
	particles.burst({
		texture: sprites.softDot,
		count: 90,
		origin: new THREE.Vector3(0, 1.2, -0.2),
		originSpread: 2.6,
		speed: [0.05, 0.25],
		life: [1.6, 2.8],
		size: [0.01, 0.04],
		colors: [0x8ff0ff, 0x46f0b4, 0xbf9aff],
		fadeIn: 0.35
	});
	flashPulse(machine, 0.45, 260, 900, 0x46f0b4); // a glow swell, not a bang
	await luckyWord(ctx, {
		text: 'SERENELY LUCKY',
		color: 0x46f0b4,
		colorB: 0xbf9aff,
		y: -1.1,
		gather: 900,
		hold: 1100,
		scatter: 600
	});

	motes.stop();
	await Promise.all(
		ribbons.map((r, i) => tween(850 + i * 140, 'inOutQuad', (v) => (r.material.uniforms.uAlpha.value = 0.75 * (1 - v))))
	);
	stopWave();
	for (const r of ribbons) {
		scene.scene.remove(r);
		r.geometry.dispose();
		r.material.dispose();
	}
	tween(900, 'outQuad', (v) => {
		scene.fxLight.intensity = 4 * (1 - v);
		machine.setInnerGlow(0.5 * (1 - v), 0x46f0b4);
	});
	await restore(1100);
}
