// The Luck Machine — procedural 3D recreation of the classic V2 contraption.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tween, rand } from '../core/anim';
import type { TextureBundle } from '../types';
import type { SpriteSet } from '../gfx/textures';

const QUADRANT_ANGLES = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

// fitAspect(): at or below PORTRAIT_ASPECT (a phone held upright) the button
// is PORTRAIT_BUTTON_SCALE× larger; from LANDSCAPE_ASPECT up (the aspect where
// the camera stops fitting to width) it is untouched, with a smooth ramp between
const PORTRAIT_ASPECT = 0.6;
const LANDSCAPE_ASPECT = 0.78;
const PORTRAIT_BUTTON_SCALE = 1.14;
const INNER_GLOW_SCALE = 1.45;
// The face's blue band runs from FACE_INNER to the rail at FACE_SEAM (radius
// fractions). On portrait its inner edge draws back to FACE_INNER_PORTRAIT so
// the bigger button still leaves a sliver of the gear train showing; the
// painted band is squeezed to fit (after cropping its innermost pinstripe,
// FACE_PAINT_PORTRAIT, so the triquetras and studs squash less).
const FACE_INNER = 0.555;
const FACE_SEAM = 0.785;
const FACE_INNER_PORTRAIT = 0.615;
const FACE_PAINT_PORTRAIT = 0.57;
const MACHINE_Y = -0.32; // the machine sits a little below the camera's aim
const BUTTON_RADIUS = 0.625; // the gold base, the button's widest point

/* ---------- gears that actually mesh ----------
   Real gearing rules, simplified: gears can only mesh if they share a tooth
   `module` (m). Pitch radius = m·T/2, centre distance = sum of pitch radii,
   and the partner turns at -w·T₁/T₂. Get those right and the teeth interlock
   like a watch; get them wrong and it's the old flat cog soup. */

interface GearOpts {
	module: number;
	teeth: number;
	depth: number;
	hubRadius?: number;
	web?: 'solid' | 'pierced' | 'spoked';
}

function gearGeometry({ module: m, teeth, depth, hubRadius, web = 'solid' }: GearOpts): THREE.ExtrudeGeometry {
	const rPitch = (m * teeth) / 2;
	const rTip = rPitch + m * 0.72;
	const rRoot = rPitch - m * 0.95;
	const rHub = hubRadius ?? Math.max(rRoot * 0.18, 0.014);
	const pitch = (Math.PI * 2) / teeth;
	const wRoot = pitch * 0.26; // tooth half-width at root — gaps stay generous
	const wTip = pitch * 0.15; // …narrowing to the tip, so partners slot in

	const s = new THREE.Shape();
	for (let i = 0; i < teeth; i++) {
		const a = i * pitch;
		s.absarc(0, 0, rRoot, a - pitch / 2, a - wRoot, false);
		s.lineTo(Math.cos(a - wTip) * rTip, Math.sin(a - wTip) * rTip);
		s.absarc(0, 0, rTip, a - wTip, a + wTip, false);
		s.lineTo(Math.cos(a + wRoot) * rRoot, Math.sin(a + wRoot) * rRoot);
	}
	s.closePath();

	const bore = new THREE.Path();
	bore.absarc(0, 0, rHub, 0, Math.PI * 2, true);
	s.holes.push(bore);

	if (web === 'pierced') {
		// a ring of drilled lightening holes, like the reference wheelwork
		const n = Math.max(5, Math.round(teeth / 3));
		const rp = (rRoot + rHub) / 2;
		const hr = Math.min((rRoot - rHub) * 0.3, rp * Math.sin(Math.PI / n) * 0.62);
		for (let i = 0; i < n; i++) {
			const a = (i / n) * Math.PI * 2;
			const hole = new THREE.Path();
			hole.absarc(Math.cos(a) * rp, Math.sin(a) * rp, hr, 0, Math.PI * 2, true);
			s.holes.push(hole);
		}
	} else if (web === 'spoked') {
		// four sector cut-outs leaving a cross of spokes
		const ri = rHub + m * 1.1;
		const ro = rRoot - m * 1.2;
		if (ro > ri) {
			for (let i = 0; i < 4; i++) {
				const a0 = (i / 4) * Math.PI * 2 + 0.3;
				const a1 = a0 + Math.PI / 2 - 0.6;
				const hole = new THREE.Path();
				hole.absarc(0, 0, ri, a0, a1, false);
				hole.lineTo(Math.cos(a1) * ro, Math.sin(a1) * ro);
				hole.absarc(0, 0, ro, a1, a0, true);
				hole.closePath();
				s.holes.push(hole);
			}
		}
	}

	const geo = new THREE.ExtrudeGeometry(s, {
		depth,
		bevelEnabled: true,
		bevelThickness: 0.0035,
		bevelSize: 0.0035,
		bevelSegments: 1,
		curveSegments: 5
	});
	geo.translate(0, 0, -depth / 2);
	return geo;
}

interface MeshedGear {
	x: number;
	y: number;
	rot: number;
	teeth: number;
	speed: number;
}

/** Rotation + speed for a gear meshing with `parent` at centre (cx, cy).
 *  The half-tooth phase offset makes the teeth interlock; the -T₁/T₂ ratio
 *  keeps them interlocked forever. */
function meshWith(parent: MeshedGear, cx: number, cy: number, teeth: number): MeshedGear {
	const phi = Math.atan2(cy - parent.y, cx - parent.x);
	const fracP = ((phi - parent.rot) * parent.teeth) / (2 * Math.PI);
	const rot = phi + Math.PI - ((2 * Math.PI) / teeth) * (0.5 - (fracP - Math.floor(fracP)));
	return { x: cx, y: cy, rot, teeth, speed: (-parent.speed * parent.teeth) / teeth };
}

/** Close a point list into a Shape with rounded corners — the single biggest
 *  antidote to the low-poly look: every silhouette edge becomes a curve that
 *  catches an env-map highlight. */
