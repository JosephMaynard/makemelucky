// The Luck Machine — procedural 3D recreation of the classic V2 contraption.

import * as THREE from 'three';
import { tween, rand } from '../core/anim';
import type { TextureBundle } from '../types';
import type { SpriteSet } from '../gfx/textures';

const QUADRANT_ANGLES = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];

function makeGearGeometry(radius = 0.09, teeth = 12, depth = 0.03): THREE.ExtrudeGeometry {
	const shape = new THREE.Shape();
	const inner = radius * 0.78;
	for (let i = 0; i < teeth * 2; i++) {
		const r = i % 2 === 0 ? radius : inner;
		const a0 = (i / (teeth * 2)) * Math.PI * 2;
		const a1 = ((i + 1) / (teeth * 2)) * Math.PI * 2;
		if (i === 0) shape.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
		shape.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
		shape.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
	}
	shape.closePath();
	const hole = new THREE.Path();
	hole.absarc(0, 0, radius * 0.3, 0, Math.PI * 2, true);
	shape.holes.push(hole);
	return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function angularArmGeometry(wBase: number, wTip: number, l: number, depth: number): THREE.ExtrudeGeometry {
	// tapered, chamfered strut — long axis along -Y, base at origin
	const s = new THREE.Shape();
	s.moveTo(-wBase / 2, 0.04);
	s.lineTo(wBase / 2, 0.04);
	s.lineTo(wTip / 2, -l);
	s.lineTo(-wTip / 2, -l);
	s.closePath();
	return new THREE.ExtrudeGeometry(s, {
		depth,
		bevelEnabled: true,
		bevelThickness: 0.014,
		bevelSize: 0.014,
		bevelSegments: 1 // single segment = crisp chamfer, not a rounded sausage
	});
}

/** Three-pronged angular clamp plate outline: one long prong gripping inward
 *  (-y), two short braced prongs angled back and outward. */
function clampPlateGeometry(): THREE.ExtrudeGeometry {
	const prongs = [
		{ a: -Math.PI / 2, len: 0.42, wBase: 0.23, wTip: 0.12 }, // main, toward the button
		{ a: Math.PI * 0.26, len: 0.24, wBase: 0.17, wTip: 0.1 },
		{ a: Math.PI * 0.74, len: 0.24, wBase: 0.17, wTip: 0.1 }
	];
	const pts: THREE.Vector2[] = [];
	for (const p of prongs) {
		const dir = new THREE.Vector2(Math.cos(p.a), Math.sin(p.a));
		const perp = new THREE.Vector2(-dir.y, dir.x);
		pts.push(
			new THREE.Vector2().addScaledVector(dir, 0.09).addScaledVector(perp, p.wBase / 2),
			new THREE.Vector2().addScaledVector(dir, p.len).addScaledVector(perp, p.wTip / 2),
			new THREE.Vector2().addScaledVector(dir, p.len).addScaledVector(perp, -p.wTip / 2),
			new THREE.Vector2().addScaledVector(dir, 0.09).addScaledVector(perp, -p.wBase / 2)
		);
	}
	const s = new THREE.Shape();
	pts.forEach((p, i) => (i === 0 ? s.moveTo(p.x, p.y) : s.lineTo(p.x, p.y)));
	s.closePath();
	return new THREE.ExtrudeGeometry(s, {
		depth: 0.05,
		bevelEnabled: true,
		bevelThickness: 0.016,
		bevelSize: 0.016,
		bevelSegments: 1 // crisp chamfer
	});
}

/** Angular tri-prong clamp: bold gold plate like the V2 original, dressed with
 *  silver hex hardware and gem-set brace tips. */
function buildClamp(gold: THREE.Material, silver: THREE.Material, darkMetal: THREE.Material): THREE.Group {
	const g = new THREE.Group();
	const gemMat = new THREE.MeshPhysicalMaterial({
		color: 0xcfe2f8,
		metalness: 0,
		roughness: 0.06,
		clearcoat: 1,
		envMapIntensity: 2.4,
		emissive: 0x36495e,
		emissiveIntensity: 0.4
	});

	const hex = (r: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
		const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.08, h, 6), mat);
		m.rotation.x = Math.PI / 2;
		m.position.set(x, y, z);
		g.add(m);
		return m;
	};

	// dark under-plate then the bold gold tri-prong plate (a slim pinstripe
	// outline, not a cartoon border)
	const under = new THREE.Mesh(clampPlateGeometry(), darkMetal);
	under.scale.set(1.05, 1.05, 0.35);
	under.position.z = -0.012;
	const plate = new THREE.Mesh(clampPlateGeometry(), gold);
	g.add(under, plate);

	// silver spine inlay running down the gripping prong
	const spine = new THREE.Mesh(angularArmGeometry(0.07, 0.035, 0.31, 0.014), silver);
	spine.position.set(0, -0.05, 0.062);
	g.add(spine);

	// tip hardware — stops at the gold ring, never over the button cap (the
	// cap sinks on press and would reveal the tip's underside)
	hex(0.065, 0.045, silver, 0, -0.375, 0.045);
	const tipDome = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), silver);
	tipDome.position.set(0, -0.375, 0.072);
	g.add(tipDome);

	// intricate silver inlay across the bare gold: fillets tracing the main
	// prong's edges, ladder bands across it, and a strip down each brace
	const strip = (w: number, l: number, x: number, y: number, rz: number, z = 0.066) => {
		const m = new THREE.Mesh(new THREE.BoxGeometry(w, l, 0.008), silver);
		m.position.set(x, y, z);
		m.rotation.z = rz;
		g.add(m);
		return m;
	};
	strip(0.011, 0.42, 0.068, -0.155, -0.1); // edge fillets, tapering with the prong
	strip(0.011, 0.42, -0.068, -0.155, 0.1);
	strip(0.13, 0.011, 0, -0.15, 0); // ladder bands under the spine
	strip(0.115, 0.011, 0, -0.235, 0);
	strip(0.1, 0.011, 0, -0.315, 0);
	for (const side of [-1, 1]) {
		const a = Math.PI * (0.5 + side * 0.24);
		strip(0.011, 0.13, Math.cos(a) * 0.17, Math.sin(a) * 0.17, a - Math.PI / 2);
	}

	// gem-set hexes on the two brace prongs
	for (const side of [-1, 1]) {
		const a = Math.PI * (0.5 + side * 0.24);
		const ex = Math.cos(a) * 0.19;
		const ey = Math.sin(a) * 0.19;
		hex(0.055, 0.04, silver, ex, ey, 0.05);
		const gem = new THREE.Mesh(new THREE.SphereGeometry(0.027, 14, 10), gemMat);
		gem.position.set(ex, ey, 0.082);
		g.add(gem);
	}

	// central boss: octagonal gold block, silver hex plate, gold collar, dome screw
	const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.112, 0.05, 8), gold);
	boss.rotation.x = Math.PI / 2;
	boss.rotation.y = Math.PI / 8;
	boss.position.z = 0.06;
	g.add(boss);
	hex(0.062, 0.03, silver, 0, 0, 0.095);
	const collar = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.011, 8, 24), gold);
	collar.position.z = 0.112;
	const screw = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), darkMetal);
	screw.position.z = 0.116;
	const slot = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.006), gold);
	slot.position.z = 0.143;
	slot.rotation.z = Math.PI / 4;
	g.add(collar, screw, slot);

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

			// hex-bolt greebles at the painted stud positions
			for (const rr of [0.595, 0.745]) {
				const ang = QUADRANT_ANGLES[q] + Math.PI / 4; // one per quadrant edge region
				const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.028, 6), gold);
				bolt.rotation.x = Math.PI / 2;
				bolt.position.set(Math.cos(ang) * R * rr, Math.sin(ang) * R * rr, 0.095);
				quadrant.add(bolt);
			}

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

		// big slow dark wheels on the deep layer
		for (let i = 0; i < 4; i++) {
			const wheel = new THREE.Mesh(makeGearGeometry(0.135, 18, 0.02), darkIron);
			const ang = (i / 4) * Math.PI * 2 + 0.4;
			wheel.position.set(Math.cos(ang) * R * 0.505, Math.sin(ang) * R * 0.505, -0.014);
			wheel.userData.speed = 0.16 * (i % 2 ? 1 : -1);
			this.mechGroup.add(wheel);
			this.cogs.push(wheel);
		}

		// mid plate with a working aperture (ring segments leaving gaps)
		for (let s = 0; s < 4; s++) {
			const seg = new THREE.Mesh(
				new THREE.RingGeometry(R * 0.482, R * 0.55, 48, 1, s * Math.PI * 0.5 + 0.32, Math.PI * 0.5 - 0.64),
				plateMatMid
			);
			seg.position.z = 0.005;
			this.mechGroup.add(seg);
		}

		// main brass/steel gear train
		const N_COGS = 9;
		for (let i = 0; i < N_COGS; i++) {
			const big = i % 2 === 0;
			const radius = big ? 0.088 : 0.062;
			const cog = new THREE.Mesh(makeGearGeometry(radius, big ? 11 : 8, 0.028), big ? brass : steel);
			const ang = (i / N_COGS) * Math.PI * 2;
			cog.position.set(Math.cos(ang) * R * 0.515, Math.sin(ang) * R * 0.515, big ? 0.018 : 0.032);
			cog.rotation.z = Math.random() * Math.PI;
			cog.userData.speed = (big ? 0.5 : -0.85) * (0.8 + (i % 3) * 0.2);
			const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, 0.04, 12), centreGold);
			hub.rotation.x = Math.PI / 2;
			cog.add(hub);
			this.mechGroup.add(cog);
			this.cogs.push(cog);
		}
		// half-hidden big wheels peeking from under the button's skirt
		for (let i = 0; i < 3; i++) {
			const wheel = new THREE.Mesh(makeGearGeometry(0.16, 16, 0.025), brass);
			const ang = (i / 3) * Math.PI * 2 + 0.7;
			wheel.position.set(Math.cos(ang) * R * 0.485, Math.sin(ang) * R * 0.485, 0.008);
			wheel.userData.speed = 0.22 * (i % 2 ? 1 : -1);
			this.mechGroup.add(wheel);
			this.cogs.push(wheel);
		}
		// small idler pinions tucked between the main train, filling the window
		for (let i = 0; i < 6; i++) {
			const ang = ((i + 0.5) / 6) * Math.PI * 2 + 0.35;
			const pinion = new THREE.Mesh(makeGearGeometry(i % 2 ? 0.052 : 0.068, i % 2 ? 7 : 9, 0.022), i % 2 ? steel : brass);
			pinion.position.set(Math.cos(ang) * R * 0.53, Math.sin(ang) * R * 0.53, i % 2 ? 0.024 : 0.038);
			pinion.rotation.z = Math.random() * Math.PI;
			pinion.userData.speed = (i % 2 ? -1.3 : 1.05) * (0.85 + (i % 3) * 0.2);
			const pinionHub = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.034, 10), centreGold);
			pinionHub.rotation.x = Math.PI / 2;
			pinion.add(pinionHub);
			this.mechGroup.add(pinion);
			this.cogs.push(pinion);
		}
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
}
