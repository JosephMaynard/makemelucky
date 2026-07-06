// Effect 14 — RAINBOW: a full spectrum arc draws itself over the machine,
// sparkling at both ends — and where a rainbow ends, coins follow.

import * as THREE from 'three';
import { tween, delay } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'charmAward';
export const duration = 9000;

const VERT = /* glsl */ `
	varying vec2 vPos;
	void main() {
		vPos = position.xy;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const FRAG = /* glsl */ `
	uniform float uProgress;
	uniform float uAlpha;
	uniform float uTime;
	uniform float uInner;
	uniform float uOuter;
	varying vec2 vPos;
	vec3 spectrum(float t) {
		vec3 c = clamp(abs(mod(t * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
		return c;
	}
	void main() {
		float r = length(vPos);
		float band = (r - uInner) / (uOuter - uInner); // 0 inner … 1 outer
		float ang = atan(vPos.y, vPos.x); // π (left) → 0 (right) across the top
		float drawn = (3.14159265 - ang) / 3.14159265; // 0 at left foot → 1 at right foot
		if (ang < 0.0 || drawn > uProgress) discard;
		float edge = smoothstep(0.0, 0.14, band) * smoothstep(1.0, 0.86, band);
		float shimmer = 0.85 + 0.15 * sin(drawn * 34.0 - uTime * 3.0);
		vec3 col = spectrum((1.0 - band) * 0.78); // red outermost → violet innermost
		float tipGlow = smoothstep(uProgress - 0.05, uProgress, drawn);
		gl_FragColor = vec4(col * shimmer + vec3(1.0) * tipGlow * 0.7, edge * uAlpha);
	}
`;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.42, 900);
	scene.fxLight.color.set(0xfff3cf);
	scene.fxLight.position.set(0, 0.6, 1.4);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3.5));

	// the arc: half-torus, spectrum across the tube
	const INNER = 1.5;
	const OUTER = 2.15;
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uProgress: { value: 0 },
			uAlpha: { value: 0.85 },
			uTime: { value: 0 },
			uInner: { value: INNER },
			uOuter: { value: OUTER }
		},
		vertexShader: VERT,
		fragmentShader: FRAG,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
	const arc = new THREE.Mesh(new THREE.RingGeometry(INNER, OUTER, 96, 1, 0, Math.PI), mat);
	arc.position.set(0, -0.75, -0.15);
	scene.scene.add(arc);
	const stopTime = scene.addUpdatable((dt, t) => (mat.uniforms.uTime.value = t));

	// draw the rainbow on, left to right
	haptics.vibrate(30);
	await tween(2200, 'inOutCubic', (v) => (mat.uniforms.uProgress.value = v));
	haptics.vibrate([20, 30, 60]);

	// sparkles + coin trickle at both ends of the rainbow
	const ends = [new THREE.Vector3(-1.85, -0.75, -0.15), new THREE.Vector3(1.85, -0.75, -0.15)];
	const emitters = [];
	for (const end of ends) {
		emitters.push(
			particles.emitter({
				texture: sprites.star4,
				count: 90,
				emitRate: 26,
				origin: end,
				originSpread: 0.25,
				direction: new THREE.Vector3(0, 1, 0.3).normalize(),
				cone: 1,
				speed: [0.3, 0.9],
				gravity: new THREE.Vector3(0, -0.5, 0),
				life: [0.8, 1.8],
				size: [0.03, 0.08],
				colors: [0xffffff, 0xfff3cf, 0xffd27a]
			}),
			particles.emitter({
				texture: sprites.coin,
				count: 60,
				emitRate: 14,
				origin: end.clone().add(new THREE.Vector3(0, 0.2, 0.15)),
				originSpread: 0.15,
				direction: new THREE.Vector3(0, 1, 0.4).normalize(),
				cone: 0.8,
				speed: [0.8, 1.8],
				gravity: new THREE.Vector3(0, -2.4, 0),
				life: [1.2, 2],
				size: [0.09, 0.17],
				colors: [0xf7ce6b, 0xffe9ad],
				spin: [-5, 5]
			})
		);
	}
	machine.setInnerGlow(0.4, 0xfff3cf);
	await delay(3400);

	// the rainbow melts away
	for (const e of emitters) e.stop();
	await tween(1200, 'inOutQuad', (v) => (mat.uniforms.uAlpha.value = 0.85 * (1 - v)));
	stopTime();
	scene.scene.remove(arc);
	arc.geometry.dispose();
	mat.dispose();
	await flashPulse(machine, 0.6, 120, 700, 0xfff3cf);
	tween(700, 'outQuad', (v) => {
		machine.setInnerGlow(0.4 * (1 - v));
		scene.fxLight.intensity = 3.5 * (1 - v);
	});
	await restore(900);
}