function roundedShape(pts: THREE.Vector2[], radius: number): THREE.Shape {
	const s = new THREE.Shape();
	const n = pts.length;
	for (let i = 0; i < n; i++) {
		const prev = pts[(i - 1 + n) % n];
		const v = pts[i];
		const next = pts[(i + 1) % n];
		const r = Math.min(radius, v.distanceTo(prev) / 2.6, v.distanceTo(next) / 2.6);
		const pIn = v.clone().add(prev.clone().sub(v).setLength(r));
		const pOut = v.clone().add(next.clone().sub(v).setLength(r));
		if (i === 0) s.moveTo(pIn.x, pIn.y);
		else s.lineTo(pIn.x, pIn.y);
		s.quadraticCurveTo(v.x, v.y, pOut.x, pOut.y);
	}
	s.closePath();
	return s;
}

/** The clamp's three lobes, V2-style: a long gripping lobe aimed at the
 *  button (-y) and two blunt braces swept back at 120°. Each is a tapered
 *  paddle with a flat, chamfered end, so the outline reads as a cut casting. */
const CLAMP_LOBES = [
	{ a: -Math.PI / 2, len: 0.37, wBase: 0.27, wTip: 0.17 },
	{ a: Math.PI / 6, len: 0.245, wBase: 0.25, wTip: 0.18 },
	{ a: (Math.PI * 5) / 6, len: 0.245, wBase: 0.25, wTip: 0.18 }
];

// the frame's chamfer flares this far past the outline at its widest...
const CLAMP_EDGE = 0.016;
// ...and the dark seat behind it a touch less, so the bright edge is the
// clamp's true silhouette (a dark seat past it vanished against the dark
// gear window and read as a gap)
const CLAMP_SEAT_GROW = 0.012;
// how far the gripping lobe reaches from the pivot
const CLAMP_REACH = CLAMP_LOBES[0].len + CLAMP_EDGE;
// daylight left between the gripping tip and the button's rim
const CLAMP_TIP_GAP = 0.002;
// clamp pivots sit this far out, as a fraction of the machine's radius
const CLAMP_PIVOT = 0.825;

/** Outline of the whole casting, grown outward by `grow` (for the dark seat). */
function clampOutline(grow = 0): THREE.Vector2[] {
	const pts: THREE.Vector2[] = [];
	for (const [i, l] of CLAMP_LOBES.entries()) {
		// a concave notch between this lobe and the previous one, so the
		// lobes read as swept out of the hub rather than bolted to it
		const prev = CLAMP_LOBES[(i + CLAMP_LOBES.length - 1) % CLAMP_LOBES.length];
		let mid = (l.a + prev.a) / 2;
		if (Math.abs(l.a - prev.a) > Math.PI) mid += Math.PI;
		pts.push(new THREE.Vector2(Math.cos(mid), Math.sin(mid)).multiplyScalar(0.128 + grow));
		const dir = new THREE.Vector2(Math.cos(l.a), Math.sin(l.a));
		const perp = new THREE.Vector2(-dir.y, dir.x);
		const at = (along: number, across: number) =>
			new THREE.Vector2().addScaledVector(dir, along).addScaledVector(perp, across);
		const tip = l.len + grow;
		const hb = l.wBase / 2 + grow;
		const ht = l.wTip / 2 + grow;
		const cut = 0.035; // chamfered end corners
		pts.push(
			at(0.1, -hb),
			at(tip - cut, -ht),
			at(tip, -ht + cut),
			at(tip, ht - cut),
			at(tip - cut, ht),
			at(0.1, hb)
		);
	}
	return pts;
}

const CLAMP_SILHOUETTE = clampOutline(CLAMP_EDGE);

/** How far from the machine's centre a clamp reaches, pivoted `dist` out
 *  and scaled by `k`. Local +y points outward and x across, so the chamfered
 *  outline is all it takes to find the silhouette's outermost point. */
function clampOuterReach(dist: number, k: number): number {
	let reach = 0;
	for (const p of CLAMP_SILHOUETTE) reach = Math.max(reach, Math.hypot(k * p.x, dist + k * p.y));
	return reach;
}

/** The recessed panel window cut into one lobe, inset by `inset` from the
 *  outer edge and starting clear of the central bezel. */
function clampPanel(l: (typeof CLAMP_LOBES)[number], inset: number): THREE.Vector2[] {
	const dir = new THREE.Vector2(Math.cos(l.a), Math.sin(l.a));
	const perp = new THREE.Vector2(-dir.y, dir.x);
	const at = (along: number, across: number) =>
		new THREE.Vector2().addScaledVector(dir, along).addScaledVector(perp, across);
	const r0 = 0.094 + inset;
	const r1 = l.len - 0.026 - inset;
	// the lobe's half-width at a given distance, then pulled in by the frame
	const hw = (r: number) => THREE.MathUtils.lerp(l.wBase / 2, l.wTip / 2, (r - 0.1) / (l.len - 0.1)) - 0.018 - inset;
	const cut = 0.022;
	return [
		at(r0, hw(r0) - 0.03),
		at(r0 + 0.03, hw(r0 + 0.03)),
		at(r1 - cut, hw(r1)),
		at(r1, hw(r1) - cut),
		at(r1, -hw(r1) + cut),
		at(r1 - cut, -hw(r1)),
		at(r0 + 0.03, -hw(r0 + 0.03)),
		at(r0, -hw(r0) + 0.03)
	];
}

/** Turned-metal profile (a lathe) — collars, fillets and steps like the parts
 *  came off a watchmaker's lathe rather than a box of primitives. */
function lathe(profile: [number, number][], mat: THREE.Material, segments = 28): THREE.Mesh {
	const m = new THREE.Mesh(
		new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segments),
		mat
	);
	m.rotation.x = Math.PI / 2; // lathe axis → z
	return m;
}

/** Tri-lobed clamp after the V2 original: a gunmetal frame with hard
 *  chamfered chrome edges, a gold panel sunk into each lobe with faceted
 *  bevels that flash as the light moves, and a cut gem in a turned bezel at
 *  the pivot. The facets are the point. Flat colour and soft blobs read as
 *  plastic at this size; planes at different angles catch the environment
 *  one at a time and read as metal. The dark frame is what separates it from
 *  the pale silver face (silver on silver vanished, and gold or pale panels
 *  read as holes through to the face). Its own polished materials, as the
 *  shared face metals are too rough for parts this close to the camera. */
