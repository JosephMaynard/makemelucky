// Effect — THE FAIRY KINGDOM: the rim opens, the button lifts away, and you go
// THROUGH the hole. Out the other side is a little low-poly kingdom — rolling
// hills, toadstools, fairies trailing dust — and you fly over it to a storybook
// castle, up to a turret, where an old king is waiting with your luck in a cup.
// Then the whole journey runs backwards at four times the speed and the hole
// shuts behind you.
//
// ── How the camera actually flies ────────────────────────────────────────────
// It doesn't. LuckyScene.tick() re-aims the real camera at the world origin on
// every single frame, so an effect can never simply move it. Instead the entire
// kingdom lives in one group whose matrix is set each frame to
//
//     world.matrix = realCamera.matrixWorld · virtualCamera.matrixWorld⁻¹
//
// A point X in kingdom space then lands at that product, and viewed through the
// real camera (whose view matrix is realCamera.matrixWorld⁻¹) it resolves to
// exactly virtualCamera.matrixWorld⁻¹ · X — i.e. precisely what the virtual
// camera sees. So we get a free-flying camera on a spline while the real one
// stays exactly where the rest of the app expects it, and nothing in scene.ts
// has to change. The real camera's parallax, breathe and shake cancel out of
// that product, which is why this effect applies its own sway and its own
// shake to the virtual camera.
//
// The one consequence: SCENE LIGHTING IS IN WORLD SPACE and would swing around
// the kingdom as the camera banks. So the kingdom carries its own sun (with its
// target inside the same group, or the direction would be meaningless), the
// scene's own lights are taken to zero, and environmentIntensity goes to zero
// with them — everything here is lit by that one sun plus flat ambient, which
// is the right look for low-poly anyway.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tween, delay, rand, pick } from '../core/anim';
import { dimLights, flashPulse, disposeObject } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'cloudsTunnel';
export const duration = 26000;

// ---------------------------------------------------------------- palette
const C = {
	grass: 0x6cc24a,
	grassLo: 0x4e9e38,
	grassHi: 0x9ade63,
	trunk: 0x8a5a3b,
	leafA: 0x3f9d4e,
	leafB: 0x5cbb5e,
	leafC: 0x7fd06a,
	stone: 0xf2e4d4,
	stoneShade: 0xdcc9b4,
	roofA: 0xd45a8e,
	roofB: 0x6f7fe0,
	roofC: 0x51c4d3,
	gold: 0xf2c14e,
	goldDeep: 0xc9922c,
	robe: 0x5b48b8,
	robeTrim: 0xf2c14e,
	skin: 0xf6cdaa,
	beard: 0xf4f1ea,
	cloud: 0xfffdf7
} as const;

// ---------------------------------------------------------------- sky
// A dome rather than scene.background: it belongs to the kingdom, so it travels
// with it and we never touch the shared scene state.
const SKY_VERT = /* glsl */ `
	varying vec3 vPos;
	void main() {
		vPos = position;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
	}
`;

const SKY_FRAG = /* glsl */ `
	uniform vec3 uHigh;
	uniform vec3 uMid;
	uniform vec3 uLow;
	uniform float uOpacity;
	varying vec3 vPos;
	void main() {
		float h = clamp(normalize(vPos).y * 0.5 + 0.5, 0.0, 1.0);
		vec3 col = mix(uLow, uMid, smoothstep(0.35, 0.56, h));
		col = mix(col, uHigh, smoothstep(0.54, 0.92, h));
		// sRGB constants into a linear buffer come back pale; linearise here
		gl_FragColor = vec4(pow(col, vec3(2.2)), uOpacity);
	}
`;

/** Flat-shaded matte material — the whole kingdom is built out of these. */
function toon(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) {
	return new THREE.MeshStandardMaterial({
		color,
		roughness: 0.94,
		metalness: 0,
		flatShading: true,
		...extra
	});
}

/** Rolling hills, as a height function shared by the ground and everything
 *  standing on it — trees have to know where the ground is. */
function groundHeight(x: number, z: number): number {
	const plateau = Math.max(0, 1 - Math.hypot(x, z + 84) / 26); // the castle sits up high
	return (
		Math.sin(x * 0.075) * 2.1 +
		Math.cos(z * 0.062) * 2.4 +
		Math.sin((x + z) * 0.045) * 1.7 +
		Math.sin(x * 0.21 + 1.3) * 0.5 +
		plateau * plateau * 7.5
	);
}

/** The ground: one big plane, displaced, then split into loose triangles so
 *  each facet takes a single colour. That faceting IS the low-poly look — a
 *  smooth-shaded hill just reads as a beanbag. */
function buildGround(): THREE.Mesh {
	const geo = new THREE.PlaneGeometry(520, 520, 64, 64).toNonIndexed();
	geo.rotateX(-Math.PI / 2);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
	}
	const colours = new Float32Array(pos.count * 3);
	const lo = new THREE.Color(C.grassLo);
	const mid = new THREE.Color(C.grass);
	const hi = new THREE.Color(C.grassHi);
	const c = new THREE.Color();
	for (let f = 0; f < pos.count; f += 3) {
		const h = (pos.getY(f) + pos.getY(f + 1) + pos.getY(f + 2)) / 3;
		const k = THREE.MathUtils.clamp((h + 4) / 12, 0, 1);
		c.copy(lo).lerp(mid, Math.min(1, k * 2)).lerp(hi, Math.max(0, k * 2 - 1));
		// a little per-facet variation so the hills don't band
		c.offsetHSL(0, 0, (((f * 37) % 13) - 6) * 0.004);
		for (let v = 0; v < 3; v++) {
			colours[(f + v) * 3] = c.r;
			colours[(f + v) * 3 + 1] = c.g;
			colours[(f + v) * 3 + 2] = c.b;
		}
	}
	geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
	geo.computeVertexNormals();
	return new THREE.Mesh(geo, toon(0xffffff, { vertexColors: true }));
}

