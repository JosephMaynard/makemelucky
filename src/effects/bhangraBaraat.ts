// Effect — BHANGRA BARAAT: the wedding procession has arrived and it's here
// for YOU. Fairy lights blaze up around the machine's rim, marigold garlands
// drop across the top of the frame, and the button steps out on stage — then
// two more buttons spring out of the open bore behind it and the three of
// them dance bhangra: the shoulder shrug, the one-leg bounce, arms-up-and-
// jhoomer spins, unison leaps, a canon wave — all done with squash, stretch,
// SHEAR and twist on the buttons themselves (no limbs, no costumes, no
// people: the buttons are the dancers). Coins are thrown over the hero on
// the accents (nyochavar — relatives toss coins over the groom for luck),
// gulal colour puffs burst on the phrase changes, marigold petals fall
// throughout, and fireworks carry the climax. For the exit the backing
// dancers dive back down the bore and the hero pirouettes home on the final
// hit.
//
// Deliberately secular: marigolds, coins, colour, fairy lights, fireworks and
// a dhol beat. No religious iconography of any kind.
//
// Sound: /soundfx/bollywood-luck.mp3 (26.57s). Measured 139.5bpm (0.430s) with
// the first downbeat at 0.90s — Suno's "136" label is off; the audio's own
// grid is what the choreography follows. Zero procedural sfx: the track owns
// the mix.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave, disposeObject } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'bollywoodLuck';
export const duration = 26700;

const BEAT = 60 / 139.5; // 0.430s, measured from the track
const GRID = 0.9; // first downbeat (s) — every accent sits on GRID + k·BEAT

const SAFFRON = 0xff8a1f;
const MARIGOLD = 0xffb020;
const MAGENTA = 0xe8177d;
const GOLD = 0xffd24a;
const TURQ = 0x18c8c0;
const LIME = 0x8fd13f;
const CREAM = 0xfff1c8;
const GULAL = [MAGENTA, SAFFRON, TURQ, LIME, GOLD];
const ROCKET_PALETTES = [
	[SAFFRON, GOLD, CREAM],
	[MAGENTA, 0xff9ad2, CREAM],
	[TURQ, 0x9af0ea, CREAM],
	[LIME, GOLD, CREAM]
];