function buildClamp(_gold: THREE.Material, _silver: THREE.Material, darkMetal: THREE.Material): THREE.Group {
	const g = new THREE.Group();

	// ExtrudeGeometry puts the flat caps in group 0 and the walls and bevels
	// in group 1, so every casting gets a quieter satin face and bright
	// polished chamfers: the edge lines that make V2's clamp sparkle.
	const chrome = new THREE.MeshPhysicalMaterial({
		color: 0xe8edf0, metalness: 1, roughness: 0.06, envMapIntensity: 3, clearcoat: 0.5, clearcoatRoughness: 0.08
	});
	const steel = new THREE.MeshStandardMaterial({ color: 0x5c656e, metalness: 1, roughness: 0.28, envMapIntensity: 1.6 });
	const gold = new THREE.MeshPhysicalMaterial({
		color: 0xf0c872, metalness: 1, roughness: 0.14, envMapIntensity: 2.4, clearcoat: 0.4, clearcoatRoughness: 0.15
	});
	const goldSatin = new THREE.MeshStandardMaterial({ color: 0xc9a04e, metalness: 1, roughness: 0.34, envMapIntensity: 1.8 });
	const gem = new THREE.MeshPhysicalMaterial({
		color: 0x4f7fcc, metalness: 0.35, roughness: 0.05, clearcoat: 1, envMapIntensity: 2.6,
		emissive: 0x1d3458, emissiveIntensity: 0.5, flatShading: true
	});

	// ---- dark seat: a thin shadow line that separates the casting from the face
	const seat = new THREE.Mesh(
		new THREE.ExtrudeGeometry(roundedShape(clampOutline(CLAMP_SEAT_GROW), 0.02), { depth: 0.02, bevelEnabled: false, curveSegments: 4 }),
		darkMetal
	);
	seat.position.z = -0.03;
	g.add(seat);

	// ---- the frame, with a window cut in each lobe. A chamfer on every edge,
	// the window walls included, is what gives V2 its bright lines.
	const frameShape = roundedShape(clampOutline(), 0.012);
	for (const l of CLAMP_LOBES) frameShape.holes.push(roundedShape(clampPanel(l, 0), 0.01));
	const frame = new THREE.Mesh(
		new THREE.ExtrudeGeometry(frameShape, {
			depth: 0.02,
			bevelEnabled: true,
			bevelThickness: 0.024,
			bevelSize: CLAMP_EDGE,
			bevelSegments: 2, // two facets per edge: one of them always finds the softbox
			curveSegments: 3
		}),
		[steel, chrome]
	);
	g.add(frame);

	// ---- gold panels: low truncated pyramids, so each has five facets. The
	// bevel is offset inward, so the panel's widest point is its outline and
	// it can sit snug against the window wall with no dark moat.
	for (const l of CLAMP_LOBES) {
		const panel = new THREE.Mesh(
			new THREE.ExtrudeGeometry(roundedShape(clampPanel(l, 0.019), 0.008), {
				depth: 0.004,
				bevelEnabled: true,
				bevelThickness: 0.016,
				bevelSize: 0.02,
				bevelOffset: -0.02,
				bevelSegments: 1,
				curveSegments: 2
			}),
			[goldSatin, gold]
		);
		panel.position.z = 0.006;
		g.add(panel);
	}

	// ---- the main lobe carries a raised chrome spine, the long bright facet
	// that made the V2 clamp read as pointing somewhere
	const main = CLAMP_LOBES[0];
	const spine = new THREE.Mesh(
		new THREE.ExtrudeGeometry(
			roundedShape([
				new THREE.Vector2(-0.012, -0.14),
				new THREE.Vector2(0.012, -0.14),
				new THREE.Vector2(0.008, -main.len + 0.09),
				new THREE.Vector2(0, -main.len + 0.075),
				new THREE.Vector2(-0.008, -main.len + 0.09)
			], 0.004),
			{ depth: 0.004, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 1, curveSegments: 2 }
		),
		chrome
	);
	spine.position.z = 0.04;
	g.add(spine);

	// ---- the pivot: a turned chrome bezel, a gold collar, and a cut gem
	const bezel = lathe(
		[
			[0.088, 0], [0.088, 0.011], [0.081, 0.022], // base flange
			[0.07, 0.027], [0.065, 0.034], // step down to the collar
			[0.058, 0.034], [0.054, 0.027], [0.045, 0.025] // inner lip the gem sits on
		],
		chrome,
		32
	);
	bezel.position.z = 0.046;
	g.add(bezel);
	const collar = new THREE.Mesh(new THREE.TorusGeometry(0.061, 0.008, 8, 32), gold);
	collar.position.z = 0.08;
	g.add(collar);
	// a brilliant cut with a flat table: few segments + flat shading = facets
	const stone = lathe(
		[[0.0, -0.018], [0.049, 0.011], [0.051, 0.016], [0.04, 0.032], [0.025, 0.039], [0.0, 0.039]],
		gem,
		10
	);
	stone.position.z = 0.056;
	g.add(stone);

	return g;
}

/** Planar-map UVs from local XY position so a disc image lands correctly. */
function planarUV(geometry: THREE.BufferGeometry, radius: number): void {
	const pos = geometry.attributes.position;
	const uv = geometry.attributes.uv;
	for (let i = 0; i < pos.count; i++) {
		uv.setXY(i, pos.getX(i) / (radius * 2) + 0.5, pos.getY(i) / (radius * 2) + 0.5);
	}
	uv.needsUpdate = true;
}

export class Machine {
	group: THREE.Group;
	backdrop: THREE.Mesh;
	backplate: THREE.Group;
	portal: THREE.Group;
	skyDisc: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
	portalClouds: THREE.Mesh[];
	quadrants: THREE.Group[];
	decos: THREE.Group[];
	faceSpin: THREE.Group;
	centre: THREE.Group;
	mechGroup: THREE.Group;
	centreMats: THREE.Material[];
	mechSpeed: number;
	cogs: THREE.Mesh[];
	balance: THREE.Group;
	buttonMount: THREE.Group;
	buttonGroup: THREE.Group;
	buttonCap: THREE.Mesh;
	innerGlow: THREE.Sprite;
	outerGlow: THREE.Sprite;
	glints: THREE.Sprite[];
	_pressDepth: number;
	_sheenTex: THREE.CanvasTexture;
	_clampMode?: 'slide' | 'twist';
	_clampScale: number;
	_clampOuterLimit: number;
	_irisDistance?: number;