/** A storybook tree: a leaning trunk and two or three stacked canopies. */
function buildTree(scale: number): THREE.Group {
	const g = new THREE.Group();
	const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 1.5, 6), toon(C.trunk));
	trunk.position.y = 0.75;
	g.add(trunk);
	const tiers = 2 + Math.floor(rand(0, 2));
	const leaf = [C.leafA, C.leafB, C.leafC];
	for (let i = 0; i < tiers; i++) {
		const r = 1.35 - i * 0.34;
		const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 1.5 - i * 0.18, 7), toon(leaf[i % 3]));
		cone.position.y = 1.5 + i * 0.85;
		cone.rotation.y = rand(0, 6.28);
		g.add(cone);
	}
	g.scale.setScalar(scale);
	g.rotation.z = rand(-0.05, 0.05);
	return g;
}

/** Toadstool. Non-negotiable in a kingdom this size. */
function buildToadstool(scale: number): THREE.Group {
	const g = new THREE.Group();
	const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.24, 0.9, 7), toon(0xfdf6e4));
	stalk.position.y = 0.45;
	g.add(stalk);
	const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52), toon(0xe0483f));
	cap.position.y = 0.9;
	cap.scale.set(1, 0.78, 1);
	g.add(cap);
	for (let i = 0; i < 5; i++) {
		const a = (i / 5) * Math.PI * 2 + rand(0, 1);
		const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5), toon(0xfffaf0));
		spot.position.set(Math.cos(a) * 0.36, 1.02 + rand(-0.04, 0.06), Math.sin(a) * 0.36);
		spot.scale.set(1, 0.4, 1);
		g.add(spot);
	}
	g.scale.setScalar(scale);
	return g;
}

/** Cloud: a huddle of lumps. Low-poly clouds should look built, not fluffy. */
function buildCloud(): THREE.Group {
	const g = new THREE.Group();
	const mat = toon(C.cloud, { emissive: 0x30343c, emissiveIntensity: 0.3 });
	const n = 4 + Math.floor(rand(0, 3));
	for (let i = 0; i < n; i++) {
		const lump = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(1.6, 3.1), 0), mat);
		lump.position.set(rand(-3.4, 3.4), rand(-0.5, 0.5), rand(-1.6, 1.6));
		lump.scale.set(1, rand(0.55, 0.8), 1);
		lump.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
		g.add(lump);
	}
	return g;
}

/** One tower: shaft, crown of crenellations, conical roof, finial and pennant. */
function buildTower(radius: number, height: number, roof: number, flag = true, roofed = true): THREE.Group {
	const g = new THREE.Group();
	const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, height, 9), toon(C.stone));
	shaft.position.y = height / 2;
	g.add(shaft);
	// a band of darker stone so the tower has a waist
	const band = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.06, radius * 1.06, 0.5, 9), toon(C.stoneShade));
	band.position.y = height * 0.55;
	g.add(band);
	const rim = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.15, radius * 1.15, 0.4, 9), toon(C.stoneShade));
	rim.position.y = height;
	g.add(rim);
	if (roofed) {
		const cone = new THREE.Mesh(new THREE.ConeGeometry(radius * 1.24, height * 0.62, 9), toon(roof));
		cone.position.y = height + height * 0.31 + 0.2;
		g.add(cone);
		const finial = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.2, 8, 6), toon(C.gold, { emissive: 0x3a2a06, emissiveIntensity: 0.6 }));
		finial.position.y = height + height * 0.62 + 0.3;
		g.add(finial);
	}
	if (flag && roofed) {
		const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 5), toon(0x9a8f7a));
		pole.position.y = height + height * 0.62 + 1.0;
		g.add(pole);
		const pennant = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.5), toon(pick([C.roofA, C.roofC, C.gold]), { side: THREE.DoubleSide }));
		pennant.position.set(0.6, height + height * 0.62 + 1.45, 0);
		pennant.userData.flag = true;
		g.add(pennant);
	}
	// windows, some of them lit
	for (let i = 0; i < 4; i++) {
		const a = rand(0, 6.28);
		const lit = Math.random() < 0.55;
		const win = new THREE.Mesh(
			new THREE.BoxGeometry(0.42, 0.62, 0.12),
			toon(lit ? 0xffd98a : 0x4a3f52, lit ? { emissive: 0xffb347, emissiveIntensity: 1.5 } : {})
		);
		const y = 1.6 + (i / 4) * (height - 2.6);
		win.position.set(Math.cos(a) * radius * 0.99, y, Math.sin(a) * radius * 0.99);
		win.rotation.y = -a + Math.PI / 2;
		g.add(win);
	}
	return g;
}

/** The castle: a keep, a curtain wall, a scatter of towers, and one tower at
 *  the front with a balcony, because that is where the king has to stand. */
