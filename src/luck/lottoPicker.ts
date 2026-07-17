// The Luck Number Generator. Harvests genuine cosmic entropy, draws your
// numbers with a properly-seeded PRNG, works out each number's numerological
// disposition, renders them as tumbling 3D orbs, and ripples them out into the
// luck field to make them that little bit luckier.
//
// Everything strange lives in THIS file on purpose. If you are reading it on
// GitHub and thinking "WTF?", that is the intended emotional journey. None of
// the numerology means anything. All of it is load-bearing.
//
// (The original CodePen also POSTed every drawn number to a random IP:port — a
// small DDoS stunt aimed at strangers' machines. That has been shown the door;
// a test asserts fetch() is never called.)

import { track } from '../services/analytics';

/* ======================================================================
   DATA
   ====================================================================== */

interface GameConfig {
	range: number;
	count: number;
	bonusRange: number;
	bonusCount: number;
}
interface Game {
	name: string;
	themeHue: number;
	config: GameConfig;
}

const GAMES: Record<string, Game> = {
	euromillions: { name: 'EuroMillions', themeHue: 220, config: { range: 50, count: 5, bonusRange: 12, bonusCount: 2 } },
	lotto: { name: 'UK National', themeHue: 120, config: { range: 59, count: 6, bonusRange: 1, bonusCount: 0 } },
	megamillions: { name: 'Mega Millions', themeHue: 25, config: { range: 70, count: 5, bonusRange: 25, bonusCount: 1 } },
	ozlotto: { name: 'Oz Lotto', themeHue: 80, config: { range: 45, count: 7, bonusRange: 1, bonusCount: 0 } },
	powerball: { name: 'Powerball USA', themeHue: 345, config: { range: 69, count: 5, bonusRange: 26, bonusCount: 1 } },
	powerballAus: { name: 'Powerball AUS', themeHue: 200, config: { range: 35, count: 7, bonusRange: 20, bonusCount: 1 } },
	setForLife: { name: 'Set For Life UK', themeHue: 285, config: { range: 47, count: 5, bonusRange: 10, bonusCount: 1 } }
};
const DEFAULT_CUSTOM: GameConfig = { range: 50, count: 5, bonusRange: 10, bonusCount: 1 };

const MANTRA = 'THE OWLS ARE NOT WHAT THEY SEEM';
const INCANTATIONS = [
	'Harvesting quantum foam…',
	'Consulting the owls (they are not what they seem)…',
	'Aligning with Pure Universal Vibration™…',
	'Reducing your numbers to their Pythagorean essence…',
	'Folding φ into the cauldron…'
];

/* ======================================================================
   ENTROPY + PRNG  (the honest bit, dressed as the dishonest bit)
   ====================================================================== */

// Non-standard navigator bits we sniff purely as extra entropy — all optional.
interface ExoticNavigator {
	deviceMemory?: number;
	connection?: { downlink?: number; effectiveType?: string };
	getBattery?: () => Promise<{ level: number }>;
}

// last pointer position — the "user aura" folded into the cosmic cauldron
const aura = { x: 0, y: 0 };
addEventListener('pointermove', (e) => { aura.x = e.screenX; aura.y = e.screenY; }, { passive: true });

// grabs moving-target data, hashes it, and pulls a 32-bit seed
async function cosmicSeed(): Promise<number> {
	const nav = navigator as Navigator & ExoticNavigator;
	let battery = '';
	try {
		if (nav.getBattery) battery = String((await nav.getBattery()).level);
	} catch { /* battery API blocked — the cosmos provides regardless */ }
	const txt = [
		Date.now(), // wall-clock
		performance.now(), // sub-ms timer
		location.href,
		navigator.userAgent,
		screen.width,
		screen.height,
		nav.deviceMemory ?? '',
		navigator.hardwareConcurrency ?? '',
		nav.connection?.downlink ?? '',
		nav.connection?.effectiveType ?? '',
		battery
	].join('::');
	const buf = new TextEncoder().encode(txt);
	const hash = await crypto.subtle.digest('SHA-256', buf);
	return new DataView(hash).getUint32(0, true); // first 4 bytes → 32-bit uint
}

