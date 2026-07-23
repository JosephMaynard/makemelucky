// Effect — JOLLY ROGER: a storm slams in and the sea rises around the machine.
// The rim sprouts helm handles and spins hard-a-starboard while a pirate ship
// crosses the horizon firing a broadside, then she roars past HUGE in the
// foreground swell. As the shanty cuts to its a-cappella outro the big red
// button slides up like a hatch and a ghost-pirate skull rises from the socket
// to sing it — "Make Me Luck, all the luck belongs to me" — before the whole
// cove erupts in doubloons, lightning and cannon salutes. For the first mate.
//
// Sound: /soundfx/pirate-shanty.mp3 (12s). Full flow 0–8s, a-cappella 8–12s —
// the reveal is timed to land exactly on that cut.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave, disposeObject } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'pirateShanty';
export const duration = 15000;

// ---- ocean: bands whose top edge rolls with layered sines (anchored bottom).
// The fragment breaks the crest into patches of foam and scatters moon-glints
// so it reads as living water, not a paper cutout.
const OCEAN_VERT = /* glsl */ `
	uniform float uTime;
	uniform float uPhase;
	varying vec2 vUv;
	void main() {
		vUv = uv;
		vec3 p = position;
		float t = uTime + uPhase;
		float w = sin(p.x * 1.6 + t * 1.0) * 0.075
			+ sin(p.x * 3.1 - t * 1.6) * 0.05
			+ sin(p.x * 5.9 + t * 2.2) * 0.024
			+ sin(p.x * 11.0 - t * 2.9) * 0.011;
		p.y += w * uv.y;
		gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
	}`;

const OCEAN_FRAG = /* glsl */ `
	uniform vec3 uDeep;
	uniform vec3 uShallow;
	uniform float uOpacity;
	uniform float uTime;
	uniform float uPhase;
	uniform float uGlint;
	varying vec2 vUv;
	void main() {
		float t = uTime + uPhase;
		vec3 c = mix(uDeep, uShallow, pow(vUv.y, 1.6));
		// slow colour swell so the surface isn't a flat gradient
		c *= 0.92 + 0.08 * sin(vUv.x * 9.0 + t * 0.7) * sin(vUv.x * 3.7 - t * 0.4);
		// broken foam: crest patches that drift and dissolve, not a solid stripe
		float crest = smoothstep(0.88, 0.985, vUv.y);
		float chop = sin(vUv.x * 23.0 + t * 1.3) * sin(vUv.x * 7.7 - t * 0.8) * 0.5 + 0.5;
		float foam = crest * smoothstep(0.35, 0.85, chop) * 0.75;
		// lace: a thinner brighter line right at the lip
		foam += smoothstep(0.975, 0.995, vUv.y) * (0.4 + 0.6 * chop);
		// moonlight glints: high-frequency sparkle, not blobs
		float g = sin(vUv.x * 140.0 + t * 2.6) * sin(vUv.x * 83.0 - t * 1.9)
			* sin(vUv.y * 26.0 + t * 1.1);
		float glint = pow(max(g, 0.0), 8.0) * uGlint * 0.5 * (0.25 + 0.75 * vUv.y);
		vec3 col = c + foam * vec3(0.62, 0.7, 0.74) + glint * vec3(0.7, 0.82, 0.9);
		gl_FragColor = vec4(col, uOpacity);
	}`;

function oceanBand(
	width: number,
	height: number,
	deep: number,
	shallow: number,
	opacity: number,
	phase: number,
	glint: number
) {
	const geo = new THREE.PlaneGeometry(width, height, 128, 1);
	const mat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uPhase: { value: phase },
			uDeep: { value: new THREE.Color(deep) },
			uShallow: { value: new THREE.Color(shallow) },
			uOpacity: { value: opacity },
			uGlint: { value: glint }
		},
		vertexShader: OCEAN_VERT,
		fragmentShader: OCEAN_FRAG,
		transparent: true,
		depthWrite: false
	});
	return new THREE.Mesh(geo, mat);
}

/** Black flag, white skull — waves at the maintop. */
function jollyRogerTexture() {
	const cv = document.createElement('canvas');
	cv.width = 160;
	cv.height = 100;
	const ctx = cv.getContext('2d')!;
	ctx.fillStyle = '#10141a';
	ctx.fillRect(0, 0, 160, 100);
	ctx.strokeStyle = 'rgba(215,225,235,0.6)';
	ctx.lineWidth = 4;
	ctx.strokeRect(3, 3, 154, 94);
	ctx.fillStyle = '#eef3f7';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.font = '68px Georgia, serif';
	ctx.fillText('☠', 80, 56);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

/** A billowed sail: plane with a wind-filled belly, normals recomputed so the
 *  moonlight models the curve. Pale canvas — dark sails vanish at night. */
function makeSail(w: number, h: number, mat: THREE.Material) {
	const geo = new THREE.PlaneGeometry(w, h, 10, 8);
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const u = pos.getX(i) / w + 0.5;
		const v = pos.getY(i) / h + 0.5;
		pos.setZ(i, Math.sin(u * Math.PI) * (0.5 + 0.5 * Math.sin(v * Math.PI)) * 0.07);
	}
	geo.computeVertexNormals();
	return new THREE.Mesh(geo, mat);
}

