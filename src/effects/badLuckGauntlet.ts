// Effect — BAD LUCK GAUNTLET: every superstition in the book takes a swing at
// the machine and every one of them misses. A ladder drops over it, a black cat
// crosses its path, an umbrella opens indoors. Nothing sticks. The joke is that
// the machine never reacts — it just sits there being lucky at things.
//
// Comedy timing beats fidelity here, so the props are deliberately simple
// silhouettes: the beat lands before anyone inspects the geometry.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'spinningRim';
export const duration = 11500;

/** A hanging ladder: two stiles and six rungs of dark wood. */
function buildLadder(): THREE.Group {
	const g = new THREE.Group();
	const wood = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85, metalness: 0.02 });
	const stileGeo = new THREE.BoxGeometry(0.09, 3.4, 0.09);
	for (const x of [-0.42, 0.42]) {
		const s = new THREE.Mesh(stileGeo, wood);
		s.position.set(x, 0, 0);
		g.add(s);
	}
	const rungGeo = new THREE.BoxGeometry(0.84, 0.06, 0.06);
	for (let i = 0; i < 6; i++) {
		const r = new THREE.Mesh(rungGeo, wood);
		r.position.set(0, 1.42 - i * 0.56, 0);
		g.add(r);
	}
	g.userData.dispose = () => {
		stileGeo.dispose();
		rungGeo.dispose();
		wood.dispose();
	};
	return g;
}

/** A black cat in profile, walking. Sculpted rather than assembled: the torso
 *  is a single lathed surface re-shaped into a deep chest, a pinched waist and
 *  heavy haunches; the limbs are lathed and bent at the hock so they pivot at
 *  the hip like real legs; the tail is a tapered tube swept along an S-curve
 *  whose thickness is re-evaluated — never re-multiplied — when it puffs.
 *  The cat faces -x; y=0 is the ground it stands on. */
