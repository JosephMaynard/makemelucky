// Effect — MANEKI-NEKO: the beckoning cat. A solid gold lucky cat rises out of
// the bore, raises its paw, and waves — and every wave DRAGS a wall of coins in
// from off-screen, because that is what beckoning is for. Then the chiptune
// kicks in and rainbows start coming out of the hole, because of course they do.
//
// Cut to Joseph's 165bpm track (21.888s, deliberately Nyan-Cat-adjacent). BEAT
// and BAR below are the master clock: ONE sim reads songT and drives the wave,
// the hop, the machine's sway, the light's hue and every rainbow's ripple, so
// nothing can drift out of sync with anything else. Same rule as kpopLuck — the
// track owns the entire mix, so there is not one procedural sfx while it plays;
// the only sounds we make ourselves land in the silence after it ends.
//
// Gold statue rather than painted ceramic: it belongs to the machine's metalwork
// that way, and a cast figure needs no fur, whiskers or texture work to read.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'luckyCatWave';
export const duration = 25200;

const BEAT = 60 / 165; // 0.3636s
const BAR = BEAT * 4;
const SONG = 21.888; // the mp3, to the millisecond

// The trail. Hard-edged bands and no blending — a Nyan Cat rainbow is pixel art,
// not a light effect, and the moment you soften it or make it additive it turns
// into aurora. The ripple grows in from the mouth so the near end stays anchored
// to the hole it is pouring out of.
const RAINBOW_VERT = /* glsl */ `
	uniform float uTime;
	uniform float uPhase;
	varying vec2 vUv;
	void main() {
		vUv = uv;
		vec3 p = position;
		float ripple = sin(p.x * 17.0 - uTime * 9.0 + uPhase) * 0.115
			+ sin(p.x * 33.0 - uTime * 5.5 + uPhase * 1.7) * 0.045;
		p.y += ripple * smoothstep(0.0, 0.3, uv.x);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}
`;

const RAINBOW_FRAG = /* glsl */ `
	uniform float uAlpha;
	uniform float uReveal;
	varying vec2 vUv;
	void main() {
		float band = floor(vUv.y * 6.0);
		vec3 c = band < 1.0 ? vec3(1.00, 0.16, 0.24)
			: band < 2.0 ? vec3(1.00, 0.58, 0.13)
			: band < 3.0 ? vec3(1.00, 0.90, 0.18)
			: band < 4.0 ? vec3(0.24, 0.88, 0.32)
			: band < 5.0 ? vec3(0.20, 0.62, 1.00)
			: vec3(0.68, 0.34, 1.00);
		// a dark hairline between bands keeps the pixel-art read under bloom
		float seam = smoothstep(0.06, 0.0, abs(fract(vUv.y * 6.0) - 0.5) - 0.44);
		c *= 1.0 - seam * 0.45;
		// Those constants are the sRGB colours we actually want to SEE. A raw
		// ShaderMaterial writes straight into the linear buffer, and the output
		// pass then tone-maps and encodes it — hand it sRGB and it comes back
		// pastel. Linearise first and the bands stay saturated.
		c = pow(c, vec3(2.2));
		// it grows out of the hole rather than appearing whole
		float grow = smoothstep(uReveal, uReveal - 0.1, vUv.x);
		gl_FragColor = vec4(c, uAlpha * grow);
	}
`;

/** Chunky 8-bit star: four pixels wide, no anti-aliasing, on purpose. */
let pixelTex: THREE.CanvasTexture | null = null;
function pixelStarTexture(): THREE.CanvasTexture {
	if (pixelTex) return pixelTex;
	const P = 7; // a 7x7 sprite, scaled up hard so the pixels stay pixels
	const cv = document.createElement('canvas');
	cv.width = cv.height = P;
	const c = cv.getContext('2d')!;
	const on = [
		[0, 0, 0, 1, 0, 0, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 1, 1, 1, 1, 1, 0],
		[1, 1, 1, 1, 1, 1, 1],
		[0, 1, 1, 1, 1, 1, 0],
		[0, 0, 1, 1, 1, 0, 0],
		[0, 0, 0, 1, 0, 0, 0]
	];
	c.fillStyle = '#fff';
	for (let y = 0; y < P; y++) {
		for (let x = 0; x < P; x++) if (on[y][x]) c.fillRect(x, y, 1, 1);
	}
	pixelTex = new THREE.CanvasTexture(cv);
	pixelTex.magFilter = THREE.NearestFilter; // keep the edges square
	pixelTex.minFilter = THREE.NearestFilter;
	pixelTex.colorSpace = THREE.SRGBColorSpace;
	return pixelTex;
}

