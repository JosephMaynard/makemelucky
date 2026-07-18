// The Luck Machine — procedural 3D recreation of the classic V2 contraption.

import * as THREE from 'three';
import { tween, rand } from '../core/anim';
import type { TextureBundle } from '../types';
import type { SpriteSet } from '../gfx/textures';

const QUADRANT_ANGLES = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

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

/** Three-pronged clamp plate outline: one long prong gripping inward (-y),
 *  two short braced prongs angled back and outward. Waisted between prongs so
 *  it reads as a designed casting, not a star cut from sheet. */
function clampPlatePoints(scale = 1): THREE.Vector2[] {
	const prongs = [
		{ a: -Math.PI / 2, len: 0.42, wBase: 0.2, wTip: 0.115 }, // main, toward the button
		{ a: Math.PI * 0.26, len: 0.24, wBase: 0.15, wTip: 0.095 },
		{ a: Math.PI * 0.74, len: 0.24, wBase: 0.15, wTip: 0.095 }
	];
	const pts: THREE.Vector2[] = [];
	for (let i = 0; i < prongs.length; i++) {
		const p = prongs[i];
		const dir = new THREE.Vector2(Math.cos(p.a), Math.sin(p.a));
		const perp = new THREE.Vector2(-dir.y, dir.x);
		pts.push(
			new THREE.Vector2().addScaledVector(dir, 0.1).addScaledVector(perp, p.wBase / 2),
			new THREE.Vector2().addScaledVector(dir, p.len).addScaledVector(perp, p.wTip / 2),
			new THREE.Vector2().addScaledVector(dir, p.len).addScaledVector(perp, -p.wTip / 2),
			new THREE.Vector2().addScaledVector(dir, 0.1).addScaledVector(perp, -p.wBase / 2)
		);
	}
	return pts.map((v) => v.multiplyScalar(scale));
}

