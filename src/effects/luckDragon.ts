// Effect — LUCK DRAGON: a serpent of golden fire pours in from the dark and
// coils around the machine, trailing a river of embers, the lights of the
// room chasing it as it swoops. Its coils tighten, faster and faster, until
// it dives headlong into the button — which drinks the whole dragon, charges
// up, and erupts in a fountain of gold. FORTUNE, in dragonfire.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 11500;

// ---- the dragon scorches the lounge: the green quilted leather turns ember
// red behind it. The red albedo is derived from the green one by remapping
// channels (the green channel encodes the pillow shading), so seams, grain
// and stitching survive the re-dye untouched. Cached across runs.
let emberQuilt: THREE.CanvasTexture | null = null;
function emberQuiltTexture(src: THREE.Texture): THREE.CanvasTexture {
	if (emberQuilt) return emberQuilt;
	const img = src.image as HTMLCanvasElement;
	const cv = document.createElement('canvas');
	cv.width = img.width;
	cv.height = img.height;
	const c = cv.getContext('2d')!;
	c.drawImage(img, 0, 0);
	const px = c.getImageData(0, 0, cv.width, cv.height);
	for (let i = 0; i < px.data.length; i += 4) {
		const st = (px.data[i + 1] - 6) / 92; // recover shade*tint from green
		px.data[i] = 118 * st + 6;
		px.data[i + 1] = 26 * st + 4;
		px.data[i + 2] = 20 * st + 4;
	}
	c.putImageData(px, 0, 0);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.copy(src.repeat);
	emberQuilt = tex;
	return tex;
}

/** Patch the backdrop's material once: a radial wipe (in view space, so the
 *  quilt's 22x UV repeat doesn't matter) blends green->red leather with a
 *  glowing burn-front. Rest state uWipe = -1 shows pure green. */