/** A single sakura petal: a soft pink teardrop with a notched tip. */
let petalTex: THREE.CanvasTexture | null = null;
function petalTexture(): THREE.CanvasTexture {
	if (petalTex) return petalTex;
	const S = 64;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	const g = c.createLinearGradient(0, 0, 0, S);
	g.addColorStop(0, 'rgba(255,225,236,0)');
	g.addColorStop(0.25, 'rgba(255,205,224,0.95)');
	g.addColorStop(1, 'rgba(246,150,190,0.85)');
	c.fillStyle = g;
	c.beginPath();
	c.moveTo(S / 2, S * 0.06);
	c.bezierCurveTo(S * 0.94, S * 0.3, S * 0.86, S * 0.86, S / 2, S * 0.96);
	c.bezierCurveTo(S * 0.14, S * 0.86, S * 0.06, S * 0.3, S / 2, S * 0.06);
	c.fill();
	// the notch at the tip that makes it a cherry petal and not a leaf
	c.globalCompositeOperation = 'destination-out';
	c.beginPath();
	c.ellipse(S / 2, S * 0.99, S * 0.14, S * 0.13, 0, 0, Math.PI * 2);
	c.fill();
	petalTex = new THREE.CanvasTexture(cv);
	petalTex.colorSpace = THREE.SRGBColorSpace;
	return petalTex;
}

interface Neko {
	cat: THREE.Group;
	pawPivot: THREE.Group;
	head: THREE.Group;
	dispose: () => void;
}

function buildNeko(): Neko {
	const cat = new THREE.Group();
	const gold = new THREE.MeshStandardMaterial({
		color: 0xd9a842,
		metalness: 0.94,
		roughness: 0.24,
		emissive: 0x3a2708,
		emissiveIntensity: 0.5
	});
	const bright = new THREE.MeshStandardMaterial({
		color: 0xf7ce6b,
		metalness: 0.95,
		roughness: 0.16,
		emissive: 0x5a3f10,
		emissiveIntensity: 0.8
	});
	const dark = new THREE.MeshStandardMaterial({ color: 0x201406, metalness: 0.5, roughness: 0.5 });
	const geos: THREE.BufferGeometry[] = [];
	const keep = <T extends THREE.BufferGeometry>(g: T) => {
		geos.push(g);
		return g;
	};

	// seated body: a squat egg, widest at the base
	const body = new THREE.Mesh(keep(new THREE.SphereGeometry(0.34, 28, 22)), gold);
	body.scale.set(1, 1.06, 0.92);
	body.position.y = 0.32;
	cat.add(body);
	// haunches
	for (const s of [-1, 1]) {
		const paw = new THREE.Mesh(keep(new THREE.SphereGeometry(0.11, 16, 12)), gold);
		paw.scale.set(1.25, 0.75, 1.1);
		paw.position.set(s * 0.24, 0.08, 0.2);
		cat.add(paw);
	}

	const head = new THREE.Group();
	head.position.set(0, 0.74, 0.02);
	const skull = new THREE.Mesh(keep(new THREE.SphereGeometry(0.27, 28, 22)), gold);
	skull.scale.set(1.06, 0.96, 0.94);
	head.add(skull);
	for (const s of [-1, 1]) {
		const ear = new THREE.Mesh(keep(new THREE.ConeGeometry(0.1, 0.17, 12)), gold);
		ear.position.set(s * 0.17, 0.23, -0.01);
		ear.rotation.z = -s * 0.34;
		head.add(ear);
		// eyes: closed-happy arcs read as content; two dark beads are enough
		const eye = new THREE.Mesh(keep(new THREE.SphereGeometry(0.032, 12, 10)), dark);
		eye.position.set(s * 0.1, 0.03, 0.245);
		eye.scale.set(1, 1.25, 0.5);
		head.add(eye);
	}
	const muzzle = new THREE.Mesh(keep(new THREE.SphereGeometry(0.085, 16, 12)), bright);
	muzzle.scale.set(1.2, 0.8, 0.7);
	muzzle.position.set(0, -0.07, 0.23);
	head.add(muzzle);
	cat.add(head);

	// the beckoning paw, hinged at the shoulder so one rotation.z is the wave
	const pawPivot = new THREE.Group();
	pawPivot.position.set(0.26, 0.5, 0.12);
	const arm = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.062, 0.24, 6, 12)), gold);
	arm.position.y = 0.14;
	pawPivot.add(arm);
	const mitt = new THREE.Mesh(keep(new THREE.SphereGeometry(0.09, 16, 12)), bright);
	mitt.position.y = 0.3;
	pawPivot.add(mitt);
	cat.add(pawPivot);

	// the other paw stays down, holding the koban
	const koban = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 24)), bright);
	koban.scale.set(1, 1, 0.62); // the oval of an Edo gold piece
	koban.rotation.x = Math.PI / 2;
	koban.position.set(-0.17, 0.27, 0.34);
	koban.rotation.z = 0.42;
	cat.add(koban);

	// collar and bell
	const collar = new THREE.Mesh(keep(new THREE.TorusGeometry(0.22, 0.028, 10, 24)), dark);
	collar.position.set(0, 0.55, 0.02);
	collar.rotation.x = 1.35;
	cat.add(collar);
	const bell = new THREE.Mesh(keep(new THREE.SphereGeometry(0.055, 14, 12)), bright);
	bell.position.set(0, 0.5, 0.24);
	cat.add(bell);

	// tail curled round the base
	const tail = new THREE.Mesh(keep(new THREE.TorusGeometry(0.16, 0.045, 10, 24, Math.PI * 1.3)), gold);
	tail.position.set(-0.3, 0.16, -0.16);
	tail.rotation.set(0.4, 0.9, 1.4);
	cat.add(tail);

	return {
		cat,
		pawPivot,
		head,
		dispose: () => {
			for (const g of geos) g.dispose();
			gold.dispose();
			bright.dispose();
			dark.dispose();
		}
	};
}


