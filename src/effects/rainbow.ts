// Effect 14 — RAINBOW: a full spectrum arc draws itself over the machine,
// sparkling at both ends — and where a rainbow ends, coins follow.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import type { EffectContext } from '../types';

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

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

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
		depthTest: false, // the rainbow arcs OVER everything
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
	const arc = new THREE.Mesh(new THREE.RingGeometry(INNER, OUTER, 96, 1, 0, Math.PI), mat);
	arc.position.set(0, -0.75, 0.7);
	arc.renderOrder = 9;
	// fit the arch inside the visible width — phones are much narrower
	const cam = scene.camera;
	const halfW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (5.35 - 0.7) * cam.aspect;
	const fit = Math.min(1, (halfW * 0.97) / OUTER);
	arc.scale.setScalar(fit);
	scene.scene.add(arc);
	const stopTime = scene.addUpdatable((dt, t) => (mat.uniforms.uTime.value = t));

	// draw the rainbow on, left to right
	haptics.vibrate(30);
	await tween(2200, 'inOutCubic', (v) => (mat.uniforms.uProgress.value = v));
	haptics.vibrate([20, 30, 60]);

	// coins tumble OUT of both rainbow ends, with sparkle fountains
	const emitters = [];
	for (const side of [-1, 1]) {
		const end = new THREE.Vector3(side * 1.82 * fit, -0.6, 0.7);
		emitters.push(
			particles.emitter({
				texture: sprites.star4,
				count: 130,
				emitRate: 42,
				origin: end,
				originSpread: 0.3,
				direction: new THREE.Vector3(side * 0.3, 1, 0.2).normalize(),
				cone: 1.4,
				speed: [0.4, 1.2],
				gravity: new THREE.Vector3(0, -0.6, 0),
				life: [0.8, 1.8],
				size: [0.03, 0.09],
				colors: [0xffffff, 0xfff3cf, 0xffd27a]
			}),
		);
	}

	// pokie-style POP COINS: solid gold coins popping out of both rainbow ends
	// in chunky arcs, like a machine paying out a big win
	const coinGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.028, 22);
	const coinMat = new THREE.MeshStandardMaterial({
		color: 0xf0c05a,
		metalness: 1,
		roughness: 0.24,
		envMapIntensity: 1.7,
		emissive: 0x7a5c1e, // keeps the shadowed faces golden, not black blobs
		emissiveIntensity: 0.55
	});
	const popCoins: THREE.Mesh[] = [];
	for (let i = 0; i < 22; i++) {
		const coin = new THREE.Mesh(coinGeo, coinMat);
		coin.visible = false;
		coin.userData = {
			vel: new THREE.Vector3(),
			spin: new THREE.Vector3(),
			live: false,
			delay: i * 0.16 + rand(0, 0.08),
			side: i % 2 ? 1 : -1
		};
		scene.scene.add(coin);
		popCoins.push(coin);
	}
	let coinClock = 0;
	let popping = true;
	const stopCoins = scene.addUpdatable((dt) => {
		coinClock += dt;
		for (const coin of popCoins) {
			const u = coin.userData;
			if (!u.live) {
				if (popping && coinClock >= u.delay) {
					u.live = true;
					coin.visible = true;
					coin.position.set(u.side * 1.82 * fit, -0.55, 0.8);
					// arc INWARD over the machine so the coins stay in shot
				u.vel.set(-u.side * rand(0.3, 1.1), rand(2.6, 3.6), rand(0.12, 0.4));
					u.spin.set(rand(-8, 8), rand(-4, 4), rand(-8, 8));
					coin.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
					if (Math.random() < 0.7) audio.sfx('ding', { pitch: 1.2 + Math.random() * 0.5, gain: 0.3 });
				}
				continue;
			}
			u.vel.y -= 3.6 * dt; // lazy pokie arcs, not meteorites
			coin.position.addScaledVector(u.vel, dt);
			coin.rotation.x += u.spin.x * dt;
			coin.rotation.y += u.spin.y * dt;
			coin.rotation.z += u.spin.z * dt;
			if (coin.position.y < -2.3) {
				coin.visible = false;
				u.live = false;
				if (popping) u.delay = coinClock + rand(0.05, 0.5);
				else u.delay = Infinity;
			}
		}
	});
	// glitter drifting off the whole arch
	emitters.push(
		particles.emitter({
			texture: sprites.star4,
			count: 120,
			emitRate: 30,
			origin: new THREE.Vector3(0, 0.6 * fit, 0.7),
			originSpread: 1.7 * fit,
			speed: [0.05, 0.25],
			gravity: new THREE.Vector3(0, -0.15, 0),
			life: [1.2, 2.4],
			size: [0.015, 0.05],
			colors: [0xffffff, 0xfff3cf],
			fadeIn: 0.3
		})
	);
	machine.setInnerGlow(0.22, 0xfff3cf);
	await delay(3400);

	// the rainbow melts away; the last coins fall out of shot
	for (const e of emitters) e.stop();
	popping = false;
	await tween(1200, 'inOutQuad', (v) => (mat.uniforms.uAlpha.value = 0.85 * (1 - v)));
	stopTime();
	stopCoins();
	scene.scene.remove(arc, ...popCoins);
	coinGeo.dispose();
	coinMat.dispose();
	arc.geometry.dispose();
	mat.dispose();
	await flashPulse(machine, 0.6, 120, 700, 0xfff3cf);
	tween(700, 'outQuad', (v) => {
		machine.setInnerGlow(0.22 * (1 - v));
		scene.fxLight.intensity = 3.5 * (1 - v);
	});
	await restore(900);
}