/** A marigold head, seen from above: ruffled orange petals, yellow heart. */
function marigoldTexture(): THREE.CanvasTexture {
	const s = 128;
	const cv = document.createElement('canvas');
	cv.width = s;
	cv.height = s;
	const c = cv.getContext('2d')!;
	const cx = s / 2;
	const layers: [number, string][] = [
		[0.4, '#e86a10'],
		[0.31, '#ff8c1a'],
		[0.22, '#ffa826'],
		[0.13, '#ffc63a']
	];
	for (const [r, col] of layers) {
		c.fillStyle = col;
		const petals = Math.round(r * 40);
		for (let i = 0; i < petals; i++) {
			const a = (i / petals) * Math.PI * 2 + r * 7;
			c.beginPath();
			c.arc(cx + Math.cos(a) * r * s * 0.8, cx + Math.sin(a) * r * s * 0.8, r * s * 0.34, 0, Math.PI * 2); // outermost reach stays inside the canvas
			c.fill();
		}
	}
	c.fillStyle = '#ffe070';
	c.beginPath();
	c.arc(cx, cx, s * 0.09, 0, Math.PI * 2);
	c.fill();
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

/** The pose a dancer holds this frame: offsets from home, plus the four
 *  cartoon deformations — scale (squash/stretch), shear (the lean that keeps
 *  the base planted), tilt and a Y-axis twist. */
interface Pose {
	dx: number;
	dy: number;
	sx: number;
	sy: number;
	kx: number; // shear: x' = x + kx·y — top slides, base stays put
	tilt: number;
	spin: number;
}
const REST: Pose = { dx: 0, dy: 0, sx: 1, sy: 1, kx: 0, tilt: 0, spin: 0 };

function lerpPose(a: Pose, b: Pose, t: number): Pose {
	return {
		dx: a.dx + (b.dx - a.dx) * t,
		dy: a.dy + (b.dy - a.dy) * t,
		sx: a.sx + (b.sx - a.sx) * t,
		sy: a.sy + (b.sy - a.sy) * t,
		kx: a.kx + (b.kx - a.kx) * t,
		tilt: a.tilt + (b.tilt - a.tilt) * t,
		spin: a.spin + (b.spin - a.spin) * t
	};
}

const smooth = (t: number) => {
	const u = Math.min(1, Math.max(0, t));
	return u * u * (3 - 2 * u);
};

/** The bhangra move set. `b` is continuous beats since the first downbeat,
 *  `side` is ±1 (which shoulder leads; the left dancer mirrors). Every move
 *  is continuous across beat boundaries: a pose reached at the end of one
 *  beat is where the next beat starts from. */
function movePose(move: number, b: number, side: number, idx: number): Pose {
	const beat = Math.floor(b);
	const ph = b - beat;
	// arrive early in the beat, then settle with a damped wobble — life, not jelly
	const snap = 1 - Math.pow(1 - Math.min(1, ph / 0.32), 3);
	const settle = ph > 0.32 ? Math.sin((ph - 0.32) * Math.PI * 4) * Math.exp(-(ph - 0.32) * 5) * 0.14 : 0;
	const step = snap + settle;
	const hop = Math.sin(Math.PI * ph);
	const land = Math.pow(1 - ph, 3);
	const alt = beat % 2 === 0 ? 1 : -1; // which way this beat travels
	const p: Pose = { ...REST };

	switch (move) {
		case 1: {
			// THE SHRUG: shoulders go up-and-across, alternating each beat —
			// a shear that flips sign every beat with a hint of bounce under it
			const k = side * alt * 0.2 * (2 * step - 1);
			p.kx = k;
			p.tilt = -k * 0.35;
			p.sy = 1 + hop * 0.04 - land * 0.05;
			p.sx = 1 - (p.sy - 1) * 0.7;
			p.dy = hop * 0.03;
			break;
		}
		case 2: {
			// THE BOUNCE: one-leg hops, tilting onto alternate legs, stretching
			// at the top and squashing hard on the landing
			const t = side * alt * 0.14 * (2 * step - 1);
			p.tilt = t;
			p.kx = -t * 0.45;
			p.dy = hop * 0.14;
			p.sy = 1 + hop * 0.12 - land * 0.16;
			p.sx = 1 - (p.sy - 1) * 0.8;
			break;
		}
		case 3: {
			// ARMS UP, THEN JHOOMER: two beats reaching tall and swaying, then a
			// full twist on two beats, low and wide
			const q = b % 4;
			if (q < 2) {
				const up = smooth(q / 1.1);
				p.sy = 1 + up * 0.2;
				p.sx = 1 - up * 0.13;
				p.kx = Math.sin(q * Math.PI) * 0.12 * side;
				p.dy = up * 0.05 + hop * 0.02;
			} else {
				const w = smooth((q - 2) / 0.3);
				p.sy = 1.2 - w * 0.27;
				p.sx = 0.87 + w * 0.19;
				p.spin = Math.PI * 2 * smooth((q - 2) / 2) * side;
				p.dy = 0.05 - w * 0.05 + hop * 0.04;
			}
			break;
		}
		case 4: {
			// BIG UNISON LEAPS: a beat of anticipation crouch, then a beat in
			// the air with a twist, landing straight into the next crouch
			const q = b % 2;
			if (q < 1) {
				const c = Math.sin(q * Math.PI);
				p.sy = 1 - c * 0.2;
				p.sx = 1 + c * 0.18;
				p.dy = -c * 0.03;
			} else {
				const a = Math.sin((q - 1) * Math.PI);
				p.dy = a * 0.34;
				p.sy = 1 + a * 0.2;
				p.sx = 1 - a * 0.14;
				p.tilt = a * 0.2 * side * (Math.floor(b / 2) % 2 === 0 ? 1 : -1);
			}
			break;
		}
		case 5: {
			// THE WAVE: the bounce again but in canon, each dancer a third of a
			// beat behind the last, with a big travelling lean
			const bb = b - idx * 0.34;
			const wb = Math.floor(bb);
			const wph = bb - wb;
			const wsnap = 1 - Math.pow(1 - Math.min(1, wph / 0.32), 3);
			const walt = wb % 2 === 0 ? 1 : -1;
			const whop = Math.sin(Math.PI * wph);
			const wland = Math.pow(1 - wph, 3);
			p.kx = walt * 0.24 * (2 * wsnap - 1);
			p.tilt = -p.kx * 0.3;
			p.dy = whop * 0.12;
			p.sy = 1 + whop * 0.1 - wland * 0.14;
			p.sx = 1 - (p.sy - 1) * 0.8;
			break;
		}
		default: {
			// idle sway between routines
			p.kx = Math.sin((b * Math.PI) / 2) * 0.04 * side;
			p.sy = 1 + hop * 0.015;
		}
	}
	return p;
}

/** A button on the dance floor. The hero IS machine.buttonGroup (posed in
 *  its own local space); the backing pair are clones living in the scene. */
class Dancer {
	obj: THREE.Object3D;
	home: THREE.Vector3;
	base: number; // resting scale
	side: number;
	idx: number;
	auto: boolean; // sim drives the matrix; false while a script owns it
	hit: number; // landing impulse, decays
	private _m = new THREE.Matrix4();
	private _t = new THREE.Matrix4();

	constructor(obj: THREE.Object3D, home: THREE.Vector3, base: number, side: number, idx: number) {
		this.obj = obj;
		this.home = home;
		this.base = base;
		this.side = side;
		this.idx = idx;
		this.auto = false;
		this.hit = 0;
	}

	/** Hand the button to the sim: from now on its matrix is composed by hand. */
	takeOver(): void {
		this.obj.matrixAutoUpdate = false;
		this.auto = true;
	}

	/** Give the button back to ordinary transforms (for scripted moves). */
	release(): void {
		this.auto = false;
		this.obj.matrixAutoUpdate = true;
		this.obj.position.copy(this.home);
		this.obj.rotation.set(0, 0, 0);
		this.obj.scale.setScalar(this.base);
		this.obj.updateMatrix();
	}

	apply(p: Pose): void {
		const m = this._m;
		const t = this._t;
		// T · Rz · Ry · Shear · S — the shear sits inside the rotations so the
		// lean is always relative to the button's own up
		m.makeTranslation(this.home.x + p.dx, this.home.y + p.dy, this.home.z);
		m.multiply(t.makeRotationZ(p.tilt));
		m.multiply(t.makeRotationY(p.spin));
		t.identity();
		t.elements[4] = p.kx; // column-major: row 0, column 1
		m.multiply(t);
		m.multiply(t.makeScale(p.sx * this.base, p.sy * this.base, this.base));
		this.obj.matrix.copy(m);
	}
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics } = ctx;
	const t0 = performance.now();
	const since = () => performance.now() - t0;
	const at = (ms: number) => delay(Math.max(0, ms - since()));
	const btnHome = machine.buttonGroup.position.clone();
	const btnPos = machine.buttonWorldPosition();
	const frameHalfW = (z: number) =>
		Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * scene.camera.aspect * (5.35 - z);
	const frameHalfH = (z: number) => Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * (5.35 - z);

	// ---- warm evening light: a wedding lawn strung with bulbs, not a nightclub
	const restore = dimLights(scene, 0.6, 700);
	scene.crossfadeEnvironment('gold', 800);
	scene.fxLight.color.set(MARIGOLD);
	scene.fxLight.position.set(0.6, 1.4, 1.9);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.4));
	scene.setVignetteTint(0x3a1608);

	// ---- fairy lights around the machine's rim, parented in so they ride the
	// machine (machine.group sits at scene y -0.32 — local origin is the centre)
	const LIGHTS = 44;
	const lightRing = new THREE.Group();
	const lightMats: THREE.SpriteMaterial[] = [];
	const bulbCols = [CREAM, GOLD, MAGENTA, TURQ];
	for (let i = 0; i < LIGHTS; i++) {
		const a = (i / LIGHTS) * Math.PI * 2;
		const mat = new THREE.SpriteMaterial({
			map: sprites.softDot,
			color: bulbCols[i % 4],
			transparent: true,
			opacity: 0,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		const sp = new THREE.Sprite(mat);
		sp.position.set(Math.cos(a) * 1.43, Math.sin(a) * 1.43, 0.36);
		sp.scale.setScalar(0.12);
		sp.renderOrder = 6;
		lightRing.add(sp);
		lightMats.push(mat);
	}
	machine.group.add(lightRing);

	// ---- marigold garlands: two swags meeting at the top centre, plus a
	// pendant string hanging from the join. One instanced mesh, coloured per bead.
	const swagZ = 0.42;
	const swagY = frameHalfH(swagZ) * 0.92;
	const swagW = frameHalfW(swagZ) + 0.2;
	const beadGeo = new THREE.SphereGeometry(0.06, 10, 8);
	const beadMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0.02 });
	const perSwag = 26;
	const pendant = 7;
	const beadCount = perSwag * 2 + pendant;
	const garland = new THREE.InstancedMesh(beadGeo, beadMat, beadCount);
	const beadHome: THREE.Vector3[] = [];
	const beadCol = new THREE.Color();
	{
		let n = 0;
		const dummy = new THREE.Object3D();
		const bead = (x: number, y: number, col: number, s = 1) => {
			dummy.position.set(x, y, swagZ);
			dummy.scale.setScalar(s);
			dummy.updateMatrix();
			garland.setMatrixAt(n, dummy.matrix);
			garland.setColorAt(n, beadCol.set(col));
			beadHome.push(dummy.position.clone());
			n++;
		};
		for (const dir of [-1, 1]) {
			for (let i = 0; i < perSwag; i++) {
				const t = i / (perSwag - 1);
				const x = dir * t * swagW;
				const y = swagY + 0.35 - 0.62 * Math.sin(t * Math.PI); // sag mid-swag
				const col = i % 5 === 4 ? 0x3aa64a : i % 2 ? MARIGOLD : SAFFRON; // a leaf every fifth bead
				bead(x, y, col, i % 5 === 4 ? 0.8 : 1);
			}
		}
		for (let i = 0; i < pendant; i++) {
			bead(0, swagY + 0.35 - i * 0.13, i % 2 ? MARIGOLD : SAFFRON, i === pendant - 1 ? 1.5 : 1);
		}
	}
	garland.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
	garland.position.y = 1.6; // dropped in from above the frame
	scene.scene.add(garland);

	// ---- petals, coins, colour
	const marigoldTex = marigoldTexture();
	const puffMats: THREE.SpriteMaterial[] = [];
	const puffs = new Set<THREE.Sprite>();
	/** A handful of gulal thrown in the air: powdery (normal blend), drifting
	 *  up and out, thinning as it spreads. */
	const gulal = (origin: THREE.Vector3, color: number, size = 1) => {
		for (let i = 0; i < 11; i++) {
			const mat = new THREE.SpriteMaterial({
				map: sprites.softDot,
				color,
				transparent: true,
				opacity: 0.8,
				depthWrite: false
			});
			puffMats.push(mat);
			const sp = new THREE.Sprite(mat);
			sp.renderOrder = 7;
			const a = rand(0, Math.PI * 2);
			const r = rand(0.05, 0.22) * size;
			const start = origin.clone().add(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, rand(-0.05, 0.05)));
			const vel = new THREE.Vector3(Math.cos(a) * rand(0.5, 1.5), Math.sin(a) * rand(0.5, 1.5) + 0.7, rand(-0.1, 0.2)).multiplyScalar(size);
			sp.position.copy(start);
			sp.scale.setScalar(0.2 * size);
			scene.scene.add(sp);
			puffs.add(sp);
			const dur = rand(800, 1250);
			tween(dur, 'outCubic', (v) => {
				sp.position.set(start.x + vel.x * v * 0.5, start.y + vel.y * v * 0.5 + v * 0.1, start.z + vel.z * v);
				sp.scale.setScalar((0.2 + v * 0.75) * size);
				mat.opacity = 0.8 * (1 - v * v);
			}).then(() => {
				scene.scene.remove(sp);
				puffs.delete(sp);
			});
		}
	};
	/** Coins over the groom. */
	const coinToss = (origin: THREE.Vector3, count = 26, big = false) =>
		particles.burst({
			texture: sprites.coin,
			count,
			origin,
			originSpread: 0.25,
			direction: new THREE.Vector3(0, 1, 0.15),
			cone: big ? 0.9 : 0.55,
			speed: big ? [2.6, 4.4] : [2, 3.4],
			gravity: new THREE.Vector3(0, -6.5, 0),
			drag: 0.995,
			life: [1.1, 1.7],
			size: [0.1, 0.17],
			colors: [GOLD, 0xfff0b0, 0xffc040],
			spin: [-9, 9]
		});
	const rocket = async (x: number, apexY: number, palette: number[]) => {
		const origin = new THREE.Vector3(x * 0.4, -0.9, 0.25);
		const trail = particles.emitter({
			texture: sprites.softDot,
			count: 90,
			emitRate: 120,
			origin,
			originSpread: 0.01,
			speed: [0.02, 0.1],
			gravity: new THREE.Vector3(0, -0.35, 0),
			life: [0.22, 0.45],
			size: [0.015, 0.04],
			colors: [CREAM, palette[0]]
		});
		await tween(rand(620, 780), 'outQuad', (v) => {
			origin.x = x * 0.4 + x * 0.6 * v;
			origin.y = -0.9 + (apexY + 0.9) * v;
			origin.z = 0.25 + v * 0.35;
		});
		trail.stop();
		scene.fxLight.color.set(palette[0]);
		scene.fxLight.intensity = 9;
		tween(600, 'outQuad', (v) => (scene.fxLight.intensity = 9 - v * 7.6));
		scene.shake(0.08);
		particles.burst({
			texture: sprites.softDot,
			count: 1,
			origin: origin.clone(),
			speed: [0, 0],
			gravity: new THREE.Vector3(0, 0, 0),
			life: [0.3, 0.3],
			size: [1.2, 1.2],
			colors: [palette[2]]
		});
		particles.burst({
			texture: sprites.softDot,
			count: 340,
			origin: origin.clone(),
			speed: [1.8, 4.2],
			gravity: new THREE.Vector3(0, -0.9, 0),
			drag: 0.982,
			life: [1, 2.2],
			size: [0.06, 0.14],
			colors: palette
		});
		particles.burst({
			texture: sprites.star4,
			count: 110,
			origin: origin.clone(),
			speed: [1, 2.8],
			gravity: new THREE.Vector3(0, -0.75, 0),
			drag: 0.985,
			life: [1.2, 2.3],
			size: [0.04, 0.1],
			colors: [0xffffff, palette[1]]
		});
	};

	// ---- the dancers: the hero is the real button; the backing pair are clones
	// of it that come up out of the bore behind it once it has stepped forward.
	const POP = 0.85; // how far the hero steps out
	const backZ = 0.45;
	const spread = Math.min(1.05, frameHalfW(backZ) - 0.5);
	const hero = new Dancer(machine.buttonGroup, new THREE.Vector3(btnHome.x, btnHome.y, btnHome.z + POP), 1, 1, 0);
	const backups: Dancer[] = [];
	for (const side of [-1, 1]) {
		const clone = machine.buttonGroup.clone();
		clone.position.set(btnPos.x, btnPos.y - 0.08, 0.12);
		clone.scale.setScalar(0.2);
		clone.visible = false;
		scene.scene.add(clone);
		backups.push(
			new Dancer(clone, new THREE.Vector3(btnPos.x + side * spread, btnPos.y - 0.05, backZ), 0.74, side, side < 0 ? 1 : 2)
		);
	}
	const dancers = [hero, ...backups];

	// ---- the beat sim: everything moves off one clock
	let songT = 0;
	let groove = 0;
	let move = 0;
	let prevMove = 0;
	let moveT = 9; // seconds since the routine changed (for the blend)
	let chase = 0.45; // fairy-light chase speed, laps per second
	let lightsUp = 0;
	let petals: ReturnType<typeof particles.emitter> | null = null;
	let coinRain: ReturnType<typeof particles.emitter> | null = null;
	const setMove = (m: number) => {
		prevMove = move;
		move = m;
		moveT = 0;
	};
	const stopSim = scene.addUpdatable((dt) => {
		songT += dt;
		moveT += dt;
		const b = (songT - GRID) / BEAT;
		const ph = ((b % 1) + 1) % 1;
		const land = Math.pow(1 - ph, 3);
		const mix = smooth(moveT / 0.36);

		for (const d of dancers) {
			d.hit *= Math.exp(-dt * 9);
			if (!d.auto) continue;
			let p = lerpPose(movePose(prevMove, b, d.side, d.idx), movePose(move, b, d.side, d.idx), mix);
			// groove scales every departure from rest; the landing impulse squashes on top
			p = lerpPose(REST, p, groove);
			p.sy *= 1 - d.hit * 0.2;
			p.sx *= 1 + d.hit * 0.18;
			d.apply(p);
		}

		// fairy lights: a chase running round the rim, every bulb flaring on the beat
		for (let i = 0; i < LIGHTS; i++) {
			const u = ((i / LIGHTS) * 4 - songT * chase + 10) % 1;
			const pulse = Math.pow(Math.max(0, Math.cos(u * Math.PI * 2)), 3);
			const glow = (0.3 + 0.7 * pulse + land * 0.35 * groove) * lightsUp;
			lightMats[i].opacity = Math.min(1, glow);
			lightRing.children[i].scale.setScalar(0.1 + pulse * 0.07 + land * 0.04 * groove);
		}

		// garlands sway with the crowd; the pendant swings a beat behind
		{
			const sway = Math.sin((songT * Math.PI) / (BEAT * 2)) * 0.05 * groove;
			const dummy = new THREE.Object3D();
			for (let i = 0; i < beadCount; i++) {
				const h = beadHome[i];
				const isPendant = i >= perSwag * 2;
				const wobble = isPendant ? Math.sin((songT - 0.12) * Math.PI / BEAT) * 0.05 * groove * (i - perSwag * 2) : sway * Math.abs(h.x) * 0.5;
				dummy.position.set(h.x + wobble, h.y + (isPendant ? 0 : Math.sin(songT * 2 + h.x) * 0.01), h.z);
				dummy.scale.setScalar(isPendant && i === beadCount - 1 ? 1.5 : i % 5 === 4 && !isPendant ? 0.8 : 1);
				dummy.updateMatrix();
				garland.setMatrixAt(i, dummy.matrix);
			}
			garland.instanceMatrix.needsUpdate = true;
		}

		if (petals) petals.opts.origin.x = rand(-frameHalfW(0.6), frameHalfW(0.6));
		if (coinRain) coinRain.opts.origin.x = (Math.random() < 0.5 ? -1 : 1) * rand(0.9, frameHalfW(0.6));

		scene.fxLight.intensity = Math.max(scene.fxLight.intensity, 1.1 + land * 0.7 * groove);
	});

	try {
		// ============================================================ THE FLOURISH (0–0.9s)
		// lights up, garlands drop in
		tween(800, 'outQuad', (v) => (lightsUp = v));
		tween(900, 'outElastic', (v) => (garland.position.y = 1.6 * (1 - v)));
		machine.mechSpeed = 2;

		// ============================================================ 0.90 the hero steps out
		await at(GRID * 1000 - 120);
		haptics.vibrate(25);
		await tween(520, 'outBack', (v) => {
			machine.buttonGroup.position.z = btnHome.z + v * POP;
		});
		gulal(new THREE.Vector3(btnPos.x, btnPos.y - 0.2, 1.0), SAFFRON, 1.1);
		hero.takeOver();
		groove = 0.35; // a polite sway while the crew arrives

		// ============================================================ 1.76 / 2.19 the crew springs out of the bore
		const springOut = async (d: Dancer, color: number) => {
			const o = d.obj;
			o.visible = true;
			const from = o.position.clone();
			await tween(480, 'outQuad', (v) => {
				o.position.set(
					from.x + (d.home.x - from.x) * v,
					from.y + (d.home.y - from.y) * v + Math.sin(v * Math.PI) * 0.5,
					from.z + (d.home.z - from.z) * v
				);
				o.scale.setScalar(0.2 + (d.base - 0.2) * v);
				o.rotation.z = d.side * Math.PI * 2 * v; // a cartwheel out of the hole
			});
			gulal(d.home.clone().setZ(d.home.z + 0.3), color, 0.85);
			d.release();
			d.takeOver();
			d.hit = 1;
		};
		await at((GRID + BEAT * 2) * 1000 - 380);
		springOut(backups[0], MAGENTA);
		await at((GRID + BEAT * 3) * 1000 - 380);
		springOut(backups[1], TURQ);

		// ============================================================ 3.48 the downbeat: everyone lands
		await at((GRID + BEAT * 6) * 1000);
		for (const d of dancers) d.hit = 1;
		scene.shake(0.14);
		haptics.vibrate([20, 30, 40]);
		coinToss(new THREE.Vector3(btnPos.x, btnPos.y + 0.55, 1.05), 30);
		shockwave(scene.scene, new THREE.Vector3(btnPos.x, btnPos.y, 0.6), { color: GOLD, maxScale: 2.4, duration: 520, z: 0.6 });
		machine.setInnerGlow(0.35, MARIGOLD);
		tween(600, 'inOutQuad', (v) => (groove = 0.35 + v * 0.65));
		setMove(1);
		machine.mechSpeed = 4;
		petals = particles.emitter({
			texture: marigoldTex,
			count: 120,
			emitRate: 14,
			origin: new THREE.Vector3(0, frameHalfH(0.6) + 0.2, 0.6),
			originSpread: 0.1,
			direction: new THREE.Vector3(0, -1, 0),
			cone: 0.5,
			speed: [0.6, 1.1],
			gravity: new THREE.Vector3(0, -0.9, 0),
			drag: 0.985,
			life: [3, 4],
			size: [0.14, 0.22],
			colors: [0xffffff],
			spin: [-2, 2]
		});

		// ============================================================ 4.36 the groove settles: coins on every accent
		for (const k of [8, 10, 12, 14, 16]) {
			await at((GRID + BEAT * k) * 1000);
			coinToss(new THREE.Vector3(btnPos.x, btnPos.y + 0.55, 1.05), 18);
			haptics.vibrate(12);
		}

		// ============================================================ 8.64 new phrase: THE BOUNCE, colour flying
		await at((GRID + BEAT * 18) * 1000);
		setMove(2);
		gulal(hero.home.clone().add(new THREE.Vector3(0, 0.2, 0.25)), MAGENTA, 1.3);
		flashPulse(machine, 0.3, 70, 500, MAGENTA);
		for (const [k, col] of [[22, TURQ], [26, LIME]] as [number, number][]) {
			await at((GRID + BEAT * k) * 1000);
			for (const d of backups) gulal(d.home.clone().add(new THREE.Vector3(0, 0.15, 0.3)), col, 0.9);
			coinToss(new THREE.Vector3(btnPos.x, btnPos.y + 0.55, 1.05), 16);
		}

		// ============================================================ 13.77 phrase change: ARMS UP + JHOOMER, the word
		await at((GRID + BEAT * 30) * 1000);
		setMove(3);
		scene.shake(0.12);
		haptics.vibrate([25, 25, 50]);
		flashPulse(machine, 0.45, 80, 550, GOLD);
		for (const d of dancers) gulal(d.home.clone().add(new THREE.Vector3(0, 0.1, 0.3)), GULAL[d.idx], 1);
		void luckyWord(ctx, {
			text: 'LUCKY!',
			color: SAFFRON,
			colorB: GOLD,
			y: 0.55,
			gather: 700,
			hold: 1100,
			scatter: 600,
			silent: true
		});
		chase = 0.8;
		// first rockets go up over the reach
		delay(300).then(() => rocket(-1.6, 1.3, ROCKET_PALETTES[0]));
		delay(1150).then(() => rocket(1.6, 1.4, ROCKET_PALETTES[1]));

		// ============================================================ 17.2 the climax: LEAPS, fireworks, coin rain
		await at((GRID + BEAT * 38) * 1000);
		setMove(4);
		chase = 1.4;
		coinToss(new THREE.Vector3(btnPos.x, btnPos.y + 0.55, 1.05), 40, true);
		coinRain = particles.emitter({
			texture: sprites.coin,
			count: 120,
			emitRate: 24,
			origin: new THREE.Vector3(0, frameHalfH(0.6) + 0.3, 0.62),
			originSpread: 0.15,
			direction: new THREE.Vector3(0, -1, 0),
			cone: 0.3,
			speed: [0.6, 1.4],
			gravity: new THREE.Vector3(0, -3, 0),
			drag: 0.99,
			life: [1.6, 2.4],
			size: [0.06, 0.11],
			colors: [GOLD, 0xfff0b0],
			spin: [-8, 8]
		});
		// one rocket per accent, alternating sides, landing on the leaps
		for (let i = 0; i < 4; i++) {
			const k = 38 + i * 2;
			await at((GRID + BEAT * k) * 1000 - 700);
			void rocket(i % 2 ? 1.7 : -1.7, rand(1.15, 1.5), ROCKET_PALETTES[(i + 2) % 4]);
			delay(700).then(() => {
				for (const d of dancers) d.hit = 0.8;
			});
		}

		// ============================================================ 20.62 final section: THE WAVE
		await at((GRID + BEAT * 46) * 1000);
		setMove(5);
		coinRain.stop();
		coinRain = null;
		for (let i = 0; i < 4; i++) {
			await at((GRID + BEAT * (48 + i * 2)) * 1000);
			const d = dancers[(i + 1) % 3];
			gulal(d.home.clone().add(new THREE.Vector3(0, 0.15, 0.3)), GULAL[(i + 1) % GULAL.length], 1);
			void rocket(i % 2 ? -1.5 : 1.5, rand(1.1, 1.4), ROCKET_PALETTES[i % 4]);
		}

		// ============================================================ 24.06 the exit: the crew dives home, the hero pirouettes
		await at((GRID + BEAT * 54) * 1000 - 200);
		petals.stop();
		petals = null;
		for (const d of backups) {
			d.release();
			const o = d.obj;
			const from = o.position.clone();
			// a leap up, then straight down the bore behind the hero
			tween(720, 'inQuad', (v) => {
				o.position.set(
					from.x + (btnPos.x - from.x) * v,
					from.y + (btnPos.y - 0.1 - from.y) * v + Math.sin(v * Math.PI) * 0.55,
					from.z + (0.12 - from.z) * v
				);
				o.rotation.z = d.side * v * 5;
				o.scale.setScalar(Math.max(0.001, d.base * (1 - v * 0.85)));
			}).then(() => {
				o.visible = false;
				particles.burst({
					texture: sprites.star4,
					count: 12,
					origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.5),
					speed: [0.6, 1.6],
					life: [0.3, 0.7],
					size: [0.03, 0.07],
					colors: [GOLD, MAGENTA, CREAM]
				});
			});
		}
		// the hero: stretch out into a forward swoop and a double pirouette
		hero.release();
		machine.buttonGroup.position.z = btnHome.z + POP;
		await tween(420, 'outCubic', (v) => {
			machine.buttonGroup.position.z = btnHome.z + POP + v * 0.5;
			const s = 1 + v * 0.12;
			machine.buttonGroup.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
		});
		await tween(980, 'inOutCubic', (v) => {
			machine.buttonGroup.rotation.y = v * Math.PI * 4;
			const s = 1.12 + Math.sin(v * Math.PI) * 0.08;
			machine.buttonGroup.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
		});
		machine.buttonGroup.rotation.y = 0;
		// and home: a backflip over the last bar, dropping into the socket on the final hit
		const landAt = (GRID + BEAT * 58) * 1000 - 40; // ≈25.74s
		const flipMs = Math.max(400, landAt - since() - 240);
		await tween(flipMs, 'inOutQuad', (v) => {
			machine.buttonGroup.rotation.x = -v * Math.PI * 2;
			machine.buttonGroup.position.z = btnHome.z + POP + 0.5 - v * (POP + 0.1);
			machine.buttonGroup.position.y = btnHome.y + Math.sin(v * Math.PI) * 0.45;
		});
		machine.buttonGroup.rotation.x = 0;
		await tween(240, 'inQuad', (v) => {
			machine.buttonGroup.position.z = btnHome.z + 0.4 - v * 0.4;
			machine.buttonGroup.position.y = btnHome.y;
		});
		scene.shake(0.24);
		haptics.vibrate([25, 25, 70]);
		flashPulse(machine, 0.5, 80, 650, GOLD);
		coinToss(new THREE.Vector3(btnPos.x, btnPos.y + 0.3, 0.8), 44, true);
		for (const col of [MAGENTA, SAFFRON, TURQ]) gulal(new THREE.Vector3(btnPos.x + rand(-0.5, 0.5), btnPos.y + rand(-0.1, 0.4), 0.9), col, 1.2);
		shockwave(scene.scene, new THREE.Vector3(btnPos.x, btnPos.y, 0.55), { color: GOLD, maxScale: 3, duration: 600, z: 0.55 });
		await tween(360, 'outBack', (v) => {
			const s = 1 - (1 - v) * 0.24;
			machine.buttonGroup.scale.set(1 + (1 - s) * 0.9, s, 1 + (1 - s) * 0.9);
		});
		machine.buttonGroup.scale.set(1, 1, 1);

		// ---- house lights while the last flourish plays out
		machine.mechSpeed = 1;
		groove = 0;
		tween(800, 'inOutQuad', (v) => {
			machine.setInnerGlow(0.35 * (1 - v));
			lightsUp = 1 - v;
			garland.position.y = v * 1.6;
		});
		await at(26400);
	} finally {
		// ---- teardown (also runs if anything above throws, so the button is
		// never left with a hand-composed matrix)
		stopSim();
		for (const d of dancers) d.obj.matrixAutoUpdate = true;
		machine.buttonGroup.position.copy(btnHome);
		machine.buttonGroup.scale.set(1, 1, 1);
		machine.buttonGroup.rotation.set(0, 0, 0);
		machine.buttonGroup.updateMatrix();
		machine.setInnerGlow(0);
		scene.fxLight.intensity = 0;
		scene.setVignetteTint(0x000000);
		petals?.stop();
		coinRain?.stop();
		for (const d of backups) scene.scene.remove(d.obj); // clones share the machine's geometry: no dispose
		for (const sp of puffs) scene.scene.remove(sp);
		for (const m of puffMats) m.dispose();
		machine.group.remove(lightRing);
		for (const m of lightMats) m.dispose();
		scene.scene.remove(garland);
		disposeObject(garland);
		marigoldTex.dispose();
		scene.crossfadeEnvironment('lounge');
		await restore(900);
	}
}