function buildCat(glow: THREE.Texture): {
	cat: THREE.Group;
	legs: THREE.Mesh[];
	tail: THREE.Group;
	ears: THREE.Mesh[];
	head: THREE.Group;
	setTailPuff: (p: number) => void;
} {
	const cat = new THREE.Group();
	// everything built here is registered for teardown as it is made
	const geos: THREE.BufferGeometry[] = [];
	const mats: THREE.Material[] = [];
	const G = <T extends THREE.BufferGeometry>(g: T): T => {
		geos.push(g);
		return g;
	};
	const M = <T extends THREE.Material>(m: T): T => {
		mats.push(m);
		return m;
	};
	const step = (a: number, b: number, x: number): number => {
		const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
		return t * t * (3 - 2 * t);
	};
	/** A lathe's first and last rings sit on top of each other but are separate
	 *  vertices, so computeVertexNormals leaves a hard lighting seam straight
	 *  down the model. Average the two rings back together. */
	const weldSeam = (g: THREE.BufferGeometry, ringLen: number, rings: number): void => {
		const n = g.attributes.normal as THREE.BufferAttribute;
		for (let j = 0; j < ringLen; j++) {
			const a = j;
			const b = rings * ringLen + j;
			const x = n.getX(a) + n.getX(b);
			const y = n.getY(a) + n.getY(b);
			const z = n.getZ(a) + n.getZ(b);
			const l = Math.hypot(x, y, z) || 1;
			n.setXYZ(a, x / l, y / l, z / l);
			n.setXYZ(b, x / l, y / l, z / l);
		}
		n.needsUpdate = true;
	};

	// coat: matte black fur with a cold sheen and a whisper of clearcoat, so
	// the silhouette still has form against a near-black backdrop
	const fur = M(
		new THREE.MeshPhysicalMaterial({
			color: 0x181821,
			roughness: 0.58,
			metalness: 0,
			clearcoat: 0.2,
			clearcoatRoughness: 0.72,
			sheen: 1,
			sheenColor: new THREE.Color(0x8ea6cc),
			sheenRoughness: 0.42
		})
	);
	const noseMat = M(new THREE.MeshStandardMaterial({ color: 0x2b2029, roughness: 0.32, metalness: 0 }));

	// ---- torso: one surface of revolution, then sculpted. The lathe runs
	// along its own y as a 0..1 body parameter; the post-pass lays that axis
	// down along x and makes the section taller than it is wide. The trick
	// that stops it reading as a sausage is that the pinch at the waist is
	// spent entirely on the BELLY: the section centre rises as the section
	// narrows, so the spine stays a level line and the underside tucks.
	const bodyR = new THREE.CatmullRomCurve3([
		new THREE.Vector3(0.0, 0.0, 0),
		new THREE.Vector3(0.05, 0.085, 0), // base of the neck
		new THREE.Vector3(0.16, 0.122, 0), // shoulder
		new THREE.Vector3(0.29, 0.126, 0), // deep chest
		new THREE.Vector3(0.44, 0.108, 0),
		new THREE.Vector3(0.57, 0.098, 0), // waist
		new THREE.Vector3(0.71, 0.118, 0),
		new THREE.Vector3(0.83, 0.132, 0), // haunch
		new THREE.Vector3(0.94, 0.1, 0),
		new THREE.Vector3(1.0, 0.0, 0) // rump
	]);
	const BODY_PTS = 60;
	const bodyProfile: THREE.Vector2[] = [];
	for (let i = 0; i <= BODY_PTS; i++) {
		const p = bodyR.getPoint(i / BODY_PTS);
		bodyProfile.push(new THREE.Vector2(Math.max(0.0006, p.y), THREE.MathUtils.clamp(p.x, 0, 1)));
	}
	const BODY_SEGS = 40;
	// phiStart puts the lathe's start/end seam on the belly, where nobody is
	// ever going to look at it
	const torsoGeo = G(new THREE.LatheGeometry(bodyProfile, BODY_SEGS, -Math.PI / 2));
	const tPos = torsoGeo.attributes.position as THREE.BufferAttribute;
	for (let i = 0; i < tPos.count; i++) {
		const u = tPos.getY(i); // 0 at the shoulders, 1 at the rump
		const rv = tPos.getX(i); // radial component that becomes height
		const rw = tPos.getZ(i); // radial component that becomes width
		const cy = 0.32 + 0.055 * u * u + (0.132 - Math.hypot(rv, rw)) * 0.7 * Math.sin(Math.PI * u);
		tPos.setXYZ(i, -0.3 + u * 0.62, cy + rv * (1.16 - 0.12 * u), rw * (0.84 + 0.2 * u));
	}
	torsoGeo.computeVertexNormals();
	weldSeam(torsoGeo, BODY_PTS + 1, BODY_SEGS);
	cat.add(new THREE.Mesh(torsoGeo, fur));

	// ---- head: a group pivoted at the withers so +z rotation dips the nose
	// down and forward (sniff) and -z snaps it up (startle)
	const head = new THREE.Group();
	head.position.set(-0.25, 0.435, 0);
	// a scruff centred all but exactly on the pivot: it fills the throat and
	// shoulder corner and, being concentric with the rotation, never slides
	// out of it
	const scruff = new THREE.Mesh(G(new THREE.SphereGeometry(0.072, 20, 16)), fur);
	scruff.position.set(0, -0.016, 0);
	scruff.scale.set(1.15, 0.94, 0.96);
	head.add(scruff);
	// a short, thick neck — the long horizontal one read as a dog. A capsule
	// almost the same girth as the scruff and the skull, so the surfaces meet
	// nearly tangentially instead of cutting a collar seam into each other.
	const neck = new THREE.Mesh(G(new THREE.CapsuleGeometry(0.071, 0.085, 6, 18)), fur);
	neck.position.set(-0.05, 0.038, 0);
	neck.rotation.z = 0.904;
	head.add(neck);
	// a cat's head is a short blunt wedge: round cranium, wide cheeks, and a
	// muzzle that barely protrudes past them
	const skull = new THREE.Mesh(G(new THREE.SphereGeometry(0.09, 26, 20)), fur);
	skull.position.set(-0.1, 0.072, 0);
	skull.scale.set(0.98, 0.96, 0.95);
	head.add(skull);
	const cheeks = new THREE.Mesh(G(new THREE.SphereGeometry(0.062, 20, 16)), fur);
	cheeks.position.set(-0.135, 0.03, 0);
	cheeks.scale.set(0.95, 0.86, 1.15);
	head.add(cheeks);
	const muzzle = new THREE.Mesh(G(new THREE.SphereGeometry(0.048, 18, 14)), fur);
	muzzle.position.set(-0.163, 0.038, 0);
	muzzle.scale.set(0.95, 0.78, 1.0);
	head.add(muzzle);
	const nose = new THREE.Mesh(G(new THREE.SphereGeometry(0.014, 10, 8)), noseMat);
	nose.position.set(-0.205, 0.052, 0);
	nose.scale.set(0.9, 0.85, 1.15);
	head.add(nose);

	// ears — big triangles set at the back corners of the skull, which is what
	// makes the silhouette read CAT before anything else does. The choreography
	// pins them back with an absolute rotation.z = 1.2, so the cone is baked
	// pointing at -1.30rad: +1.2 swings it flat to the horizontal, and the
	// resting 2.92 stands it upright.
	const earGeo = G(new THREE.ConeGeometry(0.086, 0.121, 4, 1));
	earGeo.rotateY(Math.PI / 4); // corners to the diagonals: flat faces to camera
	earGeo.scale(1.0, 1, 0.4); // thin triangular ear, not a party hat
	earGeo.translate(0, 0.0605, 0); // pivot at the base
	earGeo.rotateZ(-2.871);
	const ears: THREE.Mesh[] = [];
	for (const s of [1, -1]) {
		const ear = new THREE.Mesh(earGeo, fur);
		ear.position.set(-0.086, 0.124, s * 0.058);
		ear.rotation.z = 2.885; // upright and alert
		ear.rotation.x = s * 0.24; // splayed outward
		head.add(ear);
		ears.push(ear);
	}

	// eyes: the only part of a black cat you ever actually see. A wide glow
	// plus a tiny co-located core, which additively burns a hot centre.
	const eyeMat = M(
		new THREE.SpriteMaterial({
			map: glow,
			color: 0xd8f048,
			transparent: true,
			opacity: 0.95,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		})
	);
	for (const s of [1, -1]) {
		const eye = new THREE.Sprite(eyeMat);
		eye.scale.setScalar(0.056);
		eye.position.set(-0.161, 0.09, s * 0.06);
		head.add(eye);
		const core = new THREE.Sprite(eyeMat);
		core.scale.setScalar(0.022);
		core.position.copy(eye.position);
		head.add(core);
	}
	cat.add(head);

	// ---- legs: lathed limbs that taper to a slim ankle and flare into a paw,
	// bent along their length so the hind pair has a proper hock. Origin is
	// the hip, so rotation.z strides.
	const LEG_SEGS = 20;
	const limb = (prof: [number, number][], bend: (t: number) => number, len: number): THREE.BufferGeometry => {
		const pts = prof.map(([y, r]) => new THREE.Vector2(Math.max(0.0006, r), y));
		const g = G(new THREE.LatheGeometry(pts, LEG_SEGS, Math.PI / 2)); // seam behind the leg
		const p = g.attributes.position as THREE.BufferAttribute;
		for (let i = 0; i < p.count; i++) {
			const y = p.getY(i);
			const t = THREE.MathUtils.clamp(-y / len, 0, 1);
			const paw = step(0.82, 1, t); // the foot is longer than it is round
			p.setXYZ(i, p.getX(i) * (1 + 0.55 * paw) + bend(t), y, p.getZ(i) * 0.86);
		}
		g.computeVertexNormals();
		weldSeam(g, pts.length, LEG_SEGS);
		return g;
	};
	const foreGeo = limb(
		[
			[-0.335, 0.0],
			[-0.328, 0.019],
			[-0.313, 0.029],
			[-0.294, 0.024],
			[-0.26, 0.019],
			[-0.208, 0.021],
			[-0.15, 0.026],
			[-0.09, 0.032],
			[-0.035, 0.04],
			[0.02, 0.044],
			[0.06, 0.0]
		],
		(t) => -0.026 * step(0.68, 1, t),
		0.335
	);
	const hindGeo = limb(
		[
			[-0.345, 0.0],
			[-0.338, 0.019],
			[-0.321, 0.03],
			[-0.3, 0.024],
			[-0.264, 0.019],
			[-0.214, 0.022],
			[-0.163, 0.028],
			[-0.108, 0.036],
			[-0.053, 0.043],
			[0.0, 0.047],
			[0.05, 0.046],
			[0.095, 0.0]
		],
		(t) => 0.04 * Math.sin(Math.PI * Math.min(1, t / 0.7)) - 0.028 * step(0.7, 1, t),
		0.345
	);
	const legs: THREE.Mesh[] = [];
	for (let i = 0; i < 4; i++) {
		const front = i % 2 === 0;
		const side = i < 2 ? 1 : -1;
		const leg = new THREE.Mesh(front ? foreGeo : hindGeo, fur);
		leg.position.set(front ? -0.175 : 0.185, front ? 0.315 : 0.325, side * (front ? 0.056 : 0.062));
		cat.add(leg);
		legs.push(leg);
	}

	// ---- tail: a tapered tube swept along an S-curve. The walk sim parks the
	// group at rotation.z = -0.55, so the curve is authored in the pose we
	// actually want and then pre-rotated by +0.55 to cancel that out.
	const tail = new THREE.Group();
	tail.position.set(0.285, 0.42, 0);
	tail.rotation.z = -0.55;
	const cr = Math.cos(0.55);
	const sr = Math.sin(0.55);
	const path = new THREE.CatmullRomCurve3(
		(
			[
				[0.0, 0.0],
				[0.052, 0.078],
				[0.112, 0.158],
				[0.152, 0.248],
				[0.15, 0.338],
				[0.104, 0.404],
				[0.032, 0.436],
				[-0.048, 0.428]
			] as [number, number][]
		).map(([x, y]) => new THREE.Vector3(x * cr - y * sr, x * sr + y * cr, 0))
	);
	const TUBE_SEGS = 64;
	const RING = 13; // radialSegments + 1
	const tailGeo = G(new THREE.TubeGeometry(path, TUBE_SEGS, 1, RING - 1, false));
	// the tube is generated at radius 1, so every vertex offset from the spine
	// is already a unit vector: thickness is then purely a function of u, and
	// puffing rewrites it from scratch instead of scaling anything
	const tPosT = tailGeo.attributes.position as THREE.BufferAttribute;
	const nT = tPosT.count;
	const spine = new Float32Array(nT * 3);
	const outward = new Float32Array(nT * 3);
	const uAt = new Float32Array(nT);
	const c = new THREE.Vector3();
	for (let i = 0; i < nT; i++) {
		const u = Math.floor(i / RING) / TUBE_SEGS;
		uAt[i] = u;
		path.getPointAt(u, c);
		spine[i * 3] = c.x;
		spine[i * 3 + 1] = c.y;
		spine[i * 3 + 2] = c.z;
		outward[i * 3] = tPosT.getX(i) - c.x;
		outward[i * 3 + 1] = tPosT.getY(i) - c.y;
		outward[i * 3 + 2] = tPosT.getZ(i) - c.z;
	}
	const setTailPuff = (p: number): void => {
		for (let i = 0; i < nT; i++) {
			const u = uAt[i];
			// bottle-brush: fattest from just past the root all the way out
			const brush = 0.4 + 3 * step(0.02, 0.3, u) * (1 - 0.4 * step(0.8, 1, u));
			// the last few rings collapse on a circular arc, which closes the
			// open end of the tube with a rounded tip instead of a pipe mouth
			const cap = Math.sqrt(Math.max(0, 1 - Math.pow(step(0.92, 1, u), 2)));
			const r = (0.038 - 0.013 * u - 0.01 * Math.pow(u, 3.2)) * cap * (1 + (p - 1) * brush);
			tPosT.setXYZ(
				i,
				spine[i * 3] + outward[i * 3] * r,
				spine[i * 3 + 1] + outward[i * 3 + 1] * r,
				spine[i * 3 + 2] + outward[i * 3 + 2] * r
			);
		}
		tPosT.needsUpdate = true;
		tailGeo.computeVertexNormals();
		// same duplicate-ring problem as the lathes, one seam per tube ring
		const nrm = tailGeo.attributes.normal as THREE.BufferAttribute;
		for (let i = 0; i <= TUBE_SEGS; i++) {
			const a = i * RING;
			const b = a + RING - 1;
			const x = nrm.getX(a) + nrm.getX(b);
			const y = nrm.getY(a) + nrm.getY(b);
			const z = nrm.getZ(a) + nrm.getZ(b);
			const l = Math.hypot(x, y, z) || 1;
			nrm.setXYZ(a, x / l, y / l, z / l);
			nrm.setXYZ(b, x / l, y / l, z / l);
		}
		nrm.needsUpdate = true;
	};
	setTailPuff(1);
	tail.add(new THREE.Mesh(tailGeo, fur));
	cat.add(tail);

	cat.userData.dispose = () => {
		for (const g of geos) g.dispose();
		for (const m of mats) m.dispose();
	};
	return { cat, legs, tail, ears, head, setTailPuff };
}

