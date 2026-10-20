// Effect 36 — FORTUNE COOKIE: a giant fortune cookie tumbles in from the top
// right, lands on the button with a thump and a spin, then cracks open. A paper
// slip climbs out of the gap, unrolls in front of the camera and holds there
// long enough to read: one sensible fortune and six lucky numbers in red, like
// the real thing. Then the slip dissolves into sparkles and the two halves tip
// off the button and drop out of shot.
//
// The cookie is a modelled asset (public/models/fortune-cookie.glb): an unsplit
// Whole, plus HalfL and HalfR, all sharing the cookie's centre as their origin.
// Whole plays everything up to the crack so no seam ever shows; at the crack it
// is swapped for the halves, which are then simply moved apart. The GLB is fetched once and kept; warm()
// starts that fetch as soon as this effect is next in the bag. If it can't be
// fetched at all, a stand-in pair of half-rings plays the part rather than the
// press doing nothing.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { tween, delay, rand, pick } from '../core/anim';
import { dimLights, flashPulse, disposeObject, shockwave } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'luckySymbol';
export const duration = 8500;

const MODEL_URL = '/models/fortune-cookie.glb';
const BISCUIT = 0xf0d8a6; // pale cream: the baked GLB colour read as mustard in the lounge
const TOAST = new THREE.Color(0xb8782e); // the golden-brown the rims bake to
const CRUMBS = [0x8a5a1f, 0xa8722c, 0xc48e45, 0x6e4516];

// Shipped copy: no em or en dashes. Wiseman, not woo: luck as a habit.
const FORTUNES = [
	'Luck favours the prepared. You look prepared.',
	'The harder you practise, the luckier you get.',
	'Say yes to the next small adventure.',
	'A chance meeting will be worth the detour.',
	'Lucky people notice things. Look up today.',
	'Your next good idea is hiding in plain sight.',
	'Expect good things. They tend to turn up.',
	'Try the other door. It is probably open.',
	'Fortune smiles on the curious. Ask more questions.',
	'Help someone today. Luck keeps the receipts.',
	'You pressed the button. Off to a flying start.'
];

// ── The asset ───────────────────────────────────────────────────────────────
let cookieLoad: Promise<THREE.Object3D> | null = null;

/** The parsed GLB scene, fetched once. A failed fetch is forgotten so the next
 *  play (or warm) tries again instead of inheriting the failure for ever. */
function loadCookie(): Promise<THREE.Object3D> {
	cookieLoad ??= new GLTFLoader()
		.loadAsync(MODEL_URL)
		.then((gltf) => gltf.scene)
		.catch((err) => {
			cookieLoad = null;
			throw err;
		});
	return cookieLoad;
}

/** Start fetching the cookie while the visitor is still admiring the last effect. */
export function warm(): void {
	loadCookie().catch(() => { /* play() falls back to the stand-in */ });
}

/** Stand-in halves for when the GLB can't be fetched (offline first visit):
 *  two half-rings meeting at the top and bottom, about 1 unit across like the
 *  real asset. Their geometry belongs to this play and is disposed with it. */
function buildStandIn(): THREE.Group {
	const g = new THREE.Group();
	const mat = new THREE.MeshStandardMaterial({ color: BISCUIT });
	for (const [name, rz] of [['HalfL', Math.PI / 2], ['HalfR', -Math.PI / 2]] as const) {
		const half = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.15, 14, 28, Math.PI), mat);
		half.rotation.z = rz;
		half.scale.set(1, 1, 0.8);
		// wrap so the half's own origin stays at the cookie's centre, like the GLB
		const pivot = new THREE.Group();
		pivot.name = name;
		pivot.add(half);
		g.add(pivot);
	}
	g.userData.standIn = true;
	return g;
}

// ── The slip ────────────────────────────────────────────────────────────────
const SLIP_W = 1.7;
const SLIP_H = 0.45;

