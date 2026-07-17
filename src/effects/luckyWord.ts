// Shared set-piece: scattered motes from all over the screen drift together to
// spell a word (or one giant glyph) across the middle of the screen, a smoked-
// glass strip fading in behind it for contrast, then everything bursts apart.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import type { EffectContext } from '../types';

function textPoints(text: string): [number, number][] {
	const cv = document.createElement('canvas');
	cv.width = 512;
	cv.height = 160;
	const c = cv.getContext('2d')!;
	c.fillStyle = '#fff';
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	const family = "'Roboto Slab', Georgia, serif";
	let size = text.length <= 2 ? 148 : 108;
	c.font = `bold ${size}px ${family}`;
	const w = c.measureText(text).width;
	if (w > 470) {
		size = Math.floor((size * 470) / w); // long phrases shrink to fit
		c.font = `bold ${size}px ${family}`;
	}
	c.fillText(text, 256, 84);
	const img = c.getImageData(0, 0, 512, 160).data;
	const pts: [number, number][] = [];
	for (let y = 0; y < 160; y += 2) {
		for (let x = 0; x < 512; x += 2) {
			if (img[(y * 512 + x) * 4 + 3] > 120) pts.push([x, y]);
		}
	}
	return pts;
}

// smoked-glass backdrop: black rounded strip with feathered edges
let stripTexCache: THREE.CanvasTexture | null = null;
export function stripTexture(): THREE.CanvasTexture {
	if (stripTexCache) return stripTexCache;
	const cv = document.createElement('canvas');
	cv.width = 512;
	cv.height = 128;
	const c = cv.getContext('2d')!;
	c.filter = 'blur(7px)';
	c.fillStyle = '#000';
	c.beginPath();
	c.roundRect(24, 22, 464, 84, 34);
	c.fill();
	c.fill();
	c.fill(); // stacked fills = dense core, feathered edge — no border, pure smoke
	stripTexCache = new THREE.CanvasTexture(cv);
	return stripTexCache;
}

export interface LuckyWordOptions {
	text?: string;
	color?: THREE.ColorRepresentation;
	colorB?: THREE.ColorRepresentation;
	gather?: number;
	hold?: number;
	scatter?: number;
	width?: number;
	y?: number;
	z?: number;
	strip?: boolean;
}