/** An umbrella, opened indoors, which is the whole problem. */
function buildUmbrella(): { umbrella: THREE.Group } {
	const umbrella = new THREE.Group();
	const cloth = new THREE.MeshStandardMaterial({
		color: 0x1f2a3a,
		roughness: 0.8,
		metalness: 0.02,
		side: THREE.DoubleSide
	});
	// an eight-gore canopy: a low cone reads as one the moment it has ribs
	const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.52, 8, 1, true), cloth);
	canopy.position.y = 0.26;
	umbrella.add(canopy);
	const ribMat = new THREE.MeshStandardMaterial({ color: 0x64707e, roughness: 0.4, metalness: 0.8 });
	const ribGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.06, 5);
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		const rib = new THREE.Mesh(ribGeo, ribMat);
		rib.position.set(Math.cos(a) * 0.5, 0.13, Math.sin(a) * 0.5);
		rib.rotation.z = Math.PI / 2 - 0.46;
		rib.rotation.y = -a;
		umbrella.add(rib);
	}
	const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.5, 8), ribMat);
	shaft.position.y = -0.4;
	umbrella.add(shaft);
	const hook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.026, 8, 16, Math.PI * 1.2), ribMat);
	hook.position.set(0.11, -1.13, 0);
	hook.rotation.z = Math.PI - 0.4; // J opens upward; it hung upside down before
	umbrella.add(hook);
	umbrella.userData.dispose = () => {
		canopy.geometry.dispose();
		ribGeo.dispose();
		shaft.geometry.dispose();
		hook.geometry.dispose();
		cloth.dispose();
		ribMat.dispose();
	};
	return { umbrella };
}

