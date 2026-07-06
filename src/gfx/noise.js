// Small value-noise + FBM used by the procedural texture painters.

function hash(x, y, seed = 0) {
	let h = (x * 374761393 + y * 668265263 + seed * 144665) | 0;
	h = (h ^ (h >>> 13)) | 0;
	h = Math.imul(h, 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed = 0) {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const a = hash(xi, yi, seed);
	const b = hash(xi + 1, yi, seed);
	const c = hash(xi, yi + 1, seed);
	const d = hash(xi + 1, yi + 1, seed);
	const u = smooth(xf);
	const v = smooth(yf);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, octaves = 4, seed = 0) {
	let value = 0;
	let amp = 0.5;
	let freq = 1;
	for (let i = 0; i < octaves; i++) {
		value += amp * valueNoise(x * freq, y * freq, seed + i * 31);
		amp *= 0.5;
		freq *= 2;
	}
	return value;
}

/** Value noise on a lattice that wraps at integer period `p` — truly seamless. */
function valueNoisePeriodic(x, y, p, seed = 0) {
	const xi = Math.floor(x);
	const yi = Math.floor(y);
	const xf = x - xi;
	const yf = y - yi;
	const wrap = (n) => ((n % p) + p) % p;
	const a = hash(wrap(xi), wrap(yi), seed);
	const b = hash(wrap(xi + 1), wrap(yi), seed);
	const c = hash(wrap(xi), wrap(yi + 1), seed);
	const d = hash(wrap(xi + 1), wrap(yi + 1), seed);
	const u = smooth(xf);
	const v = smooth(yf);
	return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Tiling FBM — wraps seamlessly at period `p` (in noise-space units). */
export function fbmTile(x, y, p, octaves = 4, seed = 0) {
	let value = 0;
	let amp = 0.5;
	let freq = 1;
	for (let i = 0; i < octaves; i++) {
		value += amp * valueNoisePeriodic(x * freq, y * freq, p * freq, seed + i * 31);
		amp *= 0.5;
		freq *= 2;
	}
	return value;
}