function patchQuiltWipe(mat: THREE.MeshStandardMaterial, ember: THREE.Texture): { value: number } {
	if (mat.userData.wipeUniform) return mat.userData.wipeUniform;
	const uWipe = { value: -1 };
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uWipe = uWipe;
		shader.uniforms.uMap2 = { value: ember };
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				'#include <common>\nuniform float uWipe;\nuniform sampler2D uMap2;'
			)
			.replace(
				'#include <map_fragment>',
				/* glsl */ `
				vec4 sampledDiffuseColor = texture2D( map, vMapUv );
				vec4 emberDiffuse = texture2D( uMap2, vMapUv );
				float dWipe = length( vViewPosition.xy );
				float redA = 1.0 - smoothstep( uWipe, uWipe + 0.4, dWipe );
				sampledDiffuseColor = mix( sampledDiffuseColor, emberDiffuse, redA );
				float rim = smoothstep( uWipe - 0.12, uWipe + 0.2, dWipe )
					* ( 1.0 - smoothstep( uWipe + 0.2, uWipe + 0.55, dWipe ) );
				sampledDiffuseColor.rgb += vec3( 1.0, 0.45, 0.12 ) * rim * 0.55 * step( -0.4, uWipe );
				diffuseColor *= sampledDiffuseColor;`
			);
	};
	mat.customProgramCacheKey = () => 'quilt-ember-wipe';
	mat.needsUpdate = true;
	mat.userData.wipeUniform = uWipe;
	return uWipe;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;

	const restore = dimLights(scene, 0.3, 700);
	scene.crossfadeEnvironment('gold', 800);
	scene.fxLight.color.set(0xffb45e);

	// the leather smoulders red from the centre out as the dragon arrives
	const wipe = patchQuiltWipe(
		machine.backdrop.material as THREE.MeshStandardMaterial,
		emberQuiltTexture(ctx.textures.quilt.map)
	);
	tween(2600, 'inOutQuad', (v) => (wipe.value = -0.5 + v * 8.5));

	// the dragon's head: a hot core with a soft halo
	const head = new THREE.Group();
	const coreMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xfff3cf,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const haloMat = coreMat.clone();
	haloMat.color.set(0xffb45e);
	const core = new THREE.Sprite(coreMat);
	core.scale.setScalar(0.34);
	const halo = new THREE.Sprite(haloMat);
	halo.scale.setScalar(0.85);
	head.add(halo, core);
	head.position.set(-4, 1.6, 0.6);
	scene.scene.add(head);

	// its body: a THICK river of fire poured out behind the head. Long particle
	// lives are what make it a serpent — the body must persist for most of a
	// coil or it reads as fairy dust behind a dot.
	const trailOrigin = new THREE.Vector3().copy(head.position);
	const trail = particles.emitter({
		texture: sprites.softDot,
		count: 1500,
		emitRate: 440,
		origin: trailOrigin,
		originSpread: 0.06,
		speed: [0.01, 0.08],
		gravity: new THREE.Vector3(0, 0.05, 0),
		drag: 0.996,
		life: [2.2, 3.2],
		size: [0.09, 0.2],
		colors: [0xffd27a, 0xffb45e, 0xff8a4a, 0xffa04e],
		fadeIn: 0.03
	});
	// hot white-gold core ribbon inside the embers
	const innerFire = particles.emitter({
		texture: sprites.softDot,
		count: 560,
		emitRate: 220,
		origin: trailOrigin,
		originSpread: 0.025,
		speed: [0.005, 0.04],
		life: [1.5, 2.3],
		size: [0.05, 0.11],
		colors: [0xfff3cf, 0xffeab0, 0xffffff],
		fadeIn: 0.02
	});
	const sparks = particles.emitter({
		texture: sprites.star4,
		count: 160,
		emitRate: 60,
		origin: trailOrigin,
		originSpread: 0.14,
		speed: [0.2, 0.6],
		gravity: new THREE.Vector3(0, -0.4, 0),
		life: [0.5, 1],
		size: [0.04, 0.09],
		colors: [0xfff3cf, 0xffd27a]
	});

	// flight: coils around the machine, weaving in front of and behind it.
	// `pace` and `radius` are driven by tweens; the sim just flies the path.
	let a = Math.PI * 1.1; // start off to the upper left
	let pace = 0;
	let radius = 2.0;
	let diving = false;
	const btnPos = machine.buttonWorldPosition();
	const stopSim = scene.addUpdatable((dt) => {
		if (!diving) {
			a += dt * pace;
			// the fast secondary sines are the serpent: the body ribbon laid
			// down along this path WAVES instead of tracing a smooth circle
			head.position.set(
				Math.cos(a) * (radius + Math.sin(a * 6) * 0.13),
				Math.sin(a * 0.9) * 0.95 - 0.1 + Math.cos(a * 5.2) * 0.11,
				0.55 + Math.sin(a * 1.3) * 0.4
			);
		}
		trailOrigin.copy(head.position);
		// the room's light chases the dragon
		scene.fxLight.position.set(head.position.x, head.position.y, head.position.z + 0.6);
		core.scale.setScalar(0.3 + Math.sin(a * 7) * 0.05);
	});

	// ---- it pours in and starts to circle
	audio.sfx('boom', { pitch: 0.5, gain: 0.5 });
	haptics.vibrate([20, 50, 25]);
	tween(700, 'outCubic', (v) => {
		coreMat.opacity = v;
		haloMat.opacity = v * 0.55;
		scene.fxLight.intensity = v * 2.4;
		pace = v * 1.45;
	});
	machine.mechSpeed = 3;
	machine.setInnerGlow(0.15, 0xffb45e);
	await delay(2400);
	audio.sfx('boom', { pitch: 0.65, gain: 0.5 }); // it roars past
	scene.shake(0.15);

	// ---- the coils tighten, faster and faster
	tween(2800, 'inQuad', (v) => {
		pace = 1.45 + v * 2.85;
		radius = 2.0 - v * 0.75;
	});
	await delay(1500);
	audio.sfx('boom', { pitch: 0.8, gain: 0.55 });
	scene.shake(0.2);
	await delay(1300);

	// ---- the dive: headlong into the button
	diving = true;
	audio.sfx('zap', { pitch: 0.7, gain: 0.6 });
	const from = head.position.clone();
	await tween(450, 'inQuad', (v) => {
		head.position.lerpVectors(from, new THREE.Vector3(btnPos.x, btnPos.y, 0.55), v);
		core.scale.setScalar(0.3 * (1 - v * 0.7));
		haloMat.opacity = 0.55 * (1 - v);
	});
	trail.stop();
	innerFire.stop();
	sparks.stop();
	coreMat.opacity = 0;
	audio.sfx('gulp', { pitch: 0.8, gain: 0.7 });
	haptics.vibrate([30, 30, 60]);

	// ---- the button drinks the dragon and charges up...
	await tween(650, 'inQuad', (v) => {
		machine.setInnerGlow(0.15 + v * 0.5, 0xffd27a);
		scene.fxLight.intensity = 2.4 + v * 1.6;
		scene.fxLight.position.set(btnPos.x, btnPos.y, 1.2);
	});

	// ---- ...and erupts
	audio.sfx('gong', { pitch: 0.9, gain: 0.85 });
	audio.sfx('boom', { pitch: 0.6, gain: 0.9 });
	haptics.vibrate([50, 30, 130]);
	scene.shake(0.5);
	flashPulse(machine, 0.85, 90, 750, 0xffd27a);
	shockwave(scene.scene, new THREE.Vector3(btnPos.x, btnPos.y, 0.55), {
		color: 0xffd27a,
		maxScale: 6,
		duration: 850,
		z: 0.55
	});
	particles.burst({
		texture: sprites.coin,
		count: 120,
		origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.55),
		originSpread: 0.15,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.9,
		speed: [2.2, 5],
		gravity: new THREE.Vector3(0, -3, 0),
		life: [1.3, 2.4],
		size: [0.07, 0.15],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff0cf],
		spin: [-6, 6]
	});
	particles.burst({
		texture: sprites.star4,
		count: 70,
		origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.55),
		speed: [1.5, 4.2],
		life: [0.6, 1.3],
		size: [0.03, 0.09],
		colors: [0xfff3cf, 0xffd27a, 0xff8a4a]
	});

	await luckyWord(ctx, {
		text: 'FORTUNE',
		color: 0xffd27a,
		colorB: 0xfff0c8,
		gather: 900,
		hold: 1300,
		scatter: 700
	});

	// ---- teardown
	stopSim();
	tween(800, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.65 * (1 - v));
		scene.fxLight.intensity = 4 * (1 - v);
	});
	machine.mechSpeed = 1;
	scene.scene.remove(head);
	coreMat.dispose();
	haloMat.dispose();
	scene.crossfadeEnvironment('lounge');
	// the fire retreats: the wipe runs in reverse and the green comes back
	tween(1100, 'inQuad', (v) => (wipe.value = 8 - v * 9));
	await delay(500);
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	await restore(900);
	wipe.value = -1; // rest state, exactly green
}
