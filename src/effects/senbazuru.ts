// Effect — SENBAZURU: fold a thousand paper cranes and you get a wish. We fold
// fourteen and call it close enough. Flat washi squares drift in, fold
// themselves mid-air, and stream around the machine in a ribbon before one
// breaks formation and settles on the button.
//
// The fold is real, not a swap: the square is two triangles hinged on its
// diagonal that crease shut while the wings, neck and tail — hidden until then,
// since all of them overhang the sheet — grow out of the crease. Building the
// crane facing +Z means Object3D.lookAt() can fly it — the one orientation
// convention that never fights three.js.
//
// Two things the fold needs to be WATCHABLE, both learned the hard way: the
// flock has to hold station while it happens (nobody can follow a fold on an
// object that is already flying past), and the paper has to face the viewer —
// a square lying flat is edge-on to the camera and effectively invisible, so
// the cranes turn side-on and their sheets counter-rotate to face front.

import * as THREE from 'three';
import { tween, delay, rand, pick } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'luckySymbol';
export const duration = 10500;

const WASHI = [0xf7f2e7, 0xf2b4c4, 0xf3d68a, 0xb6d6ef, 0xd9c2ee] as const;

/** One triangle, given three corners. Flat-shaded paper needs nothing more. */
function triangle(a: number[], b: number[], c: number[]): THREE.BufferGeometry {
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
	g.computeVertexNormals();
	return g;
}

interface Crane {
	group: THREE.Group;
	wings: [THREE.Group, THREE.Group];
	body: THREE.Group;
	bird: THREE.Group;
	sheet: THREE.Group;
	halves: [THREE.Group, THREE.Group];
	sheetMat: THREE.MeshStandardMaterial;
	phase: number;
	flap: number;
	landing: boolean;
}

