// Effect 24 — GENIE OF THE MACHINE: the iris cracks open and something far
// stranger than smoke rises out — a coiling braid of iridescent light, hue
// rolling from teal through violet to magenta, orbited by sharp streaks of
// escaping glow. It dances, condenses into the words you were hoping for,
// and then the machine swallows the whole apparition back down with one
// satisfied gulp. Wish granted; receipts retained.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'spinningRim';
export const duration = 10500;

// A helical ribbon: the plane's x-span becomes an angular band around a
// central axis, its y-span the height — three of these, phase-offset, braid
// into one rising coil. The fragment shader flows hue-cycling bands down the
// ribbon with feathered edges: liquid light, not vapour.
const VERT = /* glsl */ `
	uniform float uTime;
	uniform float uPhase;
	uniform float uRise; // 0 = swallowed into the mouth, 1 = fully risen
	varying vec2 vUv;
	void main() {
		vUv = uv;
		float h = uv.y * 2.1 * uRise; // height above the mouth
		// coil: angle advances with height and time; the braid breathes
		float angle = uPhase + h * 3.1 - uTime * 1.6 + uv.x * 1.25;
		float flare = 0.12 + h * 0.16 + 0.05 * sin(h * 4.0 - uTime * 2.2);
		vec3 p = vec3(cos(angle) * flare, h, sin(angle) * flare);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}
`;

const FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uAlpha;
	varying vec2 vUv;
	// compact hue → neon rgb, saturated enough to survive additive blending
	vec3 hue2rgb(float h) {
		vec3 k = mod(vec3(5.0, 3.0, 1.0) + h * 6.0, 6.0);
		return 0.95 - 0.88 * clamp(min(k, 4.0 - k), 0.0, 1.0);
	}
	void main() {
		// bands of light flowing down the coil
		float bands = 0.55 + 0.45 * sin(vUv.y * 24.0 + uTime * 5.0 + vUv.x * 6.0);
		float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
		float tip = smoothstep(1.0, 0.86, vUv.y); // feather the crown
		float hue = fract(vUv.y * 0.5 - uTime * 0.11 + vUv.x * 0.12);
		gl_FragColor = vec4(hue2rgb(hue), bands * edge * tip * uAlpha);
	}