/** Cream paper, the fortune in a serif, and the lucky numbers in red. */
function slipTexture(fortune: string, numbers: number[]): THREE.CanvasTexture {
	const W = 1024;
	const H = 272;
	const cv = document.createElement('canvas');
	cv.width = W;
	cv.height = H;
	const c = cv.getContext('2d')!;
	const paper = c.createLinearGradient(0, 0, 0, H);
	paper.addColorStop(0, '#fcf8ea');
	paper.addColorStop(1, '#efe5c9');
	c.fillStyle = paper;
	c.fillRect(0, 0, W, H);
	// a whisper of fibre so it reads as paper, not a UI panel
	c.fillStyle = 'rgba(150,120,70,0.05)';
	for (let i = 0; i < 260; i++) c.fillRect(Math.random() * W, Math.random() * H, rand(6, 28), 1);
	// a thin red keyline, printed slightly off-register like the real thing
	c.strokeStyle = 'rgba(192,50,43,0.55)';
	c.lineWidth = 3;
	c.strokeRect(16, 14, W - 30, H - 30);

	c.textAlign = 'center';
	c.textBaseline = 'middle';
	c.fillStyle = '#2b2318';
	const maxW = W - 110;
	const font = (px: number) => (c.font = `italic ${px}px Georgia, 'Times New Roman', serif`);
	let size = 52;
	font(size);
	while (c.measureText(fortune).width > maxW && size > 42) font(--size);
	let lines = [fortune];
	if (c.measureText(fortune).width > maxW) {
		// two lines, broken at the word that evens them out (no lonely last word)
		size = 46;
		font(size);
		const words = fortune.split(' ');
		let best = Infinity;
		for (let i = 1; i < words.length; i++) {
			const a = words.slice(0, i).join(' ');
			const b = words.slice(i).join(' ');
			const worst = Math.max(c.measureText(a).width, c.measureText(b).width);
			if (worst < best) {
				best = worst;
				lines = [a, b];
			}
		}
		while (best > maxW && size > 30) {
			font(--size);
			best = Math.max(...lines.map((l) => c.measureText(l).width));
		}
	}
	const lineH = size * 1.22;
	const top = lines.length === 1 ? 96 : 96 - lineH / 2;
	lines.forEach((l, i) => c.fillText(l, W / 2, top + i * lineH));

	// the numbers row
	c.fillStyle = '#c0322b';
	c.font = "bold 22px Georgia, 'Times New Roman', serif";
	c.fillText('L U C K Y   N U M B E R S', W / 2, 178);
	c.font = "bold 44px Georgia, 'Times New Roman', serif";
	const step = 118;
	numbers.forEach((n, i) => c.fillText(String(n), W / 2 + (i - (numbers.length - 1) / 2) * step, 224));

	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	return tex;
}