function buildCastle(): { castle: THREE.Group; balcony: THREE.Vector3; pennants: THREE.Mesh[] } {
	const castle = new THREE.Group();

	// the mound it stands on — without it the castle floats over the hill, since
	// the plateau underneath is a smooth function and the walls are not
	const plinth = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 20, 9, 12), toon(C.grass));
	plinth.position.y = -4.4;
	castle.add(plinth);
	const rock = new THREE.Mesh(new THREE.CylinderGeometry(20, 25, 6, 12), toon(0x8f9a6a));
	rock.position.y = -10;
	castle.add(rock);

	// curtain wall
	const wall = new THREE.Mesh(new THREE.CylinderGeometry(11, 11.6, 5.5, 10, 1, true), toon(C.stone, { side: THREE.DoubleSide }));
	wall.position.y = 2.75;
	castle.add(wall);
	for (let i = 0; i < 30; i++) {
		const a = (i / 30) * Math.PI * 2;
		const merlon = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.1, 0.9), toon(C.stoneShade));
		merlon.position.set(Math.cos(a) * 11.1, 5.9, Math.sin(a) * 11.1);
		merlon.rotation.y = -a;
		castle.add(merlon);
	}

	// the keep
	const keep = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.1, 13, 10), toon(C.stone));
	keep.position.y = 6.5;
	castle.add(keep);
	const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(5.8, 7.5, 10), toon(C.roofB));
	keepRoof.position.y = 16.6;
	castle.add(keepRoof);
	const keepBall = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), toon(C.gold, { emissive: 0x3a2a06, emissiveIntensity: 0.7 }));
	keepBall.position.y = 20.7;
	castle.add(keepBall);

	// the gate, facing the way we arrive (+z)
	const gate = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.6, 1.2), toon(0x8a5a3b));
	gate.position.set(0, 2.3, 11.2);
	castle.add(gate);
	const arch = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 1.2, 10, 1, false, 0, Math.PI), toon(0x8a5a3b));
	arch.position.set(0, 4.6, 11.2);
	arch.rotation.set(Math.PI / 2, 0, 0);
	castle.add(arch);

	const pennants: THREE.Mesh[] = [];
	const towers: [number, number, number, number, number][] = [
		// x, z, radius, height, roof colour
		[-9.5, 5.5, 2.1, 12, C.roofA],
		[9.5, 5.5, 2.1, 12, C.roofC],
		[-8.5, -8.0, 2.4, 15, C.roofB],
		[8.5, -8.0, 2.4, 15, C.roofA],
		[0, -12.0, 1.9, 10, C.roofC]
	];
	for (const [x, z, r, h, roof] of towers) {
		const t = buildTower(r, h, roof);
		t.position.set(x, 0, z);
		castle.add(t);
	}

	// the hero tower, out front, with the balcony
	const heroX = 3.4;
	const heroZ = 12.6;
	const hero = buildTower(2.6, 13.5, C.roofA, false, false);
	hero.position.set(heroX, 0, heroZ);
	castle.add(hero);
	const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.1, 3.6, 0.7, 12), toon(C.stoneShade));
	deck.position.set(heroX, 13.6, heroZ);
	castle.add(deck);
	const rug = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.08, 12), toon(0xb8324f));
	rug.position.set(heroX, 13.98, heroZ);
	castle.add(rug);
	const rugTrim = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.09, 6, 24), toon(C.gold, { emissive: 0x2e2205, emissiveIntensity: 0.5 }));
	rugTrim.position.set(heroX, 13.99, heroZ);
	rugTrim.rotation.x = Math.PI / 2;
	castle.add(rugTrim);

	const rail = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 4.0, 1.3, 12, 1, true), toon(C.stone, { side: THREE.DoubleSide }));
	rail.position.set(heroX, 14.5, heroZ);
	castle.add(rail);
	for (let i = 0; i < 12; i++) {
		const a = ((i + 0.5) / 12) * Math.PI * 2;
		const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.36, 0.36), toon(C.gold, { emissive: 0x2e2205, emissiveIntensity: 0.5 }));
		cap.position.set(heroX + Math.cos(a) * 4.0, 15.1, heroZ + Math.sin(a) * 4.0);
		cap.rotation.y = -a;
		castle.add(cap);
	}

	castle.traverse((o) => {
		const m = o as THREE.Mesh;
		if (m.userData.flag) pennants.push(m);
	});

	return { castle, balcony: new THREE.Vector3(heroX, 13.95, heroZ), pennants };
}

/** A fairy: a bell of a dress, a round head, and four wings that beat. */
function buildFairy(tint: number): { group: THREE.Group; wings: THREE.Mesh[] } {
	const g = new THREE.Group();
	const dress = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 7), toon(tint));
	dress.position.y = 0.2;
	g.add(dress);
	const head = new THREE.Mesh(new THREE.SphereGeometry(0.135, 10, 8), toon(C.skin));
	head.position.y = 0.5;
	g.add(head);
	const hair = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), toon(pick([0xffe0a0, 0xd06a3a, 0x5a3b2a, 0xffb3d1])));
	hair.position.y = 0.52;
	g.add(hair);
	for (const s of [-1, 1]) {
		const eye = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), toon(0x241a12, { emissive: 0x000000 }));
		eye.position.set(s * 0.05, 0.51, 0.115);
		g.add(eye);
	}
	const wings: THREE.Mesh[] = [];
	const wingMat = new THREE.MeshBasicMaterial({
		color: 0xbfe4ff,
		transparent: true,
		opacity: 0.62,
		side: THREE.DoubleSide,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});
	for (const s of [-1, 1]) {
		for (const [ly, lz, sc] of [[0.46, 0.0, 1], [0.31, 0.0, 0.74]] as const) {
			const w = new THREE.Mesh(new THREE.CircleGeometry(0.38 * sc, 9), wingMat);
			w.position.set(s * 0.07, ly, lz - 0.08);
			w.scale.set(0.6, 1.15, 1);
			w.userData.side = s;
			g.add(w);
			wings.push(w);
		}
	}
	return { group: g, wings };
}

/** A golden cup with your luck in it. */
function buildTrophy(): THREE.Group {
	const g = new THREE.Group();
	const goldMat = toon(C.gold, { metalness: 0.65, roughness: 0.28, flatShading: false, emissive: 0x4a3608, emissiveIntensity: 0.5 });
	const profile: THREE.Vector2[] = [
		new THREE.Vector2(0.001, 0),
		new THREE.Vector2(0.17, 0),
		new THREE.Vector2(0.17, 0.05),
		new THREE.Vector2(0.06, 0.09),
		new THREE.Vector2(0.05, 0.26),
		new THREE.Vector2(0.1, 0.3),
		new THREE.Vector2(0.22, 0.4),
		new THREE.Vector2(0.24, 0.62),
		new THREE.Vector2(0.21, 0.62),
		new THREE.Vector2(0.19, 0.42),
		new THREE.Vector2(0.001, 0.34)
	];
	const cup = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), goldMat);
	g.add(cup);
	for (const s of [-1, 1]) {
		const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 14, Math.PI * 1.1), goldMat);
		handle.position.set(s * 0.24, 0.5, 0);
		handle.rotation.set(Math.PI / 2, 0, s * -0.4);
		g.add(handle);
	}
	return g;
}