/** Moonlit galleon: weathered-wood hull with bevelled edges, gunwale, cannon
 *  ports, rigging lines, billowed pale sails, lanterns and the colours flying.
 *  Origin at the waterline, bow toward -x. */
function buildShip(flagTex: THREE.Texture, glowTex: THREE.Texture) {
	const ship = new THREE.Group();
	const hullMat = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.75, metalness: 0.05 });
	const trimMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.8, metalness: 0.05 });
	const sailMat = new THREE.MeshStandardMaterial({
		color: 0xc4cdd6,
		roughness: 0.9,
		metalness: 0,
		side: THREE.DoubleSide
	});

	const shape = new THREE.Shape();
	shape.moveTo(-0.66, 0.1);
	shape.quadraticCurveTo(-0.52, -0.2, -0.2, -0.24);
	shape.lineTo(0.24, -0.24);
	shape.quadraticCurveTo(0.56, -0.2, 0.62, 0.06);
	shape.lineTo(0.66, 0.22); // stern castle
	shape.lineTo(0.42, 0.22);
	shape.lineTo(0.4, 0.07);
	shape.lineTo(-0.5, 0.07);
	shape.quadraticCurveTo(-0.58, 0.16, -0.66, 0.3); // bow sweep
	shape.closePath();
	const hull = new THREE.Mesh(
		new THREE.ExtrudeGeometry(shape, {
			depth: 0.12,
			bevelEnabled: true,
			bevelThickness: 0.02,
			bevelSize: 0.02,
			bevelSegments: 2
		}),
		hullMat
	);
	hull.position.z = -0.06;
	ship.add(hull);

	// gunwale rail + keel line give the silhouette structure
	const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.022, 0.17), trimMat);
	rail.position.set(-0.04, 0.08, 0);
	ship.add(rail);
	// cannon ports along the near side
	for (let i = 0; i < 4; i++) {
		const port = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), trimMat);
		port.position.set(-0.38 + i * 0.24, -0.05, 0.085);
		ship.add(port);
	}
	// bowsprit
	const sprit = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.44, 6), trimMat);
	sprit.rotation.z = 1.1;
	sprit.position.set(-0.8, 0.26, 0);
	ship.add(sprit);

	const mastDefs = [
		{ x: -0.3, h: 0.64, sails: [[0.36, 0.22, 0.34], [0.28, 0.17, 0.56]] },
		{ x: 0.02, h: 0.84, sails: [[0.44, 0.26, 0.37], [0.34, 0.21, 0.65]] },
		{ x: 0.34, h: 0.56, sails: [[0.3, 0.19, 0.33]] }
	] as const;
	const mastTops: [number, number][] = [];
	for (const def of mastDefs) {
		const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, def.h, 6), trimMat);
		mast.position.set(def.x, 0.07 + def.h / 2, 0);
		ship.add(mast);
		mastTops.push([def.x, 0.07 + def.h]);
		for (const [w, h, y] of def.sails) {
			const sail = makeSail(w, h, sailMat);
			sail.position.set(def.x, y, 0.03);
			ship.add(sail);
			const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, w + 0.08, 5), trimMat);
			yard.rotation.z = Math.PI / 2;
			yard.position.set(def.x, y + h / 2, 0.03);
			ship.add(yard);
		}
	}
	// rigging: stays from each masthead down to bow and stern
	const rigMat = new THREE.MeshBasicMaterial({ color: 0x1a1410 });
	const rig = (x1: number, y1: number, x2: number, y2: number) => {
		const len = Math.hypot(x2 - x1, y2 - y1);
		const line = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, len, 4), rigMat);
		line.position.set((x1 + x2) / 2, (y1 + y2) / 2, 0.01);
		line.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
		ship.add(line);
	};
	rig(mastTops[0][0], mastTops[0][1], -0.72, 0.28);
	rig(mastTops[1][0], mastTops[1][1], -0.3, 0.66);
	rig(mastTops[1][0], mastTops[1][1], 0.34, 0.58);
	rig(mastTops[2][0], mastTops[2][1], 0.64, 0.22);
	rig(mastTops[0][0], mastTops[0][1] - 0.2, -0.86, 0.34); // to the sprit

	const flagGeo = new THREE.PlaneGeometry(0.34, 0.21);
	flagGeo.translate(0.17, 0, 0);
	const flag = new THREE.Mesh(
		flagGeo,
		new THREE.MeshBasicMaterial({ map: flagTex, side: THREE.DoubleSide })
	);
	flag.position.set(mastTops[1][0], mastTops[1][1] + 0.07, 0);
	ship.add(flag);

	const lanternMat = new THREE.SpriteMaterial({
		map: glowTex,
		color: 0xffb45e,
		transparent: true,
		opacity: 0.95,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	for (const [lx, ly] of [[0.62, 0.28], [0.52, 0.18], [-0.62, 0.36]] as const) {
		const lantern = new THREE.Sprite(lanternMat);
		lantern.scale.setScalar(0.11);
		lantern.position.set(lx, ly, 0.08);
		ship.add(lantern);
	}
	return { ship, flag };
}

/** The ghost pirate: bone skull with crimson bandana, gold earring and gold
 *  tooth, glowing amber eyes, and a jaw that actually sings. Returns the
 *  parts the choreography needs to puppet. */
function buildSkull(glowTex: THREE.Texture) {
	const skull = new THREE.Group(); // rises/scales
	const head = new THREE.Group(); // sways/tilts
	skull.add(head);
	const boneMat = new THREE.MeshStandardMaterial({ color: 0xe6ddc8, roughness: 0.55, metalness: 0.02 });
	const darkMat = new THREE.MeshBasicMaterial({ color: 0x080604 });
	const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9a842, roughness: 0.3, metalness: 0.85 });

	const cranium = new THREE.Mesh(new THREE.SphereGeometry(0.27, 24, 18), boneMat);
	cranium.scale.set(1, 1.12, 0.92);
	cranium.position.y = 0.1;
	head.add(cranium);
	const maxilla = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), boneMat);
	maxilla.scale.set(1, 0.72, 0.75);
	maxilla.position.set(0, -0.1, 0.13);
	head.add(maxilla);
	for (const side of [-1, 1]) {
		const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), boneMat);
		cheek.position.set(side * 0.155, -0.05, 0.16);
		head.add(cheek);
		const socket = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 12), darkMat);
		socket.position.set(side * 0.105, 0.03, 0.185);
		socket.scale.set(1, 1.15, 0.6);
		head.add(socket);
	}
	const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), darkMat);
	nose.scale.set(0.7, 1.25, 0.5);
	nose.position.set(0, -0.08, 0.235);
	head.add(nose);
	// teeth — one gold, obviously
	for (let i = 0; i < 5; i++) {
		const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.05, 0.028), i === 1 ? goldMat : boneMat);
		const a = (i - 2) * 0.19;
		tooth.position.set(Math.sin(a) * 0.13, -0.185, 0.13 + Math.cos(a) * 0.075);
		tooth.rotation.y = a;
		head.add(tooth);
	}
	// jaw, pivoted at the back so rotation.x drops the chin
	const jaw = new THREE.Group();
	jaw.position.set(0, -0.19, 0.0);
	const mandible = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.06, 0.12), boneMat);
	mandible.position.set(0, -0.05, 0.12);
	jaw.add(mandible);
	for (const side of [-1, 1]) {
		const ramus = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.045), boneMat);
		ramus.position.set(side * 0.115, 0.0, 0.03);
		ramus.rotation.x = -0.5;
		jaw.add(ramus);
	}
	for (let i = 0; i < 4; i++) {
		const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.024), boneMat);
		tooth.position.set((i - 1.5) * 0.042, -0.008, 0.175);
		jaw.add(tooth);
	}
	head.add(jaw);
	// crimson bandana + knot, gold earring
	const bandana = new THREE.Mesh(
		new THREE.SphereGeometry(0.285, 24, 12, 0, Math.PI * 2, 0, 1.2),
		new THREE.MeshStandardMaterial({ color: 0xa8322e, roughness: 0.85, metalness: 0 })
	);
	bandana.scale.set(1.02, 1.05, 0.95);
	bandana.position.y = 0.1;
	head.add(bandana);
	for (const [dx, rz] of [[0, 0.5], [0.05, 1.1]] as const) {
		const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.02), bandana.material);
		tail.position.set(-0.25 - dx, 0.06, -0.12);
		tail.rotation.z = rz;
		head.add(tail);
	}
	const earring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.009, 8, 20), goldMat);
	earring.position.set(-0.27, -0.08, 0.05);
	earring.rotation.y = Math.PI / 2;
	head.add(earring);
	// glowing amber eyes
	const eyeMat = new THREE.SpriteMaterial({
		map: glowTex,
		color: 0xffb84e,
		transparent: true,
		opacity: 0.95,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const eyes: THREE.Sprite[] = [];
	for (const side of [-1, 1]) {
		const eye = new THREE.Sprite(eyeMat);
		eye.scale.setScalar(0.07);
		eye.position.set(side * 0.105, 0.03, 0.28);
		head.add(eye);
		eyes.push(eye);
	}
	return { skull, head, jaw, eyes };
}

// The a-cappella outro, as jaw-open windows (seconds from the cut):
// "Make Me Luck, all the luck be-longs to me" — last note held with vibrato.
const LYRIC: readonly (readonly [number, number])[] = [
	[0.0, 0.22], [0.32, 0.18], [0.58, 0.38],
	[1.28, 0.2], [1.5, 0.15], [1.72, 0.3],
	[2.12, 0.16], [2.32, 0.34], [2.78, 0.18],
	[3.05, 0.85]
];

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, lightning, sprites, audio, haptics } = ctx;

	// ---- Act 1: the storm slams in (the song is already at full sail)
	const restore = dimLights(scene, 0.3, 600);
	scene.crossfadeEnvironment('nightSky', 600);
	scene.fxLight.color.set(0x8fd0d8);
	scene.fxLight.position.set(-1.4, 1.7, 1.6);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.8));
	// cold moon key so the ship and skull are modelled, not flat cutouts
	const moonLight = new THREE.DirectionalLight(0xa8c8e8, 0);
	moonLight.position.set(-2.5, 3, 2);
	scene.scene.add(moonLight);
	tween(900, 'inOutQuad', (v) => (moonLight.intensity = v * 1.6));
	// pale moon glow behind ragged sky
	const moonMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xcfe2f2,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const moon = new THREE.Sprite(moonMat);
	moon.scale.setScalar(1.55);
	moon.position.set(-1.55, 1.75, -0.6);
	const moonCore = new THREE.Sprite(moonMat.clone());
	moonCore.scale.setScalar(0.42);
	moonCore.position.copy(moon.position);
	scene.scene.add(moon, moonCore);
	tween(1200, 'inOutQuad', (v) => {
		moonMat.opacity = v * 0.13;
		(moonCore.material as THREE.SpriteMaterial).opacity = v * 0.38;
	});

	const oceanBack = oceanBand(9, 1.5, 0x061420, 0x1a4a56, 0.97, 0, 0.0);
	const oceanMid = oceanBand(9, 1.7, 0x04161f, 0x1e5a64, 0.9, 2.1, 0.0);
	const oceanNear = oceanBand(9, 1.7, 0x03121c, 0x175058, 0.94, 4.4, 0.0);
	oceanBack.position.set(0, -3.3, -0.55);
	oceanMid.position.set(0, -3.5, 0.62);
	oceanNear.position.set(0, -3.7, 0.92);
	oceanMid.renderOrder = 7;
	oceanNear.renderOrder = 9;
	scene.scene.add(oceanBack, oceanMid, oceanNear);

	const flagTex = jollyRogerTexture();
	const { ship, flag } = buildShip(flagTex, sprites.softDot);
	ship.position.set(-3.4, -0.42, -0.5);
	ship.scale.setScalar(0.62);
	scene.scene.add(ship);

	const { skull, head, jaw, eyes } = buildSkull(sprites.softDot);
	const btnHome = machine.buttonGroup.position.clone();
	skull.position.set(btnHome.x, btnHome.y, btnHome.z - 0.25);
	skull.scale.setScalar(0.001);
	machine.centre.add(skull);

	// helm handles, parked at scale 0 around the face
	const btnPos = machine.buttonWorldPosition();
	const helm = new THREE.Group();
	helm.position.set(btnPos.x, btnPos.y, 0.18);
	const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a4a26, roughness: 0.55, metalness: 0.05 });
	const knobMat = new THREE.MeshStandardMaterial({ color: 0x53301a, roughness: 0.45, metalness: 0.05 });
	const handles: THREE.Group[] = [];
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
		const handle = new THREE.Group();
		const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.034, 0.3, 10), woodMat);
		shaft.position.y = 0.15;
		const knob = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), knobMat);
		knob.position.y = 0.32;
		handle.add(shaft, knob);
		handle.rotation.z = a - Math.PI / 2;
		handle.position.set(Math.cos(a) * 1.26, Math.sin(a) * 1.26, 0);
		handle.scale.setScalar(0.001);
		helm.add(handle);
		handles.push(handle);
	}
	scene.scene.add(helm);

	// ---- the living sea sim
	const baseY = machine.group.position.y;
	let rollAmp = 0;
	let rollBoost = 1; // the close pass rocks the machine in its wash
	let leanBias = 0;
	let shipBob = 1;
	let singT = -1; // ≥0 once the skull starts the outro
	let laughing = false;
	let jawOpen = 0;
	const wakeOrigin = new THREE.Vector3(0, -5, 0.8); // parked until the close pass
	const stopSim = scene.addUpdatable((dt, t) => {
		for (const band of [oceanBack, oceanMid, oceanNear]) {
			(band.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
		}
		ship.position.y += (Math.sin(t * 0.8 + 0.7) * 0.045 * shipBob - (ship.position.y - ship.userData.waterline)) * Math.min(1, dt * 6);
		ship.rotation.z = Math.sin(t * 0.7) * 0.05;
		flag.rotation.z = Math.sin(t * 7.3) * 0.14;
		flag.scale.x = 0.92 + Math.sin(t * 9.1) * 0.1;
		const roll = Math.sin(t * 0.85) * rollAmp * rollBoost;
		machine.group.rotation.z = roll + leanBias;
		machine.group.position.y = baseY + Math.sin(t * 0.8 + 1.1) * rollAmp * rollBoost * 0.8;
		scene.cameraRoll = roll * 0.25;

		// the ghost sings: jaw driven by the lyric windows, held note vibrato
		let target = 0;
		if (laughing) {
			target = Math.abs(Math.sin(t * 14)) * 0.42;
		} else if (singT >= 0) {
			singT += dt;
			for (const [s, d] of LYRIC) {
				if (singT >= s && singT <= s + d) {
					const held = d > 0.6;
					target = 0.3 + (held ? Math.sin(singT * 26) * 0.06 : 0.05);
					break;
				}
			}
			head.rotation.z = Math.sin(singT * 1.9) * 0.07;
			head.position.y = Math.sin(singT * 3.8) * 0.008;
			// the held last note tips the head back, showman style
			const last = LYRIC[LYRIC.length - 1];
			if (singT > last[0]) head.rotation.x = -0.16 * Math.min(1, (singT - last[0]) / 0.4);
		}
		jawOpen += (target - jawOpen) * Math.min(1, dt * 18);
		jaw.rotation.x = jawOpen;
		for (const eye of eyes) eye.scale.setScalar(0.07 + jawOpen * 0.05);
	});
	ship.userData.waterline = -0.42;

	// visible half-width of the frame at a given depth — phones are much
	// narrower than desktop, so every pass spans the REAL frame edges instead
	// of desktop-tuned constants that leave mobile watching empty water
	const frameHalfW = (z: number) =>
		Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * scene.camera.aspect * (5.35 - z);

	const skyBolt = (x: number) => {
		lightning.strike(
			new THREE.Vector3(x + rand(-0.4, 0.4), 3.1, -0.5),
			new THREE.Vector3(x + rand(-0.7, 0.7), 0.3, -0.5),
			{ width: 0.045, life: 0.42, jitter: 0.24, generations: 6 }
		);
		const c0 = scene.fxLight.intensity;
		tween(320, (v) => 1 - Math.abs(v * 2 - 1), (v) => (scene.fxLight.intensity = c0 + v * 2.6));
	};

	audio.sfx('boom', { pitch: 0.45, gain: 0.55 });
	haptics.vibrate([15, 60, 30]);
	// band tops (centre + half-height): back -0.55, mid -0.9, near -1.0 —
	// the machine floats hull-down, it does not drown
	tween(900, 'outCubic', (v) => {
		oceanBack.position.y = -3.3 + v * 2.0;
		oceanMid.position.y = -3.5 + v * 1.75;
		oceanNear.position.y = -3.7 + v * 1.85;
		rollAmp = v * 0.05;
	});
	await delay(250);
	skyBolt(1.4);

	// ---- Act 2: the helm, immediately — this machine knows what's coming
	await delay(500);
	// distant pass starts underneath the helm business (battle chaos is good)
	const farEdge = frameHalfW(-0.5) + 0.7; // just past the frame + ship length
	const distantPass = tween(2900, 'inOutQuad', (v) => {
		ship.position.x = -farEdge + v * farEdge * 2; // left → right across the horizon
	});
	ship.scale.x = -0.62; // bow toward her heading

	machine.mechSpeed = 4.5;
	for (let i = 0; i < handles.length; i++) {
		tween(340, 'outBack', (v) => handles[i].scale.setScalar(Math.max(0.001, v)));
		audio.sfx('tick', { pitch: 1.1 + i * 0.08, gain: 0.4 });
		await delay(45);
	}
	tween(600, 'inOutQuad', (v) => (leanBias = -0.085 * v));
	const spinStart = machine.faceSpin.rotation.z;
	let lastNotch = 0;
	const helmSpin = (turns: number, ms: number, from: number) =>
		tween(ms, 'outCubic', (v) => {
			const a = from + v * Math.PI * turns;
			machine.faceSpin.rotation.z = spinStart + a;
			helm.rotation.z = a;
			const notch = Math.floor(a / (Math.PI / 4));
			if (notch > lastNotch) {
				lastNotch = notch;
				audio.sfx('clack', { pitch: 1.3 + (notch % 3) * 0.15, gain: 0.3 });
			}
		});
	const firstSpin = helmSpin(4, 1700, 0);
	audio.sfx('swoosh', { pitch: 0.9, gain: 0.6 });

	// broadside from the horizon while the helm is still spinning
	const ballGeo = new THREE.SphereGeometry(0.055, 10, 8);
	const ballMat = new THREE.MeshBasicMaterial({ color: 0x1a2128 });
	const ballGlowMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0x9fb8c8,
		transparent: true,
		opacity: 0.4,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const fireCannon = async (target: THREE.Vector3, hero: boolean) => {
		const muzzle = new THREE.Vector3(
			ship.position.x + 0.3 * Math.sign(ship.scale.x) * -1,
			ship.position.y + 0.12,
			ship.position.z + 0.15
		);
		audio.sfx('boom', { pitch: hero ? 0.8 : rand(0.95, 1.15), gain: hero ? 0.9 : 0.65 });
		haptics.vibrate(hero ? [20, 20, 70] : 30);
		scene.shake(hero ? 0.2 : 0.12);
		particles.burst({
			texture: sprites.softDot,
			count: hero ? 30 : 20,
			origin: muzzle.clone(),
			originSpread: 0.06,
			direction: new THREE.Vector3(0.6, 0.35, 0.7),
			cone: 0.55,
			speed: [0.3, 0.9],
			gravity: new THREE.Vector3(0, 0.35, 0),
			life: [0.8, 1.6],
			size: [0.08, 0.2],
			colors: [0x8a98a4, 0x5c6a76, 0xb8c4cc],
			fadeIn: 0.1
		});
		particles.burst({
			texture: sprites.spark,
			count: 10,
			origin: muzzle.clone(),
			direction: new THREE.Vector3(0.6, 0.3, 0.6),
			cone: 0.4,
			speed: [1.5, 3],
			life: [0.1, 0.25],
			size: [0.05, 0.12],
			colors: [0xffd9a0, 0xffb45e]
		});
		const ball = new THREE.Mesh(ballGeo, ballMat);
		const glow = new THREE.Sprite(ballGlowMat);
		glow.scale.setScalar(0.22);
		ball.add(glow);
		scene.scene.add(ball);
		const from = muzzle.clone();
		const apex = hero ? 1.15 : rand(0.8, 1.0);
		await tween(hero ? 680 : 600, 'linear', (v) => {
			ball.position.lerpVectors(from, target, v);
			ball.position.y += Math.sin(Math.PI * v) * apex;
		});
		scene.scene.remove(ball);
		if (hero) {
			audio.sfx('clang', { pitch: 0.85, gain: 0.8 });
			scene.shake(0.5);
			haptics.vibrate([40, 30, 110]);
			shockwave(scene.scene, target, { color: 0x9fd8e0, maxScale: 3.2, duration: 650, z: 0.55 });
			flashPulse(machine, 0.4, 80, 500, 0xbfe0e8);
		} else {
			audio.sfx('pop', { pitch: 0.65, gain: 0.5 });
			audio.sfx('swoosh', { pitch: 1.6, gain: 0.35 });
			scene.shake(0.14);
		}
		particles.burst({
			texture: sprites.softDot,
			count: hero ? 40 : 26,
			origin: target.clone(),
			originSpread: 0.05,
			direction: new THREE.Vector3(0, 1, 0),
			cone: 0.55,
			speed: [1.2, hero ? 3.2 : 2.4],
			gravity: new THREE.Vector3(0, -4, 0),
			life: [0.4, 0.9],
			size: [0.03, 0.1],
			colors: [0xdfeef2, 0x9fc8d8, 0xffffff],
			fadeIn: 0.02
		});
	};
	fireCannon(new THREE.Vector3(-0.85, -1.1, 0.7), false);
	await delay(480);
	fireCannon(new THREE.Vector3(1.15, -1.15, 0.75), false);
	await delay(520);
	await fireCannon(new THREE.Vector3(0.12, -0.95, 0.55), true);
	await Promise.all([distantPass, firstSpin]);

	// ---- Act 3: she comes about and ROARS past in the foreground swell
	ship.scale.setScalar(1.18); // close = big; parallax sells the turn
	ship.scale.x = 1.18; // bow toward -x: sailing right → left
	const nearEdge = frameHalfW(0.75) + 1.0;
	ship.position.set(nearEdge, -0.72, 0.75);
	ship.userData.waterline = -0.72; // hull-down in the near swell
	const wake = particles.emitter({
		texture: sprites.softDot,
		count: 80,
		emitRate: 30,
		origin: wakeOrigin,
		originSpread: 0.1,
		direction: new THREE.Vector3(0.4, 1, 0),
		cone: 0.6,
		speed: [0.4, 1.1],
		gravity: new THREE.Vector3(0, -2.2, 0),
		life: [0.35, 0.8],
		size: [0.02, 0.07],
		colors: [0xdfeef2, 0xaacfdc],
		fadeIn: 0.02
	});
	audio.sfx('swoosh', { pitch: 0.55, gain: 0.7 });
	rollBoost = 1.6; // her wash rocks the machine
	const closePass = tween(3300, 'inOutQuad', (v) => {
		ship.position.x = nearEdge - v * nearEdge * 2;
		wakeOrigin.set(ship.position.x - 0.95, -0.85, 0.8);
	});
	// as she crosses the button she fires GLITTER from the cannons — a
	// celebratory broadside of star-shot arcing off the deck
	const glitterBroadside = () => {
		audio.sfx('pop', { pitch: rand(1.2, 1.5), gain: 0.5 });
		audio.sfx('chime', { pitch: rand(1.1, 1.4), gain: 0.35 });
		haptics.vibrate(20);
		const origin = new THREE.Vector3(
			ship.position.x + rand(-0.5, 0.4),
			ship.position.y + 0.28,
			ship.position.z + 0.12
		);
		// a fat core flash so the volley POPS, then a big shell of star-shot
		particles.burst({
			texture: sprites.softDot,
			count: 5,
			origin: origin.clone(),
			speed: [0.1, 0.4],
			life: [0.15, 0.3],
			size: [0.3, 0.5],
			colors: [0xfff3cf, 0xffd9a0]
		});
		particles.burst({
			texture: sprites.star4,
			count: 90,
			origin,
			originSpread: 0.12,
			direction: new THREE.Vector3(rand(-0.35, 0.35), 1, 0.12),
			cone: 0.6,
			speed: [2.8, 6],
			gravity: new THREE.Vector3(0, -2.2, 0),
			life: [0.9, 1.9],
			size: [0.06, 0.16],
			colors: [0xffd27a, 0xfff3cf, 0xff9a5e, 0xbfe8ff],
			spin: [-5, 5]
		});
		particles.burst({
			texture: sprites.spark,
			count: 26,
			origin: origin.clone(),
			direction: new THREE.Vector3(0, 1, 0.2),
			cone: 0.4,
			speed: [1.8, 3.6],
			life: [0.15, 0.4],
			size: [0.08, 0.18],
			colors: [0xffd9a0, 0xffb45e]
		});
	};
	await delay(650);
	glitterBroadside();
	await delay(350);
	skyBolt(-1.2);
	await delay(350);
	glitterBroadside();
	await delay(650);
	glitterBroadside();
	await delay(400);
	skyBolt(1.7);
	audio.sfx('boom', { pitch: 0.5, gain: 0.5 });
	await delay(350);
	glitterBroadside();
	await closePass;
	wake.stop();
	rollBoost = 1;

	// ---- Act 4: the hatch opens — timed to the shanty's a-cappella cut
	audio.sfx('clang', { pitch: 1.3, gain: 0.5 });
	machine.setInnerGlow(0.32, 0x86ffb0); // ghost-green from the bore
	await tween(240, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + v * 0.22;
	});
	tween(750, 'outCubic', (v) => {
		machine.buttonGroup.position.y = btnHome.y + v * 1.05; // high enough to clear the skull's bandana
	});
	// green grave-mist as the ghost rises
	particles.burst({
		texture: sprites.softDot,
		count: 40,
		origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.55),
		originSpread: 0.2,
		speed: [0.2, 0.7],
		gravity: new THREE.Vector3(0, 0.5, 0),
		life: [0.8, 1.8],
		size: [0.08, 0.22],
		colors: [0x86ffb0, 0x3fae6a, 0xbfffd8],
		fadeIn: 0.15
	});
	audio.sfx('chime', { pitch: 0.7, gain: 0.6 });
	haptics.vibrate([20, 40, 60]);
	await tween(800, 'outCubic', (v) => {
		skull.scale.setScalar(Math.max(0.001, v));
		skull.position.z = btnHome.z - 0.25 + v * 0.55;
	});

	// ---- Act 5: the ghost sings the outro. Let him have the stage.
	singT = 0;
	machine.setInnerGlow(0.16, 0x86ffb0);
	const serenade = particles.emitter({
		texture: sprites.coin,
		count: 40,
		emitRate: 8, // a lazy trickle of doubloons keeps the promise of treasure
		origin: new THREE.Vector3(btnPos.x, btnPos.y - 0.35, 0.5),
		originSpread: 0.4,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.5,
		speed: [0.8, 1.6],
		gravity: new THREE.Vector3(0, -1.4, 0),
		life: [1.6, 2.6],
		size: [0.06, 0.12],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
		spin: [-4, 4]
	});
	// she sails steadily across the horizon while he sings — one clean
	// crossing, gone off the right-hand side before the tide turns
	ship.userData.waterline = -0.44;
	ship.scale.setScalar(0.62);
	ship.scale.x = -0.62;
	const songEdge = frameHalfW(-0.5) + 0.7;
	ship.position.set(-songEdge, -0.44, -0.5);
	tween(5000, 'linear', (v) => {
		ship.position.x = -songEdge + v * songEdge * 2;
	});
	await delay(2400);
	skyBolt(0.3); // the skull grins in the lightning
	await delay(1500); // ...the held note lands here

	// ---- Act 6: CLIMAX — all hands, all guns, all the luck
	laughing = true;
	tween(300, 'outQuad', (v) => (head.rotation.x = -0.16 - v * 0.24));
	for (const eye of eyes) {
		(eye.material as THREE.SpriteMaterial).opacity = 1;
	}
	tween(500, 'outQuad', (v) => {
		for (const eye of eyes) eye.scale.setScalar(0.07 + v * 0.09);
	});
	audio.sfx('gong', { pitch: 0.9, gain: 0.8 });
	audio.sfx('boom', { pitch: 0.6, gain: 0.9 });
	haptics.vibrate([50, 30, 120, 30, 60]);
	scene.shake(0.5);
	shockwave(scene.scene, new THREE.Vector3(btnPos.x, btnPos.y, 0.6), {
		color: 0xffd27a,
		maxScale: 5,
		duration: 800,
		z: 0.6
	});
	flashPulse(machine, 0.85, 90, 800, 0xffd27a);
	machine.setInnerGlow(0.4, 0xffd27a);
	// the hold bursts: doubloons EVERYWHERE
	for (const [count, speed] of [[130, 5.2], [90, 3.6]] as const) {
		particles.burst({
			texture: sprites.coin,
			count,
			origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.55),
			originSpread: 0.15,
			direction: new THREE.Vector3(0, 1, 0),
			cone: 0.95,
			speed: [2.2, speed],
			gravity: new THREE.Vector3(0, -3.2, 0),
			life: [1.4, 2.6],
			size: [0.07, 0.16],
			colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff0cf],
			spin: [-6, 6]
		});
	}
	// star-glitter through the gold
	particles.burst({
		texture: sprites.star4,
		count: 60,
		origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.55),
		speed: [1.5, 4],
		life: [0.6, 1.4],
		size: [0.03, 0.09],
		colors: [0xfff3cf, 0xffd27a, 0xbfe8ff]
	});
	// triple lightning + her final salute from the dark
	skyBolt(-1.8);
	const salute = async () => {
		for (let i = 0; i < 3; i++) {
			await delay(160);
			skyBolt(rand(-0.5, 1.8));
			audio.sfx('boom', { pitch: rand(0.7, 1.0), gain: 0.6 });
			particles.burst({
				texture: sprites.spark,
				count: 12,
				origin: new THREE.Vector3(ship.position.x + 0.4, ship.position.y + 0.15, ship.position.z + 0.1),
				direction: new THREE.Vector3(0.7, 0.4, 0.4),
				cone: 0.4,
				speed: [1.5, 3],
				life: [0.1, 0.3],
				size: [0.05, 0.14],
				colors: [0xffd9a0, 0xffb45e]
			});
		}
	};
	salute();
	// and the helm goes hard over one last time
	lastNotch = 0;
	await helmSpin(4, 1100, 0);

	// ---- the tide goes out
	laughing = false;
	singT = -1; // fully off, or the sing-branch fights the head-reset tween
	serenade.stop();
	machine.mechSpeed = 1;
	audio.sfx('swoosh', { pitch: 0.6, gain: 0.5 });
	tween(400, 'inOutQuad', (v) => (head.rotation.x = -0.4 * (1 - v)));
	// the ghost sinks home, the hatch closes with a satisfying clack
	await tween(600, 'inQuad', (v) => {
		skull.scale.setScalar(Math.max(0.001, 1 - v));
		skull.position.z = btnHome.z + 0.3 - v * 0.55;
	});
	tween(550, 'inOutQuad', (v) => {
		machine.buttonGroup.position.y = btnHome.y + 1.05 * (1 - v);
	});
	await delay(560);
	await tween(220, 'outBack', (v) => {
		machine.buttonGroup.position.z = btnHome.z + 0.22 * (1 - v);
	});
	audio.sfx('clack', { pitch: 0.8, gain: 0.6 });
	for (let i = handles.length - 1; i >= 0; i--) {
		tween(240, 'inQuad', (v) => handles[i].scale.setScalar(Math.max(0.001, 1 - v)));
		await delay(40);
	}
	tween(900, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.4 * (1 - v));
		scene.fxLight.intensity = 1.8 * (1 - v);
		moonLight.intensity = 1.6 * (1 - v);
		moonMat.opacity = 0.22 * (1 - v);
		(moonCore.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - v);
		leanBias = -0.085 * (1 - v);
	});
	await tween(1000, 'inQuad', (v) => {
		oceanBack.position.y = -1.3 - v * 2.0;
		oceanMid.position.y = -1.75 - v * 1.75;
		oceanNear.position.y = -1.85 - v * 1.85;
		rollAmp = 0.05 * (1 - v);
	});

	// ---- teardown
	stopSim();
	machine.group.position.y = baseY;
	machine.group.rotation.z = 0;
	machine.faceSpin.rotation.z = spinStart; // 8π later ≡ where it started
	machine.buttonGroup.position.copy(btnHome);
	scene.cameraRoll = 0;
	scene.fxLight.intensity = 0;
	machine.setInnerGlow(0);
	machine.centre.remove(skull);
	scene.scene.remove(ship, helm, oceanBack, oceanMid, oceanNear, moon, moonCore, moonLight);
	disposeObject(ship);
	disposeObject(helm);
	disposeObject(skull);
	for (const band of [oceanBack, oceanMid, oceanNear]) {
		band.geometry.dispose();
		(band.material as THREE.Material).dispose();
	}
	ballGeo.dispose();
	ballMat.dispose();
	ballGlowMat.dispose();
	moonMat.dispose();
	(moonCore.material as THREE.SpriteMaterial).dispose();
	flagTex.dispose();
	scene.crossfadeEnvironment('lounge');
	await restore(900);
}