/** Six distinct lucky numbers, 1 to 49, sorted. */
function luckyNumbers(): number[] {
	const set = new Set<number>();
	while (set.size < 6) set.add(1 + Math.floor(Math.random() * 49));
	return [...set].sort((a, b) => a - b);
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;
	const frameHalfH = (z: number) => Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * (5.35 - z);
	const frameHalfW = (z: number) => frameHalfH(z) * scene.camera.aspect;

	// ---- warm amber lamplight, a takeaway at midnight
	const restore = dimLights(scene, 0.42, 700);
	scene.fxLight.color.set(0xffb45e);
	scene.fxLight.position.set(0.7, 0.9, 2.1);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.6));

	// ---- the cookie
	let source: THREE.Object3D;
	try {
		source = await loadCookie();
	} catch (err) {
		if (import.meta.env.DEV) console.warn('fortuneCookie: model unavailable, using the stand-in', err);
		source = buildStandIn();
	}
	const standIn = source.userData.standIn === true;
	const cookie = standIn ? source : source.clone(true);
	const biscuit = new THREE.MeshStandardMaterial({
		color: BISCUIT,
		roughness: 0.42,
		metalness: 0,
		envMapIntensity: 0.9,
		side: THREE.DoubleSide,
		// transparent from the start so the fade-out at the end needs no recompile
		transparent: true,
		opacity: 1
	});
	// Toasted rims: the albedo darkens toward golden brown where the surface
	// turns away from the camera, so the silhouette and folds read baked.
	const toast = TOAST.clone(); // working (linear) space, as the shader wants it
	biscuit.onBeforeCompile = (shader) => {
		shader.fragmentShader = shader.fragmentShader.replace(
			'#include <normal_fragment_maps>',
			`#include <normal_fragment_maps>
			float rimT = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
			diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${toast.r.toFixed(4)}, ${toast.g.toFixed(4)}, ${toast.b.toFixed(4)}), smoothstep(0.3, 0.92, rimT) * 0.8);`
		);
	};
	biscuit.customProgramCacheKey = () => 'fortuneCookieBiscuit';
	cookie.traverse((o) => {
		const mesh = o as THREE.Mesh;
		if (!mesh.isMesh) return;
		const baked = mesh.material as THREE.MeshStandardMaterial;
		// keep the baked surface detail, if the asset has any, under our biscuit tone
		if (!Array.isArray(baked) && baked.normalMap && !biscuit.normalMap) {
			biscuit.normalMap = baked.normalMap;
			biscuit.normalScale.copy(baked.normalScale);
		}
		if (standIn) (mesh.material as THREE.Material).dispose();
		mesh.material = biscuit;
		mesh.castShadow = false;
		mesh.receiveShadow = false;
	});
	const halfL = cookie.getObjectByName('HalfL') ?? cookie;
	const halfR = cookie.getObjectByName('HalfR') ?? cookie;
	// the unsplit cookie until the crack; the halves wait hidden behind it
	const whole = cookie.getObjectByName('Whole');
	if (whole) halfL.visible = halfR.visible = false;

	// sized off the button so it's ~1.5x its width, but on a phone (where the
	// button is enlarged) never so wide the cracked halves leave the frame
	const rim = machine.buttonRestRim();
	cookie.updateMatrixWorld(true);
	const box = new THREE.Box3().setFromObject(whole ?? cookie);
	const size = box.getSize(new THREE.Vector3());
	const S = Math.min(1.5 * rim.radius * 2, frameHalfW(0.9) * 2 * 0.66) / Math.max(0.01, size.x);
	// The model is spine-down with its horns up. The classic illustrated
	// fortune cookie is the other way up: round belly to the camera, horns
	// down with the V notch at the bottom. Three applies X after Z here, so
	// the small peek into the notch is a NEGATIVE tilt (checked by render).
	const REST_FLIP = Math.PI;
	const REST_TILT = -0.3;

	const wrapper = new THREE.Group(); // owns position/scale; the cookie inside owns the spin
	wrapper.add(cookie);
	cookie.position.set(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
	const spinner = new THREE.Group();
	spinner.add(wrapper);
	spinner.scale.setScalar(S);
	// rest depth measured in the rest pose, so the cookie sits on the dome, not in it
	spinner.rotation.set(REST_TILT, 0, REST_FLIP);
	spinner.updateMatrixWorld(true);
	const restBox = new THREE.Box3().setFromObject(spinner);
	const capTop = rim.centre.z + 0.14 * (rim.radius / 0.625); // the dome's crown
	const rest = new THREE.Vector3(rim.centre.x, rim.centre.y + 0.04, capTop - restBox.min.z * 0.8 + 0.04);
	const startPos = new THREE.Vector3(frameHalfW(rest.z) + 1.3, 2.6, rest.z - 0.25);
	spinner.position.copy(startPos);
	scene.scene.add(spinner);

	const trail = particles.emitter({
		texture: sprites.star4,
		count: 130,
		emitRate: 70,
		origin: spinner.position,
		originSpread: 0.3,
		speed: [0.05, 0.35],
		gravity: new THREE.Vector3(0, -0.4, 0),
		life: [0.5, 1.1],
		size: [0.02, 0.06],
		colors: [0xffe9ad, 0xffd27a, 0xffffff]
	});

	// ---- the tumble: a lobbed arc in from the top right, three slow flips
	haptics.vibrate(20);
	audio.sfx('swoosh', { gain: 0.55, pitch: 0.8 });
	await tween(1200, 'inQuad', (v) => {
		spinner.position.lerpVectors(startPos, rest, v);
		spinner.position.y += Math.sin(Math.PI * v) * 0.55;
		spinner.rotation.z = REST_FLIP + (1 - v) * Math.PI * 3;
		spinner.rotation.x = REST_TILT + (1 - v) * 1.4;
		spinner.rotation.y = (1 - v) * 0.8;
	});
	spinner.position.copy(rest);
	spinner.rotation.set(REST_TILT, 0, REST_FLIP);
	trail.stop();

	// ---- THUMP: it lands on the cap, the button takes the weight
	audio.sfx('boom', { gain: 0.35, pitch: 1.6 });
	audio.sfx('clack', { gain: 0.45, pitch: 0.6 });
	haptics.vibrate([45, 30, 70]);
	scene.shake(0.3);
	machine.pressDown().then(() => machine.pressUp());
	particles.burst({
		texture: sprites.spark,
		count: 30,
		origin: rest.clone(),
		originSpread: 0.4,
		speed: [0.8, 2.4],
		life: [0.3, 0.7],
		size: [0.025, 0.06],
		colors: [0xffffff, 0xffe9ad, 0xffd27a]
	});
	// squash, rebound, and a showman's spin
	tween(520, 'linear', (_v, t) => {
		const k = Math.sin(t * Math.PI * 2.5) * Math.exp(-t * 4.5) * 0.24;
		spinner.scale.set(S * (1 + k * 0.6), S * (1 - k), S * (1 + k * 0.6));
	});
	await tween(900, 'outCubic', (v) => (wrapper.rotation.y = v * Math.PI * 2));
	wrapper.rotation.y = 0;
	spinner.scale.setScalar(S);

	// ---- a beat, then a nervous wobble
	await delay(380);
	audio.sfx('tick', { gain: 0.4, pitch: 0.9 });
	await tween(320, 'linear', (_v, t) => {
		spinner.rotation.z = REST_FLIP + Math.sin(t * Math.PI * 6) * 0.06 * (1 - t);
	});
	spinner.rotation.z = REST_FLIP;

	// ---- CRACK: the halves jolt apart and turn their insides to the camera
	audio.sfx('clack', { gain: 0.7, pitch: 1.25 });
	audio.sfx('pop', { gain: 0.55, pitch: 0.9 });
	haptics.vibrate([20, 20, 40]);
	scene.shake(0.18);
	// the seam appears only now: the whole cookie hands over to its halves,
	// which sit in exactly the same place until they jolt
	if (whole) {
		whole.visible = false;
		halfL.visible = halfR.visible = true;
	}
	const apart = 0.35 / S; // world units, in the cookie's own space
	tween(300, 'outBack', (v) => {
		halfL.position.x = -apart * v;
		halfR.position.x = apart * v;
		halfL.rotation.z = 0.32 * v;
		halfR.rotation.z = -0.32 * v;
		halfL.rotation.y = -0.4 * v;
		halfR.rotation.y = 0.4 * v;
	});
	const seam = rest.clone();
	seam.z += 0.15;
	// a proper SNAP: a gold shockwave off the seam, a flash on the lamp, a
	// shower of crumbs that rains down past the button, a fan of gold stars
	// and a short-lived dust cloud that hangs where the cookie broke
	shockwave(scene.scene, seam, { color: 0xffd27a, maxScale: 0.8, duration: 420, z: seam.z + 0.1 });
	const lampBase = scene.fxLight.intensity;
	tween(500, 'outQuad', (v) => (scene.fxLight.intensity = lampBase + (1 - v) * 3.5));
	particles.burst({
		texture: sprites.softDot,
		count: 160,
		origin: seam,
		originSpread: 0.22,
		direction: new THREE.Vector3(0, 1, 0.45),
		cone: 1.5,
		speed: [1.0, 3.8],
		gravity: new THREE.Vector3(0, -5.5, 0),
		life: [0.7, 1.6],
		size: [0.025, 0.075],
		colors: CRUMBS,
		spin: [-8, 8]
	});
	particles.burst({
		texture: sprites.star4,
		count: 44,
		origin: seam.clone(),
		originSpread: 0.1,
		direction: new THREE.Vector3(0, 0.4, 1),
		cone: 1.3,
		speed: [1.2, 3.2],
		gravity: new THREE.Vector3(0, -1.8, 0),
		drag: 0.96,
		life: [0.5, 1.1],
		size: [0.05, 0.12],
		colors: [0xffe9ad, 0xffcf66, 0xffffff],
		spin: [-4, 4]
	});
	particles.burst({
		texture: sprites.spark,
		count: 70,
		origin: seam.clone(),
		originSpread: 0.12,
		speed: [1.5, 4.0],
		drag: 0.9,
		life: [0.25, 0.6],
		size: [0.02, 0.06],
		colors: [0xffe9ad, 0xffffff]
	});
	const dust = particles.emitter({
		texture: sprites.softDot,
		count: 90,
		emitRate: 110,
		origin: seam.clone(),
		originSpread: 0.3,
		speed: [0.05, 0.35],
		gravity: new THREE.Vector3(0, -0.4, 0),
		drag: 0.95,
		life: [0.9, 1.8],
		size: [0.08, 0.2],
		colors: [0xd9b47a, 0xb98a54, 0xf0d8a6]
	});
	delay(650).then(() => dust.stop());
	// ...and real BROKEN COOKIE: a handful of jagged biscuit chips, cut
	// from the same baked material, spray out of the seam, tumble under
	// gravity and fall away past the button. Flat extruded polygons, so they
	// catch the light edge-on the way a snapped wafer does.
	const shardMat = biscuit.clone();
	shardMat.onBeforeCompile = biscuit.onBeforeCompile;
	shardMat.customProgramCacheKey = biscuit.customProgramCacheKey;
	const shards = new THREE.Group();
	shards.position.copy(seam);
	scene.scene.add(shards);
	const cookieW = S * size.x;
	const shardList: { mesh: THREE.Mesh; vel: THREE.Vector3; ang: THREE.Vector3 }[] = [];
	for (let i = 0; i < 18; i++) {
		const r = rand(0.03, 0.075) * cookieW;
		const shape = new THREE.Shape();
		const n = 5 + Math.floor(Math.random() * 3);
		for (let k = 0; k < n; k++) {
			const a = (k / n) * Math.PI * 2;
			const rr = r * rand(0.55, 1);
			if (k === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
			else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
		}
		shape.closePath();
		const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.012 * cookieW, bevelEnabled: false });
		const mesh = new THREE.Mesh(geo, shardMat);
		mesh.position.set(rand(-0.12, 0.12) * cookieW, rand(-0.25, 0.25) * cookieW, rand(0, 0.06));
		mesh.rotation.set(rand(0, Math.PI), rand(0, Math.PI), rand(0, Math.PI));
		shards.add(mesh);
		const vel = new THREE.Vector3(rand(-1, 1) * 1.1, rand(0.3, 1.4), rand(0.35, 1)).normalize().multiplyScalar(rand(1.0, 2.8));
		shardList.push({ mesh, vel, ang: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)) });
	}
	let shardT = 0;
	let shardsLive = true;
	const killShards = () => {
		if (!shardsLive) return;
		shardsLive = false;
		stopShards();
		scene.scene.remove(shards);
		for (const sh of shardList) sh.mesh.geometry.dispose();
		shardMat.dispose();
	};
	const stopShards = scene.addUpdatable((dt) => {
		shardT += dt;
		for (const sh of shardList) {
			sh.vel.y -= 5.5 * dt;
			sh.mesh.position.addScaledVector(sh.vel, dt);
			sh.mesh.rotation.x += sh.ang.x * dt;
			sh.mesh.rotation.y += sh.ang.y * dt;
			sh.mesh.rotation.z += sh.ang.z * dt;
		}
		shardMat.opacity = Math.max(0, Math.min(1, 1 - (shardT - 1.1) / 0.5));
		if (shardT > 1.6) killShards();
	});
	machine.setInnerGlow(0.35, 0xffc070);

	// the halves breathe a little while the slip is read
	let sway = 0;
	const stopSway = scene.addUpdatable((dt) => {
		sway += dt;
		halfL.rotation.z = 0.32 + Math.sin(sway * 1.7) * 0.03;
		halfR.rotation.z = -0.32 - Math.sin(sway * 1.7 + 0.6) * 0.03;
	});

	// ---- the slip
	const fortune = pick(FORTUNES);
	const slipTex = slipTexture(fortune, luckyNumbers());
	const slipGeo = new THREE.PlaneGeometry(SLIP_W, SLIP_H, 32, 2);
	const flat = Float32Array.from(slipGeo.attributes.position.array as Float32Array);
	// Unlit: lit paper either sulked grey in the dimmed room or, passing the
	// amber lamp, crossed the bloom threshold and haloed. 0.86 keeps the cream
	// just under the threshold everywhere, so the print stays crisp.
	const slipMat = new THREE.MeshBasicMaterial({
		map: slipTex,
		color: new THREE.Color(0.86, 0.86, 0.86),
		side: THREE.DoubleSide,
		transparent: true,
		opacity: 1
	});
	const slip = new THREE.Mesh(slipGeo, slipMat);
	slip.renderOrder = 4;
	/** Bow the paper: 1 = freshly unfolded, curling back at both ends. */
	const curl = (amount: number) => {
		const pos = slipGeo.attributes.position;
		for (let i = 0; i < pos.count; i++) {
			const u = flat[i * 3] / (SLIP_W / 2);
			const roll = Math.max(0, u - 0.55) / 0.45; // the end that was rolled tightest
			pos.setZ(i, -amount * (0.16 * u * u + 0.22 * roll * roll * roll));
		}
		pos.needsUpdate = true;
		slipGeo.computeVertexNormals();
	};
	curl(1);
	// emerges standing up out of the vertical gap, pulled out a little at a time
	slip.position.set(rest.x, rest.y - 0.05, rest.z + 0.02);
	slip.rotation.z = Math.PI / 2;
	slip.scale.set(0.05, 0.75, 1);
	scene.scene.add(slip);

	await delay(160);
	audio.sfx('swoosh', { gain: 0.3, pitch: 1.6 });
	await tween(600, 'outCubic', (v) => {
		slip.position.y = rest.y - 0.05 + v * 0.62;
		slip.position.z = rest.z + 0.02 + v * 0.25;
		slip.scale.x = 0.05 + v * 0.45;
	});

	// ...then floats to the camera, turning flat and unrolling as it comes
	const holdZ = 2.3;
	const fit = Math.min(1.15, (frameHalfW(holdZ) * 2 * 0.88) / SLIP_W);
	const hold = new THREE.Vector3(0, rest.y + 0.86, holdZ);
	const from = slip.position.clone();
	audio.sfx('chime', { gain: 0.5, pitch: 1.2 });
	haptics.vibrate(15);
	await tween(950, 'inOutCubic', (v) => {
		slip.position.lerpVectors(from, hold, v);
		slip.rotation.z = (Math.PI / 2) * (1 - v) - Math.sin(v * Math.PI) * 0.12;
		slip.scale.set((0.5 + v * 0.5) * fit, (0.75 + v * 0.25) * fit, 1);
		curl(1 - v * 0.9);
	});
	audio.sfx('ding', { gain: 0.35, pitch: 1.5 });
	flashPulse(machine, 0.3, 90, 500, 0xffe2a8);
	const sparkle = particles.emitter({
		texture: sprites.star4,
		count: 90,
		emitRate: 26,
		origin: slip.position,
		originSpread: (SLIP_W / 2) * fit,
		speed: [0.05, 0.25],
		gravity: new THREE.Vector3(0, 0.12, 0),
		life: [0.6, 1.3],
		size: [0.015, 0.045],
		colors: [0xffe9ad, 0xffffff, 0xffd27a],
		fadeIn: 0.25
	});

	// ---- hold it there to be read, drifting like paper in warm air
	await tween(2500, 'linear', (_v, t) => {
		slip.position.y = hold.y + Math.sin(t * Math.PI * 2) * 0.025;
		slip.rotation.z = Math.sin(t * Math.PI * 3) * 0.015;
		slip.rotation.x = Math.sin(t * Math.PI * 2 + 1) * 0.04;
		curl(0.1 + Math.sin(t * Math.PI * 4) * 0.02);
	});
	sparkle.stop();

	// ---- the fortune is yours now: the paper dissolves into sparkles
	audio.sfx('chime', { gain: 0.4, pitch: 1.6 });
	haptics.vibrate([15, 25, 30]);
	for (let i = 0; i < 4; i++) {
		particles.burst({
			texture: i % 2 ? sprites.spark : sprites.star4,
			count: 22,
			origin: new THREE.Vector3(hold.x + ((i - 1.5) / 1.5) * (SLIP_W / 2) * fit * 0.8, slip.position.y, holdZ),
			originSpread: 0.16,
			speed: [0.3, 1.2],
			gravity: new THREE.Vector3(0, 0.4, 0),
			life: [0.5, 1.1],
			size: [0.02, 0.06],
			colors: [0xfff6dc, 0xffe9ad, 0xffd27a]
		});
	}
	const slipFade = tween(520, 'inQuad', (v) => {
		slipMat.opacity = 1 - v;
		slip.scale.set(fit * (1 + v * 0.12), fit * (1 + v * 0.12), 1);
	});

	// ---- and the halves tip off the button and drop out of shot
	stopSway();
	audio.sfx('swoosh', { gain: 0.35, pitch: 0.7 });
	const lFrom = halfL.position.clone();
	const rFrom = halfR.position.clone();
	// far enough to clear the bottom of the frame, which is a long way down on a phone
	const drop = (rest.y + 0.15 + frameHalfH(rest.z) + 0.5) / S;
	// "down" in the cookie's own (flipped, tilted) frame; the halves live there
	const down = new THREE.Vector3(0, -1, 0).applyQuaternion(spinner.quaternion.clone().invert());
	tween(600, 'outQuad', (v) => machine.setInnerGlow(0.35 * (1 - v)));
	await tween(850, 'inQuad', (v) => {
		halfL.position.set(lFrom.x - (v * 0.5) / S, lFrom.y, lFrom.z).addScaledVector(down, v * drop);
		halfR.position.set(rFrom.x + (v * 0.5) / S, rFrom.y, rFrom.z).addScaledVector(down, v * drop);
		// the flip puts HalfL on the RIGHT, so each half tips outward and
		// down over its own outer edge by turning against its crack angle
		halfL.rotation.z = 0.32 - v * 1.3;
		halfR.rotation.z = -0.32 + v * 1.3;
		biscuit.opacity = 1 - Math.max(0, v - 0.45) / 0.55;
	});
	await slipFade;

	// ---- teardown: the button was never touched, the room comes back
	scene.scene.remove(spinner, slip);
	killShards(); // normally long gone, but never leave chips behind
	biscuit.dispose(); // the GLB's own geometry and textures stay cached for next time
	if (standIn) disposeObject(cookie);
	slipGeo.dispose();
	slipMat.dispose();
	slipTex.dispose();
	tween(700, 'outQuad', (v) => (scene.fxLight.intensity = 2.6 * (1 - v)));
	await restore(900);
	scene.fxLight.intensity = 0;
}
