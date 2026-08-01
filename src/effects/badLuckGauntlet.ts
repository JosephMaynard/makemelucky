// Effect — BAD LUCK GAUNTLET: every superstition in the book takes a swing at
// the machine and every one of them misses. A ladder drops over it, a black cat
// crosses its path, an umbrella opens indoors. Nothing sticks. The joke is that
// the machine never reacts — it just sits there being lucky at things.
//
// Comedy timing beats fidelity here, so the props are deliberately simple
// silhouettes: the beat lands before anyone inspects the geometry.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'spinningRim';
export const duration = 11500;

/** A hanging ladder: two stiles and six rungs of dark wood. */
function buildLadder(): THREE.Group {
	const g = new THREE.Group();
	const wood = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85, metalness: 0.02 });
	const stileGeo = new THREE.BoxGeometry(0.09, 3.4, 0.09);
	for (const x of [-0.42, 0.42]) {
		const s = new THREE.Mesh(stileGeo, wood);
		s.position.set(x, 0, 0);
		g.add(s);
	}
	const rungGeo = new THREE.BoxGeometry(0.84, 0.06, 0.06);
	for (let i = 0; i < 6; i++) {
		const r = new THREE.Mesh(rungGeo, wood);
		r.position.set(0, 1.42 - i * 0.56, 0);
		g.add(r);
	}
	g.userData.dispose = () => {
		stileGeo.dispose();
		rungGeo.dispose();
		wood.dispose();
	};
	return g;
}

/** A black cat in profile, walking. Silhouette only — it lives in shadow. */
function buildCat(glow: THREE.Texture): { cat: THREE.Group; legs: THREE.Mesh[]; tail: THREE.Group } {
	const cat = new THREE.Group();
	const fur = new THREE.MeshStandardMaterial({ color: 0x1c1c28, roughness: 0.62, metalness: 0.18 });
	const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.42, 6, 12), fur);
	body.rotation.z = Math.PI / 2;
	body.position.y = 0.3;
	cat.add(body);
	const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), fur);
	head.position.set(-0.34, 0.42, 0);
	cat.add(head);
	for (const s of [-1, 1]) {
		const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 4), fur);
		ear.position.set(-0.35, 0.53, s * 0.06);
		cat.add(ear);
	}
	// eyes: the only part of a black cat you ever actually see
	const eyeMat = new THREE.SpriteMaterial({
		map: glow,
		color: 0xd8f048,
		transparent: true,
		opacity: 0.95,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	for (const s of [-1, 1]) {
		const eye = new THREE.Sprite(eyeMat);
		eye.scale.setScalar(0.075);
		eye.position.set(-0.44, 0.45, s * 0.05 + 0.06);
		cat.add(eye);
	}
	const legs: THREE.Mesh[] = [];
	const legGeo = new THREE.CapsuleGeometry(0.035, 0.2, 4, 8);
	for (let i = 0; i < 4; i++) {
		const leg = new THREE.Mesh(legGeo, fur);
		leg.position.set(-0.2 + (i % 2) * 0.42, 0.13, (i < 2 ? 0.07 : -0.07));
		cat.add(leg);
		legs.push(leg);
	}
	const tail = new THREE.Group();
	const tailMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.42, 4, 8), fur);
	tailMesh.position.y = 0.21;
	tail.add(tailMesh);
	tail.position.set(0.3, 0.34, 0);
	tail.rotation.z = -0.5;
	cat.add(tail);
	cat.userData.dispose = () => {
		fur.dispose();
		eyeMat.dispose();
		legGeo.dispose();
	};
	return { cat, legs, tail };
}