/** The king. Big head, small body, enormous beard — the Ben-and-Holly rule. */
function buildKing(): {
	king: THREE.Group;
	armR: THREE.Group;
	head: THREE.Group;
	brows: THREE.Mesh[];
} {
	const king = new THREE.Group();
	const robeMat = toon(C.robe);
	const skinMat = toon(C.skin);
	const beardMat = toon(C.beard);
	const goldMat = toon(C.gold, { emissive: 0x3a2a06, emissiveIntensity: 0.5 });

	const robe = new THREE.Mesh(new THREE.ConeGeometry(0.62, 1.5, 10), robeMat);
	robe.position.y = 0.75;
	king.add(robe);
	const hem = new THREE.Mesh(new THREE.CylinderGeometry(0.63, 0.63, 0.16, 10), toon(C.robeTrim, { emissive: 0x3a2a06, emissiveIntensity: 0.4 }));
	hem.position.y = 0.1;
	king.add(hem);
	// an ermine sash, because he is that kind of king
	const sash = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.15, 0.62), toon(0xfaf6ef));
	sash.position.set(-0.12, 0.86, 0.14);
	sash.rotation.z = 0.16;
	king.add(sash);

	const head = new THREE.Group();
	head.position.y = 1.72;
	const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), skinMat);
	skull.scale.set(1, 0.96, 0.94);
	head.add(skull);
	const nose = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), skinMat);
	nose.position.set(0, -0.02, 0.4);
	head.add(nose);
	// big cartoon eyes: white ball, dark pupil in front of it
	const brows: THREE.Mesh[] = [];
	for (const s of [-1, 1]) {
		const white = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), toon(0xffffff));
		white.position.set(s * 0.16, 0.09, 0.33);
		white.scale.set(1, 1.12, 0.6);
		head.add(white);
		const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), toon(0x2a2118));
		pupil.position.set(s * 0.16, 0.08, 0.4);
		pupil.scale.set(1, 1.1, 0.5);
		head.add(pupil);
		const brow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 0.09), beardMat);
		brow.position.set(s * 0.17, 0.235, 0.36);
		brow.rotation.z = s * -0.22;
		head.add(brow);
		brows.push(brow);
	}
	// the beard: a broad cone hanging off the chin, plus a moustache
	const beard = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.95, 9), beardMat);
	beard.position.set(0, -0.52, 0.12);
	beard.rotation.x = 0.1;
	head.add(beard);
	const jowl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 9, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), beardMat);
	jowl.position.set(0, -0.08, 0.1);
	jowl.scale.set(1.05, 1, 1.05);
	head.add(jowl);
	for (const s of [-1, 1]) {
		const tache = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), beardMat);
		tache.position.set(s * 0.11, -0.13, 0.36);
		tache.scale.set(1.1, 0.7, 0.8);
		head.add(tache);
	}
	// crown
	const bandCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.19, 10), goldMat);
	bandCrown.position.y = 0.42;
	head.add(bandCrown);
	for (let i = 0; i < 7; i++) {
		const a = (i / 7) * Math.PI * 2;
		const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 5), goldMat);
		spike.position.set(Math.cos(a) * 0.36, 0.62, Math.sin(a) * 0.36);
		head.add(spike);
		const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.055, 0), toon(pick([0xe0483f, 0x51c4d3, 0x6f7fe0]), { emissive: 0x221100, emissiveIntensity: 0.5 }));
		gem.position.set(Math.cos(a) * 0.36, 0.78, Math.sin(a) * 0.36);
		head.add(gem);
	}
	king.add(head);

	// arms — the right one is a group so it can be raised from the shoulder
	const armR = new THREE.Group();
	armR.position.set(0.42, 1.25, 0.05);
	const upperR = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), robeMat);
	upperR.position.y = -0.24;
	armR.add(upperR);
	const handR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
	handR.position.y = -0.52;
	armR.add(handR);
	king.add(armR);

	const armL = new THREE.Group();
	armL.position.set(-0.42, 1.25, 0.05);
	const upperL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.42, 4, 8), robeMat);
	upperL.position.y = -0.24;
	armL.add(upperL);
	const handL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
	handL.position.y = -0.52;
	armL.add(handL);
	armL.rotation.z = -0.22;
	king.add(armL);

	return { king, armR, head, brows };
}

/** Fairy dust. One shared point cloud for every trail in the kingdom, living
 *  INSIDE the kingdom group — the shared Particles system emits into world
 *  space, which would strand every mote the moment the camera moves. */
class Dust {
	points: THREE.Points;
	private pos: Float32Array;
	private col: Float32Array;
	private life: Float32Array;
	private maxLife: Float32Array;
	private tint: THREE.Color[];
	private next = 0;
	private cap: number;

	constructor(map: THREE.Texture, cap = 700) {
		this.cap = cap;
		this.pos = new Float32Array(cap * 3);
		this.col = new Float32Array(cap * 3);
		this.life = new Float32Array(cap);
		this.maxLife = new Float32Array(cap);
		this.tint = [];
		for (let i = 0; i < cap; i++) this.pos[i * 3 + 1] = -9999;
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
		geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
		this.points = new THREE.Points(
			geo,
			new THREE.PointsMaterial({
				map,
				size: 0.2,
				sizeAttenuation: true,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				vertexColors: true
			})
		);
		this.points.frustumCulled = false;
	}

