// Effect 23 — SOLAR ECLIPSE OF FORTUNE: the lounge falls away to a night sky,
// a blazing sun climbs above the machine, and a black moon slides across it.
// Totality: corona streamers, a slow ring of glyphs, held breath. Then the
// diamond ring — one blinding point of light on the trailing edge — and the
// world floods back golden. The rarest kind of luck: being in the right
// shadow at the right time.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'powerStreams';
export const duration = 11500;

const CORONA_FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uIntensity;
	uniform float uInner;
	varying vec2 vUv;
	void main() {
		vec2 p = vUv - 0.5;
		float r = length(p) * 2.0;
		float ang = atan(p.y, p.x);
		// streamers: two interfering ray systems, drifting slowly opposite ways
		float rays = 0.55 + 0.45 * sin(ang * 11.0 + uTime * 0.7)
		                  * sin(ang * 5.0 - uTime * 0.45);
		// a tight bright rim at the disc edge plus a long soft falloff
		float rim = smoothstep(uInner - 0.05, uInner, r) * smoothstep(uInner + 0.16, uInner + 0.02, r);
		float glow = pow(max(0.0, 1.0 - (r - uInner) / 0.75), 2.4) * step(uInner, r);
		vec3 col = mix(vec3(1.0, 0.98, 0.92), vec3(1.0, 0.78, 0.38), clamp((r - uInner) * 2.2, 0.0, 1.0));
		gl_FragColor = vec4(col, (rim * 0.9 + glow * rays * 0.85) * uIntensity);
	}