	constructor(scene: THREE.Scene, textures: TextureBundle, sprites: SpriteSet) {
		this.group = new THREE.Group();
		this.group.position.set(0, MACHINE_Y, 0);
		scene.add(this.group);

		const R = 1.3; // machine radius in world units

		// ---------- materials
		const silver = new THREE.MeshStandardMaterial({
			color: 0x93a4b2,
			metalness: 1,
			roughness: 0.3,
			envMapIntensity: 1.35
		});
		const gold = new THREE.MeshStandardMaterial({
			color: 0xd9b05e,
			metalness: 1,
			roughness: 0.26,
			envMapIntensity: 1.35
		});
		const darkMetal = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.85, roughness: 0.5 });
		const faceMat = new THREE.MeshStandardMaterial({
			map: textures.face.map,
			normalMap: textures.face.normalMap,
			roughnessMap: textures.face.roughnessMap,
			metalnessMap: textures.face.metalnessMap,
			metalness: 1,
			roughness: 1,
			transparent: true
		});

		// ---------- quilted leather backdrop
		const quiltMat = new THREE.MeshStandardMaterial({
			map: textures.quilt.map,
			normalMap: textures.quilt.normalMap,
			roughnessMap: textures.quilt.roughnessMap,
			normalScale: new THREE.Vector2(1.2, 1.2)
		});
		this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(26, 26), quiltMat);
		this.backdrop.position.set(0, 0.32, -0.75);
		this.group.add(this.backdrop);

		// ---------- backplate (stays put behind the iris; fades to reveal the portal)
		this.backplate = new THREE.Group();
		const plateMat = darkMetal.clone();
		plateMat.transparent = true; // set up-front — toggling later needs a recompile
		const plate = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.045, R * 1.045, 0.1, 72), plateMat);
		plate.rotation.x = Math.PI / 2;
		plate.position.z = -0.07;
		this.backplate.add(plate);
		this.group.add(this.backplate);

		// socket lining — when the iris opens this frames the hole in the housing:
		// a polished gold rim and a dark bore wall, so it reads solid, not paper
		const socketWall = new THREE.Mesh(
			new THREE.CylinderGeometry(R * 1.045, R * 1.02, 0.55, 72, 1, true),
			new THREE.MeshStandardMaterial({ color: 0x171209, metalness: 0.85, roughness: 0.55, side: THREE.BackSide })
		);
		socketWall.rotation.x = Math.PI / 2;
		socketWall.position.z = -0.3;
		this.group.add(socketWall);
		const socketRim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.048, 0.038, 14, 96), gold);
		socketRim.position.z = -0.02;
		this.group.add(socketRim);

		// ---------- portal (revealed when the iris opens)
		this.portal = new THREE.Group();
		this.portal.position.z = -0.42;
		const skyMat = new THREE.MeshBasicMaterial({ map: textures.sky });
		this.skyDisc = new THREE.Mesh(new THREE.CircleGeometry(R * 1.0, 64), skyMat);
		this.portal.add(this.skyDisc);
		this.portalClouds = [];
		for (let i = 0; i < 3; i++) {
			const m = new THREE.Mesh(
				new THREE.PlaneGeometry(R * 2.1, R * 2.1),
				new THREE.MeshBasicMaterial({
					map: textures.cloudSprite,
					transparent: true,
					opacity: 0.22 - i * 0.06,
					depthWrite: false
				})
			);
			m.position.z = 0.05 + i * 0.06;
			m.rotation.z = rand(0, Math.PI * 2);
			this.portal.add(m);
			this.portalClouds.push(m);
		}
		this.portal.visible = false;
		this.group.add(this.portal);

		// Clamps are sized so the gripping tip just meets the button's rim
		// without cutting into it. Effects never touch a clamp's scale.
		this._clampScale = (R * CLAMP_PIVOT - BUTTON_RADIUS - CLAMP_TIP_GAP) / CLAMP_REACH;
		// ...and never reach past the outer edge of the face's polished lip
		this._clampOuterLimit = R * 0.995 + 0.052;

		// ---------- iris quadrants (face ring + arcs of lip/rail) + static decorations
		this.quadrants = [];
		this.decos = [];
		this.faceSpin = new THREE.Group(); // spins during Spin-Up
		this.group.add(this.faceSpin);

		for (let q = 0; q < 4; q++) {
			const quadrant = new THREE.Group();
			const thetaStart = QUADRANT_ANGLES[q] - Math.PI * 0.25;

			// blue band + outer ornament as two rings merged into one mesh, so
			// there's a vertex ring at the rail for fitAspect() to hinge on
			const bandGeo = new THREE.RingGeometry(R * FACE_INNER, R * FACE_SEAM, 64, 2, thetaStart, Math.PI / 2);
			const outerGeo = new THREE.RingGeometry(R * FACE_SEAM, R, 64, 2, thetaStart, Math.PI / 2);
			planarUV(bandGeo, R);
			planarUV(outerGeo, R);
			const ringGeo = mergeGeometries([bandGeo, outerGeo])!;
			{
				// each band vertex's angle and fraction across the band
				const pos = bandGeo.attributes.position;
				const band = { count: pos.count, t: new Float32Array(pos.count), a: new Float32Array(pos.count), R };
				for (let i = 0; i < pos.count; i++) {
					const r = Math.hypot(pos.getX(i), pos.getY(i));
					band.t[i] = (r / R - FACE_INNER) / (FACE_SEAM - FACE_INNER);
					band.a[i] = Math.atan2(pos.getY(i), pos.getX(i));
				}
				quadrant.userData.band = band;
			}
			bandGeo.dispose();
			outerGeo.dispose();
			const ring = new THREE.Mesh(ringGeo, faceMat);
			quadrant.userData.ring = ring;
			ring.position.z = 0.06;
			quadrant.add(ring);

			// polished outer lip arc
			const lip = new THREE.Mesh(new THREE.TorusGeometry(R * 0.995, 0.052, 14, 40, Math.PI / 2), silver);
			lip.rotation.z = thetaStart;
			lip.position.z = 0.055;
			quadrant.add(lip);

			// rail arc between the bands
			const rail = new THREE.Mesh(new THREE.TorusGeometry(R * 0.785, 0.02, 10, 36, Math.PI / 2), silver);
			rail.rotation.z = thetaStart;
			rail.position.z = 0.085;
			quadrant.add(rail);

			// silver frame arc on the inner edge (rim of the mechanism window)
			const frame = new THREE.Mesh(new THREE.TorusGeometry(R * (FACE_INNER + 0.002), 0.02, 10, 36, Math.PI / 2), silver);
			frame.rotation.z = thetaStart;
			frame.position.z = 0.07;
			quadrant.add(frame);
			quadrant.userData.frame = frame;

			this.faceSpin.add(quadrant);
			quadrant.userData.dir = new THREE.Vector2(
				Math.cos(QUADRANT_ANGLES[q]),
				Math.sin(QUADRANT_ANGLES[q])
			);
			this.quadrants.push(quadrant);

			// pearls sit IN the painted chain, so they ride the spinning face
			for (let g = 0; g < 3; g++) {
				const ang = thetaStart + ((g + 0.5) / 3) * (Math.PI / 2);
				const gem = new THREE.Mesh(
					new THREE.SphereGeometry(0.05, 20, 14),
					new THREE.MeshPhysicalMaterial({
						color: 0xcfe2f8,
						metalness: 0,
						roughness: 0.06,
						clearcoat: 1,
						envMapIntensity: 2.4,
						emissive: 0x36495e,
						emissiveIntensity: 0.35
					})
				);
				gem.position.set(Math.cos(ang) * R * 0.8825, Math.sin(ang) * R * 0.8825, 0.1);
				quadrant.add(gem);
			}

			// the clamp must NOT spin with the face — it lives in its own
			// diagonal group and slides with the iris.
			const deco = new THREE.Group();
			deco.userData.dir = quadrant.userData.dir;
			const clampGroup = buildClamp(gold, silver, darkMetal);
			const ang = QUADRANT_ANGLES[q];
			// fitAspect() moves and sizes it; this is the landscape layout
			clampGroup.position.set(Math.cos(ang) * R * CLAMP_PIVOT, Math.sin(ang) * R * CLAMP_PIVOT, 0.16);
			clampGroup.scale.setScalar(this._clampScale);
			clampGroup.rotation.z = ang - Math.PI / 2; // arm points inward
			deco.add(clampGroup);
			deco.userData.clamp = clampGroup;
			deco.userData.clampHome = clampGroup.position.clone();
			this.group.add(deco);
			this.decos.push(deco);
		}

		// ---------- static centre: mechanism, bead ring + button
		// Everything except the button lives in mechGroup so the iris can fade
		// the whole movement away and the button can float alone.
		this.centre = new THREE.Group();
		this.group.add(this.centre);
		this.mechGroup = new THREE.Group();
		this.centre.add(this.mechGroup);
		this.centreMats = [];
		const fadeable = (mat: THREE.Material) => {
			mat.transparent = true;
			this.centreMats.push(mat);
			return mat;
		};

		const centreFaceMat = fadeable(faceMat.clone());
		const centreGold = fadeable(gold.clone());
		const brass = fadeable(new THREE.MeshStandardMaterial({ color: 0xa9853f, metalness: 1, roughness: 0.38, envMapIntensity: 1.3 }));
		const steel = fadeable(new THREE.MeshStandardMaterial({ color: 0x7d8b99, metalness: 1, roughness: 0.34, envMapIntensity: 1.3 }));
		const darkIron = fadeable(new THREE.MeshStandardMaterial({ color: 0x2a2f38, metalness: 0.95, roughness: 0.5 }));
		const plateMatDeep = fadeable(new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.9, roughness: 0.6 }));
		const plateMatMid = fadeable(new THREE.MeshStandardMaterial({ color: 0x161a22, metalness: 0.9, roughness: 0.52 }));
		const centreGeo = new THREE.RingGeometry(R * 0.26, R * 0.478, 64, 2);
		planarUV(centreGeo, R);
		const centreRing = new THREE.Mesh(centreGeo, centreFaceMat);
		centreRing.position.z = 0.055;
		this.mechGroup.add(centreRing);

		// (the old gold bead torus at R*0.435 is gone — the button now fills its
		// footprint, so the cap itself is the first thing you meet from the centre)

		// gold frame ring on the inner edge of the mechanism window
		const windowFrame = new THREE.Mesh(new THREE.TorusGeometry(R * 0.478, 0.02, 10, 72), centreGold);
		windowFrame.position.z = 0.07;
		this.mechGroup.add(windowFrame);

		// ---------- the movement, in layers, like an antique complication
		this.mechSpeed = 1; // effects crank this up to make the machine "work"
		this.cogs = [];

		// deepest plate
		const deepPlate = new THREE.Mesh(new THREE.RingGeometry(R * 0.4, R * 0.62, 72, 1), plateMatDeep);
		deepPlate.position.z = -0.035;
		this.mechGroup.add(deepPlate);

		// mid plate with a working aperture (ring segments leaving gaps)
		for (let s = 0; s < 4; s++) {
			const seg = new THREE.Mesh(
				new THREE.RingGeometry(R * 0.482, R * 0.55, 48, 1, s * Math.PI * 0.5 + 0.32, Math.PI * 0.5 - 0.64),
				plateMatMid
			);
			seg.position.z = 0.005;
			this.mechGroup.add(seg);
		}

		// ---------- the gear train: ONE designed mechanism, repeated 4×.
		// A pierced brass wheel drives a spoked steel wheel drives a solid gold
		// pinion — same tooth module throughout, centres one pitch-sum apart,
		// phases solved by meshWith(), speeds locked to the -T₁/T₂ ratio. The
		// teeth interlock and counter-rotate like the real thing.
		const MODULE = 0.0128;
		const Rc = R * 0.515; // the arc the train rides
		const GEAR_A = { teeth: 18, geo: gearGeometry({ module: MODULE, teeth: 18, depth: 0.03, web: 'pierced' }) };
		const GEAR_B = { teeth: 11, geo: gearGeometry({ module: MODULE, teeth: 11, depth: 0.026, web: 'spoked' }) };
		const GEAR_C = { teeth: 8, geo: gearGeometry({ module: MODULE, teeth: 8, depth: 0.024, web: 'solid' }) };
		const bigWheelGeo = gearGeometry({ module: MODULE, teeth: 28, depth: 0.018, web: 'pierced', hubRadius: 0.03 });
		const pitchR = (t: number) => (MODULE * t) / 2;
		// angular steps along the arc so adjacent pitch circles kiss exactly
		const stepAngle = (tA: number, tB: number) =>
			2 * Math.asin((pitchR(tA) + pitchR(tB) + MODULE * 0.02) / (2 * Rc));
		const AB = stepAngle(GEAR_A.teeth, GEAR_B.teeth);
		const BC = stepAngle(GEAR_B.teeth, GEAR_C.teeth);

		const placeGear = (spec: MeshedGear, def: { geo: THREE.ExtrudeGeometry }, mat: THREE.Material) => {
			const cog = new THREE.Mesh(def.geo, mat);
			cog.position.set(spec.x, spec.y, 0.02);
			cog.rotation.z = spec.rot;
			cog.userData.speed = spec.speed;
			this.mechGroup.add(cog);
			this.cogs.push(cog);
			// arbor behind, metallic cap in front — every wheel on a real axle
			const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 10), darkIron);
			arbor.rotation.x = Math.PI / 2;
			arbor.position.set(spec.x, spec.y, -0.01);
			this.mechGroup.add(arbor);
			const cap = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), steel);
			cap.scale.z = 0.6;
			cap.position.set(spec.x, spec.y, 0.038);
			this.mechGroup.add(cap);
		};

		for (let q = 0; q < 4; q++) {
			// a symmetric five-wheel chain — C‑B‑A‑B‑C — centred in the open
			// window between the diagonal clamps, spanning most of the gap
			const a0 = QUADRANT_ANGLES[q] + Math.PI / 4;
			const A: MeshedGear = {
				x: Math.cos(a0) * Rc,
				y: Math.sin(a0) * Rc,
				rot: a0 + q * 0.7, // each quadrant's unit starts at its own phase
				teeth: GEAR_A.teeth,
				speed: 0.55
			};
			placeGear(A, GEAR_A, brass);
			// the driver carries a big slow wheel on the same arbor, one layer
			// down — wheel-and-pinion, the way real movements stack
			const wheel = new THREE.Mesh(bigWheelGeo, darkIron);
			wheel.position.set(A.x, A.y, -0.016);
			wheel.rotation.z = A.rot * 0.5;
			wheel.userData.speed = A.speed; // same arbor, same spin
			this.mechGroup.add(wheel);
			this.cogs.push(wheel);

			for (const side of [-1, 1]) {
				const aB = a0 + side * AB;
				const B = meshWith(A, Math.cos(aB) * Rc, Math.sin(aB) * Rc, GEAR_B.teeth);
				placeGear(B, GEAR_B, steel);
				const aC = aB + side * BC;
				const C = meshWith(B, Math.cos(aC) * Rc, Math.sin(aC) * Rc, GEAR_C.teeth);
				placeGear(C, GEAR_C, centreGold);
			}

			// a curved watchmaker's bridge behind the whole chain, pinned at
			// the ends — structure the eye can hang the movement on
			const span = 2 * (AB + BC) + 0.16;
			const bridge = new THREE.Mesh(new THREE.TorusGeometry(Rc, 0.016, 10, 22, span), plateMatMid);
			bridge.rotation.z = a0 - span / 2;
			bridge.position.z = -0.004;
			this.mechGroup.add(bridge);
			for (const side of [-1, 1]) {
				const aEnd = a0 + side * (span / 2);
				const pin = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), steel);
				pin.scale.z = 0.55;
				pin.position.set(Math.cos(aEnd) * Rc, Math.sin(aEnd) * Rc, 0.006);
				this.mechGroup.add(pin);
			}
		}
		// (the old randomly-phased idler pinions are gone — every visible tooth
		// now belongs to a solved, meshing train)
		// plain support spans between the jewelled bridges — structure, not motion
		for (let i = 0; i < 3; i++) {
			const ang = (i / 3) * Math.PI * 2 + 1.35;
			const span = new THREE.Mesh(new THREE.TorusGeometry(R * 0.545, 0.013, 8, 12, 0.26), steel);
			span.rotation.z = ang - 0.13;
			span.position.z = 0.046;
			this.mechGroup.add(span);
		}

		// (the old five ruby-set bridges are gone — five red dots over four
		// windows never sat right, and the train carries its own bridges now)

		// balance wheel — oscillates back and forth like a heartbeat
		this.balance = new THREE.Group();
		const balRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 10, 32), centreGold);
		this.balance.add(balRing);
		const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.012), steel);
		this.balance.add(spoke);
		const spoke2 = spoke.clone();
		spoke2.rotation.z = Math.PI / 2;
		this.balance.add(spoke2);
		const balJewel = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), steel);
		balJewel.position.z = 0.014;
		this.balance.add(balJewel);
		this.balance.position.set(Math.cos(-0.9) * R * 0.515, Math.sin(-0.9) * R * 0.515, 0.04);
		this.mechGroup.add(this.balance);

		// ---------- the red button (bigger — it's the hero)
		// Effects own buttonGroup's transform (and reparent it), so the
		// portrait enlargement lives on a mount above it; see fitAspect().
		this.buttonMount = new THREE.Group();
		this.centre.add(this.buttonMount);
		this.buttonGroup = new THREE.Group();
		this.buttonMount.add(this.buttonGroup);

		const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, BUTTON_RADIUS, 0.1, 56), gold);
		base.rotation.x = Math.PI / 2;
		base.position.z = 0.09;
		this.buttonGroup.add(base);

		const trim = new THREE.Mesh(new THREE.TorusGeometry(0.592, 0.032, 14, 64), gold);
		trim.position.z = 0.148;
		this.buttonGroup.add(trim);

		// domed red cap via lathe, planar-UV'd for the label art
		const profile = [];
		const capR = 0.575;
		for (let i = 0; i <= 20; i++) {
			const t = i / 20;
			const r = Math.sin(t * Math.PI * 0.5) * capR;
			const z = Math.cos(t * Math.PI * 0.5) * 0.185;
			profile.push(new THREE.Vector2(r, z));
		}
		const capGeo = new THREE.LatheGeometry(profile, 56);
		// lathe axis is +Y; remap UVs planar from X/Z before rotating
		{
			const pos = capGeo.attributes.position;
			const uv = capGeo.attributes.uv;
			for (let i = 0; i < pos.count; i++) {
				uv.setXY(i, pos.getX(i) / (capR * 2.15) + 0.5, -pos.getZ(i) / (capR * 2.15) + 0.5);
			}
		}
		const capMat = new THREE.MeshPhysicalMaterial({
			map: textures.button.map,
			color: 0xffffff,
			metalness: 0,
			roughness: 0.3,
			clearcoat: 0.85,
			clearcoatRoughness: 0.28,
			envMapIntensity: 0.55,
			side: THREE.DoubleSide
		});
		this.buttonCap = new THREE.Mesh(capGeo, capMat);
		this.buttonCap.rotation.x = Math.PI / 2;
		this.buttonCap.position.z = 0.1;
		this.buttonGroup.add(this.buttonCap);

		// living ruby: a cloud-sheen skin over the dome whose texture creeps
		// around imperceptibly slowly (the label stays put on the layer below)
		this._sheenTex = textures.button.sheen;
		const sheenMat = new THREE.MeshBasicMaterial({
			map: this._sheenTex,
			color: 0xff6a74,
			transparent: true,
			opacity: 0.4,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		const sheenSkin = new THREE.Mesh(capGeo, sheenMat);
		sheenSkin.rotation.x = Math.PI / 2;
		sheenSkin.position.z = 0.1;
		sheenSkin.scale.setScalar(1.003); // just proud of the cap, no z-fighting
		sheenSkin.renderOrder = 1;
		this.buttonGroup.add(sheenSkin);

		// ---------- glow sprites
		const mkGlow = (map: THREE.Texture, scale: number, z: number, color: THREE.ColorRepresentation = 0xffffff) => {
			const sp = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map,
					color,
					transparent: true,
					opacity: 0,
					blending: THREE.AdditiveBlending,
					depthWrite: false,
					depthTest: false // glows overlay the dome — never slice through it
				})
			);
			sp.renderOrder = 8;
			sp.scale.setScalar(scale);
			sp.position.z = z;
			this.group.add(sp);
			return sp;
		};
		this.innerGlow = mkGlow(sprites.softDot, INNER_GLOW_SCALE, 0.2);
		this.outerGlow = mkGlow(sprites.softDot, 5.0, 0.3);
		this.glints = [];
		for (let i = 0; i < 5; i++) {
			const glint = mkGlow(sprites.star4, 0.16, 0.16);
			glint.userData.timer = rand(0, 6);
			this.glints.push(glint);
		}

		this._pressDepth = 0;
	}

	/* ---------- idle ---------- */

	update(dt: number, t: number): void {
		// breathing
		const breathe = 1 + Math.sin(t * 1.4) * 0.004;
		this.group.scale.setScalar(breathe);
		// the ruby's clouds creep around the dome, barely perceptibly
		this._sheenTex.rotation = t * 0.02;
		this._sheenTex.offset.x = Math.sin(t * 0.05) * 0.015;
		// working mechanism — effects wind mechSpeed up for drama
		for (const cog of this.cogs) {
			cog.rotation.z += dt * cog.userData.speed * this.mechSpeed;
		}
		this.balance.rotation.z = Math.sin(t * 4.2 * Math.min(this.mechSpeed, 2.5)) * 0.8;
		// occasional gem glints
		for (const glint of this.glints) {
			glint.userData.timer -= dt;
			if (glint.userData.timer <= 0) {
				glint.userData.timer = rand(1.4, 5);
				const q = this.quadrants[Math.floor(rand(0, 4))];
				const gems = q.children.filter((ch) => (ch as THREE.Mesh).geometry && (ch as THREE.Mesh).geometry.type === 'SphereGeometry');
				if (gems.length) {
					const gem = gems[Math.floor(rand(0, gems.length))];
					const wp = gem.getWorldPosition(new THREE.Vector3());
					this.group.worldToLocal(wp);
					glint.position.set(wp.x, wp.y, 0.18);
					glint.userData.life = 1;
				}
			}
			if (glint.userData.life > 0) {
				glint.userData.life = Math.max(0, glint.userData.life - dt * 1.8);
				const l = glint.userData.life;
				glint.material.opacity = Math.sin(l * Math.PI);
				glint.material.rotation += dt * 1.5;
				glint.scale.setScalar(0.12 + Math.sin(l * Math.PI) * 0.2);
			}
		}
		// portal cloud drift
		if (this.portal.visible) {
			for (let i = 0; i < this.portalClouds.length; i++) {
				this.portalClouds[i].rotation.z += dt * 0.05 * (i % 2 ? 1 : -1);
			}
			this.skyDisc.material.map!.offset.x += dt * 0.008;
		}
	}

	/* ---------- layout ---------- */

	/** Portrait phones fit the machine to the screen's width, which leaves the
	 *  button small with a lot of empty height around it. Grow the button (not
	 *  the machine) as the screen narrows: it spreads over the gear window,
	 *  which is too fine to read at phone size anyway, and the clamps back off
	 *  just enough to keep clear of its rim. Landscape stays exactly as it was. */
	fitAspect(aspect: number): void {
		const wide = THREE.MathUtils.smoothstep(aspect, PORTRAIT_ASPECT, LANDSCAPE_ASPECT);
		const s = THREE.MathUtils.lerp(PORTRAIT_BUTTON_SCALE, 1, wide);
		this.buttonMount.scale.setScalar(s);
		this.innerGlow.scale.setScalar(INNER_GLOW_SCALE * s);
		// the blue band's inner edge draws back so the gear train still peeks
		// out around the bigger button; its artwork squeezes to fit
		const inner = THREE.MathUtils.lerp(FACE_INNER_PORTRAIT, FACE_INNER, wide);
		const paint = THREE.MathUtils.lerp(FACE_PAINT_PORTRAIT, FACE_INNER, wide);
		for (const q of this.quadrants) {
			const { band, ring, frame } = q.userData;
			const geo: THREE.BufferGeometry = ring.geometry;
			const pos = geo.attributes.position;
			const uv = geo.attributes.uv;
			for (let i = 0; i < band.count; i++) {
				const cos = Math.cos(band.a[i]);
				const sin = Math.sin(band.a[i]);
				const r = band.R * THREE.MathUtils.lerp(inner, FACE_SEAM, band.t[i]);
				const painted = THREE.MathUtils.lerp(paint, FACE_SEAM, band.t[i]) / 2; // planar UV: r / 2R
				pos.setXY(i, cos * r, sin * r);
				uv.setXY(i, cos * painted + 0.5, sin * painted + 0.5);
			}
			pos.needsUpdate = true;
			uv.needsUpdate = true;
			geo.computeBoundingSphere();
			// the silver frame arc rides the edge (x/y only: the tube keeps its depth)
			const k = (inner + 0.002) / (FACE_INNER + 0.002);
			frame.scale.set(k, k, 1);
		}
		// The clamps back off so their tips still just meet the grown rim.
		// Backing off at full size would shove them over the outer lip, so
		// they also give up a little size until their far edge fits inside it.
		const tip = BUTTON_RADIUS * s + CLAMP_TIP_GAP;
		const fits = (k: number) => clampOuterReach(tip + k * CLAMP_REACH, k) <= this._clampOuterLimit;
		let k = this._clampScale;
		if (!fits(k)) {
			let lo = 0.5;
			let hi = k;
			for (let i = 0; i < 20; i++) {
				const mid = (lo + hi) / 2;
				if (fits(mid)) lo = mid;
				else hi = mid;
			}
			k = lo;
		}
		const dist = tip + k * CLAMP_REACH;
		for (const d of this.decos) {
			const clamp: THREE.Group = d.userData.clamp;
			const home: THREE.Vector3 = d.userData.clampHome;
			const dir: THREE.Vector2 = d.userData.dir;
			const next = new THREE.Vector3(dir.x * dist, dir.y * dist, home.z);
			clamp.scale.setScalar(k);
			// shift by the change, not to the new home: an effect may have the
			// clamp open (or aimed) right now, and a rotate-to-portrait should
			// carry it along rather than snap it shut
			clamp.position.add(next.clone().sub(home));
			home.copy(next);
		}
	}

	/** The button's rim at rest, in world space. */
	buttonRestRim(): { centre: THREE.Vector3; radius: number } {
		const s = this.buttonMount.scale.x;
		return { centre: new THREE.Vector3(0, MACHINE_Y, 0.15 * s), radius: BUTTON_RADIUS * s };
	}

	/* ---------- interactions ---------- */

	pressDown(): Promise<void> {
		return tween(90, 'inQuad', (v) => {
			this.buttonGroup.position.z = -0.07 * v;
		});
	}

	pressUp(): Promise<void> {
		const from = this.buttonGroup.position.z;
		return tween(420, 'outBack', (v) => {
			this.buttonGroup.position.z = from * (1 - v);
		});
	}

	_layoutClamps(v: number): void {
		// v: 0 = locked home, 1 = fully released, in the current mode
		const twist = this._clampMode === 'twist';
		const reach = twist ? 0.17 : 0.3;
		for (let i = 0; i < this.decos.length; i++) {
			const d = this.decos[i];
			const clamp = d.userData.clamp;
			const home = d.userData.clampHome;
			const dir = d.userData.dir;
			clamp.position.x = home.x + dir.x * reach * v;
			clamp.position.y = home.y + dir.y * reach * v;
			clamp.rotation.z = QUADRANT_ANGLES[i] - Math.PI / 2 + (twist ? v * 0.6 : 0);
		}
	}

	openClamps(duration = 700, mode?: 'slide' | 'twist'): Promise<void> {
		// sometimes they twist off, sometimes they draw straight back like the original
		this._clampMode = mode || (Math.random() < 0.55 ? 'slide' : 'twist');
		return tween(duration, 'inOutCubic', (v) => this._layoutClamps(v));
	}

	closeClamps(duration = 700): Promise<void> {
		return tween(duration, 'inOutCubic', (v) => this._layoutClamps(1 - v));
	}

	_slideIris(distance: number, v: number): void {
		for (const part of [...this.quadrants, ...this.decos]) {
			const dir = part.userData.dir;
			part.position.x = dir.x * distance * v;
			part.position.y = dir.y * distance * v;
		}
	}

	setCentreOpacity(o: number): void {
		for (const mat of this.centreMats) mat.opacity = o;
		this.mechGroup.visible = o > 0.02;
	}

	openIris(distance = 1.0, duration = 1600): Promise<[void, void]> {
		this.portal.visible = true;
		this._irisDistance = distance;
		const fade = tween(duration * 0.6, 'inOutQuad', (v) => {
			(this.backplate.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.opacity = 1 - v;
			this.setCentreOpacity(1 - v); // the movement recedes with the iris
		});
		const slide = tween(duration, 'inOutCubic', (v) => this._slideIris(distance, v));
		return Promise.all([fade, slide]);
	}

	closeIris(duration = 1400): Promise<[void, void]> {
		const fade = tween(duration, 'inOutQuad', (v) => {
			(this.backplate.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.opacity = v;
			this.setCentreOpacity(v);
		});
		const slide = tween(duration, 'inOutCubic', (v) =>
			this._slideIris(this._irisDistance || 1, 1 - v)
		).then(() => {
			this.portal.visible = false;
		});
		return Promise.all([fade, slide]);
	}

	setInnerGlow(opacity: number, color?: THREE.ColorRepresentation): void {
		this.innerGlow.material.opacity = opacity;
		if (color !== undefined) this.innerGlow.material.color.set(color);
	}

	setOuterGlow(opacity: number, color?: THREE.ColorRepresentation): void {
		this.outerGlow.material.opacity = opacity;
		if (color !== undefined) this.outerGlow.material.color.set(color);
	}

	/** World position of the button centre (for aiming lightning etc.) */
	buttonWorldPosition(target = new THREE.Vector3()): THREE.Vector3 {
		return this.buttonGroup.getWorldPosition(target);
	}

	/** Crash recovery: snap every effect-mutated part back to its idle pose.
	    Deliberately tween-free — a wedged machine must never stay wedged. */
	resetToIdle(): void {
		this._slideIris(this._irisDistance || 1, 0);
		(this.backplate.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material.opacity = 1;
		this.setCentreOpacity(1);
		this.portal.visible = false;
		this._layoutClamps(0);
		this.buttonGroup.position.z = 0;
		this.setInnerGlow(0.2);
		this.setOuterGlow(0.3, 0xffffff);
		this.mechSpeed = 1;
	}
}