/** An umbrella, opened indoors, which is the whole problem. */
function buildUmbrella(): { umbrella: THREE.Group } {
	const umbrella = new THREE.Group();
	const cloth = new THREE.MeshStandardMaterial({
		color: 0x1f2a3a,
		roughness: 0.8,
		metalness: 0.02,
		side: THREE.DoubleSide
	});
	// an eight-gore canopy: a low cone reads as one the moment it has ribs
	const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.52, 8, 1, true), cloth);
	canopy.position.y = 0.26;
	umbrella.add(canopy);
	const ribMat = new THREE.MeshStandardMaterial({ color: 0x64707e, roughness: 0.4, metalness: 0.8 });
	const ribGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.06, 5);
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		const rib = new THREE.Mesh(ribGeo, ribMat);
		rib.position.set(Math.cos(a) * 0.5, 0.13, Math.sin(a) * 0.5);
		rib.rotation.z = Math.PI / 2 - 0.46;
		rib.rotation.y = -a;
		umbrella.add(rib);
	}
	const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.5, 8), ribMat);
	shaft.position.y = -0.4;
	umbrella.add(shaft);
	const hook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.026, 8, 16, Math.PI * 1.2), ribMat);
	hook.position.set(-0.11, -1.13, 0);
	hook.rotation.z = -0.4;
	umbrella.add(hook);
	umbrella.userData.dispose = () => {
		canopy.geometry.dispose();
		ribGeo.dispose();
		shaft.geometry.dispose();
		hook.geometry.dispose();
		cloth.dispose();
		ribMat.dispose();
	};
	return { umbrella };
}

const COLD = new THREE.Color(0x9fb8d8);
const WARM = new THREE.Color(0xffc478);

// ---- the luck shield: a near-invisible bubble around the machine that
// FLARES where bad luck strikes it. This is the whole point of the effect —
// without a visible guardian, the superstitions just look like weather.
// Ripples spread from each impact direction across the bubble's surface.
const SHIELD_VERT = /* glsl */ `
	varying vec3 vDir;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		vDir = normalize(position);
		vNormal = normalMatrix * normal;
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		vView = -mv.xyz;
		gl_Position = projectionMatrix * mv;
	}`;