`;

const VERT = /* glsl */ `
	varying vec2 vUv;
	void main() {
		vUv = uv;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, glyphTextures, audio, haptics } = ctx;

	// NOTE: the quilt backdrop lives at z=-0.75 — the whole eclipse set must
	// sit in front of it or the sky show plays to an empty house
	const SUN = new THREE.Vector3(0.95, 1.5, -0.45);

	// ---- nightfall: the lounge reflections give way to a night sky
	const restore = dimLights(scene, 0.14, 1600);
	scene.crossfadeEnvironment('nightSky', 1400);
	scene.fxLight.color.set(0xffe8b0);
	scene.fxLight.position.copy(SUN).setZ(0.6);
	tween(1500, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 5));

	// ---- the sun: a blazing core sprite wrapped in a shader corona
	const sunGroup = new THREE.Group();
	sunGroup.position.copy(SUN);
	const coreMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xfff2cf,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const core = new THREE.Sprite(coreMat);
	core.scale.setScalar(1.05);
	const coronaMat = new THREE.ShaderMaterial({
		uniforms: { uTime: { value: 0 }, uIntensity: { value: 0 }, uInner: { value: 0.34 } },
		vertexShader: VERT,
		fragmentShader: CORONA_FRAG,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
	const corona = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), coronaMat);
	sunGroup.add(corona, core);
	scene.scene.add(sunGroup);

	// ---- the moon: a matte-black disc with the faintest cool rim
	const moonMat = new THREE.MeshBasicMaterial({ color: 0x05060a });
	const moon = new THREE.Mesh(new THREE.CircleGeometry(0.36, 64), moonMat);
	const moonStart = new THREE.Vector3(SUN.x - 2.4, SUN.y + 1.5, SUN.z + 0.06);
	moon.position.copy(moonStart);
	scene.scene.add(moon);

	// ---- a slow ring of omen-glyphs orbiting the eclipse
	const glyphMat = new THREE.MeshBasicMaterial({
		map: glyphTextures[1],
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide
	});
	const glyphRing = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.1), glyphMat);
	glyphRing.position.copy(SUN).add(new THREE.Vector3(0, 0, 0.02));
	scene.scene.add(glyphRing);

	const stopSpin = scene.addUpdatable((dt, t) => {
		coronaMat.uniforms.uTime.value = t;
		glyphRing.rotation.z -= dt * 0.22;
	});

	// dawn of the wrong kind of day
	audio.sfx('swoosh', { pitch: 0.55, gain: 0.8 });
	haptics.vibrate(30);
	machine.setInnerGlow(0.1, 0xffd27a);
	await Promise.all([
		tween(1400, 'inOutQuad', (v) => {
			coreMat.opacity = v * 0.95;
			coronaMat.uniforms.uIntensity.value = v * 0.5;
		}),
		tween(1800, 'inOutQuad', (v) => (glyphMat.opacity = v * 0.16))
	]);

	// ---- first contact → transit. The moon crosses; the world holds its breath.
	audio.sfx('swoosh', { pitch: 0.4, gain: 0.6 });
	const transit = tween(3400, 'inOutQuad', (v) => {
		moon.position.lerpVectors(moonStart, SUN.clone().setZ(moonStart.z), v);
		// deepening shadow as coverage grows
		const cover = Math.max(0, v - 0.55) / 0.45;
		coreMat.opacity = 0.95 * (1 - cover * 0.96);
		scene.fxLight.intensity = 5 * (1 - cover * 0.85);
		machine.setInnerGlow(0.1 + cover * 0.25, 0xffd27a);
	});
	// ticking dread as the disc closes
	for (let i = 0; i < 6; i++) {
		delay(1600 + i * 300).then(() => audio.sfx('tick', { pitch: 0.8 + i * 0.1, gain: 0.5 }));
	}
	await transit;

	// ---- TOTALITY. Corona blazes, stars come out, time stops.
	haptics.vibrate([40, 80, 40]);
	audio.sfx('boom', { pitch: 0.6, gain: 0.5 });
	tween(700, 'outQuad', (v) => {
		coronaMat.uniforms.uIntensity.value = 0.5 + v * 0.75;
		glyphMat.opacity = 0.16 + v * 0.2;
	});
	// stars: pinprick glints scattered across the dark
	particles.burst({
		texture: sprites.star4,
		count: 70,
		origin: new THREE.Vector3(0, 0.8, -0.65),
		originSpread: 5.2,
		speed: [0, 0.04],
		life: [2.2, 3.4],
		size: [0.008, 0.026],
		colors: [0xffffff, 0xcfe0ff, 0xffe8c0],
		fadeIn: 0.5
	});
	await delay(2100);

	// ---- THE DIAMOND RING. One blinding point on the trailing edge.
	const edge = SUN.clone().add(new THREE.Vector3(0.24, 0.2, 0.1));
	audio.sfx('chime', { pitch: 1.4, gain: 1.1 });
	audio.sfx('zap', { pitch: 1.6, gain: 0.5 });
	scene.shake(0.65);
	haptics.vibrate([20, 30, 90]);
	particles.burst({
		texture: sprites.spark,
		count: 90,
		origin: edge,
		speed: [0.6, 3.2],
		life: [0.5, 1.3],
		size: [0.014, 0.05],
		colors: [0xffffff, 0xfff3cf, 0xffd27a]
	});
	shockwave(scene.scene, SUN, { color: 0xfff0c8, maxScale: 5.5, duration: 900, z: SUN.z + 0.15 });
	flashPulse(machine, 1.0, 70, 700, 0xfff6e0);
	luckyWord(ctx, { text: 'TOTALLY LUCKY', color: 0xffd27a, colorB: 0xfff3cf, y: -1.15 });

	// ---- the moon moves on; light floods back golden.
	// NOTE: crossfadeEnvironment and dimLights' restore both tween
	// environmentIntensity, so they run strictly in sequence, never together.
	const moonEnd = new THREE.Vector3(SUN.x + 2.6, SUN.y - 1.3, moonStart.z);
	scene.crossfadeEnvironment('gold', 900); // done well before restore() below
	audio.sfx('swoosh', { pitch: 0.7, gain: 0.7 });
	await tween(2300, 'inOutQuad', (v) => {
		moon.position.lerpVectors(SUN.clone().setZ(moonStart.z), moonEnd, v);
		coreMat.opacity = Math.min(0.95, 0.04 + v * 1.2);
		coronaMat.uniforms.uIntensity.value = 1.25 * (1 - v * 0.8);
		scene.fxLight.intensity = 0.75 + v * 4.25;
	});
	await restore(1200);
	scene.crossfadeEnvironment('lounge', 1500); // settles during the outro below

	// ---- sunset on demand: everything bows out
	await Promise.all([
		tween(1000, 'inOutQuad', (v) => {
			coreMat.opacity = 0.95 * (1 - v);
			coronaMat.uniforms.uIntensity.value = 0.25 * (1 - v);
			glyphMat.opacity = 0.36 * (1 - v);
			scene.fxLight.intensity = 5 * (1 - v);
			machine.setInnerGlow(0.35 * (1 - v), 0xffd27a);
		})
	]);

	stopSpin();
	scene.scene.remove(sunGroup, moon, glyphRing);
	corona.geometry.dispose();
	coronaMat.dispose();
	coreMat.dispose();
	moon.geometry.dispose();
	moonMat.dispose();
	glyphRing.geometry.dispose();
	glyphMat.dispose(); // texture belongs to ctx.glyphTextures — leave it
	machine.setInnerGlow(0.2);
}