export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();
	const btnHome = machine.buttonGroup.position.clone();
	const machineHomeY = machine.group.position.y;

	const restore = dimLights(scene, 0.42, 700);
	scene.crossfadeEnvironment('gold', 900);
	scene.fxLight.color.set(0xffd9a0);
	scene.fxLight.position.set(0, 0.4, 1.8);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.6));
	machine.setInnerGlow(0.24, 0xffd27a);
	machine.mechSpeed = 3.5;

	// ---- sakura, from the very first frame: it sets the register before
	// anything else happens
	const petals = particles.emitter({
		texture: petalTexture(),
		count: 300,
		emitRate: 46,
		origin: new THREE.Vector3(0, 2.5, 0.7),
		originSpread: 2.6,
		direction: new THREE.Vector3(-0.25, -1, 0),
		cone: 0.35,
		speed: [0.35, 0.85],
		gravity: new THREE.Vector3(0.05, -0.28, 0),
		drag: 0.995,
		life: [3.4, 5.2],
		size: [0.05, 0.115],
		colors: [0xffffff, 0xffd6e6, 0xf6a8c8],
		spin: [-2.4, 2.4],
		fadeIn: 0.12
	});

	// ---- the rainbow pool. Eight is enough for the widest fan; they are
	// recycled rather than rebuilt so the drop doesn't allocate mid-beat.
	const rainbowGeo = new THREE.PlaneGeometry(1, 1, 120, 1);
	rainbowGeo.translate(0.5, 0, 0); // anchored at the mouth, growing along +x
	interface Trail {
		mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
		free: boolean;
	}
	const trails: Trail[] = [];
	for (let i = 0; i < 8; i++) {
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uPhase: { value: i * 1.7 },
				uAlpha: { value: 0 },
				uReveal: { value: 0 }
			},
			vertexShader: RAINBOW_VERT,
			fragmentShader: RAINBOW_FRAG,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(rainbowGeo, mat);
		mesh.visible = false;
		mesh.renderOrder = 5;
		scene.scene.add(mesh);
		trails.push({ mesh, free: true });
	}

	/** Shoot one rainbow out of the bore at `angle`, rippling, then let it go. */
	const rainbow = (angle: number, length: number, height = 0.5, hold = 1500) => {
		const t = trails.find((x) => x.free);
		if (!t) return;
		t.free = false;
		const { mesh } = t;
		const u = mesh.material.uniforms;
		mesh.visible = true;
		// it starts behind the cat so it reads as pouring out from behind it
		mesh.position.set(btn.x, btn.y, 0.5);
		mesh.rotation.z = angle;
		mesh.scale.set(length, height, 1);
		u.uAlpha.value = 1;
		u.uReveal.value = 0;
		u.uPhase.value = rand(0, 6.28);
		tween(360, 'outQuad', (v) => (u.uReveal.value = v));
		tween(hold + 700, 'linear', (v) => {
			// hangs at full, then the tail is pulled back into the hole
			u.uAlpha.value = v < 0.7 ? 1 : 1 - (v - 0.7) / 0.3;
		}).then(() => {
			mesh.visible = false;
			t.free = true;
		});
	};

	// ---- the cat
	const { cat, pawPivot, head, dispose } = buildNeko();
	cat.position.set(btnHome.x, btnHome.y - 0.5, btnHome.z - 0.2);
	cat.scale.setScalar(0.001);
	machine.centre.add(cat);

	// ---- ONE sim, one clock. Everything below reads songT.
	let songT = -1;
	let waveT = 0;
	let waveSpeed = 0; // paw waves per second
	let hop = 0; // how much the cat bounces on the beat
	let bob = 0; // one-shot kick from a beckon
	let risen = false;
	const stopSim = scene.addUpdatable((dt, t) => {
		if (songT >= 0) songT += dt;
		waveT += dt * waveSpeed;
		const swing = Math.sin(waveT * Math.PI * 2);
		pawPivot.rotation.z = -0.35 - swing * 0.55;
		head.rotation.z = swing * 0.08;
		head.rotation.y = Math.sin(waveT * Math.PI) * 0.14;

		if (songT >= 0) {
			// the beat pulse every rhythmic thing hangs off
			const beat = (songT % BEAT) / BEAT;
			const kick = Math.pow(1 - beat, 2.4);
			if (risen) cat.position.y = btnHome.y + 0.12 + kick * hop + bob;
			cat.scale.y = cat.scale.x * (1 + kick * hop * 0.35); // squash on landing
			// the machine sways a bar at a time, and the room cycles hue
			machine.group.position.y = machineHomeY + Math.sin((songT / BAR) * Math.PI * 2) * 0.035;
			machine.group.rotation.z = Math.sin((songT / (BAR * 2)) * Math.PI * 2) * 0.022;
			scene.fxLight.color.setHSL(((songT / BAR) * 0.19) % 1, 0.62, 0.62);
		} else if (risen) {
			cat.position.y = btnHome.y + 0.12 + Math.sin(t * 1.6) * 0.018 + bob;
		}
		for (const tr of trails) {
			if (tr.mesh.visible) tr.mesh.material.uniforms.uTime.value = t;
		}
	});
	pawPivot.rotation.z = -0.35;

	/** A wave HAULS money in from off the sides of the frame. */
	const beckon = (strength: number) => {
		haptics.vibrate(20 + strength * 18);
		tween(240, 'outQuad', (v) => (bob = Math.sin(Math.PI * v) * 0.05));
		for (const side of [-1, 1]) {
			particles.burst({
				texture: sprites.coin,
				count: Math.round(26 + strength * 40),
				origin: new THREE.Vector3(side * 3.4, btn.y + rand(-0.5, 0.7), 0.75),
				originSpread: 0.55,
				direction: new THREE.Vector3(-side * 1, 0.18, 0),
				cone: 0.24,
				speed: [3.4 + strength * 1.6, 5.6 + strength * 2.2],
				drag: 0.985,
				gravity: new THREE.Vector3(0, -1.4, 0),
				life: [1, 1.7],
				size: [0.05, 0.12],
				colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
				spin: [-7, 7],
				fadeIn: 0.05
			});
		}
	};

	/** A pop of square 8-bit stars — the chiptune's visual punctuation. */
	const pixelPop = (x: number, y: number, count = 18) => {
		particles.burst({
			texture: pixelStarTexture(),
			count,
			origin: new THREE.Vector3(x, y, 0.95),
			originSpread: 0.14,
			speed: [1.4, 3.6],
			gravity: new THREE.Vector3(0, -1.2, 0),
			life: [0.5, 1.1],
			size: [0.05, 0.13],
			colors: [0xff4f6d, 0xffd12e, 0x3fe05a, 0x33a0ff, 0xae57ff, 0xffffff],
			spin: [-8, 8]
		});
	};

	// ================= the song =================
	// Bar 0: the hatch. Everything from here is measured in bars, and the audio
	// is already running — director.play() started it as this function was called.
	songT = 0;
	await delay(BEAT * 1000);
	await tween(200, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + v * 0.22;
	});
	tween(BEAT * 2 * 1000, 'outCubic', (v) => {
		machine.buttonGroup.position.y = btnHome.y + v * 1.02;
	});
	haptics.vibrate([18, 40, 60]);
	particles.burst({
		texture: sprites.softDot,
		count: 34,
		origin: new THREE.Vector3(btn.x, btn.y, 0.5),
		originSpread: 0.22,
		speed: [0.25, 0.8],
		gravity: new THREE.Vector3(0, 0.5, 0),
		life: [0.7, 1.6],
		size: [0.07, 0.2],
		colors: [0xffe9ad, 0xffd27a, 0xfff6e0],
		fadeIn: 0.15
	});

	// Bar 1: the cat rises
	await delay(BEAT * 1000);
	await tween(BAR * 1000, 'outCubic', (v) => {
		cat.scale.setScalar(Math.max(0.001, v * 1.18));
		cat.position.y = btnHome.y - 0.5 + v * 0.62;
		cat.position.z = btnHome.z - 0.2 + v * 1.05;
	});
	risen = true;
	waveSpeed = 165 / 60 / 2; // one wave every two beats
	hop = 0.05;
	pixelPop(btn.x, btn.y + 0.5, 22);

	// Bar 2: the first rainbow, and the first fistful of money
	rainbow(2.9, 3.6, 0.55, 2200);
	beckon(0);
	await delay(BAR * 1000);

	// Bar 3: one out the other side
	rainbow(0.3, 3.6, 0.55, 2200);
	pixelPop(btn.x + 1.2, btn.y + 0.7, 14);
	await delay(BAR * 1000);

	// Bar 4: a pair, high and wide, and the face starts turning on the bar
	const faceHome = machine.faceSpin.rotation.z;
	let faceTurn = 0;
	const spinFace = () => {
		faceTurn += Math.PI / 2;
		const from = machine.faceSpin.rotation.z;
		tween(BAR * 900, 'inOutCubic', (v) => {
			machine.faceSpin.rotation.z = from + (faceHome + faceTurn - from) * v;
		});
	};
	rainbow(2.35, 4.2, 0.45, 2400);
	rainbow(0.8, 4.2, 0.45, 2400);
	spinFace();
	beckon(0.4);
	await delay(BAR * 1000);

	// Bar 5: rain of koban
	pixelPop(btn.x - 1.4, btn.y + 0.9, 16);
	particles.burst({
		texture: sprites.coin,
		count: 90,
		origin: new THREE.Vector3(btn.x, btn.y + 2.2, 0.85),
		originSpread: 1.9,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.2,
		speed: [1.4, 3],
		gravity: new THREE.Vector3(0, -2.6, 0),
		life: [1.2, 2],
		size: [0.06, 0.14],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
		spin: [-6, 6]
	});
	await delay(BAR * 1000);

	// Bar 6: a three-rainbow fan
	rainbow(3.0, 4.4, 0.5, 2600);
	rainbow(0.14, 4.4, 0.5, 2600);
	rainbow(1.57, 3.0, 0.4, 2600);
	spinFace();
	beckon(0.7);
	await delay(BAR * 1000);

	// Bar 7: quiet-ish, the cat winds up
	waveSpeed = 165 / 60; // one wave per beat now
	hop = 0.075;
	pixelPop(btn.x, btn.y + 1.1, 20);
	await delay(BAR * 1000);

	// ---- Bar 8: THE DROP. Full fan, cat spins, everything at once.
	haptics.vibrate([50, 30, 120]);
	scene.shake(0.42);
	flashPulse(machine, 0.8, 110, 760, 0xffd27a);
	shockwave(scene.scene, new THREE.Vector3(btn.x, btn.y, 0.7), {
		color: 0xffd27a,
		maxScale: 5.6,
		duration: 820,
		z: 0.7
	});
	for (let i = 0; i < 6; i++) {
		rainbow((i / 6) * Math.PI * 2 + 0.2, 4.6, 0.46, 3200);
	}
	beckon(1.2);
	pixelPop(btn.x, btn.y, 34);
	tween(BAR * 1000, 'outCubic', (v) => {
		cat.rotation.y = v * Math.PI * 2; // one full pirouette, lands facing front
	});
	waveSpeed = (165 / 60) * 1.5;
	hop = 0.1;
	await delay(BAR * 1000);

	// Bars 9-10: it holds the party up
	for (let i = 0; i < 2; i++) {
		rainbow(2.7 + i * 0.5, 4.4, 0.5, 2400);
		rainbow(0.45 - i * 0.5, 4.4, 0.5, 2400);
		pixelPop(btn.x + (i ? 1.5 : -1.5), btn.y + 0.6, 18);
		beckon(0.9);
		spinFace();
		await delay(BAR * 1000);
	}

	// Bar 11: a slow sweep — one rainbow that rotates right around the machine
	const sweeper = trails.find((x) => x.free);
	rainbow(-1.2, 4.6, 0.52, 3400);
	if (sweeper) {
		tween(BAR * 2 * 1000, 'inOutQuad', (v) => {
			sweeper.mesh.rotation.z = -1.2 + v * Math.PI * 2;
		});
	}
	pixelPop(btn.x, btn.y + 1.2, 24);
	await delay(BAR * 1000);

	// Bars 12-13: the word, while the sweep is still going round
	beckon(1);
	luckyWord(ctx, {
		text: 'BECKONED',
		color: 0xffd27a,
		colorB: 0xfff0c8,
		y: -1.25, // below the machine: over that gold face the motes wash out
		gather: BAR * 700,
		hold: BAR * 900,
		scatter: BAR * 500,
		silent: true // the track owns the mix
	});
	await delay(BAR * 2 * 1000);

	// Bar 14: the run-up — keep the frame busy while the track climbs
	rainbow(2.2, 4.6, 0.5, 2200);
	rainbow(0.95, 4.6, 0.5, 2200);
	pixelPop(btn.x, btn.y + 1.0, 26);
	beckon(1);
	spinFace();
	await delay(BAR * 1000);

	// Bar 15: everything left in the tank, landing on the final chord
	haptics.vibrate([60, 30, 140]);
	scene.shake(0.5);
	flashPulse(machine, 0.9, 100, 900, 0xffd27a);
	for (let i = 0; i < 6; i++) rainbow((i / 6) * Math.PI * 2 - 0.4, 5, 0.46, 2600);
	beckon(1.5);
	pixelPop(btn.x, btn.y, 44);
	particles.burst({
		texture: sprites.coin,
		count: 170,
		origin: new THREE.Vector3(btn.x, btn.y, 0.6),
		originSpread: 0.2,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.95,
		speed: [2.4, 5.6],
		gravity: new THREE.Vector3(0, -3.2, 0),
		life: [1.2, 2.3],
		size: [0.06, 0.14],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff0cf],
		spin: [-6, 6]
	});
	tween(500, 'outQuad', (v) => {
		pawPivot.rotation.z = -0.35 - v * 1.1; // paw held high for the finish
		scene.fxLight.intensity = 2.6 + v * 3;
	});
	waveSpeed = 0;

	// ---- the song ends. Now, and only now, we are allowed to make a noise.
	await delay(Math.max(0, SONG * 1000 - songT * 1000));
	audio.stopTrack('luckyCatWave', 400);
	await delay(260);
	// a little chiptune sign-off in the silence: three rising blips and the bell
	for (const [pitch, wait] of [[1.5, 130], [1.9, 130], [2.6, 0]] as const) {
		audio.sfx('pop', { pitch, gain: 0.4 });
		if (wait) await delay(wait);
	}
	audio.sfx('ding', { pitch: 1.7, gain: 0.5 });

	// ---- back into the machine, hatch shut
	petals.stop();
	await tween(620, 'inCubic', (v) => {
		cat.scale.setScalar(Math.max(0.001, 1.18 * (1 - v)));
		cat.position.y = btnHome.y + 0.12 - v * 0.6;
		cat.position.z = btnHome.z + 0.85 - v * 1.05;
	});
	songT = -1;
	stopSim();
	for (const tr of trails) {
		scene.scene.remove(tr.mesh);
		tr.mesh.material.dispose();
	}
	rainbowGeo.dispose();
	machine.centre.remove(cat);
	dispose();
	machine.group.position.y = machineHomeY;
	machine.group.rotation.z = 0;
	await tween(560, 'outBack', (v) => {
		machine.buttonGroup.position.y = btnHome.y + 1.02 * (1 - v);
	});
	audio.sfx('clack', { pitch: 0.9, gain: 0.5 });
	await tween(200, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + 0.22 * (1 - v);
	});
	machine.buttonGroup.position.copy(btnHome);

	machine.mechSpeed = 1;
	scene.crossfadeEnvironment('lounge');
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.44 * (1 - v));
		scene.fxLight.intensity = 5.6 * (1 - v);
	});
	await restore(900);
}