const SHIELD_FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uBase;
	uniform vec3 uHitDir[3];
	uniform float uHitT[3];
	uniform vec3 uGold;
	varying vec3 vDir;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
		// a faint woven shimmer so the idle bubble reads as a surface at all
		float weave = pow(abs(sin(vDir.x * 24.0 + uTime * 0.6)) * abs(sin(vDir.y * 24.0 - uTime * 0.4)), 6.0);
		float glow = fresnel * (0.13 + uBase * 1.2) + weave * uBase * 0.35;
		// impact ripples: rings racing out from wherever bad luck touched
		for (int i = 0; i < 3; i++) {
			float age = uTime - uHitT[i];
			if (age > 0.0 && age < 0.9) {
				float ang = acos(clamp(dot(vDir, uHitDir[i]), -1.0, 1.0));
				float ring = smoothstep(0.16, 0.0, abs(ang - age * 3.2)) * (1.0 - age / 0.9);
				float core = smoothstep(0.5, 0.0, ang) * (1.0 - age / 0.35) ;
				glow += ring * 1.3 + max(core, 0.0) * 0.9;
			}
		}
		gl_FragColor = vec4(uGold * glow, glow * 0.85);
	}`;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, lightning, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();

	const restore = dimLights(scene, 0.42, 700);
	scene.crossfadeEnvironment('nightSky', 800);
	scene.fxLight.color.set(0x9fb8d8);
	scene.fxLight.position.set(-1.5, 1.6, 1.8);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.4));
	machine.setInnerGlow(0.2, 0xbfe8ff);

	// ---- raise the shield
	const shieldMat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uBase: { value: 0 },
			uHitDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
			uHitT: { value: [-10, -10, -10] },
			uGold: { value: new THREE.Color(0xffd27a) }
		},
		vertexShader: SHIELD_VERT,
		fragmentShader: SHIELD_FRAG,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
	const shieldCentre = new THREE.Vector3(btn.x, btn.y, 0.1);
	const shield = new THREE.Mesh(new THREE.SphereGeometry(1.95, 48, 32), shieldMat);
	shield.position.copy(shieldCentre);
	scene.scene.add(shield);
	let shieldT = 0;
	let hitSlot = 0;
	const stopShield = scene.addUpdatable((dt) => {
		shieldT += dt;
		shieldMat.uniforms.uTime.value = shieldT;
	});
	/** Register an impact: the bubble ripples out from that direction. */
	const shieldHit = (at: THREE.Vector3) => {
		const dir = at.clone().sub(shieldCentre).normalize();
		(shieldMat.uniforms.uHitDir.value as THREE.Vector3[])[hitSlot].copy(dir);
		(shieldMat.uniforms.uHitT.value as number[])[hitSlot] = shieldT;
		hitSlot = (hitSlot + 1) % 3;
	};
	// the shield charges a little with every save — by the finale it is FED UP
	let shieldCharge = 0.08;
	tween(600, 'outQuad', (v) => (shieldMat.uniforms.uBase.value = v * shieldCharge));
	const chargeShield = (to: number) => {
		const from = shieldCharge;
		shieldCharge = to;
		tween(500, 'outQuad', (v) => (shieldMat.uniforms.uBase.value = from + (to - from) * v));
	};

	/** Bad luck bounces off: shield ripple, gold sparks, a smug glow pulse. */
	const deflect = (at: THREE.Vector3, gain = 1) => {
		shieldHit(at);
		audio.sfx('ding', { pitch: 1.5, gain: 0.4 * gain });
		audio.sfx('pop', { pitch: 1.8, gain: 0.3 * gain });
		haptics.vibrate(16);
		particles.burst({
			texture: sprites.star4,
			count: Math.round(34 * gain),
			origin: at.clone(),
			originSpread: 0.14,
			speed: [1, 3],
			gravity: new THREE.Vector3(0, -2.2, 0),
			life: [0.5, 1.1],
			size: [0.03, 0.09],
			colors: [0xffd27a, 0xfff3cf, 0xffe0a0]
		});
		flashPulse(machine, 0.3 * gain, 90, 420, 0xffd27a);
	};

	// ================= BEAT 1: the ladder =================
	const ladder = buildLadder();
	ladder.position.set(btn.x - 0.1, 3.6, 0.85);
	ladder.rotation.z = 0.5;
	scene.scene.add(ladder);
	audio.sfx('swoosh', { pitch: 0.7, gain: 0.5 });
	// it falls FOR the machine and lands ON the bubble — the first save is
	// physical: the ladder visibly rests against thin air
	await tween(900, 'outCubic', (v) => {
		ladder.position.y = 3.6 - v * 2.1;
		ladder.rotation.z = 0.5 - v * 0.34;
	});
	audio.sfx('clack', { pitch: 0.55, gain: 0.5 });
	scene.shake(0.14);
	deflect(new THREE.Vector3(btn.x - 0.05, btn.y + 1.75, 0.55), 0.8);
	// a little settle-bounce on the shield's surface
	await tween(360, 'outBack', (v) => {
		ladder.position.y = 1.5 + Math.sin(v * Math.PI) * 0.12;
	});
	await delay(200);
	// a bolt of ill fortune runs down it — and splashes across the bubble
	lightning.strike(
		new THREE.Vector3(btn.x - 0.1, 2.6, 0.7),
		new THREE.Vector3(btn.x, btn.y + 1.7, 0.55),
		{ width: 0.03, life: 0.3, jitter: 0.22, generations: 5 }
	);
	await delay(180);
	deflect(new THREE.Vector3(btn.x, btn.y + 1.7, 0.55));
	chargeShield(0.16);
	await delay(340);
	// and up it goes again, embarrassed
	audio.sfx('swoosh', { pitch: 1.1, gain: 0.35 });
	tween(800, 'inCubic', (v) => {
		ladder.position.y = 1.5 + v * 2.6;
		ladder.rotation.z = 0.16 + v * 0.5;
	}).then(() => {
		scene.scene.remove(ladder);
		(ladder.userData.dispose as () => void)();
	});

	// ================= BEAT 2: the black cat =================
	await delay(500);
	const { cat, legs, tail } = buildCat(sprites.softDot);
	const startX = 3.4;
	cat.position.set(startX, -1.02, 1.05);
	cat.scale.setScalar(1.05);
	scene.scene.add(cat);
	let walk = 0;
	let walking = true;
	const stopCat = scene.addUpdatable((dt, t) => {
		if (walking) walk += dt * 9;
		for (let i = 0; i < legs.length; i++) {
			legs[i].rotation.z = Math.sin(walk + i * 1.6) * (walking ? 0.5 : 0.04);
		}
		tail.rotation.z = -0.5 + Math.sin(t * 3.4) * 0.35;
		cat.position.y = -1.02 + Math.abs(Math.sin(walk)) * 0.02;
	});
	// crosses your path, right to left
	await tween(1500, 'linear', (v) => {
		cat.position.x = startX - v * 3.1;
	});
	// ...and stops dead in front of the button, because of course it does
	walking = false;
	audio.sfx('chime', { pitch: 0.75, gain: 0.3 });
	await tween(700, 'outCubic', (v) => {
		cat.position.y = -1.02 + v * 0.14; // stretches up at the button
		cat.rotation.z = v * 0.16;
	});
	// it head-butts the bubble. BONK. Sits back down, offended.
	audio.sfx('pop', { pitch: 0.9, gain: 0.3 });
	haptics.vibrate(20);
	deflect(new THREE.Vector3(btn.x - 0.35, btn.y - 0.7, 0.9), 0.7);
	chargeShield(0.24);
	tween(420, 'outBack', (v) => {
		cat.position.x = startX - 3.1 + v * 0.3; // recoils onto its haunches
		cat.rotation.z = 0.16 - v * 0.22;
	});
	particles.burst({
		texture: sprites.clover,
		count: 14,
		origin: new THREE.Vector3(cat.position.x - 0.3, -0.85, 1.1),
		originSpread: 0.16,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.5,
		speed: [0.6, 1.6],
		gravity: new THREE.Vector3(0, -1.4, 0),
		life: [0.8, 1.6],
		size: [0.05, 0.1],
		colors: [0x6fd48a, 0xa8f0bf],
		spin: [-4, 4]
	});
	await delay(420);
	walking = true;
	await tween(1000, 'inQuad', (v) => {
		cat.position.x = startX - 3.1 - v * 2.2;
		cat.rotation.z = 0.16 * (1 - v);
	});
	stopCat();
	scene.scene.remove(cat);
	(cat.userData.dispose as () => void)();

	// ================= BEAT 3: the umbrella, indoors =================
	const { umbrella } = buildUmbrella();
	umbrella.position.set(btn.x, btn.y + 2.9, 1.15);
	umbrella.scale.set(0.06, 0.06, 0.06);
	scene.scene.add(umbrella);
	audio.sfx('swoosh', { pitch: 1.2, gain: 0.4 });
	// it descends as far as the bubble's crown and no further
	await tween(520, 'outQuad', (v) => {
		umbrella.position.y = btn.y + 2.9 - v * 0.72;
		umbrella.scale.set(0.06, 0.06 + v * 0.2, 0.06); // still furled
	});
	// FWUMP
	audio.sfx('boom', { pitch: 1.15, gain: 0.5 });
	audio.sfx('swoosh', { pitch: 0.75, gain: 0.5 });
	haptics.vibrate([25, 20, 45]);
	scene.shake(0.2);
	await tween(420, 'outBack', (v) => {
		umbrella.scale.set(0.06 + v * 0.94, 0.26 + v * 0.74, 0.06 + v * 0.94);
	});
	await delay(260);
	// an umbrella, indoors?! The shield has SEEN ENOUGH — one pulse and the
	// offending article is yeeted into the stratosphere
	deflect(new THREE.Vector3(btn.x, btn.y + 1.9, 0.5), 1.2);
	chargeShield(0.34);
	audio.sfx('zap', { pitch: 1.1, gain: 0.45 });
	tween(650, 'inCubic', (v) => {
		umbrella.position.y = btn.y + 2.18 + v * 3.2;
		umbrella.rotation.z = v * 5;
		umbrella.scale.setScalar(Math.max(0.05, 1 - v * 0.5));
	}).then(() => {
		scene.scene.remove(umbrella);
		(umbrella.userData.dispose as () => void)();
	});
	await delay(400);

	// it rains, but only money — and the shield lets it straight through,
	// shimmering politely as each coin passes. It knows the difference.
	audio.sfx('ding', { pitch: 1.1, gain: 0.5 });
	const rain = particles.emitter({
		texture: sprites.coin,
		count: 260,
		emitRate: 150,
		origin: new THREE.Vector3(btn.x, btn.y + 2.4, 0.9), // from above the bubble
		originSpread: 0.95,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.14,
		speed: [1.6, 3],
		gravity: new THREE.Vector3(0, -3.4, 0),
		life: [1.3, 2.2],
		size: [0.05, 0.12],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
		spin: [-6, 6]
	});
	tween(1400, 'outCubic', (v) => {
		machine.setInnerGlow(0.2 + v * 0.4, 0xffd27a);
		scene.fxLight.color.copy(COLD).lerp(WARM, v);
		scene.fxLight.intensity = 1.4 + v * 2.6;
	});
	await delay(1500);
	rain.stop();
	// ================= the verdict =================
	// Three saves, fully charged: the shield gathers itself in tight...
	await tween(550, 'inQuad', (v) => {
		shieldMat.uniforms.uBase.value = 0.34 + v * 0.6;
		shield.scale.setScalar(1 - v * 0.2);
	});
	// ...and DETONATES as pure lucky energy. For good luck. Obviously.
	audio.sfx('gong', { pitch: 0.85, gain: 0.9 }); // THE DONG
	audio.sfx('boom', { pitch: 0.7, gain: 0.6 });
	haptics.vibrate([40, 40, 120]);
	scene.shake(0.35);
	flashPulse(machine, 0.7, 100, 750, 0xffd27a);
	tween(750, 'outCubic', (v) => {
		shield.scale.setScalar(0.8 + v * 2.6);
		shieldMat.uniforms.uBase.value = 0.94 * (1 - v);
	}).then(() => {
		scene.scene.remove(shield);
		shield.geometry.dispose();
		shieldMat.dispose();
	});
	shockwave(scene.scene, new THREE.Vector3(btn.x, btn.y, 0.5), {
		color: 0xffd27a,
		maxScale: 5.5,
		duration: 800,
		z: 0.5
	});
	particles.burst({
		texture: sprites.star4,
		count: 130,
		origin: new THREE.Vector3(btn.x, btn.y, 0.6),
		originSpread: 0.25,
		speed: [1.8, 4.8],
		gravity: new THREE.Vector3(0, -2, 0),
		life: [0.8, 1.8],
		size: [0.03, 0.11],
		colors: [0xffd27a, 0xfff3cf, 0xffe0a0, 0xbfffd8]
	});
	await luckyWord(ctx, {
		text: 'STILL LUCKY',
		color: 0xffd27a,
		colorB: 0xfff3cf,
		gather: 850,
		hold: 1000,
		scatter: 560
	});

	// ---- teardown
	stopShield();
	scene.crossfadeEnvironment('lounge');
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.6 * (1 - v));
		scene.fxLight.intensity = 4 * (1 - v);
	});
	await restore(900);
}