const COLD = new THREE.Color(0x9fb8d8);
const WARM = new THREE.Color(0xffc478);

// ---- the luck shield: a near-invisible bubble around the machine that
// FLARES where bad luck strikes it. This is the whole point of the effect —
// without a visible guardian, the superstitions just look like weather.
// Ripples spread from each impact direction across the bubble's surface.
const SHIELD_VERT = /* glsl */ `
	varying vec3 vDir;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		vDir = normalize(position);
		vNormal = normalMatrix * normal;
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		vView = -mv.xyz;
		gl_Position = projectionMatrix * mv;
	}`;

const SHIELD_FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uBase;
	uniform vec3 uHitDir[3];
	uniform float uHitT[3];
	uniform vec3 uGold;
	varying vec3 vDir;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
		// a faint woven shimmer so the idle bubble reads as a surface at all
		float weave = pow(abs(sin(vDir.x * 24.0 + uTime * 0.6)) * abs(sin(vDir.y * 24.0 - uTime * 0.4)), 6.0);
		float glow = fresnel * (0.18 + uBase * 1.2) + weave * uBase * 0.4;
		// impact ripples: rings racing out from wherever bad luck touched
		for (int i = 0; i < 3; i++) {
			float age = uTime - uHitT[i];
			if (age > 0.0 && age < 0.9) {
				float ang = acos(clamp(dot(vDir, uHitDir[i]), -1.0, 1.0));
				float ring = smoothstep(0.16, 0.0, abs(ang - age * 3.2)) * (1.0 - age / 0.9);
				float core = smoothstep(0.5, 0.0, ang) * (1.0 - age / 0.35) ;
				glow += ring * 1.3 + max(core, 0.0) * 0.9;
			}
		}
		gl_FragColor = vec4(uGold * glow, glow * 0.85);
	}`;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, lightning, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();

	const restore = dimLights(scene, 0.42, 700);
	scene.crossfadeEnvironment('nightSky', 800);
	scene.fxLight.color.set(0x9fb8d8);
	scene.fxLight.position.set(-1.5, 1.6, 1.8);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.4));
	machine.setInnerGlow(0.2, 0xbfe8ff);

	// ---- raise the shield
	const shieldMat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uBase: { value: 0 },
			uHitDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
			uHitT: { value: [-10, -10, -10] },
			uGold: { value: new THREE.Color(0xffd27a) }
		},
		vertexShader: SHIELD_VERT,
		fragmentShader: SHIELD_FRAG,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
	// small and personal: a dome over the centre button whose rim lands in
	// the cog-window gap. A machine-sized bubble read as fog; this reads as
	// a precision defence system guarding the crown jewel.
	const shieldCentre = new THREE.Vector3(btn.x, btn.y, 0.35);
	const shield = new THREE.Mesh(new THREE.SphereGeometry(0.85, 48, 32), shieldMat);
	shield.position.copy(shieldCentre);
	scene.scene.add(shield);
	let shieldT = 0;
	let hitSlot = 0;
	const stopShield = scene.addUpdatable((dt) => {
		shieldT += dt;
		shieldMat.uniforms.uTime.value = shieldT;
	});
	/** Register an impact: the bubble ripples out from that direction. */
	const shieldHit = (at: THREE.Vector3) => {
		const dir = at.clone().sub(shieldCentre).normalize();
		(shieldMat.uniforms.uHitDir.value as THREE.Vector3[])[hitSlot].copy(dir);
		(shieldMat.uniforms.uHitT.value as number[])[hitSlot] = shieldT;
		hitSlot = (hitSlot + 1) % 3;
	};
	// the shield charges a little with every save — by the finale it is FED UP
	let shieldCharge = 0.08;
	tween(600, 'outQuad', (v) => (shieldMat.uniforms.uBase.value = v * shieldCharge));
	const chargeShield = (to: number) => {
		const from = shieldCharge;
		shieldCharge = to;
		tween(500, 'outQuad', (v) => (shieldMat.uniforms.uBase.value = from + (to - from) * v));
	};

	/** Bad luck bounces off: shield ripple, gold sparks, a smug glow pulse. */
	const deflect = (at: THREE.Vector3, gain = 1) => {
		shieldHit(at);
		audio.sfx('ding', { pitch: 1.5, gain: 0.4 * gain });
		audio.sfx('pop', { pitch: 1.8, gain: 0.3 * gain });
		haptics.vibrate(16);
		particles.burst({
			texture: sprites.star4,
			count: Math.round(34 * gain),
			origin: at.clone(),
			originSpread: 0.14,
			speed: [1, 3],
			gravity: new THREE.Vector3(0, -2.2, 0),
			life: [0.5, 1.1],
			size: [0.03, 0.09],
			colors: [0xffd27a, 0xfff3cf, 0xffe0a0]
		});
		flashPulse(machine, 0.3 * gain, 90, 420, 0xffd27a);
	};

	// ================= BEAT 1: the ladder meets the air defence =================
	const ladder = buildLadder();
	ladder.position.set(btn.x - 0.1, 3.6, 0.85);
	ladder.rotation.z = 0.5;
	scene.scene.add(ladder);
	audio.sfx('swoosh', { pitch: 0.7, gain: 0.5 });
	// it drops ALL the way down, leaning right across the machine — a real
	// walk-under-me menace, not someone poking the button with a stepladder
	await tween(900, 'outCubic', (v) => {
		ladder.position.y = 3.6 - v * 3.25;
		ladder.rotation.z = 0.5 - v * 0.28;
	});
	// ...and the top clamps AIM. This machine has turrets and today it
	// remembers that.
	const clampR = machine.decos[0].userData.clamp as THREE.Group;
	const clampL = machine.decos[1].userData.clamp as THREE.Group;
	const aimR0 = clampR.rotation.z;
	const aimL0 = clampL.rotation.z;
	audio.sfx('tick', { pitch: 0.8, gain: 0.5 });
	haptics.vibrate(15);
	// they swing the long way round, roughly 180 degrees, and settle in the
	// frowning-eyebrow position. The machine is VISIBLY unimpressed.
	const aimSwing = Math.PI * 0.85;
	await tween(380, 'outBack', (v) => {
		clampR.rotation.z = aimR0 - v * aimSwing;
		clampL.rotation.z = aimL0 + v * aimSwing;
	});
	// charge glints at the muzzles
	const tipR = new THREE.Vector3();
	const tipL = new THREE.Vector3();
	clampR.getWorldPosition(tipR);
	clampL.getWorldPosition(tipL);
	for (const tip of [tipR, tipL]) {
		particles.burst({
			texture: sprites.spark,
			count: 8,
			origin: tip.clone().setZ(0.55),
			speed: [0.3, 0.9],
			life: [0.15, 0.35],
			size: [0.04, 0.09],
			colors: [0xffd27a, 0xfff3cf]
		});
	}
	await delay(260);
	// FIRE. Twin lucky lasers; the ladder becomes a firework of splinters.
	const target = new THREE.Vector3(btn.x - 0.05, ladder.position.y + 0.6, 0.85);
	const fireBeam = (from: THREE.Vector3) => {
		const dir = target.clone().sub(from);
		const len = dir.length();
		const geo = new THREE.CylinderGeometry(0.024, 0.024, len, 6);
		const mat = new THREE.MeshBasicMaterial({
			color: 0xffd27a,
			transparent: true,
			opacity: 1,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		const beam = new THREE.Mesh(geo, mat);
		beam.position.copy(from).addScaledVector(dir, 0.5);
		beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
		scene.scene.add(beam);
		tween(200, 'outQuad', (v) => {
			mat.opacity = 1 - v;
			beam.scale.x = beam.scale.z = 1 + v * 2;
		}).then(() => {
			scene.scene.remove(beam);
			geo.dispose();
			mat.dispose();
		});
	};
	audio.sfx('zap', { pitch: 1.2, gain: 0.6 });
	audio.sfx('zap', { pitch: 1.45, gain: 0.5 });
	audio.sfx('boom', { pitch: 1.1, gain: 0.55 });
	haptics.vibrate([25, 20, 60]);
	scene.shake(0.22);
	fireBeam(tipR.clone().setZ(0.55));
	fireBeam(tipL.clone().setZ(0.55));
	// recoil
	tween(140, 'outQuad', (v) => {
		clampR.rotation.z = aimR0 - aimSwing - v * 0.12;
		clampL.rotation.z = aimL0 + aimSwing + v * 0.12;
	});
	// the ladder is BLASTED: it cartwheels off the top of the frame in a
	// shower of splinters
	tween(620, 'inQuad', (v) => {
		ladder.position.y += v * 0.32;
		ladder.position.x += v * 0.14;
		ladder.rotation.z += v * 0.55; // adds up to a full dramatic cartwheel
	}).then(() => {
		scene.scene.remove(ladder);
		(ladder.userData.dispose as () => void)();
	});
	particles.burst({
		texture: sprites.softDot,
		count: 46,
		origin: target.clone(),
		originSpread: 0.5,
		speed: [1.2, 3.4],
		gravity: new THREE.Vector3(0, -3.4, 0),
		life: [0.6, 1.3],
		size: [0.03, 0.09],
		colors: [0x6b4a2a, 0x4a3520, 0x8a6a42]
	});
	deflect(target, 1.1);
	chargeShield(0.16);
	// turrets stand down, satisfied
	await delay(420);
	tween(600, 'inOutQuad', (v) => {
		clampR.rotation.z = aimR0 - (aimSwing + 0.12) * (1 - v);
		clampL.rotation.z = aimL0 + (aimSwing + 0.12) * (1 - v);
	});

	// ================= BEAT 2: the black cat =================
	await delay(500);
	const { cat, legs, tail, ears, head, setTailPuff } = buildCat(sprites.softDot);
	const startX = 3.4;
	cat.position.set(startX, -1.02, 1.05);
	cat.scale.setScalar(1.05);
	scene.scene.add(cat);
	let walk = 0;
	let walkRate = 9; // strides; the exit is considerably brisker
	let walking = true;

	const stopCat = scene.addUpdatable((dt, t) => {
		if (walking) walk += dt * walkRate;
		for (let i = 0; i < legs.length; i++) {
			legs[i].rotation.z = Math.sin(walk + i * 1.6) * (walking ? 0.55 : 0.05);
		}
		tail.rotation.z = -0.55 + Math.sin(t * 3.4) * 0.3;
		cat.position.y = Math.max(cat.position.y, -1.02 + Math.abs(Math.sin(walk)) * 0.02);
	});
	// crosses your path, right to left
	await tween(1500, 'linear', (v) => {
		cat.position.x = startX - v * 2.9;
	});
	// ...stops at the machine and leans in for a good sniff at the glow
	walking = false;
	audio.sfx('chime', { pitch: 0.75, gain: 0.3 });
	await tween(500, 'inOutQuad', (v) => {
		head.rotation.z = v * 0.35; // nose dips toward the machine
		cat.rotation.z = v * 0.1;
	});
	await tween(350, 'inOutQuad', (v) => (head.rotation.z = 0.35 - Math.sin(v * Math.PI) * 0.12)); // sniff sniff
	// the defence system fires a WARNING SHOT into the floor. Nobody shoots
	// the cat. The cat is merely advised.
	lightning.strike(
		new THREE.Vector3(btn.x - 0.2, btn.y - 0.6, 0.8),
		new THREE.Vector3(cat.position.x - 0.7, -1.0, 1.0),
		{ width: 0.025, life: 0.25, jitter: 0.2, generations: 4 }
	);
	audio.sfx('zap', { pitch: 1.6, gain: 0.35 });
	audio.sfx('pop', { pitch: 1.3, gain: 0.35 });
	deflect(new THREE.Vector3(btn.x - 0.2, btn.y - 0.55, 0.8), 0.6);
	chargeShield(0.24);
	haptics.vibrate(18);
	// STARTLE. The full cartoon: vertical leap, arched back, ears flat,
	// tail like a bottle brush.
	setTailPuff(1.45);
	for (const ear of ears) ear.rotation.z = 1.2; // pinned back
	await tween(340, (v) => Math.sin(v * Math.PI), (v) => {
		cat.position.y = -1.02 + v * 0.5;
		cat.rotation.z = 0.1 - v * 0.28; // back arches
		head.rotation.z = 0.35 - v * 0.6; // head snaps up
	});
	// lands facing the exit and BOLTS, dust flying
	cat.position.y = -1.02;
	walking = true;
	walkRate = 22;
	audio.sfx('swoosh', { pitch: 1.5, gain: 0.3 });
	for (let i = 0; i < 3; i++) {
		setTimeout(() => {
			particles.burst({
				texture: sprites.softDot,
				count: 7,
				origin: new THREE.Vector3(cat.position.x + 0.3, -1.05, 1.0),
				speed: [0.3, 0.8],
				gravity: new THREE.Vector3(0, 0.4, 0),
				life: [0.3, 0.7],
				size: [0.05, 0.12],
				colors: [0x9aa48a, 0x6a7460]
			});
		}, i * 160);
	}
	// a farewell of clovers where it stood: no hard feelings, gato
	particles.burst({
		texture: sprites.clover,
		count: 14,
		origin: new THREE.Vector3(cat.position.x - 0.2, -0.85, 1.1),
		originSpread: 0.16,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.5,
		speed: [0.6, 1.6],
		gravity: new THREE.Vector3(0, -1.4, 0),
		life: [0.8, 1.6],
		size: [0.05, 0.1],
		colors: [0x6fd48a, 0xa8f0bf],
		spin: [-4, 4]
	});
	await tween(750, 'inQuad', (v) => {
		cat.position.x = startX - 2.9 + v * 3.6; // straight back the way it came
		cat.rotation.z = -0.18 * (1 - v);
		head.rotation.z = -0.25 * (1 - v);
	});
	stopCat();
	scene.scene.remove(cat);
	(cat.userData.dispose as () => void)();

	// ================= BEAT 3: the umbrella, indoors =================
	// wrapped in a holder so the whole prop can be sized to fit the FRAME —
	// full size it played its entire scene above the top edge
	const { umbrella } = buildUmbrella();
	const brolly = new THREE.Group();
	brolly.add(umbrella);
	brolly.scale.setScalar(0.62);
	brolly.position.set(btn.x + 0.15, btn.y + 2.6, 1.15);
	umbrella.scale.set(0.06, 0.06, 0.06);
	scene.scene.add(brolly);
	audio.sfx('swoosh', { pitch: 1.2, gain: 0.4 });
	// it descends to hover right over the shielded button
	await tween(520, 'outQuad', (v) => {
		brolly.position.y = btn.y + 2.6 - v * 1.35;
		umbrella.scale.set(0.06, 0.06 + v * 0.2, 0.06); // still furled
	});
	// FWUMP
	audio.sfx('boom', { pitch: 1.15, gain: 0.5 });
	audio.sfx('swoosh', { pitch: 0.75, gain: 0.5 });
	haptics.vibrate([25, 20, 45]);
	scene.shake(0.2);
	await tween(420, 'outBack', (v) => {
		umbrella.scale.set(0.06 + v * 0.94, 0.26 + v * 0.74, 0.06 + v * 0.94);
	});
	// and immediately it rains — but only money, streaming out from under
	// the canopy while the umbrella is still centre stage
	audio.sfx('ding', { pitch: 1.1, gain: 0.5 });
	const rain = particles.emitter({
		texture: sprites.coin,
		count: 260,
		emitRate: 150,
		origin: new THREE.Vector3(btn.x, btn.y + 1.45, 1.05),
		originSpread: 0.75,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.14,
		speed: [1.6, 3],
		gravity: new THREE.Vector3(0, -3.4, 0),
		life: [1, 1.9],
		size: [0.05, 0.12],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
		spin: [-6, 6]
	});
	tween(1400, 'outCubic', (v) => {
		machine.setInnerGlow(0.2 + v * 0.4, 0xffd27a);
		scene.fxLight.color.copy(COLD).lerp(WARM, v);
		scene.fxLight.intensity = 1.4 + v * 2.6;
	});
	await delay(1400); // let the absurd little scene be ENJOYED
	// an umbrella, indoors?! The shield has SEEN ENOUGH. One pulse and the
	// offending article is BAMMED into the stratosphere, still spinning.
	deflect(new THREE.Vector3(btn.x, btn.y + 0.8, 0.55), 1.2);
	shockwave(scene.scene, new THREE.Vector3(brolly.position.x, brolly.position.y - 0.2, 1.0), {
		color: 0xffd27a,
		maxScale: 2.2,
		duration: 480,
		z: 1.0
	});
	chargeShield(0.34);
	audio.sfx('zap', { pitch: 1.1, gain: 0.45 });
	audio.sfx('boom', { pitch: 0.9, gain: 0.5 });
	scene.shake(0.18);
	tween(650, 'inCubic', (v) => {
		brolly.position.y = btn.y + 1.25 + v * 3.4;
		brolly.position.x = btn.x + 0.15 + v * 0.9;
		brolly.rotation.z = v * 6;
		brolly.scale.setScalar(0.62 * Math.max(0.1, 1 - v * 0.5));
	}).then(() => {
		scene.scene.remove(brolly);
		(umbrella.userData.dispose as () => void)();
	});
	// the money keeps falling a moment longer — the shield lets every coin
	// straight through. It knows the difference.
	await delay(900);
	rain.stop();
	// ================= the verdict =================
	// Three saves, fully charged: the shield gathers itself in tight...
	await tween(550, 'inQuad', (v) => {
		shieldMat.uniforms.uBase.value = 0.34 + v * 0.6;
		shield.scale.setScalar(1 - v * 0.2);
	});
	// ...and DETONATES as pure lucky energy. For good luck. Obviously.
	audio.sfx('gong', { pitch: 0.85, gain: 0.9 }); // THE DONG
	audio.sfx('boom', { pitch: 0.7, gain: 0.6 });
	haptics.vibrate([40, 40, 120]);
	scene.shake(0.35);
	flashPulse(machine, 0.7, 100, 750, 0xffd27a);
	tween(750, 'outCubic', (v) => {
		shield.scale.setScalar(0.8 + v * 2.6);
		shieldMat.uniforms.uBase.value = 0.94 * (1 - v);
	}).then(() => {
		scene.scene.remove(shield);
		shield.geometry.dispose();
		shieldMat.dispose();
	});
	shockwave(scene.scene, new THREE.Vector3(btn.x, btn.y, 0.5), {
		color: 0xffd27a,
		maxScale: 5.5,
		duration: 800,
		z: 0.5
	});
	particles.burst({
		texture: sprites.star4,
		count: 130,
		origin: new THREE.Vector3(btn.x, btn.y, 0.6),
		originSpread: 0.25,
		speed: [1.8, 4.8],
		gravity: new THREE.Vector3(0, -2, 0),
		life: [0.8, 1.8],
		size: [0.03, 0.11],
		colors: [0xffd27a, 0xfff3cf, 0xffe0a0, 0xbfffd8]
	});
	await luckyWord(ctx, {
		text: 'STILL LUCKY',
		color: 0xffd27a,
		colorB: 0xfff3cf,
		gather: 850,
		hold: 1000,
		scatter: 560
	});

	// ---- teardown
	stopShield();
	scene.crossfadeEnvironment('lounge');
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.6 * (1 - v));
		scene.fxLight.intensity = 4 * (1 - v);
	});
	await restore(900);
}