function clampPlateGeometry(scale = 1, depth = 0.045): THREE.ExtrudeGeometry {
	return new THREE.ExtrudeGeometry(roundedShape(clampPlatePoints(scale), 0.05), {
		depth,
		bevelEnabled: true,
		bevelThickness: 0.02,
		bevelSize: 0.02,
		bevelSegments: 3, // soft machined edge, not a chamfered sticker
		curveSegments: 6
	});
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

/** Tri-prong clamp, rebuilt as jewellery: rounded castings with soft bevels,
 *  lathe-turned hardware, a working piston down the gripping arm and pearls to
 *  match the face. Its own polished materials — the shared face metals are too
 *  rough for parts this close to the camera. */
function buildClamp(_gold: THREE.Material, _silver: THREE.Material, darkMetal: THREE.Material): THREE.Group {
	const g = new THREE.Group();

	const gold = new THREE.MeshPhysicalMaterial({
		color: 0xd8ae4e, metalness: 1, roughness: 0.22, envMapIntensity: 1.7, clearcoat: 0.35, clearcoatRoughness: 0.25
	});
	const goldDeep = new THREE.MeshStandardMaterial({ color: 0x8a6a28, metalness: 1, roughness: 0.42, envMapIntensity: 1.2 });
	const silver = new THREE.MeshPhysicalMaterial({
		color: 0xcfd6dc, metalness: 1, roughness: 0.16, envMapIntensity: 1.9, clearcoat: 0.3, clearcoatRoughness: 0.2
	});
	const pearl = new THREE.MeshPhysicalMaterial({
		color: 0xcfe2f8, metalness: 0, roughness: 0.06, clearcoat: 1, envMapIntensity: 2.4,
		emissive: 0x36495e, emissiveIntensity: 0.4
	});

	// ---- body: dark seat, then the gold casting with soft rounded bevels
	const seat = new THREE.Mesh(clampPlateGeometry(1.045, 0.02), darkMetal);
	seat.position.z = -0.016;
	const plate = new THREE.Mesh(clampPlateGeometry(1, 0.045), gold);
	// a slimmer raised deck on top makes the casting read as two machined layers
	const deck = new THREE.Mesh(clampPlateGeometry(0.82, 0.02), goldDeep);
	deck.position.z = 0.052;
	g.add(seat, plate, deck);

	// ---- the gripping arm: recessed channel, piston rod, guide collars
	const channelShape = roundedShape([
		new THREE.Vector2(-0.042, -0.1),
		new THREE.Vector2(0.042, -0.1),
		new THREE.Vector2(0.026, -0.365),
		new THREE.Vector2(-0.026, -0.365)
	], 0.024);
	const channel = new THREE.Mesh(
		new THREE.ExtrudeGeometry(channelShape, { depth: 0.012, bevelEnabled: false, curveSegments: 6 }),
		darkMetal
	);
	channel.position.z = 0.062;
	g.add(channel);

	const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.27, 14), silver);
	rod.position.set(0, -0.235, 0.077);
	g.add(rod);
	for (const y of [-0.16, -0.27]) {
		const guide = lathe([[0.016, -0.011], [0.03, -0.008], [0.033, 0], [0.03, 0.008], [0.016, 0.011]], gold, 20);
		guide.position.set(0, y, 0.077);
		g.add(guide);
	}

	// ---- gripper foot: turned ferrule + rounded pad, stopping shy of the cap
	const ferrule = lathe(
		[[0.014, -0.03], [0.05, -0.026], [0.056, -0.012], [0.044, -0.004], [0.052, 0.006], [0.038, 0.02], [0.0, 0.026]],
		silver
	);
	ferrule.position.set(0, -0.375, 0.06);
	g.add(ferrule);
	const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 6, 14), goldDeep);
	pad.rotation.z = Math.PI / 2;
	pad.position.set(0, -0.408, 0.045);
	g.add(pad);

	// ---- brace prongs: turned collars holding pearls, echoing the face ring
	for (const side of [-1, 1]) {
		const a = Math.PI * (0.5 + side * 0.24);
		const ex = Math.cos(a) * 0.19;
		const ey = Math.sin(a) * 0.19;
		const collar = lathe(
			[[0.016, -0.02], [0.052, -0.016], [0.058, -0.002], [0.046, 0.008], [0.034, 0.014], [0.0, 0.018]],
			silver
		);
		collar.position.set(ex, ey, 0.062);
		g.add(collar);
		const gem = new THREE.Mesh(new THREE.SphereGeometry(0.032, 18, 14), pearl);
		gem.position.set(ex, ey, 0.092);
		g.add(gem);
	}

	// ---- rivet line down each edge of the main arm — machined, purposeful
	for (const side of [-1, 1]) {
		for (let i = 0; i < 3; i++) {
			const y = -0.14 - i * 0.085;
			const w = 0.075 - i * 0.012;
			const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 10, 8), silver);
			rivet.scale.z = 0.55;
			rivet.position.set(side * w, y, 0.068);
			g.add(rivet);
		}
	}

	// ---- central boss: a turned gold stack with a knurl, collar and screw
	const boss = lathe(
		[
			[0.125, 0], [0.125, 0.014], [0.108, 0.022], // base flange
			[0.095, 0.03], [0.095, 0.052], // drum
			[0.075, 0.06], [0.062, 0.062], // shoulder
			[0.05, 0.07], [0.048, 0.082], [0.0, 0.09] // cap swell
		],
		gold
	);
	boss.position.z = 0.045;
	g.add(boss);
	// knurled grip band around the drum (many facets, flat-shaded on purpose)
	const knurl = new THREE.Mesh(new THREE.CylinderGeometry(0.099, 0.099, 0.02, 36, 1), silver);
	knurl.rotation.x = Math.PI / 2;
	knurl.position.z = 0.086;
	g.add(knurl);
	const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.01, 10, 28), gold);
	collarRing.position.z = 0.128;
	const screwDome = new THREE.Mesh(new THREE.SphereGeometry(0.03, 18, 14), darkMetal);
	screwDome.scale.z = 0.7;
	screwDome.position.z = 0.13;
	const slot = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.01, 0.005), gold);
	slot.position.z = 0.152;
	slot.rotation.z = Math.PI / 4;
	g.add(collarRing, screwDome, slot);
	// four dome screws holding the flange down
	for (let i = 0; i < 4; i++) {
		const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
		const s = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), darkMetal);
		s.scale.z = 0.55;
		s.position.set(Math.cos(a) * 0.108, Math.sin(a) * 0.108, 0.062);
		g.add(s);
	}

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
	buttonGroup: THREE.Group;
	buttonCap: THREE.Mesh;
	innerGlow: THREE.Sprite;
	outerGlow: THREE.Sprite;
	glints: THREE.Sprite[];
	_pressDepth: number;
	_sheenTex: THREE.CanvasTexture;
	_clampMode?: 'slide' | 'twist';
	_irisDistance?: number;

	constructor(scene: THREE.Scene, textures: TextureBundle, sprites: SpriteSet) {
		this.group = new THREE.Group();
		this.group.position.set(0, -0.32, 0);
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
		this.skyDisc = new THREE.Mesh(new THREE.CircleGeometry(R * 0.98, 64), skyMat);
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

		// ---------- iris quadrants (face ring + arcs of lip/rail) + static decorations
		this.quadrants = [];
		this.decos = [];
		this.faceSpin = new THREE.Group(); // spins during Spin-Up
		this.group.add(this.faceSpin);

		for (let q = 0; q < 4; q++) {
			const quadrant = new THREE.Group();
			const thetaStart = QUADRANT_ANGLES[q] - Math.PI * 0.25;

			const ringGeo = new THREE.RingGeometry(R * 0.555, R, 64, 3, thetaStart, Math.PI / 2);
			planarUV(ringGeo, R);
			const ring = new THREE.Mesh(ringGeo, faceMat);
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
			const frame = new THREE.Mesh(new THREE.TorusGeometry(R * 0.557, 0.02, 10, 36, Math.PI / 2), silver);
			frame.rotation.z = thetaStart;
			frame.position.z = 0.07;
			quadrant.add(frame);

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
			clampGroup.position.set(Math.cos(ang) * R * 0.825, Math.sin(ang) * R * 0.825, 0.16);
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
		const ruby = fadeable(new THREE.MeshPhysicalMaterial({
			color: 0xb01030,
			metalness: 0,
			roughness: 0.05,
			clearcoat: 1,
			emissive: 0x600515,
			emissiveIntensity: 0.6
		}));

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
		const TRAIN = [
			{ teeth: 18, web: 'pierced' as const, depth: 0.03 },
			{ teeth: 11, web: 'spoked' as const, depth: 0.026 },
			{ teeth: 8, web: 'solid' as const, depth: 0.024 }
		];
		const trainGeos = TRAIN.map((t) => gearGeometry({ module: MODULE, teeth: t.teeth, depth: t.depth, web: t.web }));
		const bigWheelGeo = gearGeometry({ module: MODULE, teeth: 28, depth: 0.018, web: 'pierced', hubRadius: 0.03 });
		const pitchR = (t: number) => (MODULE * t) / 2;
		// angular steps along the arc so adjacent pitch circles kiss exactly
		const stepAngle = (tA: number, tB: number) =>
			2 * Math.asin((pitchR(tA) + pitchR(tB) + MODULE * 0.02) / (2 * Rc));

		for (let q = 0; q < 4; q++) {
			// centred in the open window between the diagonal clamps
			const a0 = QUADRANT_ANGLES[q] + Math.PI / 4 - 0.24;
			const angles = [
				a0,
				a0 + stepAngle(TRAIN[0].teeth, TRAIN[1].teeth),
				a0 + stepAngle(TRAIN[0].teeth, TRAIN[1].teeth) + stepAngle(TRAIN[1].teeth, TRAIN[2].teeth)
			];
			const centers = angles.map((a) => ({ x: Math.cos(a) * Rc, y: Math.sin(a) * Rc }));

			// solve the chain: A is the driver, B meshes with A, C meshes with B
			let spec: MeshedGear = { x: centers[0].x, y: centers[0].y, rot: a0, teeth: TRAIN[0].teeth, speed: 0.55 };
			const mats = [brass, steel, centreGold];
			spec.rot += q * 0.7; // each quadrant's unit starts at its own phase
			for (let i = 0; i < 3; i++) {
				if (i > 0) spec = meshWith(spec, centers[i].x, centers[i].y, TRAIN[i].teeth);
				const cog = new THREE.Mesh(trainGeos[i], mats[i]);
				cog.position.set(spec.x, spec.y, 0.02);
				cog.rotation.z = spec.rot;
				cog.userData.speed = spec.speed;
				this.mechGroup.add(cog);
				this.cogs.push(cog);

				// arbor behind, hub cap in front — every wheel sits on a real axle
				const arbor = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 10), darkIron);
				arbor.rotation.x = Math.PI / 2;
				arbor.position.set(spec.x, spec.y, -0.01);
				this.mechGroup.add(arbor);
				const cap = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), i === 1 ? ruby : centreGold);
				cap.scale.z = 0.6;
				cap.position.set(spec.x, spec.y, 0.038);
				this.mechGroup.add(cap);

				// the driver carries a big slow wheel on the same arbor, one
				// layer down — wheel-and-pinion, the way real movements stack
				if (i === 0) {
					const wheel = new THREE.Mesh(bigWheelGeo, darkIron);
					wheel.position.set(spec.x, spec.y, -0.016);
					wheel.rotation.z = spec.rot * 0.5;
					wheel.userData.speed = spec.speed; // same arbor, same spin
					this.mechGroup.add(wheel);
					this.cogs.push(wheel);
				}
			}

			// a watchmaker's bridge spanning the unit, dome-screwed at each end
			const span = Math.hypot(centers[2].x - centers[0].x, centers[2].y - centers[0].y);
			const bridge = new THREE.Mesh(new THREE.BoxGeometry(span + 0.1, 0.05, 0.012), plateMatMid);
			bridge.position.set((centers[0].x + centers[2].x) / 2, (centers[0].y + centers[2].y) / 2, -0.002);
			bridge.rotation.z = Math.atan2(centers[2].y - centers[0].y, centers[2].x - centers[0].x);
			this.mechGroup.add(bridge);
			for (const end of [centers[0], centers[2]]) {
				const screw = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), steel);
				screw.scale.z = 0.55;
				const out = Math.hypot(end.x, end.y);
				screw.position.set((end.x / out) * (out + 0.055), (end.y / out) * (out + 0.055), 0.005);
				this.mechGroup.add(screw);
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

		// ornate gold bridges spanning the window, each set with a ruby jewel —
		// the signature of an expensive movement
		for (let i = 0; i < 5; i++) {
			const ang = (i / 5) * Math.PI * 2 + 0.25;
			const bridge = new THREE.Group();
			const arm = new THREE.Mesh(new THREE.TorusGeometry(R * 0.515, 0.017, 10, 14, 0.34), centreGold);
			arm.rotation.z = ang - 0.17;
			bridge.add(arm);
			// jewel bearing in a gold collar at the bridge centre
			const collar = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.011, 8, 18), centreGold);
			collar.position.set(Math.cos(ang) * R * 0.515, Math.sin(ang) * R * 0.515, 0);
			bridge.add(collar);
			const jewel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), ruby);
			jewel.position.copy(collar.position);
			jewel.position.z = 0.012;
			bridge.add(jewel);
			bridge.position.z = 0.052;
			this.mechGroup.add(bridge);
		}

		// balance wheel — oscillates back and forth like a heartbeat
		this.balance = new THREE.Group();
		const balRing = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 10, 32), centreGold);
		this.balance.add(balRing);
		const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.012), steel);
		this.balance.add(spoke);
		const spoke2 = spoke.clone();
		spoke2.rotation.z = Math.PI / 2;
		this.balance.add(spoke2);
		const balJewel = new THREE.Mesh(new THREE.SphereGeometry(0.016, 12, 8), ruby);
		balJewel.position.z = 0.014;
		this.balance.add(balJewel);
		this.balance.position.set(Math.cos(-0.9) * R * 0.515, Math.sin(-0.9) * R * 0.515, 0.04);
		this.mechGroup.add(this.balance);

		// ---------- the red button (bigger — it's the hero)
		this.buttonGroup = new THREE.Group();
		this.centre.add(this.buttonGroup);

		const base = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.625, 0.1, 56), gold);
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
		this.innerGlow = mkGlow(sprites.softDot, 1.45, 0.2);
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