export async function luckyWord(ctx: EffectContext, opts: LuckyWordOptions = {}): Promise<void> {
	const {
		text = 'LUCKY',
		color = 0xffd27a,
		colorB = 0xfff3cf,
		gather = 1500,
		hold = 1500,
		scatter = 900,
		width = 3.1,
		y: yPos = -0.1, // straight across the middle, over the button
		z = 1.25,
		strip: wantStrip = true
	} = opts;
	const { scene, sprites, haptics, audio } = ctx;

	let pts = textPoints(text);
	while (pts.length > 2000) pts = pts.filter((_, i) => i % 2 === 0);
	const n = pts.length;
	// never wider than the visible frame (phones are narrow)
	const cam = scene.camera;
	const visW = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * (5.35 - z) * cam.aspect * 2;
	const scale = Math.min(width, visW * 0.92) / 512;

	const positions = new Float32Array(n * 3);
	const colors = new Float32Array(n * 3);
	const sizes = new Float32Array(n);
	const angles = new Float32Array(n);
	const start = new Float32Array(n * 3);
	const target = new Float32Array(n * 3);
	const stagger = new Float32Array(n);
	const cA = new THREE.Color(color);
	const cB = new THREE.Color(colorB);
	for (let i = 0; i < n; i++) {
		const [px, py] = pts[i];
		target[i * 3] = (px - 256) * scale;
		target[i * 3 + 1] = yPos + (80 - py) * scale;
		target[i * 3 + 2] = z + rand(-0.03, 0.03);
		start[i * 3] = rand(-2.6, 2.6);
		start[i * 3 + 1] = rand(-1.7, 1.6);
		start[i * 3 + 2] = z + rand(-0.5, 0.5);
		stagger[i] = rand(0, 0.35);
		// a loose scattering of sizes and spins so the stars read hand-strewn
		sizes[i] = 0.05 + Math.pow(Math.random(), 1.8) * 0.065;
		angles[i] = rand(0, Math.PI * 2);
		const c = Math.random() < 0.5 ? cA : cB;
		colors[i * 3] = c.r;
		colors[i * 3 + 1] = c.g;
		colors[i * 3 + 2] = c.b;
		positions[i * 3] = start[i * 3];
		positions[i * 3 + 1] = start[i * 3 + 1];
		positions[i * 3 + 2] = start[i * 3 + 2];
	}
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
	geo.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1));
	// PointsMaterial draws every star at one size, bolt upright — a custom
	// shader lets each mote keep its own size and rotation
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uMap: { value: sprites.star4 },
			uOpacity: { value: 0 },
			uScale: { value: scene.renderer.domElement.height * 0.5 }
		},
		vertexShader: /* glsl */ `
			attribute float aSize;
			attribute float aAngle;
			varying vec3 vColor;
			varying float vAngle;
			uniform float uScale;
			void main() {
				vColor = color;
				vAngle = aAngle;
				vec4 mv = modelViewMatrix * vec4(position, 1.0);
				gl_PointSize = aSize * uScale / -mv.z;
				gl_Position = projectionMatrix * mv;
			}
		`,
		fragmentShader: /* glsl */ `
			uniform sampler2D uMap;
			uniform float uOpacity;
			varying vec3 vColor;
			varying float vAngle;
			void main() {
				vec2 p = gl_PointCoord - 0.5;
				float s = sin(vAngle);
				float c = cos(vAngle);
				vec4 tex = texture2D(uMap, vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5);
				gl_FragColor = vec4(vColor * tex.rgb, tex.a * uOpacity);
			}
		`,
		vertexColors: true,
		transparent: true,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		depthTest: false
	});
	const points = new THREE.Points(geo, mat);
	points.renderOrder = 9; // the word floats over everything
	scene.scene.add(points);

	// the backdrop strip: starts big and invisible, shrinks + fades in as the
	// letters land, and leaves the same way
	const stripGeo = new THREE.PlaneGeometry(512 * scale * 1.06, Math.max(0.74, 160 * scale * 0.96));
	const stripMat = new THREE.MeshBasicMaterial({
		map: stripTexture(),
		transparent: true,
		opacity: 0,
		depthTest: false,
		depthWrite: false
	});
	const strip = new THREE.Mesh(stripGeo, stripMat);
	strip.renderOrder = 8; // just under the motes
	strip.position.set(0, yPos, z - 0.03);
	strip.visible = wantStrip;
	scene.scene.add(strip);

	// gather: every mote drifts from its scatter position to its letter pixel
	const ease = (t: number) => 1 - Math.pow(1 - t, 3);
	let P = 0;
	let shimmerT = 0;
	const stopGather = scene.addUpdatable((dt) => {
		shimmerT += dt;
		for (let i = 0; i < n; i++) {
			const p = ease(Math.min(1, Math.max(0, (P - stagger[i]) / 0.65)));
			const j = Math.sin(shimmerT * 7 + i * 1.7) * 0.012 * (p >= 1 ? 1 : 0.4);
			positions[i * 3] = start[i * 3] + (target[i * 3] - start[i * 3]) * p + j;
			positions[i * 3 + 1] = start[i * 3 + 1] + (target[i * 3 + 1] - start[i * 3 + 1]) * p + j * 0.7;
			positions[i * 3 + 2] = start[i * 3 + 2] + (target[i * 3 + 2] - start[i * 3 + 2]) * p;
		}
		geo.attributes.position.needsUpdate = true;
		// strip slips in only just before the words become readable
		const s = ease(Math.min(1, Math.max(0, (P - 0.72) / 0.28)));
		stripMat.opacity = 0.9 * s;
		strip.scale.setScalar(1.35 - 0.35 * s);
	});

	tween(500, 'outQuad', (v) => (mat.uniforms.uOpacity.value = v));
	await tween(gather, 'linear', (v) => (P = v));
	audio.sfx('chime', { pitch: 1.1 });
	haptics.vibrate([15, 25, 40]);
	await delay(hold);

	// dissipate: the word blows apart from its own centre, the strip grows away
	stopGather();
	const vel = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		vel[i * 3] = target[i * 3] * rand(0.7, 1.4) + rand(-0.5, 0.5);
		vel[i * 3 + 1] = (target[i * 3 + 1] - yPos) * rand(0.7, 1.4) + rand(0.3, 1.1);
		vel[i * 3 + 2] = rand(-0.3, 0.6);
	}
	const stopScatter = scene.addUpdatable((dt) => {
		for (let i = 0; i < n; i++) {
			positions[i * 3] += vel[i * 3] * dt;
			positions[i * 3 + 1] += (vel[i * 3 + 1] -= 2.2 * dt) * dt;
			positions[i * 3 + 2] += vel[i * 3 + 2] * dt;
		}
		geo.attributes.position.needsUpdate = true;
	});
	await tween(scatter, 'inQuad', (v) => {
		mat.uniforms.uOpacity.value = 1 - v;
		// the strip is gone almost immediately — visible only while the text is
		const sOut = Math.min(1, v / 0.4);
		stripMat.opacity = 0.9 * (1 - sOut);
		strip.scale.setScalar(1 + 0.35 * sOut);
	});
	stopScatter();
	scene.scene.remove(points, strip);
	geo.dispose();
	mat.dispose();
	stripGeo.dispose();
	stripMat.dispose(); // texture is cached module-wide, keep it
}
