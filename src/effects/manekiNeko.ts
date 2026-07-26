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
// STREAMERS, not flags. The first version fired flat bands radially out of the
// centre and the result read as a Pride starburst rather than a party popper —
// six equal horizontal stripes repeated in a symmetric sunburst will do that.
// The fix is threefold: each ribbon TWISTS about its own axis so you see it
// edge-on as often as face-on, its path starts deep inside the bore and curls
// as it flies, and they are fired as a loose asymmetric spray with cream
// selvedge down both edges — which is what a party streamer actually looks like.
const RIBBON_VERT = /* glsl */ `
	uniform float uTime;
	uniform float uPhase;
	uniform float uLen;
	uniform float uWidth;
	uniform float uTwist;
	varying vec2 vUv;
	void main() {
		vUv = uv;
		float s = position.x; // 0..1 along the streamer
		float w = position.y; // -0.5..0.5 across it
		float t = uTime * 1.5 + uPhase;
		// the path: out of the deep dark of the bore, forward, then waving
		vec3 path;
		path.x = s * uLen;
		path.y = sin(s * 5.0 + t) * 0.4 * s + sin(s * 11.0 - t * 1.4) * 0.11 * s;
		path.z = mix(-2.1, 0.0, smoothstep(0.0, 0.2, s)) + sin(s * 3.6 + t * 0.8) * 0.55 * s;
		// the twist. Without it this is a flag; with it, it is a ribbon.
		float tw = s * uTwist + t * 1.15 + uPhase;
		vec3 across = vec3(0.0, cos(tw), sin(tw));
		// pinched at the mouth so you never see where it comes from
		vec3 p = path + across * w * uWidth * smoothstep(0.0, 0.13, s);
		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}
`;