	spawn(x: number, y: number, z: number, colour: THREE.Color, life = 0.9) {
		const i = this.next;
		this.next = (this.next + 1) % this.cap;
		this.pos[i * 3] = x;
		this.pos[i * 3 + 1] = y;
		this.pos[i * 3 + 2] = z;
		this.life[i] = life;
		this.maxLife[i] = life;
		this.tint[i] = colour;
	}

	update(dt: number) {
		for (let i = 0; i < this.cap; i++) {
			if (this.life[i] <= 0) continue;
			this.life[i] -= dt;
			const k = Math.max(0, this.life[i] / this.maxLife[i]);
			const c = this.tint[i];
			// additive, so fading the colour to black IS fading out
			this.col[i * 3] = c.r * k;
			this.col[i * 3 + 1] = c.g * k;
			this.col[i * 3 + 2] = c.b * k;
			this.pos[i * 3 + 1] -= dt * 0.35; // dust settles
			if (this.life[i] <= 0) this.pos[i * 3 + 1] = -9999;
		}
		this.points.geometry.attributes.position.needsUpdate = true;
		this.points.geometry.attributes.color.needsUpdate = true;
	}
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();
	const btnHome = machine.buttonGroup.position.clone();

	const restoreLights = dimLights(scene, 0.55, 600);
	scene.fxLight.color.set(0xbfffd8);
	scene.fxLight.position.set(0, -0.1, 1.4);