// Mulberry-32: tiny, fast, strong enough when reseeded per spin
function mulberry32(seed: number): () => number {
	return () => {
		let t = (seed += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/*  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    ┃  summonCosmos()  —  an RNG channelling Pure Universal   ┃
    ┃  Vibration™.  Returns a 0 ≤ x < 1 float each call.      ┃
    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ */
function summonCosmos(): () => number {
	const rol = (x: number, k: number) => (x << k) | (x >>> (32 - k));

	/* 1 ▸ HARVEST ASTONISHING ENTROPY */
	const buf = new Uint32Array(8);
	crypto.getRandomValues(buf); // quantum foam
	buf[0] ^= (performance.now() * 1e3) | 0; // scheduler jitter
	buf[1] ^= Date.now(); // wall-clock
	buf[2] ^= 0x9e3779b9; // φ in hex form
	buf[3] ^= (aura.x << 16) | (aura.y & 0xffff); // user aura
	/* nonsense mantra hash */
	MANTRA.split('').forEach((ch, i) => {
		buf[4] ^= rol(ch.charCodeAt(0), i & 31);
	});

	/* 2 ▸ BREW IT — xorshift* cauldron */
	let state = 0x85ebca6b >>> 0; // odd, non-zero
	for (const v of buf) {
		state = (state ^ Math.imul(v, 0x6c50b47c)) >>> 0;
		state = Math.imul(rol(state, 17), 0x9e3779b1) >>> 0;
	}

	/* 3 ▸ RETURN PRNG — a float in [0, 1), cosmically flavoured */
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/* ======================================================================
   LOTTO MATHS
   ====================================================================== */

const formatBigInt = (n: bigint): string => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const nChooseK = (n: number, k: number): bigint => {
	let bn = BigInt(n);
	let bk = BigInt(k);
	if (bk > bn) return 0n;
	if (bk === 0n || bk === bn) return 1n;
	if (bk > bn - bk) bk = bn - bk;
	let res = 1n;
	for (let i = 1n; i <= bk; i++) res = (res * (bn - i + 1n)) / i;
	return res;
};

const oddsString = ({ range, count, bonusRange, bonusCount }: GameConfig): string => {
	const odds = nChooseK(range, count) * (bonusCount ? nChooseK(bonusRange, bonusCount) : 1n);
	return odds > 0n ? `1 in ${formatBigInt(odds)}` : '—';
};

/* Fisher-Yates using the supplied cosmic rng() — the draw itself is honestly,
   boringly uniform. The numerology is applied AFTER, purely as decoration. */
function pickUnique(range: number, count: number, rng: () => number): number[] {
	if (count > range) throw new RangeError('count > range');
	const pool = Array.from({ length: range }, (_, i) => i + 1);
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	return pool.slice(0, count).sort((a, b) => a - b);
}

/* ======================================================================
   ⛧ NUMEROLOGY ENGINE ⛧
   None of this is real. All of it is deterministic. The numbers do not know
   they are being judged. The judgement is delivered regardless.
   ====================================================================== */

const PHI = (1 + Math.sqrt(5)) / 2; // golden ratio — luck's structural rebar
const GOLDEN_ANGLE = 137.50776405003785; // degrees; how sunflowers hedge their bets
const SCHUMANN_HZ = 7.83; // Earth's own alleged heartbeat
const LUNAR_SYNODIC = 29.530588853; // days per lunation
const LUNAR_EPOCH_MS = 947182440000; // a documented new moon, 2000-01-06 18:14 UTC
const TAU = Math.PI * 2;

// Pythagorean 9-reduction: keep summing digits until one remains (1–9).
const digitalRoot = (n: number): number => 1 + ((Math.abs(n) - 1 + 9) % 9);

const isPrime = (n: number): boolean => {
	if (n < 2) return false;
	for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
	return true; // indivisible fortune — nothing can break it up
};
const isFib = (n: number): boolean => {
	// a positive integer is Fibonacci iff 5n²±4 is a perfect square (Gessel)
	const test = (x: number) => {
		const s = Math.round(Math.sqrt(x));
		return s * s === x;
	};
	return test(5 * n * n + 4) || test(5 * n * n - 4); // spiral-aligned
};
const isAngel = (n: number): boolean => {
	const s = String(n);
	return s.length >= 2 && [...s].every((c) => c === s[0]); // 11, 22, 33…: the angels concur
};

// which fraction of the lunation we are currently living through (0 = new moon)
const lunarPhase = (ms: number): number => {
	const days = (ms - LUNAR_EPOCH_MS) / 86400000;
	return ((days % LUNAR_SYNODIC) + LUNAR_SYNODIC) % LUNAR_SYNODIC / LUNAR_SYNODIC;
};

// 1–9 archetypes, each with a planet, a glyph and an aura hue. Bonus balls also
// pass through here; the cosmos does not distinguish "main" from "bonus".
interface Vibe {
	glyph: string;
	name: string;
	hue: number;
}
const VIBES: Record<number, Vibe> = {
	1: { glyph: '☉', name: 'the Monad', hue: 46 }, // Sun — sovereign, singular
	2: { glyph: '☽', name: 'the Dyad', hue: 210 }, // Moon — reflective, paired
	3: { glyph: '♃', name: 'the Triad', hue: 276 }, // Jupiter — expansive
	4: { glyph: '♅', name: 'the Tetrad', hue: 188 }, // Uranus — foundational
	5: { glyph: '☿', name: 'the Pentad', hue: 138 }, // Mercury — mercurial (obviously)
	6: { glyph: '♀', name: 'the Hexad', hue: 330 }, // Venus — harmonious
	7: { glyph: '♆', name: 'the Heptad', hue: 250 }, // Neptune — the people's number
	8: { glyph: '♄', name: 'the Ogdoad', hue: 30 }, // Saturn — the returns
	9: { glyph: '♂', name: 'the Ennead', hue: 2 } // Mars — the completion
};

interface Numerology {
	root: number;
	vibe: Vibe;
	resonance: number; // 40–99% because nobody wants to be told they're a 12%
	tags: string[];
}

/* The luck-field resonance of a number. A logistic squash of golden-angle
   harmonics, current lunar alignment, a Schumann beat, and every superstition
   we could bolt on. Deterministic, meaningless, and flattering by construction. */
function luckResonance(n: number, phase: number): number {
	const root = digitalRoot(n);
	const golden = Math.abs(Math.sin((n * GOLDEN_ANGLE * Math.PI) / 180)); // 0..1
	const lunar = 0.5 + 0.5 * Math.cos(phase * TAU - n / PHI); // 0..1: are the moon and n friends today?
	const schumann = 0.5 + 0.5 * Math.sin(n * SCHUMANN_HZ); // 0..1: does n hum with the planet?
	let score = 0.34 * golden + 0.34 * lunar + 0.18 * schumann;
	if (isPrime(n)) score += 0.09; // indivisible fortune
	if (isFib(n)) score += 0.07; // spiral-aligned
	if (root === 7) score += 0.08; // the people's number
	if (root === 3 || root === 6 || root === 9) score += 0.05; // Tesla's key vibration
	if (isAngel(n)) score += 0.06; // the angels concur
	const squashed = 1 / (1 + Math.exp(-6 * (score - 0.55))); // logistic, so it always reads plausible
	return Math.round(40 + squashed * 59); // 40..99%
}

function numerology(n: number, phase: number): Numerology {
	const root = digitalRoot(n);
	const tags: string[] = [];
	if (isPrime(n)) tags.push('prime');
	if (isFib(n)) tags.push('Fibonacci');
	if (isAngel(n)) tags.push('angel');
	if (root === 3 || root === 6 || root === 9) tags.push('Tesla 3·6·9');
	return { root, vibe: VIBES[root], resonance: luckResonance(n, phase), tags };
}

const FIELD_QUIPS: [number, string][] = [
	[62, 'the field is merely lukewarm today'],
	[74, 'the owls are paying close attention'],
	[86, 'Pure Universal Vibration™ very nearly achieved'],
	[Infinity, 'the cosmos is, frankly, showing off']
];
const fieldQuip = (avg: number): string => FIELD_QUIPS.find(([t]) => avg < t)![1];

/* ======================================================================
   COLOUR + 3D ORB RENDERING
   Each ball is a canvas-rendered sphere: a fixed light, a rotating procedural
   surface (starfield + meridian sigils whose count equals the number's digital
   root), a specular glint and a fresnel rim. It genuinely tumbles.
   ====================================================================== */

const fract = (x: number): number => x - Math.floor(x);
const clamp255 = (x: number): number => (x < 0 ? 0 : x > 255 ? 255 : x);

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	h = ((h % 360) + 360) % 360 / 360;
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const hue = (t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	return [Math.round(hue(h + 1 / 3) * 255), Math.round(hue(h) * 255), Math.round(hue(h - 1 / 3) * 255)];
}

// Precomputed sphere geometry (light-dependent bits are fixed, so they only get
// computed once per size and reused by every orb). Only the surface texture
// re-samples per frame as the sphere rotates.
interface Sphere {
	S: number;
	mask: Uint8Array;
	shade: Float32Array; // ambient + lambert, baked
	spec: Float32Array; // specular highlight, baked
	u0: Float32Array; // base longitude per pixel
	gv: Int16Array; // latitude star-grid row per pixel
	lat: Float32Array; // latitude banding term
	rim: Float32Array; // fresnel edge glow
}
let GEOM: Sphere | null = null;
function sphereGeom(S: number): Sphere {
	if (GEOM && GEOM.S === S) return GEOM;
	const mask = new Uint8Array(S * S);
	const shade = new Float32Array(S * S);
	const spec = new Float32Array(S * S);
	const u0 = new Float32Array(S * S);
	const gv = new Int16Array(S * S);
	const lat = new Float32Array(S * S);
	const rim = new Float32Array(S * S);
	// light comes from the upper-left, slightly toward the viewer
	const Lx = -0.42, Ly = -0.55, Lz = 0.72;
	const Ll = Math.hypot(Lx, Ly, Lz);
	const lx = Lx / Ll, ly = Ly / Ll, lz = Lz / Ll;
	const c = (S - 1) / 2;
	const rad = S / 2 - 1;
	for (let y = 0; y < S; y++) {
		for (let x = 0; x < S; x++) {
			const i = y * S + x;
			const dx = (x - c) / rad;
			const dy = (y - c) / rad;
			const r2 = dx * dx + dy * dy;
			if (r2 > 1) continue;
			mask[i] = 1;
			const nz = Math.sqrt(1 - r2);
			const nDotL = Math.max(0, dx * lx + dy * ly + nz * lz);
			shade[i] = Math.min(1.25, 0.3 + 0.95 * nDotL);
			// specular via reflection·view (view = +Z)
			const rz = 2 * nDotL * nz - lz;
			spec[i] = Math.pow(Math.max(0, rz), 28) * 0.9;
			u0[i] = fract(Math.atan2(dx, nz) / TAU + 0.5);
			const v = Math.acos(Math.max(-1, Math.min(1, dy))) / Math.PI;
			gv[i] = (v * 24) | 0;
			lat[i] = 0.5 + 0.5 * Math.sin(v * Math.PI * 6);
			rim[i] = Math.pow(r2, 3); // 1 at the very edge, ~0 in the middle
		}
	}
	GEOM = { S, mask, shade, spec, u0, gv, lat, rim };
	return GEOM;
}

interface Palette {
	dr: number; dg: number; db: number; // aura, in shadow
	br: number; bg: number; bb: number; // aura, lit
}
function paletteFor(hue: number): Palette {
	const [dr, dg, db] = hslToRgb(hue, 0.72, 0.2);
	const [br, bg, bb] = hslToRgb(hue, 0.86, 0.64);
	return { dr, dg, db, br, bg, bb };
}

interface Orb {
	root: number;
	hue: number;
	isBonus: boolean;
	pal: Palette;
	speed: number; // rad/s tumble
	phase: number; // rotation offset
	canvas?: HTMLCanvasElement;
	ctx?: CanvasRenderingContext2D;
	img?: ImageData;
	cx: number; // centre in luck-field pixels (for ripples)
	cy: number;
	resonance: number;
	nextPulse: number; // ms of loop-time until this orb next disturbs the field
}

// Paint one frame of a tumbling orb. rot advances the surface longitude.
function drawOrb(orb: Orb, geom: Sphere, rot: number): void {
	const { ctx, img } = orb;
	if (!ctx || !img) return;
	const { S, mask, shade, spec, u0, gv, lat, rim } = geom;
	const { dr, dg, db, br, bg, bb } = orb.pal;
	const data = img.data;
	const root = orb.root;
	for (let i = 0; i < S * S; i++) {
		const p = i * 4;
		if (!mask[i]) {
			data[p + 3] = 0;
			continue;
		}
		let u = u0[i] + rot;
		u -= Math.floor(u);
		// rotating starfield: hash a longitude/latitude grid cell
		const gu = (u * 48) | 0;
		const hh = fract(Math.sin(gu * 127.1 + gv[i] * 311.7) * 43758.5453);
		// meridian sigils: exactly `root` glowing spokes engraved around the sphere
		const spokes = 0.5 + 0.5 * Math.cos(u * TAU * root);
		let b = 0.15 + 0.13 * spokes + 0.2 * lat[i];
		let sparkle = 0;
		if (hh > 0.93) {
			b = Math.max(b, 0.86);
			if (hh > 0.985) sparkle = 255; // the occasional hard twinkle
		}
		const sh = shade[i];
		const rm = rim[i] * 0.55; // fresnel: the limb catches the aura
		let r = (dr + (br - dr) * b) * sh + (br - dr) * rm;
		let g = (dg + (bg - dg) * b) * sh + (bg - dg) * rm;
		let bl = (db + (bb - db) * b) * sh + (bb - db) * rm;
		const sp = spec[i] * 235 + sparkle;
		data[p] = clamp255(r + sp);
		data[p + 1] = clamp255(g + sp);
		data[p + 2] = clamp255(bl + sp);
		data[p + 3] = 255;
	}
	ctx.putImageData(img, 0, 0);
	if (orb.isBonus) {
		// bonus balls wear a golden meridian ring so they still read as special
		ctx.save();
		ctx.strokeStyle = 'rgba(240,212,136,0.9)';
		ctx.lineWidth = S * 0.045;
		ctx.beginPath();
		ctx.arc(S / 2, S / 2, S * 0.45, 0, TAU);
		ctx.stroke();
		ctx.restore();
	}
}

/* ======================================================================
   INJECTED STYLE — all the orb / field / dossier CSS lives here so the weird
   half of the feature is self-contained in one file.
   ====================================================================== */

const STYLE_ID = 'lng-injected-style';
function ensureStyle(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
/* the luck field is a canvas that fills the WHOLE section, behind the content,
   so ripples spread across the entire panel. (Named -luckfield, not -field, so
   it never collides with the custom-settings .lng-field slider rows.) */
#luck-numbers { position: relative; }
#luck-numbers > *:not(canvas) { position: relative; z-index: 1; }
.lng-luckfield { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
.lng-result { position: relative; margin-top: 16px; min-height: 96px; }
.lng-ball-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; position: relative; z-index: 1; }
.lng-ball-cell { display: flex; flex-direction: column; align-items: center; gap: 6px; }
.lng-ball {
	position: relative; width: 62px; height: 62px;
	filter: drop-shadow(0 6px 10px rgba(0,0,0,0.55));
	animation: lng-pop 0.5s cubic-bezier(0.2,1.4,0.5,1) backwards;
	animation-delay: var(--delay, 0ms);
}
.lng-ball canvas { width: 100%; height: 100%; display: block; border-radius: 50%; }
.lng-num {
	position: absolute; inset: 0; display: grid; place-items: center;
	font-weight: 700; font-size: 22px; color: #fff; font-variant-numeric: tabular-nums;
	text-shadow: 0 1px 2px rgba(0,0,0,0.9), 0 0 7px rgba(0,0,0,0.65); pointer-events: none;
}
.lng-dossier { font-size: 11px; line-height: 1.3; text-align: center; color: var(--text-dim); max-width: 78px; }
.lng-dossier b { color: hsl(var(--bh, 45) 72% 68%); font-size: 12px; }
@keyframes lng-pop { 0% { transform: scale(0) rotate(-30deg); } 70% { transform: scale(1.12); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .lng-ball { animation: none; } }
`;
	document.head.appendChild(style);
}

/* ======================================================================
   THE FEATURE
   ====================================================================== */

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Wire up the Luck Number Generator. No-ops if its markup isn't present. */
export function initLottoPicker(): void {
	const root = document.getElementById('luck-numbers');
	const gameSelect = document.getElementById('lng-game') as HTMLSelectElement | null;
	const customBox = document.getElementById('lng-custom') as HTMLFieldSetElement | null;
	const chanceOut = document.getElementById('lng-chance');
	const spinBtn = document.getElementById('lng-spin') as HTMLButtonElement | null;
	const statusEl = document.getElementById('lng-status');
	const resultEl = document.getElementById('lng-result');
	if (!root || !gameSelect || !customBox || !chanceOut || !spinBtn || !statusEl || !resultEl) return;

	ensureStyle();

	const LOCAL_KEY = 'lotto-prefs';
	const ID_MAP: Record<string, keyof GameConfig> = {
		'lng-numberRange': 'range',
		'lng-numberCount': 'count',
		'lng-bonusRange': 'bonusRange',
		'lng-bonusCount': 'bonusCount'
	};

	let currentGameKey = 'euromillions';
	let customConfig: Partial<GameConfig> = {};
	try {
		const saved = JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') as {
			gameKey?: string;
			custom?: Partial<GameConfig>;
		};
		if (saved.gameKey && (saved.gameKey === 'custom' || GAMES[saved.gameKey])) currentGameKey = saved.gameKey;
		if (saved.custom) customConfig = saved.custom;
	} catch { /* corrupt prefs — start fresh */ }

	const rangeEls = Object.keys(ID_MAP).map((id) => ({
		key: ID_MAP[id],
		slider: document.getElementById(id) as HTMLInputElement | null,
		out: document.getElementById(`${id}Out`) as HTMLOutputElement | null
	}));

	// build the game menu
	for (const [key, game] of Object.entries(GAMES)) {
		gameSelect.insertAdjacentHTML('beforeend', `<option value="${key}">${game.name}</option>`);
	}
	gameSelect.insertAdjacentHTML('beforeend', '<option value="custom">Custom (your rules)</option>');
	gameSelect.value = currentGameKey;

	const savePrefs = () =>
		localStorage.setItem(LOCAL_KEY, JSON.stringify({ gameKey: currentGameKey, custom: customConfig }));

	// clamp so odd custom settings (count > range) never throw
	const getActiveConfig = (): GameConfig => {
		const c = currentGameKey === 'custom' ? { ...DEFAULT_CUSTOM, ...customConfig } : GAMES[currentGameKey].config;
		const range = Math.max(1, c.range);
		const bonusRange = Math.max(0, c.bonusRange);
		return {
			range,
			count: Math.min(Math.max(1, c.count), range),
			bonusRange,
			bonusCount: Math.min(Math.max(0, c.bonusCount), bonusRange)
		};
	};

	const showOdds = () => (chanceOut.textContent = oddsString(getActiveConfig()));
	const applyHue = () => {
		const hue = currentGameKey === 'custom' ? 45 : GAMES[currentGameKey].themeHue;
		root.style.setProperty('--accent-h', String(hue));
	};

	const loadCustomIntoRanges = () => {
		const cfg = { ...DEFAULT_CUSTOM, ...customConfig };
		for (const { key, slider, out } of rangeEls) {
			if (!slider || !out) continue;
			slider.value = out.value = String(cfg[key]);
		}
	};

	// slider ↔ output binding
	for (const { key, slider, out } of rangeEls) {
		if (!slider || !out) continue;
		const sync = (v: number) => {
			slider.value = out.value = String(v);
			customConfig = { ...customConfig, [key]: v };
			savePrefs();
			showOdds();
		};
		slider.addEventListener('input', () => sync(+slider.value));
		out.addEventListener('change', () => {
			const v = Math.max(+slider.min, Math.min(+slider.max, +out.value || 0));
			sync(v);
		});
	}

	/* ---- the luck field: a canvas of ripples behind the orbs ---- */
	const DPR = Math.min(2, window.devicePixelRatio || 1);
	const hasRAF = typeof requestAnimationFrame === 'function';
	const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	interface Ripple {
		x: number; y: number; hue: number; born: number; speed: number; max: number; width: number;
	}
	let orbs: Orb[] = [];
	let ripples: Ripple[] = [];
	let fieldCanvas: HTMLCanvasElement | null = null;
	let fieldCtx: CanvasRenderingContext2D | null = null;
	let rafId = 0;
	let startPerf = 0;
	let looping = false;

	function ensureField(): void {
		if (!fieldCanvas) {
			fieldCanvas = document.createElement('canvas');
			fieldCanvas.className = 'lng-luckfield';
			root!.appendChild(fieldCanvas); // covers the whole section, behind the content
			fieldCtx = fieldCanvas.getContext('2d');
		}
		const w = root!.clientWidth || 1;
		const h = root!.clientHeight || 96;
		fieldCanvas.width = Math.round(w * DPR);
		fieldCanvas.height = Math.round(h * DPR);
	}

	function drawField(tMs: number): void {
		if (!fieldCtx || !fieldCanvas) return;
		const w = fieldCanvas.width;
		const h = fieldCanvas.height;
		fieldCtx.clearRect(0, 0, w, h);
		// a faint triangular lattice — the "luck field" the ripples travel through
		fieldCtx.fillStyle = 'rgba(240,212,136,0.05)';
		const step = 26 * DPR;
		for (let y = 0, r = 0; y < h; y += step, r++) {
			for (let x = (r % 2 ? step / 2 : 0); x < w; x += step) {
				fieldCtx.fillRect(x, y, DPR, DPR);
			}
		}
		// living ripples
		for (let k = ripples.length - 1; k >= 0; k--) {
			const rp = ripples[k];
			const rr = ((tMs - rp.born) / 1000) * rp.speed;
			const a = 1 - rr / rp.max;
			if (a <= 0) {
				ripples.splice(k, 1);
				continue;
			}
			fieldCtx.strokeStyle = `hsla(${rp.hue}, 80%, 62%, ${a * 0.55})`;
			fieldCtx.lineWidth = rp.width;
			fieldCtx.beginPath();
			fieldCtx.arc(rp.x, rp.y, rr, 0, TAU);
			fieldCtx.stroke();
		}
		if (ripples.length > 80) ripples.splice(0, ripples.length - 80);
	}

	function frame(now: number): void {
		const t = (now - startPerf) / 1000;
		if (!document.hidden) {
			const geom = orbs[0]?.canvas ? sphereGeom(orbs[0].canvas.width) : null;
			if (geom) for (const orb of orbs) drawOrb(orb, geom, t * orb.speed + orb.phase);
			// ripples reach the far corners of the whole panel
			const diag = Math.hypot(root!.clientWidth || 300, root!.clientHeight || 300) * DPR;
			for (const orb of orbs) {
				if (now - startPerf >= orb.nextPulse) {
					ripples.push({
						x: orb.cx,
						y: orb.cy,
						hue: orb.hue,
						born: now,
						speed: (110 + orb.resonance) * DPR,
						max: diag,
						width: (1 + orb.resonance / 40) * DPR
					});
					// higher-resonance numbers disturb the field more often
					orb.nextPulse += 2400 - orb.resonance * 14;
				}
			}
			drawField(now);
		}
		rafId = requestAnimationFrame(frame);
	}
	function stopLoop(): void {
		if (rafId) cancelAnimationFrame(rafId);
		rafId = 0;
		looping = false;
	}
	function startLoop(): void {
		if (looping || !hasRAF) return;
		looping = true;
		startPerf = performance.now();
		rafId = requestAnimationFrame(frame);
	}

	/* ---- render the drawn numbers as 3D orbs with numerological dossiers ---- */
	function renderBalls(main: number[], bonus: number[]): void {
		stopLoop();
		orbs = [];
		ripples = [];
		resultEl!.innerHTML = ''; // clears the ball row; the luck field lives on the section

		const row = document.createElement('div');
		row.className = 'lng-ball-row';
		resultEl!.appendChild(row);

		const S = Math.round(62 * DPR);
		const phase = lunarPhase(Date.now());
		const all = [...main, ...bonus];

		all.forEach((n, i) => {
			const isBonus = i >= main.length;
			const num = numerology(n, phase);

			const cell = document.createElement('div');
			cell.className = 'lng-ball-cell';
			cell.style.setProperty('--bh', String(num.vibe.hue));

			const ball = document.createElement('div');
			ball.className = 'lng-ball';
			ball.style.setProperty('--delay', `${i * 70}ms`);

			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = S;
			const ctx = canvas.getContext('2d');
			ball.appendChild(canvas);

			const numEl = document.createElement('span');
			numEl.className = 'lng-num';
			numEl.textContent = String(n);
			ball.appendChild(numEl);
			cell.appendChild(ball);

			const dossier = document.createElement('div');
			dossier.className = 'lng-dossier';
			dossier.innerHTML = `${num.vibe.glyph} <b>${num.resonance}%</b>`;
			dossier.title = `${num.vibe.name} · digital root ${num.root}${num.tags.length ? ' · ' + num.tags.join(', ') : ''}`;
			cell.appendChild(dossier);

			row.appendChild(cell);

			orbs.push({
				root: num.root,
				hue: num.vibe.hue,
				isBonus,
				pal: paletteFor(num.vibe.hue),
				speed: 0.28 + (n % 7) * 0.05, // each orb tumbles at its own pace
				phase: (n * GOLDEN_ANGLE * Math.PI) / 180, // seeded by its golden-angle position
				canvas: ctx ? canvas : undefined,
				ctx: ctx ?? undefined,
				img: ctx ? ctx.createImageData(S, S) : undefined,
				cx: 0,
				cy: 0,
				resonance: num.resonance,
				nextPulse: 300 + i * 140
			});
		});

		// measure each orb's centre in luck-field pixels (relative to the section)
		ensureField();
		const box = root!.getBoundingClientRect();
		orbs.forEach((orb) => {
			if (!orb.canvas) return;
			const r = orb.canvas.getBoundingClientRect();
			orb.cx = (r.left - box.left + r.width / 2) * DPR;
			orb.cy = (r.top - box.top + r.height / 2) * DPR;
		});

		if (reduceMotion) {
			// one static, upright frame — no tumble, no ripples
			const geom = orbs[0]?.canvas ? sphereGeom(orbs[0].canvas.width) : null;
			if (geom) for (const orb of orbs) drawOrb(orb, geom, orb.phase);
		} else {
			startLoop();
		}

		return;
	}

	gameSelect.addEventListener('change', () => {
		currentGameKey = gameSelect.value;
		const isCustom = currentGameKey === 'custom';
		customBox.hidden = !isCustom;
		if (isCustom) loadCustomIntoRanges();
		applyHue();
		showOdds();
		stopLoop();
		orbs = [];
		ripples = [];
		if (fieldCanvas) fieldCanvas.remove();
		fieldCanvas = null;
		fieldCtx = null;
		resultEl.innerHTML = '';
		statusEl.textContent = '';
		savePrefs();
	});

	let spinning = false;
	async function spin(): Promise<void> {
		if (spinning) return;
		spinning = true;
		spinBtn!.disabled = true;

		// cosmic theatre while the real entropy harvest runs
		for (const line of INCANTATIONS) {
			statusEl!.textContent = line;
			await wait(140);
		}
		const seed = await cosmicSeed();
		const cosmos = summonCosmos();
		const foamSeed = (seed ^ Math.floor(cosmos() * 0x1_0000_0000)) >>> 0; // fold foam into the seed
		const rng = mulberry32(foamSeed);

		const cfg = getActiveConfig();
		const main = pickUnique(cfg.range, cfg.count, rng);
		const bonus = cfg.bonusCount ? pickUnique(cfg.bonusRange, cfg.bonusCount, rng) : [];

		renderBalls(main, bonus);
		track('luck_numbers_spun', { game: currentGameKey, count: cfg.count });

		// average resonance drives the field readout
		const phase = lunarPhase(Date.now());
		const avg = Math.round(
			[...main, ...bonus].reduce((s, n) => s + luckResonance(n, phase), 0) / (main.length + bonus.length)
		);
		await wait(main.length * 70 + 400);
		statusEl!.textContent = `Luck-field resonance ${avg}% — ${fieldQuip(avg)}. 🍀`;
		spinBtn!.disabled = false;
		spinning = false;
	}
	spinBtn.addEventListener('click', () => void spin());
	addEventListener('resize', () => {
		if (orbs.length) ensureField();
	});

	// first run
	customBox.hidden = currentGameKey !== 'custom';
	if (currentGameKey === 'custom') loadCustomIntoRanges();
	applyHue();
	showOdds();
}