function buildCrane(mat: THREE.Material, sheetMat: THREE.MeshStandardMaterial): Crane {
	const group = new THREE.Group();

	// The unfolded square is two triangles hinged on its own diagonal, so the
	// fold can be a crease instead of a crossfade. They are cut diamond-wise
	// (corners on the axes) because a hinge is cheapest along a local axis; the
	// crease group is then turned 45° to stand the square back up square-on.
	const D = 0.15 * Math.SQRT2; // half-diagonal of a 0.3 square
	const sheet = new THREE.Group();
	const crease = new THREE.Group();
	crease.rotation.z = Math.PI / 4;
	sheet.add(crease);
	const halves: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
	for (let s = 0; s < 2; s++) {
		const tri =
			s === 0
				? triangle([-D, 0, 0], [D, 0, 0], [0, D, 0])
				: triangle([D, 0, 0], [-D, 0, 0], [0, -D, 0]);
		halves[s].add(new THREE.Mesh(tri, sheetMat));
		crease.add(halves[s]);
	}
	// squared up to the viewer; the caller counter-rotates it against the pose
	group.add(sheet);

	// Everything below is crane, and every piece of it is wider or longer than
	// the sheet — it stays hidden until the fold starts or it shows as shrapnel
	// sticking out of a square that is supposed to be flat paper.
	const bird = new THREE.Group();
	bird.visible = false;
	bird.scale.setScalar(0.0001);
	group.add(bird);

	// body: a four-sided keel pointing the way it flies
	const body = new THREE.Group();
	const hull = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), mat);
	hull.rotation.x = Math.PI / 2; // apex toward +Z
	body.add(hull);
	// neck and head, lifted forward
	const neck = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.24, 3), mat);
	neck.position.set(0, 0.05, 0.12);
	neck.rotation.x = Math.PI / 2 - 0.55;
	body.add(neck);
	// tail, cocked up behind
	const tail = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.2, 3), mat);
	tail.position.set(0, 0.045, -0.13);
	tail.rotation.x = -Math.PI / 2 + 0.42;
	body.add(tail);
	body.scale.set(1, 0.02, 1); // flat until folded
	bird.add(body);

	// wings, hinged on the spine so a rotation.z is a wingbeat
	const wingGeo = triangle([0, 0, 0.02], [0.4, 0.05, -0.16], [0.04, 0, -0.24]);
	const wings: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
	for (let s = 0; s < 2; s++) {
		const w = new THREE.Mesh(wingGeo, mat);
		wings[s].add(w);
		wings[s].scale.x = s === 0 ? 1 : -1;
		bird.add(wings[s]);
	}

	return { group, wings, body, bird, sheet, halves, sheetMat, phase: 0, flap: 0, landing: false };
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();

	const restore = dimLights(scene, 0.52, 900);
	scene.fxLight.color.set(0xffe6c8);
	scene.fxLight.position.set(-1.2, 1.4, 2);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.2));
	machine.setInnerGlow(0.24, 0xffe6c8);
	machine.mechSpeed = 3;

	// ---- the flock
	const N = 14;
	const mats: THREE.MeshStandardMaterial[] = [];
	const cranes: Crane[] = [];
	for (let i = 0; i < N; i++) {
		const colour = WASHI[i % WASHI.length];
		const mat = new THREE.MeshStandardMaterial({
			color: colour,
			roughness: 0.92,
			metalness: 0,
			side: THREE.DoubleSide,
			flatShading: true
		});
		const sheetMat = new THREE.MeshStandardMaterial({
			color: colour,
			roughness: 0.92,
			metalness: 0,
			side: THREE.DoubleSide,
			transparent: true,
			opacity: 1
		});
		mats.push(mat, sheetMat);
		const crane = buildCrane(mat, sheetMat);
		crane.phase = (i / N) * Math.PI * 2;
		crane.group.scale.setScalar(0.001);
		scene.scene.add(crane.group);
		cranes.push(crane);
	}

	// The orbit: an ellipse concentric with the machine, big enough that the
	// flock never crosses its silhouette — cranes used to fly straight through
	// the button, which read as a clipping bug rather than a flypast. Anything
	// that does stray inside the machine's radius is pushed towards the viewer
	// so it passes cleanly IN FRONT instead.
	const MACHINE_Y = -0.32;
	const ribbon = (a: number, out = new THREE.Vector3()) => {
		const x = Math.cos(a) * 1.78;
		const y = MACHINE_Y + Math.sin(a) * 1.18;
		const clear = Math.max(0, Math.min(1, (1.62 - Math.hypot(x, y - MACHINE_Y)) / 0.6));
		return out.set(x, y, 0.5 + Math.sin(a * 1.35) * 0.45 + clear * 1.15);
	};

	let pace = 0;
	let flying = false;
	const ahead = new THREE.Vector3();
	const stopFlight = scene.addUpdatable((dt, t) => {
		for (const c of cranes) {
			c.flap += dt * (7.5 + c.phase * 0.2);
			const beat = Math.sin(c.flap);
			// wings ride their fold pose plus the beat
			const fold = (c.group.userData.fold as number) ?? 0;
			const flutter = flying ? 0.42 : 0.16; // barely stirring while folding
			c.wings[0].rotation.z = fold * (0.5 + beat * flutter);
			c.wings[1].rotation.z = -fold * (0.5 + beat * flutter);
			if (c.landing) continue;
			if (!flying) {
				// holding station in the ring, side-on, breathing
				c.group.position.y = (c.group.userData.homeY as number) + Math.sin(t * 1.5 + c.phase) * 0.045;
				c.group.rotation.z = Math.sin(t * 1.1 + c.phase) * 0.07;
				continue;
			}
			c.phase += dt * pace;
			ribbon(c.phase, c.group.position);
			// point where it's going, one small step ahead
			c.group.lookAt(ribbon(c.phase + 0.06, ahead));
			// bank into the turn
			c.group.rotateZ(Math.sin(c.phase) * 0.28);
			c.group.position.y += Math.sin(t * 2.2 + c.phase * 3) * 0.03;
		}
	});

	// ---- the squares arrive and take their places in the ring, turned side-on
	// so their profile will read once they are cranes
	haptics.vibrate(18);
	audio.sfx('swoosh', { pitch: 1.4, gain: 0.35 });
	for (let i = 0; i < N; i++) {
		const c = cranes[i];
		ribbon(c.phase, c.group.position);
		c.group.userData.homeY = c.group.position.y;
		const side = Math.cos(c.phase) >= 0 ? 1 : -1; // face into the ring
		c.group.rotation.set(0, side * 1.25, 0);
		c.sheet.rotation.set(0, -side * 1.25, 0); // …but the paper faces front
		c.sheet.scale.setScalar(1.25); // a sheet you can actually see
		tween(620, 'outCubic', (v) => c.group.scale.setScalar(Math.max(0.001, v * 1.15)));
		await delay(46);
	}

	// ---- and now the fold, slow enough to follow, one bird at a time
	await delay(420);
	for (let i = 0; i < N; i++) {
		const c = cranes[i];
		audio.sfx('tick', { pitch: 1.7 + rand(-0.2, 0.2), gain: 0.18 });
		tween(700, 'outBack', (v) => {
			// outBack overshoots past 1; the crease may snap, scales and opacity
			// may not
			const f = Math.min(1, Math.max(0, v));
			c.group.userData.fold = v;
			// first the square hinges shut on its diagonal — both halves lift
			// towards the viewer, which is the one direction the crease reads from
			c.halves[0].rotation.x = v * 1.32;
			c.halves[1].rotation.x = -v * 1.32;
			// then the paper is drawn into the crease as the bird grows out of it
			const drawn = Math.max(0, (f - 0.42) / 0.58);
			c.halves[0].scale.set(1 - drawn * 0.42, 1 - drawn * 0.95, 1);
			c.halves[1].scale.copy(c.halves[0].scale);
			c.sheetMat.opacity = 1 - drawn * drawn;
			// the bird only breaks cover once the paper is well into the crease
			// and thinning — any earlier and a half-scale crane reads as a speck
			// of dirt on a flat square
			const grown = Math.min(1, Math.max(0, (f - 0.5) / 0.42));
			c.bird.visible = grown > 0;
			c.bird.scale.setScalar(Math.max(0.0001, grown));
			c.body.scale.set(1, 0.02 + f * 0.98, 1);
		});
		await delay(105);
	}
	for (const c of cranes) c.sheet.visible = false;

	// ---- and they're off
	await delay(260);
	audio.sfx('swoosh', { pitch: 1.15, gain: 0.4 });
	flying = true;
	tween(1500, 'outCubic', (v) => (pace = v * 1.05));

	// a scatter of paper motes in their wake
	const dust = particles.emitter({
		texture: sprites.softDot,
		count: 160,
		emitRate: 34,
		origin: new THREE.Vector3(0, 0.2, 0.5),
		originSpread: 1.9,
		speed: [0.1, 0.4],
		gravity: new THREE.Vector3(0, -0.25, 0),
		life: [1.4, 2.8],
		size: [0.012, 0.04],
		colors: [0xfff4e2, 0xf2b4c4, 0xf3d68a],
		fadeIn: 0.25
	});

	// ---- let the ribbon fly
	await delay(1500);
	audio.sfx('swoosh', { pitch: 0.9, gain: 0.35 });
	tween(1500, 'inOutQuad', (v) => (pace = 1.05 + v * 0.55));
	await delay(1400);

	// ---- one breaks formation and comes to rest on the button
	const chosen = pick(cranes);
	chosen.landing = true;
	audio.sfx('chime', { pitch: 1.25, gain: 0.4 });
	const from = chosen.group.position.clone();
	const to = new THREE.Vector3(btn.x, btn.y + 0.16, 0.95);
	await tween(1100, 'inOutQuad', (v) => {
		chosen.group.position.lerpVectors(from, to, v);
		chosen.group.position.y += Math.sin(Math.PI * v) * 0.45;
		chosen.group.rotation.set(0, Math.PI * (1 - v) * 0.6, 0); // turns to face out
		chosen.group.scale.setScalar(1 + v * 0.5);
		chosen.group.userData.fold = 1 - v * 0.45; // wings settle
	});
	chosen.flap = Math.PI / 2; // wings at rest, high

	// ---- the wish
	audio.sfx('gong', { pitch: 0.95, gain: 0.6 });
	haptics.vibrate([22, 40, 80]);
	flashPulse(machine, 0.55, 140, 700, 0xffe6c8);
	tween(900, 'outCubic', (v) => {
		machine.setInnerGlow(0.24 + v * 0.45, 0xffe6c8);
		scene.fxLight.intensity = 2.2 + v * 2.4;
	});
	particles.burst({
		texture: sprites.star4,
		count: 80,
		origin: to.clone(),
		originSpread: 0.2,
		speed: [1, 3.2],
		gravity: new THREE.Vector3(0, -1.4, 0),
		life: [0.8, 1.7],
		size: [0.03, 0.09],
		colors: [0xfff4e2, 0xf3d68a, 0xf2b4c4]
	});
	await luckyWord(ctx, {
		text: 'GRANTED',
		color: 0xf3d68a,
		colorB: 0xfff4e2,
		gather: 850,
		hold: 1000,
		scatter: 560
	});

	// ---- the flock scatters upward and the paper is gone
	dust.stop();
	tween(1200, 'inQuad', (v) => (pace = 1.6 + v * 2.2));
	await Promise.all(
		cranes.map((c, i) =>
			tween(700 + i * 30, 'inCubic', (v) => {
				c.group.scale.setScalar(Math.max(0.001, (c === chosen ? 1.5 : 1) * (1 - v)));
			})
		)
	);
	stopFlight();
	for (const c of cranes) {
		scene.scene.remove(c.group);
		c.group.traverse((o) => {
			const m = o as THREE.Mesh;
			if (m.geometry) m.geometry.dispose();
		});
	}
	for (const m of mats) m.dispose();
	machine.mechSpeed = 1;
	tween(800, 'outQuad', (v) => {
		machine.setInnerGlow(0.69 * (1 - v));
		scene.fxLight.intensity = 4.6 * (1 - v);
	});
	await restore(900);
}