	// ================================================================ THE HOLE
	audio.sfx('clang', { pitch: 1.15, gain: 0.45 });
	await machine.openClamps(560);
	haptics.vibrate(30);
	await tween(220, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + v * 0.24;
	});
	audio.sfx('swoosh', { pitch: 0.85, gain: 0.5 });
	tween(900, 'outCubic', (v) => {
		machine.buttonGroup.position.y = btnHome.y + v * 1.15;
	});
	const opening = machine.openIris(0.78, 1100);
	machine.portal.visible = false;
	machine.setInnerGlow(0.15, 0x8fffb8);
	tween(1100, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.15 + v * 0.5, 0x8fffb8);
		scene.fxLight.intensity = v * 3;
	});

	// something green and alive on the other side of it
	const portalMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xa8ffcf,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const portal = new THREE.Sprite(portalMat);
	portal.position.set(btn.x, btn.y, -0.05);
	portal.scale.setScalar(0.2);
	portal.renderOrder = 4;
	scene.scene.add(portal);
	tween(900, 'outCubic', (v) => {
		portalMat.opacity = v * 0.9;
		portal.scale.setScalar(0.2 + v * 1.5);
	});
	const escaping = particles.emitter({
		texture: sprites.star4,
		count: 200,
		emitRate: 55,
		origin: new THREE.Vector3(btn.x, btn.y, 0.2),
		originSpread: 0.35,
		direction: new THREE.Vector3(0, 0.35, 1),
		cone: 0.6,
		speed: [0.5, 1.8],
		gravity: new THREE.Vector3(0, 0.4, 0),
		life: [0.9, 2],
		size: [0.03, 0.1],
		colors: [0xbfffd8, 0xfff3cf, 0xa8e0ff, 0xffd6f0],
		fadeIn: 0.1
	});
	await opening;
	audio.sfxLoop('wooWoo');

	// ================================================================ THE KINGDOM
	const world = new THREE.Group();
	world.matrixAutoUpdate = false; // we drive its matrix directly, every frame
	world.visible = false;
	scene.scene.add(world);

	const sky = new THREE.Mesh(
		new THREE.SphereGeometry(420, 24, 16),
		new THREE.ShaderMaterial({
			uniforms: {
				uHigh: { value: new THREE.Color(0x4fa8ef) },
				uMid: { value: new THREE.Color(0xa8dcff) },
				uLow: { value: new THREE.Color(0xffe6c4) },
				uOpacity: { value: 1 }
			},
			vertexShader: SKY_VERT,
			fragmentShader: SKY_FRAG,
			side: THREE.BackSide,
			depthWrite: false
		})
	);
	world.add(sky);

	// the kingdom's own sun. Its TARGET has to live in here too, or the light
	// direction is measured against a point that swims about in world space.
	const sunTarget = new THREE.Object3D();
	sunTarget.position.set(0, 0, -40);
	world.add(sunTarget);
	const sun = new THREE.DirectionalLight(0xfff4dc, 2.6);
	sun.position.set(30, 46, 22);
	sun.target = sunTarget;
	world.add(sun);
	const fill = new THREE.HemisphereLight(0xcfe8ff, 0x5a7a3a, 1.15);
	world.add(fill);

	world.add(buildGround());

	// Trees, toadstools and clouds are static scenery, and built naively they
	// were ~600 draw calls on their own — far too many for the phone this is
	// really for. Bake each one into a bucket keyed by colour and merge, which
	// gets the whole scatter down to a handful of meshes.
	const buckets = new Map<number, THREE.BufferGeometry[]>();
	const bake = (prop: THREE.Object3D) => {
		prop.updateMatrixWorld(true);
		prop.traverse((o) => {
			const m = o as THREE.Mesh;
			if (!(m as unknown as { isMesh?: boolean }).isMesh) return;
			const g = m.geometry.clone();
			g.applyMatrix4(m.matrixWorld);
			const key = (m.material as THREE.MeshStandardMaterial).color.getHex();
			const bucket = buckets.get(key);
			if (bucket) bucket.push(g);
			else buckets.set(key, [g]);
		});
	};

	for (let i = 0; i < 130; i++) {
		const x = rand(-95, 95);
		const z = rand(30, -140);
		const nearPath = Math.abs(x) < 9 && z > -70;
		if (nearPath && Math.random() < 0.8) continue;
		if (Math.hypot(x, z + 84) < 15) continue; // keep the castle plateau clear
		const thing = Math.random() < 0.76 ? buildTree(rand(0.85, 1.9)) : buildToadstool(rand(0.9, 1.9));
		thing.position.set(x, groundHeight(x, z) - 0.1, z);
		thing.rotation.y = rand(0, 6.28);
		bake(thing);
	}
	for (let i = 0; i < 16; i++) {
		const cloud = buildCloud();
		cloud.position.set(rand(-90, 90), rand(31, 48), rand(20, -150));
		cloud.rotation.y = rand(0, 6.28);
		bake(cloud);
	}
	for (const [hex, geos] of buckets) {
		const merged = mergeGeometries(geos, false);
		for (const g of geos) g.dispose();
		if (!merged) continue;
		const isCloud = hex === C.cloud;
		world.add(new THREE.Mesh(merged, toon(hex, isCloud ? { emissive: 0x30343c, emissiveIntensity: 0.3 } : {})));
	}

	const { castle, balcony, pennants } = buildCastle();
	castle.position.set(0, groundHeight(0, -84) - 1.5, -84);
	world.add(castle);

	// ---- the king, on his balcony, facing the way we come in
	const { king, armR, head, brows } = buildKing();
	const kingPos = balcony.clone().add(castle.position);
	king.position.copy(kingPos);
	king.scale.setScalar(1.15);
	king.rotation.y = 0; // built facing +z, which is the way we arrive from
	world.add(king);
	const trophy = buildTrophy();
	trophy.scale.setScalar(1.5);
	armR.add(trophy);
	trophy.position.set(0, -0.72, 0.1);
	trophy.rotation.x = 0.2;

	// a little glow living in the cup
	const cupGlowMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xfff0b8,
		transparent: true,
		opacity: 0.85,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const cupGlow = new THREE.Sprite(cupGlowMat);
	cupGlow.scale.setScalar(0.7);
	cupGlow.position.set(0, 0.62, 0);
	trophy.add(cupGlow);

	// ---- fairies
	const dust = new Dust(sprites.softDot);
	world.add(dust.points);
	const fairyTints = [0xffd6f0, 0xbfffd8, 0xfff3cf, 0xc8d8ff, 0xffc9a8];
	const fairies: {
		group: THREE.Group;
		wings: THREE.Mesh[];
		home: THREE.Vector3;
		phase: number;
		radius: number;
		speed: number;
		colour: THREE.Color;
		emit: number;
	}[] = [];
	for (let i = 0; i < 9; i++) {
		const tint = fairyTints[i % fairyTints.length];
		const { group, wings } = buildFairy(tint);
		const t = i / 9;
		const home = new THREE.Vector3(
			rand(-9, 9),
			0,
			THREE.MathUtils.lerp(4, -70, t) + rand(-6, 6)
		);
		home.y = groundHeight(home.x, home.z) + rand(2.5, 6.5);
		group.position.copy(home);
		group.scale.setScalar(rand(1.5, 2.4));
		world.add(group);
		fairies.push({
			group,
			wings,
			home,
			phase: rand(0, 6.28),
			radius: rand(1.4, 3.4),
			speed: rand(0.5, 1.1),
			colour: new THREE.Color(tint),
			emit: 0
		});
	}
	// three more circling the king, as an honour guard
	for (let i = 0; i < 3; i++) {
		const tint = fairyTints[(i + 2) % fairyTints.length];
		const { group, wings } = buildFairy(tint);
		const home = kingPos.clone().add(new THREE.Vector3((i - 1) * 2.35 + rand(-0.3, 0.3), rand(1.5, 2.7), rand(-0.9, 0.6)));
		group.position.copy(home);
		group.scale.setScalar(rand(0.9, 1.25));
		world.add(group);
		fairies.push({
			group,
			wings,
			home,
			phase: rand(0, 6.28),
			radius: rand(0.45, 0.85),
			speed: rand(1.1, 1.7),
			colour: new THREE.Color(tint),
			emit: 0
		});
	}

	// ================================================================ THE FLIGHT
	// Built from the king's ACTUAL position, not from guessed numbers: the castle
	// sits on a plateau whose height comes out of groundHeight(), so hard-coding
	// the arrival left the camera eight units under the balcony staring up at
	// the masonry.
	const arrive = kingPos.clone().add(new THREE.Vector3(0.5, 1.95, 5.4));
	const PATH = new THREE.CatmullRomCurve3(
		[
			new THREE.Vector3(0, 4.2, 16),
			new THREE.Vector3(2.2, 5.4, 2),
			new THREE.Vector3(-3.6, 7.0, -16),
			new THREE.Vector3(2.8, 9.0, -34),
			new THREE.Vector3(-2.2, 13.0, -48),
			new THREE.Vector3(2.0, arrive.y * 0.82, -58),
			arrive.clone().add(new THREE.Vector3(-0.4, 0.6, 5.5)),
			arrive
		],
		false,
		'catmullrom',
		0.3
	);

	const vcam = new THREE.PerspectiveCamera(); // never renders; we only want its matrix
	const eye = new THREE.Vector3();
	const look = new THREE.Vector3();
	const inv = new THREE.Matrix4();
	let travel = 0; // 0..1 along the path
	let gaze = 0; // 0 = look along the path, 1 = look at the king
	let bank = 0;
	let sway = 1; // handheld sway, killed during the presentation
	let shakeAmt = 0;

	const kingLook = kingPos.clone().add(new THREE.Vector3(0, 1.15, 0));

	const flyCamera = (t: number) => {
		PATH.getPointAt(THREE.MathUtils.clamp(t, 0, 1), eye);
		PATH.getPointAt(THREE.MathUtils.clamp(t + 0.035, 0, 1), look);
		if (gaze > 0) look.lerp(kingLook, gaze);
		// a gentle bank into whichever way the path is turning
		const ahead = PATH.getPointAt(THREE.MathUtils.clamp(t + 0.02, 0, 1));
		const behind = PATH.getPointAt(THREE.MathUtils.clamp(t - 0.02, 0, 1));
		bank += ((behind.x - ahead.x) * 0.12 - bank) * 0.06;
	};

	const stopSim = scene.addUpdatable((dt, time) => {
		// ---- flight
		flyCamera(travel);
		vcam.position.copy(eye);
		if (sway > 0) {
			vcam.position.x += Math.sin(time * 0.7) * 0.22 * sway;
			vcam.position.y += Math.sin(time * 0.53 + 1.1) * 0.16 * sway;
		}
		if (shakeAmt > 0) {
			vcam.position.x += (Math.random() - 0.5) * shakeAmt;
			vcam.position.y += (Math.random() - 0.5) * shakeAmt;
		}
		vcam.up.set(0, 1, 0);
		vcam.lookAt(look);
		vcam.rotateZ(bank);
		vcam.updateMatrixWorld(true);

		// world.matrix = realCamera.matrixWorld · vcam.matrixWorld⁻¹
		scene.camera.updateWorldMatrix(true, false);
		inv.copy(vcam.matrixWorld).invert();
		world.matrix.multiplyMatrices(scene.camera.matrixWorld, inv);
		world.matrixWorldNeedsUpdate = true;

		// ---- fairies
		for (const f of fairies) {
			f.phase += dt * f.speed;
			f.group.position.set(
				f.home.x + Math.cos(f.phase) * f.radius,
				f.home.y + Math.sin(f.phase * 1.7) * 0.7,
				f.home.z + Math.sin(f.phase) * f.radius * 0.7
			);
			f.group.rotation.y = -f.phase + Math.PI / 2;
			f.group.rotation.z = Math.sin(f.phase * 2.1) * 0.16;
			const beat = Math.sin(time * 34 + f.phase) * 0.7;
			for (const w of f.wings) w.rotation.y = (w.userData.side as number) * (0.5 + beat);
			f.emit -= dt;
			if (f.emit <= 0) {
				f.emit = 0.022;
				dust.spawn(
					f.group.position.x + rand(-0.08, 0.08),
					f.group.position.y + rand(-0.05, 0.1),
					f.group.position.z + rand(-0.08, 0.08),
					f.colour,
					rand(0.6, 1.2)
				);
			}
		}
		dust.update(dt);

		// ---- set dressing
		for (const p of pennants) p.rotation.y = Math.sin(time * 3 + p.position.x) * 0.4;
		cupGlow.scale.setScalar(0.62 + Math.sin(time * 3.4) * 0.09);
	});

	// ---- the dive: the portal swells until it owns the screen, and we cut
	await delay(280);
	audio.sfx('swoosh', { pitch: 0.6, gain: 0.7 });
	haptics.vibrate([25, 30, 90]);
	const rigZ0 = scene.rig.position.z;
	const fov0 = scene.camera.fov;
	// The scene runs a 200-unit far plane, which is fine for a machine 5 units
	// away and useless for a kingdom: it was clipping the sky dome entirely
	// (hence a black sky) and slicing the horizon off the hills.
	const far0 = scene.camera.far;
	scene.camera.far = 1400;
	scene.camera.updateProjectionMatrix();
	// AWAIT the dive rather than racing it: cutting away 60ms early left this
	// tween running past the restore below, which re-applied the push-in and
	// left the machine framed at double size for the rest of the effect.
	await tween(760, 'inQuad', (v) => {
		scene.rig.position.z = rigZ0 - v * 3.4;
		scene.camera.fov = fov0 + v * 20;
		scene.camera.updateProjectionMatrix();
		portalMat.opacity = 0.9 + v * 0.1;
		portal.scale.setScalar(1.7 + v * v * 22);
	});

	// the cut, hidden inside the whiteout
	escaping.stop();
	machine.group.visible = false;
	world.visible = true;
	scene.scene.fog = new THREE.Fog(0xe8dcc0, 110, 330);
	const envIntensity0 = scene.scene.environmentIntensity;
	scene.scene.environmentIntensity = 0; // world-space reflections would swim
	const keep0 = scene.keyLight.intensity;
	const fill0 = scene.fillLight.intensity;
	const rim0 = scene.rimLight.intensity;
	scene.keyLight.intensity = 0;
	scene.fillLight.intensity = 0;
	scene.rimLight.intensity = 0;
	scene.rig.position.z = rigZ0;
	scene.camera.fov = fov0;
	scene.camera.updateProjectionMatrix();
	audio.stopAllLoops(200);
	audio.sfx('chime', { pitch: 1.3, gain: 0.6 });

	await tween(700, 'outCubic', (v) => {
		portalMat.opacity = 1 - v;
		portal.scale.setScalar(23 * (1 - v * 0.35));
	});
	portal.visible = false;

	// ---- over the hills
	audio.sfx('chime', { pitch: 0.9, gain: 0.35 });
	tween(5200, 'inOutQuad', (v) => (travel = v * 0.42));
	await delay(1700);
	audio.sfx('ding', { pitch: 1.8, gain: 0.22 });
	await delay(1900);
	audio.sfx('ding', { pitch: 2.1, gain: 0.2 });
	await delay(1600);

	// ---- the castle, and up to the turret
	audio.sfx('swoosh', { pitch: 1.1, gain: 0.4 });
	tween(4600, 'inOutCubic', (v) => {
		travel = 0.42 + v * 0.58;
		gaze = Math.max(0, (v - 0.55) / 0.45); // start turning to the king near the end
		sway = 1 - v * 0.75;
	});
	await delay(3000);
	audio.sfx('chime', { pitch: 0.75, gain: 0.5 });
	await delay(1700);

	// ================================================================ THE KING
	sway = 0.12;
	audio.sfx('gong', { pitch: 1.05, gain: 0.5 });
	// he bows
	await tween(900, 'inOutQuad', (v) => {
		const b = Math.sin(v * Math.PI);
		king.rotation.x = b * 0.22;
		head.rotation.x = b * 0.2;
	});
	// and raises the cup
	audio.sfx('swoosh', { pitch: 1.5, gain: 0.35 });
	await tween(1000, 'outBack', (v) => {
		armR.rotation.z = v * 2.05;
		armR.rotation.x = -v * 0.25;
		// the cup rides the arm, so without this it ends up pouring sideways
		trophy.rotation.z = -v * 2.05;
		trophy.rotation.x = 0.2 - v * 0.12;
		for (const b of brows) b.position.y = 0.235 + v * 0.045;
	});
	audio.sfx('chime', { pitch: 1.15, gain: 0.6 });
	haptics.vibrate([20, 40, 70]);
	// the cup catches light
	tween(900, 'outCubic', (v) => {
		cupGlowMat.opacity = 0.85 + v * 0.15;
		cupGlow.scale.setScalar(0.62 + v * 1.5);
	});
	for (const f of fairies.slice(-3)) f.speed *= 2.1;
	await delay(700);

	// ---- the luck comes out of the cup and straight at you
	audio.sfx('zap', { pitch: 0.8, gain: 0.5 });
	audio.sfx('gong', { pitch: 1.2, gain: 0.7 });
	const starMat = new THREE.SpriteMaterial({
		map: sprites.star4,
		color: 0xfff2c8,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const star = new THREE.Sprite(starMat);
	const cupWorld = new THREE.Vector3();
	cupGlow.getWorldPosition(cupWorld);
	world.worldToLocal(cupWorld);
	star.position.copy(cupWorld);
	star.scale.setScalar(0.4);
	world.add(star);
	const starFrom = star.position.clone();
	await tween(1100, 'inQuad', (v) => {
		// it flies to just in front of the lens and swallows the frame
		star.position.lerpVectors(starFrom, vcam.position, v * 0.94);
		star.scale.setScalar(0.4 + v * v * 26);
		starMat.opacity = Math.min(1, v * 3);
		shakeAmt = v * 0.14;
	});
	haptics.vibrate([40, 30, 120]);
	scene.shake(0.4);
	shakeAmt = 0;

	// ================================================================ HOME AGAIN
	// the same path, backwards, four times as fast, still facing the kingdom
	audio.sfx('swoosh', { pitch: 0.5, gain: 0.75 });
	audio.sfxLoop('wooWoo');
	gaze = 0;
	sway = 0.5;
	tween(600, 'outQuad', (v) => {
		starMat.opacity = 1 - v;
		star.scale.setScalar(26 * (1 - v * 0.5));
	}).then(() => {
		world.remove(star);
		starMat.dispose();
	});
	const warp = particles.emitter({
		texture: sprites.streak,
		count: 260,
		emitRate: 150,
		origin: new THREE.Vector3(0, -0.2, 1.6),
		originSpread: 1.7,
		direction: new THREE.Vector3(0, 0, 1),
		cone: 0.25,
		speed: [7, 13],
		life: [0.25, 0.5],
		size: [0.1, 0.34],
		colors: [0xffffff, 0xbfffd8, 0xfff3cf],
		fadeIn: 0.05
	});
	await tween(2500, 'inOutCubic', (v) => (travel = 1 - v));

	// ---- back through the hole
	audio.sfx('boom', { pitch: 0.9, gain: 0.5 });
	portal.visible = true;
	portalMat.opacity = 0;
	portal.scale.setScalar(24);
	await tween(420, 'inQuad', (v) => (portalMat.opacity = v));

	world.visible = false;
	machine.group.visible = true;
	scene.scene.fog = null;
	scene.camera.far = far0;
	scene.camera.updateProjectionMatrix();
	scene.scene.environmentIntensity = envIntensity0;
	scene.keyLight.intensity = keep0;
	scene.fillLight.intensity = fill0;
	scene.rimLight.intensity = rim0;
	warp.stop();
	audio.stopAllLoops(180);
	scene.shake(0.35);
	haptics.vibrate([30, 40, 90]);

	await tween(650, 'outCubic', (v) => {
		portalMat.opacity = 1 - v;
		portal.scale.setScalar(24 - v * 22.2);
	});
	particles.burst({
		texture: sprites.star4,
		count: 90,
		origin: new THREE.Vector3(btn.x, btn.y, 0.5),
		originSpread: 0.2,
		speed: [1.4, 4],
		gravity: new THREE.Vector3(0, -2, 0),
		life: [0.7, 1.6],
		size: [0.03, 0.1],
		colors: [0xbfffd8, 0xfff3cf, 0xffd6f0]
	});
	flashPulse(machine, 0.6, 110, 700, 0xd8ffe8);

	// ---- shut the door
	stopSim();
	scene.scene.remove(world);
	disposeObject(world);
	dust.points.geometry.dispose();
	(dust.points.material as THREE.Material).dispose();

	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.65 * (1 - v));
		scene.fxLight.intensity = 3 * (1 - v);
	});
	await machine.closeIris(950);
	await tween(620, 'outBack', (v) => {
		machine.buttonGroup.position.y = btnHome.y + 1.15 * (1 - v);
	});
	audio.sfx('clack', { pitch: 0.85, gain: 0.5 });
	await tween(220, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + 0.24 * (1 - v);
	});
	machine.buttonGroup.position.copy(btnHome);
	await machine.closeClamps(520);

	await luckyWord(ctx, {
		text: 'ROYAL LUCK',
		color: 0xffe9ad,
		colorB: 0xbfffd8,
		y: -1.2,
		gather: 800,
		hold: 950,
		scatter: 520
	});

	scene.scene.remove(portal);
	portalMat.dispose();
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	await restoreLights(800);
}