`;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;

	const MOUTH = new THREE.Vector3(0, 0.05, 0.4); // just in front of the open iris
	const NEON = [0x46f0e0, 0xff5fd0, 0x9a5cff, 0x40e8ff];

	// ---- the machine stirs: half-light, breathing prismatic innards
	const restore = dimLights(scene, 0.35, 900);
	scene.fxLight.color.set(0x9a5cff);
	scene.fxLight.position.set(0, 0.6, 1.1);
	tween(1100, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 3.5));
	// the inner glow breathes through the spectrum for the whole visit
	const glowCol = new THREE.Color();
	let T = 0;
	const stopClock = scene.addUpdatable((dt) => {
		T += dt;
		glowCol.setHSL((0.45 + T * 0.09) % 1, 0.85, 0.6);
		machine.setInnerGlow(0.45 + Math.sin(T * 2.1) * 0.18, glowCol);
	});
	// the void behind the iris: not the portal's daytime sky (that's
	// portalDrop's trick), but a violet-throated dark with its own stars —
	// in place BEFORE the iris cracks, so it's all you ever see inside
	const cv = document.createElement('canvas');
	cv.width = cv.height = 256;
	const c2 = cv.getContext('2d')!;
	const grad = c2.createRadialGradient(128, 128, 10, 128, 128, 128);
	grad.addColorStop(0, '#000006');
	grad.addColorStop(0.55, '#0a0418');
	grad.addColorStop(0.85, '#1c0b33');
	grad.addColorStop(1, '#2b1048');
	c2.fillStyle = grad;
	c2.fillRect(0, 0, 256, 256);
	c2.fillStyle = '#b9a6ff';
	for (let i = 0; i < 40; i++) {
		c2.globalAlpha = 0.25 + Math.random() * 0.6;
		c2.fillRect(Math.random() * 256, Math.random() * 256, 1.5, 1.5);
	}
	c2.globalAlpha = 1;
	const voidMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv) });
	const voidDisc = new THREE.Mesh(new THREE.CircleGeometry(0.8, 48), voidMat);
	voidDisc.position.set(0, 0, -0.2);
	scene.scene.add(voidDisc);

	const opening = machine.openIris(0.45, 1200);
	machine.portal.visible = false; // openIris shows the sky; overrule it same-frame
	await opening;
	// reflections go neon only AFTER the dim settles — never two hands on
	// environmentIntensity at once
	scene.crossfadeEnvironment('neon', 800);
	haptics.vibrate(35);

	// ---- THE EMERGENCE: a braid of three helical ribbons rises and dances
	const genie = new THREE.Group();
	genie.position.copy(MOUTH);
	scene.scene.add(genie);
	const ribbons: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>[] = [];
	for (let i = 0; i < 3; i++) {
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uPhase: { value: (i / 3) * Math.PI * 2 },
				uRise: { value: 0 },
				uAlpha: { value: 0 }
			},
			vertexShader: VERT,
			fragmentShader: FRAG,
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 10, 72), mat);
		genie.add(mesh);
		ribbons.push(mesh);
	}
	const stopDance = scene.addUpdatable((dt, t) => {
		for (const r of ribbons) r.material.uniforms.uTime.value = t;
		genie.rotation.y = t * 0.5; // the whole braid slowly revolves…
		genie.rotation.z = Math.sin(t * 0.7) * 0.07; // …and sways on its hips
	});

	// sharp streaks of light orbiting the column — escaping glow, not smoke
	const orbiters = particles.emitter({
		texture: sprites.streak,
		count: 60,
		emitRate: 18,
		origin: MOUTH.clone().add(new THREE.Vector3(0, 0.3, 0)),
		originSpread: 0.3,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.3,
		speed: [0.15, 0.4],
		drag: 0.25,
		life: [1.4, 2.4],
		size: [0.025, 0.06],
		colors: NEON,
		spin: [-2, 2],
		fadeIn: 0.2,
		// swirl around the column's axis, leashed to it, drifting upward
		field: (x, y, z) => {
			const dx = x - MOUTH.x;
			const dz = z - MOUTH.z;
			const d = Math.max(0.12, Math.hypot(dx, dz));
			return [(-dz / d) * 2.2 - dx * 1.4, 0.75 + Math.sin(y * 3 + T * 2) * 0.3, (dx / d) * 2.2 - dz * 1.4];
		}
	});

	audio.sfx('swoosh', { pitch: 0.5, gain: 1.0 });
	await tween(1300, 'outCubic', (v) => {
		for (const r of ribbons) {
			r.material.uniforms.uRise.value = v;
			r.material.uniforms.uAlpha.value = v * 0.85;
		}
	});
	// let it dance — glints pop inside the braid like thoughts forming
	for (let i = 0; i < 3; i++) {
		delay(300 + i * 600).then(() =>
			particles.burst({
				texture: sprites.star4,
				count: 8,
				origin: MOUTH.clone().add(new THREE.Vector3(rand(-0.25, 0.25), rand(0.4, 1.7), rand(-0.2, 0.2))),
				speed: [0.05, 0.3],
				life: [0.4, 0.9],
				size: [0.02, 0.05],
				colors: NEON
			})
		);
	}
	await delay(1900);

	// ---- condensation: the braid draws down tight as the words gather from it
	audio.sfx('gong', { pitch: 1.35, gain: 0.5 });
	orbiters.stop();
	haptics.vibrate(25);
	tween(900, 'inQuad', (v) => {
		for (const r of ribbons) {
			r.material.uniforms.uRise.value = 1 - v * 0.55; // squeezes toward the mouth
			r.material.uniforms.uAlpha.value = 0.85 * (1 - v);
		}
	});
	await luckyWord(ctx, {
		text: 'WISH GRANTED',
		color: 0x46f0e0,
		colorB: 0xff5fd0,
		y: 0.95,
		gather: 1100,
		hold: 1800,
		scatter: 500
	});

	// ---- the inhale. Everything spirals back into the mouth — sharply.
	audio.sfx('gulp', { pitch: 0.85, gain: 1.2 });
	haptics.vibrate([15, 40, 60]);
	const inhale = particles.emitter({
		texture: sprites.streak,
		count: 90,
		emitRate: 160,
		origin: new THREE.Vector3(0, 0.9, 0.5),
		originSpread: 1.7,
		direction: null,
		speed: [0.05, 0.15],
		life: [0.45, 0.8],
		size: [0.02, 0.055],
		colors: NEON,
		fadeIn: 0.08,
		// spiral drain: strong tangential swirl + inverse-square pull
		field: (x, y, z) => {
			const dx = MOUTH.x - x, dy = MOUTH.y - y, dz = MOUTH.z - z;
			const d = Math.max(0.2, Math.hypot(dx, dy, dz));
			const pull = 30 / (d * d);
			return [(dx / d) * pull - dy * 2.5, (dy / d) * pull + dx * 2.5, (dz / d) * pull];
		}
	});
	await delay(650);
	inhale.stop();

	// the swallow lands: iris snaps shut, one satisfied thump
	scene.shake(0.4);
	audio.sfx('boom', { pitch: 1.1, gain: 0.6 });
	shockwave(scene.scene, MOUTH, { color: 0xff5fd0, maxScale: 3.2, duration: 600 });
	flashPulse(machine, 0.7, 80, 550, 0x9a5cff);
	await machine.closeIris(700);

	stopDance();
	stopClock();
	scene.scene.remove(genie, voidDisc);
	voidDisc.geometry.dispose();
	voidMat.map!.dispose();
	voidMat.dispose();
	for (const r of ribbons) {
		r.geometry.dispose();
		r.material.dispose();
	}
	tween(900, 'outQuad', (v) => (scene.fxLight.intensity = 3.5 * (1 - v)));
	await restore(1000);
	scene.crossfadeEnvironment('lounge', 1200); // settles as the lights land
	machine.setInnerGlow(0.2);
}