const RIBBON_FRAG = /* glsl */ `
	uniform float uAlpha;
	uniform float uReveal;
	uniform float uShift;
	varying vec2 vUv;
	void main() {
		float a = vUv.y;
		vec3 c;
		if (a < 0.1 || a > 0.9) {
			c = vec3(1.0, 0.97, 0.88); // cream selvedge, like crepe paper
		} else {
			// the palette is ROTATED per ribbon so a handful of them together
			// never line up into the same repeated banner
			float band = mod(floor((a - 0.1) / 0.8 * 6.0) + uShift, 6.0);
			c = band < 1.0 ? vec3(1.00, 0.20, 0.34)
				: band < 2.0 ? vec3(1.00, 0.60, 0.14)
				: band < 3.0 ? vec3(1.00, 0.90, 0.20)
				: band < 4.0 ? vec3(0.28, 0.86, 0.42)
				: band < 5.0 ? vec3(0.24, 0.60, 1.00)
				: vec3(0.78, 0.36, 0.92);
			float seam = smoothstep(0.05, 0.0, abs(fract((a - 0.1) / 0.8 * 6.0) - 0.5) - 0.45);
			c *= 1.0 - seam * 0.4;
		}
		// the far side of a twist is in its own shadow — this is what gives the
		// ribbon its form as it rolls over
		if (!gl_FrontFacing) c *= 0.5;
		float grow = smoothstep(uReveal, uReveal - 0.08, vUv.x);
		// sRGB constants written into a linear buffer come back pastel; the
		// output pass encodes afterwards, so linearise here
		gl_FragColor = vec4(pow(c, vec3(2.2)), uAlpha * grow);
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



/** An ofuda: the paper talisman that gets slapped on things in every anime
 *  exorcism. Cream washi, red rule, a column of kanji and a vermillion seal. */
const OFUDA_KANJI = ['福', '運', '招', '金', '縁', '開'] as const;
const ofudaTex: Partial<Record<string, THREE.CanvasTexture>> = {};
function ofudaTexture(glyph: string): THREE.CanvasTexture {
	const hit = ofudaTex[glyph];
	if (hit) return hit;
	const W = 128;
	const H = 340;
	const cv = document.createElement('canvas');
	cv.width = W;
	cv.height = H;
	const c = cv.getContext('2d')!;
	// paper, slightly warm, with a soft edge shadow so it isn't a flat rectangle
	const g = c.createLinearGradient(0, 0, W, H);
	g.addColorStop(0, '#fbf4e2');
	g.addColorStop(0.5, '#f3e8cd');
	g.addColorStop(1, '#e6d7b4');
	c.fillStyle = g;
	c.fillRect(0, 0, W, H);
	// the notched head that says "talisman" and not "receipt"
	c.clearRect(0, 0, W, 26);
	c.fillStyle = g as unknown as string;
	c.beginPath();
	c.moveTo(0, 26);
	c.lineTo(W / 2, 0);
	c.lineTo(W, 26);
	c.closePath();
	c.fillStyle = '#fbf4e2';
	c.fill();
	// vermillion rules
	c.strokeStyle = '#b4232a';
	c.lineWidth = 5;
	c.strokeRect(11, 32, W - 22, H - 46);
	c.lineWidth = 2;
	c.strokeRect(19, 40, W - 38, H - 62);
	// the glyph, big, plus a smaller one under it
	c.fillStyle = '#1c1712';
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	c.font = "700 84px 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";
	c.fillText(glyph, W / 2, 118);
	c.font = "700 46px 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";
	c.fillText('護', W / 2, 196);
	// the seal
	c.fillStyle = '#c02a30';
	c.fillRect(W / 2 - 26, H - 96, 52, 52);
	c.fillStyle = '#f6ead0';
	c.font = "700 30px 'Hiragino Mincho ProN', 'Yu Mincho', serif";
	c.fillText('印', W / 2, H - 68);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	ofudaTex[glyph] = tex;
	return tex;
}

/** Gold foil confetti: a rectangle with a bright crease down it. */
let confettiTex: THREE.CanvasTexture | null = null;
function confettiTexture(): THREE.CanvasTexture {
	const S = 32;
	if (confettiTex) return confettiTex;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	c.fillStyle = '#ffffff';
	c.fillRect(S * 0.28, S * 0.06, S * 0.44, S * 0.88);
	c.fillStyle = 'rgba(0,0,0,0.28)'; // the fold
	c.fillRect(S * 0.28, S * 0.06, S * 0.16, S * 0.88);
	confettiTex = new THREE.CanvasTexture(cv);
	confettiTex.colorSpace = THREE.SRGBColorSpace;
	return confettiTex;
}

/** Concentration lines — the anime "everything is about to happen" overlay. */
let linesTex: THREE.CanvasTexture | null = null;
function speedLinesTexture(): THREE.CanvasTexture {
	if (linesTex) return linesTex;
	const S = 512;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	const C = S / 2;
	c.translate(C, C);
	// deterministic-ish spread: 116 spikes of varying width, none in the middle
	for (let i = 0; i < 116; i++) {
		const a = (i / 116) * Math.PI * 2 + Math.sin(i * 12.9898) * 0.02;
		const wide = 0.004 + (i % 7) * 0.0035;
		const inner = C * (0.3 + ((i * 37) % 11) * 0.022);
		c.save();
		c.rotate(a);
		const grad = c.createLinearGradient(inner, 0, C * 1.42, 0);
		grad.addColorStop(0, 'rgba(255,255,255,0)');
		grad.addColorStop(1, 'rgba(255,255,255,0.95)');
		c.fillStyle = grad;
		c.beginPath();
		c.moveTo(inner, 0);
		c.lineTo(C * 1.42, -C * wide * 4);
		c.lineTo(C * 1.42, C * wide * 4);
		c.closePath();
		c.fill();
		c.restore();
	}
	linesTex = new THREE.CanvasTexture(cv);
	linesTex.colorSpace = THREE.SRGBColorSpace;
	return linesTex;
}

/** A single huge kanji, brush-weight, for the JRPG screen-filling flash. */
const kanjiTex: Partial<Record<string, THREE.CanvasTexture>> = {};
function kanjiFlashTexture(glyph: string): THREE.CanvasTexture {
	const hit = kanjiTex[glyph];
	if (hit) return hit;
	const S = 512;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	c.font = "900 380px 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif JP', serif";
	c.lineJoin = 'round';
	c.strokeStyle = '#c0202c';
	c.lineWidth = 34;
	c.strokeText(glyph, S / 2, S / 2 + 12);
	c.fillStyle = '#fffaf0';
	c.fillText(glyph, S / 2, S / 2 + 12);
	kanjiTex[glyph] = new THREE.CanvasTexture(cv);
	kanjiTex[glyph]!.colorSpace = THREE.SRGBColorSpace;
	return kanjiTex[glyph]!;
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

	// ---- the streamer pool, recycled so a volley never allocates mid-beat
	const ribbonGeo = new THREE.PlaneGeometry(1, 1, 150, 1);
	ribbonGeo.translate(0.5, 0, 0); // anchored at the mouth, running along +x
	interface Streamer {
		mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
		free: boolean;
	}
	const trails: Streamer[] = [];
	for (let i = 0; i < 9; i++) {
		const mat = new THREE.ShaderMaterial({
			uniforms: {
				uTime: { value: 0 },
				uPhase: { value: i * 1.7 },
				uAlpha: { value: 0 },
				uReveal: { value: 0 },
				uShift: { value: 0 },
				uLen: { value: 4 },
				uWidth: { value: 0.4 },
				uTwist: { value: 6 }
			},
			vertexShader: RIBBON_VERT,
			fragmentShader: RIBBON_FRAG,
			transparent: true,
			depthWrite: false,
			side: THREE.DoubleSide
		});
		const mesh = new THREE.Mesh(ribbonGeo, mat);
		mesh.visible = false;
		mesh.renderOrder = 5;
		scene.scene.add(mesh);
		trails.push({ mesh, free: true });
	}

	/** Fire one streamer out of the bore. `angle` is only the general heading —
	 *  the ribbon's own curl does most of the work, so volleys are sprayed
	 *  rather than spaced evenly, which is what stopped them reading as a flag. */
	const streamer = (angle: number, len = 4.2, hold = 1800) => {
		const t = trails.find((x) => x.free);
		if (!t) return null;
		t.free = false;
		const u = t.mesh.material.uniforms;
		t.mesh.visible = true;
		// deep behind the button: the vertex path starts at z -2.1 from here
		t.mesh.position.set(btn.x, btn.y, 0.35);
		t.mesh.rotation.z = angle + rand(-0.12, 0.12);
		u.uAlpha.value = 1;
		u.uReveal.value = 0;
		u.uPhase.value = rand(0, 6.28);
		u.uShift.value = Math.floor(rand(0, 6));
		u.uLen.value = len * rand(0.85, 1.15);
		u.uWidth.value = rand(0.3, 0.46);
		u.uTwist.value = rand(7, 13);
		tween(420, 'outQuad', (v) => (u.uReveal.value = v));
		tween(hold + 700, 'linear', (v) => {
			u.uAlpha.value = v < 0.72 ? 1 : 1 - (v - 0.72) / 0.28;
		}).then(() => {
			t.mesh.visible = false;
			t.free = true;
		});
		return t;
	};

	/** A loose spray of streamers around a heading — never a symmetric star. */
	const volley = (count: number, centre: number, spread: number, hold = 2000) => {
		for (let i = 0; i < count; i++) {
			streamer(centre + rand(-spread, spread), rand(3.4, 5), hold);
		}
	};

	// ---- the ofuda: paper talismans that fly out and hang in a ward around it
	const ofudaGeo = new THREE.PlaneGeometry(0.26, 0.7);
	const ofuda: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[] = [];
	for (let i = 0; i < 8; i++) {
		const mat = new THREE.MeshBasicMaterial({
			map: ofudaTexture(OFUDA_KANJI[i % OFUDA_KANJI.length]),
			transparent: true,
			opacity: 0,
			side: THREE.DoubleSide,
			depthWrite: false
		});
		const m = new THREE.Mesh(ofudaGeo, mat);
		m.visible = false;
		m.renderOrder = 6;
		scene.scene.add(m);
		ofuda.push(m);
	}
	let wardT = 0;
	let wardSpin = 0; // radians/sec around the machine
	let wardOut = 0; // 0 hidden, 1 fully deployed

	// ---- overlays: concentration lines and the screen-filling kanji
	const linesMat = new THREE.SpriteMaterial({
		map: speedLinesTexture(),
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const lines = new THREE.Sprite(linesMat);
	lines.position.set(btn.x, btn.y, 2.4);
	lines.scale.setScalar(7);
	lines.renderOrder = 20;
	scene.scene.add(lines);
	const speedLines = (peak = 0.75, ms = 620) => {
		tween(ms, 'outCubic', (v) => {
			linesMat.opacity = Math.sin(Math.min(1, v * 1.25) * Math.PI) * peak;
			lines.scale.setScalar(7.6 - v * 2.4); // rushing inward
		});
	};

	const kanjiMat = new THREE.SpriteMaterial({
		map: kanjiFlashTexture('福'),
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const kanji = new THREE.Sprite(kanjiMat);
	kanji.position.set(btn.x, btn.y + 0.1, 2.2);
	kanji.renderOrder = 21;
	scene.scene.add(kanji);
	const kanjiFlash = (glyph: string, ms = 900) => {
		kanjiMat.map = kanjiFlashTexture(glyph);
		kanjiMat.needsUpdate = true;
		tween(ms, 'outCubic', (v) => {
			// slams in oversized, settles, then goes
			kanji.scale.setScalar(3.6 - Math.pow(1 - v, 3) * 1.9);
			kanjiMat.opacity = v < 0.18 ? v / 0.18 : Math.pow(1 - (v - 0.18) / 0.82, 1.7);
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
	let hop = 0;
	let bob = 0;
	let risen = false;
	const stopSim = scene.addUpdatable((dt, t) => {
		if (songT >= 0) songT += dt;
		waveT += dt * waveSpeed;
		const swing = Math.sin(waveT * Math.PI * 2);
		pawPivot.rotation.z = -0.35 - swing * 0.55;
		head.rotation.z = swing * 0.08;
		head.rotation.y = Math.sin(waveT * Math.PI) * 0.14;

		let kick = 0;
		if (songT >= 0) {
			kick = Math.pow(1 - (songT % BEAT) / BEAT, 2.4);
			if (risen) cat.position.y = btnHome.y + 0.12 + kick * hop + bob;
			cat.scale.y = cat.scale.x * (1 + kick * hop * 0.35);
			machine.group.position.y = machineHomeY + Math.sin((songT / BAR) * Math.PI * 2) * 0.035;
			machine.group.rotation.z = Math.sin((songT / (BAR * 2)) * Math.PI * 2) * 0.022;
			scene.fxLight.color.setHSL(((songT / BAR) * 0.19) % 1, 0.62, 0.62);
		} else if (risen) {
			cat.position.y = btnHome.y + 0.12 + Math.sin(t * 1.6) * 0.018 + bob;
		}

		// the ward: talismans hanging in a slowly turning ring, breathing on the
		// beat, each one swinging on its own like paper on a string
		wardT += dt * wardSpin;
		for (let i = 0; i < ofuda.length; i++) {
			const m = ofuda[i];
			if (!m.visible) continue;
			const a = wardT + (i / ofuda.length) * Math.PI * 2;
			const r = 1.62 * wardOut;
			m.position.set(
				btn.x + Math.cos(a) * r,
				btn.y + Math.sin(a) * r * 0.82,
				0.95 + Math.sin(a * 2) * 0.3
			);
			m.rotation.z = Math.sin(t * 2.1 + i) * 0.16 - Math.cos(a) * 0.12;
			m.rotation.y = Math.sin(t * 1.3 + i * 0.7) * 0.35;
			m.scale.setScalar(wardOut * (1 + kick * 0.12));
			m.material.opacity = wardOut;
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

	/** Gold foil confetti, fired up and out to flutter down over everything. */
	const confetti = (count = 90, speed = 4) => {
		particles.burst({
			texture: confettiTexture(),
			count,
			origin: new THREE.Vector3(btn.x, btn.y - 0.2, 0.9),
			originSpread: 0.3,
			direction: new THREE.Vector3(0, 1, 0.1),
			cone: 0.85,
			speed: [speed * 0.55, speed],
			drag: 0.988, // foil loses its speed fast, then flutters
			gravity: new THREE.Vector3(0, -2.2, 0),
			life: [1.6, 3],
			size: [0.045, 0.1],
			colors: [0xffd45e, 0xfff0b8, 0xd9a842, 0xff7ba6, 0xfffaf0],
			spin: [-9, 9],
			fadeIn: 0.04
		});
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
	waveSpeed = 165 / 60 / 2;
	hop = 0.05;
	pixelPop(btn.x, btn.y + 0.5, 22);

	// Bar 2: the first streamers, up and to the left, and money
	volley(2, 2.5, 0.5);
	beckon(0);
	await delay(BAR * 1000);

	// Bar 3: a pair the other way, and the first confetti
	volley(2, 0.6, 0.5);
	confetti(70, 3.6);
	await delay(BAR * 1000);

	// Bar 4: the ward deploys — eight talismans out of the bore
	const faceHome = machine.faceSpin.rotation.z;
	let faceTurn = 0;
	const spinFace = () => {
		faceTurn += Math.PI / 2;
		const from = machine.faceSpin.rotation.z;
		tween(BAR * 900, 'inOutCubic', (v) => {
			machine.faceSpin.rotation.z = from + (faceHome + faceTurn - from) * v;
		});
	};
	for (const m of ofuda) m.visible = true;
	wardSpin = 0.42;
	tween(BAR * 900, 'outBack', (v) => (wardOut = Math.max(0.001, v)));
	pixelPop(btn.x, btn.y + 0.7, 20);
	spinFace();
	await delay(BAR * 1000);

	// Bar 5: koban rain through the ward
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
	volley(2, 1.9, 0.9);
	beckon(0.5);
	await delay(BAR * 1000);

	// Bar 6: concentration lines and a spray to the right
	speedLines(0.6, 700);
	volley(3, 0.2, 0.8);
	spinFace();
	await delay(BAR * 1000);

	// Bar 7: the wind-up — the ward speeds up, everything holds its breath
	waveSpeed = 165 / 60;
	hop = 0.075;
	wardSpin = 1.5;
	speedLines(0.5, 500);
	pixelPop(btn.x, btn.y + 1.1, 20);
	await delay(BEAT * 3 * 1000);
	speedLines(0.9, 420); // one more, right before it lands
	await delay(BEAT * 1000);

	// ---- Bar 8: THE DROP
	haptics.vibrate([50, 30, 120]);
	scene.shake(0.42);
	flashPulse(machine, 0.7, 110, 760, 0xffd27a);
	delay(170).then(() => kanjiFlash('福', 950));
	shockwave(scene.scene, new THREE.Vector3(btn.x, btn.y, 0.7), {
		color: 0xffd27a,
		maxScale: 5.6,
		duration: 820,
		z: 0.7
	});
	volley(5, 1.5, 1.5, 3000); // a wide spray, still not a star
	confetti(150, 5.4);
	beckon(1.2);
	pixelPop(btn.x, btn.y, 34);
	tween(BAR * 1000, 'outCubic', (v) => {
		cat.rotation.y = v * Math.PI * 2;
	});
	waveSpeed = (165 / 60) * 1.5;
	hop = 0.1;
	wardSpin = 0.9;
	await delay(BAR * 1000);

	// Bars 9-10: it holds the party up
	for (let i = 0; i < 2; i++) {
		volley(3, i ? 2.6 : 0.5, 0.9, 2400);
		confetti(80, 4.2);
		pixelPop(btn.x + (i ? 1.5 : -1.5), btn.y + 0.6, 18);
		beckon(0.9);
		spinFace();
		await delay(BAR * 1000);
	}

	// Bar 11: the ward closes in and flares, anime-seal style
	speedLines(0.8, 640);
	kanjiFlash('招', 850);
	tween(BAR * 1000, 'inOutQuad', (v) => (wardOut = 1 - v * 0.42));
	wardSpin = 2.6;
	volley(2, 4.4, 0.7, 2200);
	await delay(BAR * 1000);

	// Bars 12-13: the word, while the ward hangs around it
	tween(BAR * 800, 'outCubic', (v) => (wardOut = 0.58 + v * 0.42));
	wardSpin = 0.6;
	beckon(1);
	luckyWord(ctx, {
		text: 'BECKONED',
		color: 0xffd27a,
		colorB: 0xfff0c8,
		y: -1.25,
		gather: BAR * 700,
		hold: BAR * 900,
		scatter: BAR * 500,
		silent: true
	});
	await delay(BAR * 2 * 1000);

	// Bar 14: the run-up
	volley(3, 1.5, 1.3, 2200);
	confetti(90, 4.4);
	pixelPop(btn.x, btn.y + 1.0, 26);
	beckon(1);
	spinFace();
	await delay(BAR * 1000);

	// Bar 15: everything left in the tank, landing on the final chord
	haptics.vibrate([60, 30, 140]);
	scene.shake(0.5);
	flashPulse(machine, 0.7, 100, 900, 0xffd27a);
	speedLines(0.6, 800);
	delay(200).then(() => kanjiFlash('大', 1150));
	volley(6, 1.5, 1.9, 2600);
	confetti(220, 6);
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
		pawPivot.rotation.z = -0.35 - v * 1.1;
		scene.fxLight.intensity = 2.6 + v * 3;
	});
	waveSpeed = 0;

	// ---- the song ends. Now, and only now, we are allowed to make a noise.
	await delay(Math.max(0, SONG * 1000 - songT * 1000));
	audio.stopTrack('luckyCatWave', 400);
	tween(700, 'inOutQuad', (v) => (wardOut = 1 - v));
	await delay(260);
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
	for (const m of ofuda) {
		scene.scene.remove(m);
		m.material.dispose();
	}
	scene.scene.remove(lines, kanji);
	linesMat.dispose();
	kanjiMat.dispose();
	ribbonGeo.dispose();
	ofudaGeo.dispose();
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
