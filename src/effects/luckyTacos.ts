// Effect — LUCKY TACOS: the button pops WAY out of the machine, a sombrero
// drops on, two maracas rise into its invisible hands, and it becomes a
// mariachi — squash-and-stretch bouncing on every beat with the maracas
// shaking in time with the bounce. The Hot Sauce of Fortune administers one
// glowing drop, and from ¡Suerte! the party is on: an Aztec-sunstone ring of
// hot-sauce bottles and tortilla chips counter-rotating around the button,
// chip rain, crumb-burst taco fly-bys, and ¡SUERTE! written in sparks. For
// the exit the button comes right out, pirouettes twice, the sombrero folds
// itself away, and the button drops back into its socket on the final chord.
//
// Sound: /soundfx/lucky-tacos.mp3 (24s, 126bpm). ALL the lyrics live in the
// first 8 seconds ("Lucky tacos, here we go!" ... "¡Suerte!" lands at 8.0),
// then it is music to the end — Suno ignored the prompt's structure, so the
// choreography follows the ACTUAL track, not the prompt. Zero procedural sfx:
// the track owns the whole mix.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave, disposeObject } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'luckyTacos';
export const duration = 25200;

const BEAT = 60 / 126; // 0.476s
const TORTILLA = 0xe8c67a;
const SALSA_RED = 0xd8362a;
const FIESTA = [0x2fae5e, 0xffffff, 0xe23d3d, 0xffd27a]; // flag + gold

/** The sombrero: upturned brim, tall dome, hatband, and little pompoms
 *  swinging under the rim, because a plain sombrero is a wasted sombrero. */
function buildSombrero(): THREE.Group {
	const g = new THREE.Group();
	const straw = new THREE.MeshStandardMaterial({ color: 0xd9a84e, roughness: 0.7, metalness: 0.05 });
	const red = new THREE.MeshStandardMaterial({ color: 0xc23b3b, roughness: 0.55, metalness: 0.05 });
	const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.35, metalness: 0.6 });
	const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.99, 0.05, 26), straw);
	g.add(brim);
	const curl = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.05, 10, 26), red);
	curl.rotation.x = Math.PI / 2;
	curl.position.y = 0.05;
	g.add(curl);
	const crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 20, 14, 0, Math.PI * 2, 0, 1.9), straw);
	crown.scale.set(1, 1.15, 1);
	crown.position.y = 0.06;
	g.add(crown);
	const band = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.04, 10, 24), red);
	band.rotation.x = Math.PI / 2;
	band.position.y = 0.16;
	g.add(band);
	const tip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), gold);
	tip.position.y = 0.54;
	g.add(tip);
	for (let i = 0; i < 8; i++) {
		const a = (i / 8) * Math.PI * 2;
		const pom = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), i % 2 ? gold : red);
		pom.position.set(Math.cos(a) * 0.93, -0.06, Math.sin(a) * 0.93);
		g.add(pom);
	}
	return g;
}

/** A maraca, pivoted at the handle end so one rotation is a shake. */
function buildMaraca(eggColor: number): THREE.Group {
	const g = new THREE.Group();
	const wood = new THREE.MeshStandardMaterial({ color: 0xb98a54, roughness: 0.6, metalness: 0.05 });
	const shell = new THREE.MeshStandardMaterial({ color: eggColor, roughness: 0.35, metalness: 0.1 });
	const gold = new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.35, metalness: 0.6 });
	const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.3, 10), wood);
	handle.position.y = 0.15;
	g.add(handle);
	const egg = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 14), shell);
	egg.scale.set(1, 1.25, 1);
	egg.position.y = 0.44;
	g.add(egg);
	const collar = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 16), gold);
	collar.rotation.x = Math.PI / 2;
	collar.position.y = 0.3;
	g.add(collar);
	for (let i = 0; i < 6; i++) {
		const a = (i / 6) * Math.PI * 2;
		const dot = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), gold);
		dot.position.set(Math.cos(a) * 0.145, 0.44, Math.sin(a) * 0.145);
		g.add(dot);
	}
	return g;
}

/** The Hot Sauce of Fortune: red bottle, green cap, chilli on the label. */
function buildBottle(): THREE.Group {
	const g = new THREE.Group();
	const glass = new THREE.MeshStandardMaterial({ color: SALSA_RED, roughness: 0.25, metalness: 0.1 });
	const capMat = new THREE.MeshStandardMaterial({ color: 0x2fae5e, roughness: 0.4, metalness: 0.1 });
	const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.34, 16), glass);
	body.position.y = 0.17;
	g.add(body);
	const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.11, 0.09, 16), glass);
	shoulder.position.y = 0.385;
	g.add(shoulder);
	const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.1, 12), glass);
	neck.position.y = 0.48;
	g.add(neck);
	const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 12), capMat);
	cap.position.y = 0.55;
	g.add(cap);
	// label: white wrap with a chilli, because branding matters
	const cv = document.createElement('canvas');
	cv.width = 128;
	cv.height = 64;
	const c = cv.getContext('2d')!;
	c.fillStyle = '#f6efe2';
	c.fillRect(0, 0, 128, 64);
	c.strokeStyle = '#c23b3b';
	c.lineWidth = 4;
	c.strokeRect(2, 2, 124, 60);
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	c.font = '30px serif';
	c.fillText('🌶️', 64, 26);
	c.fillStyle = '#c23b3b';
	c.font = 'bold 13px Georgia, serif';
	c.fillText('SUERTE', 64, 50);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	const label = new THREE.Mesh(
		new THREE.CylinderGeometry(0.115, 0.122, 0.2, 16, 1, true),
		new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 })
	);
	label.position.y = 0.19;
	g.add(label);
	g.userData.labelTex = tex;
	return g;
}

/** A taco done PROPERLY: a tortilla disc folded over — two semicircle shells
 *  hinged at a shared bottom fold, leaning apart, with the filling nestled
 *  down INSIDE the V and just peeking over the rim. */
function buildTaco(): THREE.Group {
	const g = new THREE.Group();
	const shellMat = new THREE.MeshStandardMaterial({
		color: TORTILLA,
		roughness: 0.65,
		metalness: 0.02,
		side: THREE.DoubleSide
	});
	const half = new THREE.CircleGeometry(0.45, 26, 0, Math.PI); // arc up, fold edge on x
	for (const s of [-1, 1]) {
		const shell = new THREE.Mesh(half, shellMat);
		shell.rotation.x = s * 0.52; // the two halves lean well apart from the fold
		g.add(shell);
	}
	// the filling sits DOWN in the V — bottoms near the fold, tops just
	// peeking over the rim. Floating above the shell reads as levitating veg.
	const fillings = [0x2fae5e, 0xe23d3d, 0xffd94e, 0x2fae5e];
	for (let i = 0; i < 4; i++) {
		const blob = new THREE.Mesh(
			new THREE.SphereGeometry(0.13, 10, 8),
			new THREE.MeshStandardMaterial({ color: fillings[i], roughness: 0.6 })
		);
		blob.position.set((i - 1.5) * 0.19, 0.29, rand(-0.03, 0.03));
		blob.scale.set(1, 0.9, 0.95);
		g.add(blob);
	}
	return g;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const t0 = performance.now();
	const since = () => performance.now() - t0;
	const at = (ms: number) => delay(Math.max(0, ms - since()));
	const btnHome = machine.buttonGroup.position.clone();
	const btnPos = machine.buttonWorldPosition();
	const frameHalfW = (z: number) =>
		Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * scene.camera.aspect * (5.35 - z);

	// ---- warm fiesta light, not darkness: this is an outdoor party
	const restore = dimLights(scene, 0.55, 700);
	scene.crossfadeEnvironment('gold', 800);
	scene.fxLight.color.set(0xffb45e);
	scene.fxLight.position.set(0.8, 1.2, 1.8);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.6));

	// ---- the wardrobe
	const sombrero = buildSombrero();
	sombrero.scale.setScalar(0.001);
	sombrero.position.set(0, 0.6, 0.0);
	sombrero.rotation.x = -0.2; // a jaunty tilt; further back and it's all brim underside
	machine.buttonGroup.add(sombrero); // wears the squash, spins the pirouette

	// maracas start OFF-SCREEN below the frame — no loitering in shot
	const maracaL = buildMaraca(0xe23d3d);
	const maracaR = buildMaraca(0x2fae5e);
	const maracaHomeY = btnPos.y - 0.2;
	maracaL.position.set(btnPos.x - 1.05, -3.2, 0.6);
	maracaR.position.set(btnPos.x + 1.05, -3.2, 0.6);
	scene.scene.add(maracaL, maracaR);

	// the sunstone: 4 sauce bottles + 16 chips in two counter-rotating rings,
	// every piece pointed radially like the rays of the stone
	const chipShape = new THREE.Shape();
	chipShape.moveTo(-0.16, -0.09);
	chipShape.lineTo(0.16, -0.09);
	chipShape.lineTo(0, 0.19);
	chipShape.closePath();
	const chipGeo = new THREE.ExtrudeGeometry(chipShape, { depth: 0.022, bevelEnabled: false });
	const chipMat = new THREE.MeshStandardMaterial({ color: 0xe8b95a, roughness: 0.6, metalness: 0.05 });
	interface RingItem {
		obj: THREE.Object3D;
		a0: number;
		r: number;
		dir: number; // spin direction
		radial: number; // extra rotation so it points outward (or inward)
	}
	const ringItems: RingItem[] = [];
	const bottles: THREE.Group[] = [];
	for (let i = 0; i < 4; i++) {
		const bottle = buildBottle();
		bottle.visible = false;
		scene.scene.add(bottle);
		bottles.push(bottle);
		ringItems.push({ obj: bottle, a0: (i / 4) * Math.PI * 2 + Math.PI / 4, r: 1.68, dir: 1, radial: -Math.PI / 2 });
	}
	for (let i = 0; i < 8; i++) {
		const chip = new THREE.Mesh(chipGeo, chipMat);
		chip.visible = false;
		scene.scene.add(chip);
		// offset half a step: at the bottles' angles the two overlapped exactly
		ringItems.push({ obj: chip, a0: (i / 8) * Math.PI * 2 + Math.PI / 8, r: 1.55, dir: 1, radial: -Math.PI / 2 });
	}
	for (let i = 0; i < 8; i++) {
		const chip = new THREE.Mesh(chipGeo, chipMat);
		chip.visible = false;
		scene.scene.add(chip);
		// inner ring: tips pointing IN, spinning the other way
		ringItems.push({ obj: chip, a0: (i / 8) * Math.PI * 2 + Math.PI / 8, r: 1.08, dir: -1, radial: Math.PI / 2 });
	}

	// rain chips (separate from the ring)
	// rain falls in the side lanes only — chips through the button's column
	// clip the popped-out performer
	const rainX = () => (Math.random() < 0.5 ? -1 : 1) * rand(0.95, frameHalfW(0.6));
	const rainChips: THREE.Mesh[] = [];
	for (let i = 0; i < 12; i++) {
		const chip = new THREE.Mesh(chipGeo, chipMat);
		chip.position.set(rainX(), 5 + rand(0, 4), rand(0.5, 0.65));
		chip.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
		chip.userData = { fall: rand(1.1, 1.9), spinX: rand(-3, 3), spinZ: rand(-3, 3) };
		chip.visible = false;
		scene.scene.add(chip);
		rainChips.push(chip);
	}

	const tacos: THREE.Group[] = [];
	for (let i = 0; i < 3; i++) {
		const taco = buildTaco();
		taco.scale.setScalar(1.15); // fly-bys deserve presence
		taco.visible = false;
		scene.scene.add(taco);
		tacos.push(taco);
	}

	// ---- the beat-locked band sim: everything moves off one clock
	let songT = 0;
	let groove = 0; // 0 still, 1 full fiesta
	let shakePunch = 0; // extra maraca throw for "shake, shake, shake"
	let chipsFalling = false;
	let tacoTime = false;
	let pirouette = false; // the exit owns the button transform
	let maracasHeld = true; // false once they dive down the hole
	let ringOut = 0; // 0 hidden, 1 deployed
	let ringSpin = 0;
	let ringRate = 0.45;
	const stopSim = scene.addUpdatable((dt, t) => {
		songT += dt;
		const phase = (songT % BEAT) / BEAT;
		const hop = Math.sin(Math.PI * phase); // up between beats
		const land = Math.pow(1 - phase, 3); // sharp at the beat

		if (!pirouette) {
			// squash and stretch: stretch mid-hop, squash on the landing,
			// volume roughly conserved. The sombrero is parented in, so it
			// squashes along and reads as one character.
			const stretch = 1 + hop * 0.1 * groove - land * 0.14 * groove;
			machine.buttonGroup.scale.set(1 + (1 - stretch) * 0.75, stretch, 1 + (1 - stretch) * 0.75);
			machine.buttonGroup.position.y = btnHome.y + hop * 0.075 * groove;
			// the hat dances WITH the bounce: a lagged bob, a beat-nod, a sway
			sombrero.position.y = 0.6 + Math.sin((Math.PI * ((songT - 0.09) % BEAT)) / BEAT) * 0.06 * groove;
			sombrero.rotation.x = -0.2 + land * 0.12 * groove;
			sombrero.rotation.z = Math.sin((songT * Math.PI) / BEAT / 2) * 0.1 * groove;
		}

		// maracas shake IN TIME WITH THE BOUNCE: they snap up on each landing
		// and relax through the hop, mirrored like a real pair of hands. Full
		// throw from entrance to exit — a quiet maraca is a sad maraca.
		if (maracasHeld) {
			const flick = land * (0.62 + shakePunch);
			maracaL.rotation.z = 0.3 + flick;
			maracaR.rotation.z = -0.3 - flick;
			if (maracaL.position.y > -2) {
				maracaL.position.y = maracaHomeY + hop * 0.06 * groove;
				maracaR.position.y = maracaHomeY + hop * 0.06 * groove;
			}
		}

		// the sunstone turns: outer ring one way, inner ring the other,
		// breathing in and out on the beat
		ringSpin += dt * ringRate;
		for (const item of ringItems) {
			if (!item.obj.visible) continue;
			const a = item.a0 + ringSpin * item.dir;
			const r = item.r * ringOut * (1 + land * 0.045 * groove);
			item.obj.position.set(btnPos.x + Math.cos(a) * r, btnPos.y + Math.sin(a) * r, 0.82);
			item.obj.rotation.z = a + item.radial; // rays, not confetti
			item.obj.scale.setScalar(Math.max(0.001, ringOut) * (item.r > 1.3 ? 1 : 0.85));
		}

		if (chipsFalling) {
			for (const chip of rainChips) {
				chip.position.y -= chip.userData.fall * dt;
				chip.rotation.x += chip.userData.spinX * dt;
				chip.rotation.z += chip.userData.spinZ * dt;
				if (chip.position.y < -2.2) {
					chip.position.set(rainX(), rand(2.2, 3.6), rand(0.5, 0.65));
					chip.userData.fall = rand(1.1, 1.9);
				}
			}
		}
		if (tacoTime) {
			for (const taco of tacos) {
				if (!taco.visible) continue;
				const u = taco.userData;
				u.vy -= 5 * dt;
				taco.position.x += u.vx * dt;
				taco.position.y += u.vy * dt;
				taco.rotation.z = Math.sin(songT * u.rock) * 0.2; // rocks, never disc-spins
				if (taco.position.y < -1.05 && u.vy < 0) {
					u.vy = Math.abs(u.vy) * 0.82;
					// crumbs on impact — the closest a taco gets to an explosion
					particles.burst({
						texture: sprites.star4,
						count: 14,
						origin: taco.position.clone(),
						direction: new THREE.Vector3(0, 1, 0),
						cone: 0.7,
						speed: [0.8, 2],
						gravity: new THREE.Vector3(0, -3, 0),
						life: [0.4, 0.9],
						size: [0.03, 0.07],
						colors: [0xe8b95a, TORTILLA, 0xfff0c8]
					});
					taco.scale.set(1.5, 1.05, 1.3);
					tween(160, 'outQuad', (v) => taco.scale.set(1.5 - v * 0.2, 1.05 + v * 0.25, 1.3));
				}
			}
		}

		// party light strolling through the flag colours each bar
		const bar = Math.floor(songT / (BEAT * 4));
		scene.fxLight.color.set(FIESTA[(bar + 2) % FIESTA.length]);
		scene.fxLight.intensity = 1.3 + land * 0.6 * groove;
	});

	// ================================================================ VERSE (0-8s)
	// "Lucky tacos, here we go!" — the button steps WELL out on stage
	await at(300);
	haptics.vibrate(25);
	await tween(700, 'outBack', (v) => {
		machine.buttonGroup.position.z = btnHome.z + v * 0.85;
	});
	// the sombrero pops on; the maracas rise straight into the invisible hands
	tween(700, 'outBack', (v) => sombrero.scale.setScalar(Math.max(0.001, v * 0.72)));
	tween(850, 'outBack', (v) => {
		maracaL.position.y = -3.2 + v * (maracaHomeY + 3.2);
		maracaR.position.y = -3.2 + v * (maracaHomeY + 3.2);
	});
	machine.mechSpeed = 2;
	groove = 0.22; // a polite sway under the verse

	// "Shake, shake, shake — the fortune's coming!" (three big punches)
	await at(4200);
	for (let i = 0; i < 3; i++) {
		tween(360, (v) => Math.sin(v * Math.PI), (v) => (shakePunch = v * 0.7));
		haptics.vibrate(15);
		await delay(430);
	}

	// "One spicy drop and luck starts running!" — one bottle does the honours
	const pourer = bottles[0];
	pourer.visible = true;
	pourer.scale.setScalar(1);
	pourer.position.set(-frameHalfW(0.6) - 0.6, btnPos.y + 0.9, 0.7);
	await tween(650, 'outCubic', (v) => {
		pourer.position.x = -frameHalfW(0.6) - 0.6 + v * (btnPos.x - 0.8 - (-frameHalfW(0.6) - 0.6));
	});
	// tip TOWARD the button: mouth down-right, over the cap
	await tween(380, 'inOutQuad', (v) => (pourer.rotation.z = -v * 2.2));
	const dropMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xff5030,
		transparent: true,
		opacity: 1,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	const drop = new THREE.Sprite(dropMat);
	drop.scale.setScalar(0.16);
	drop.position.set(btnPos.x - 0.45, btnPos.y + 0.62, 0.75);
	scene.scene.add(drop);
	await tween(380, 'inQuad', (v) => {
		drop.position.y = btnPos.y + 0.62 - v * 0.5;
		drop.position.x = btnPos.x - 0.45 + v * 0.45;
	});
	scene.scene.remove(drop);
	dropMat.dispose();
	// ...and luck starts running: chilli-hot glow
	haptics.vibrate([20, 30, 50]);
	machine.setInnerGlow(0.3, 0xff7040);
	flashPulse(machine, 0.35, 80, 500, 0xff6a4a);
	shockwave(scene.scene, new THREE.Vector3(btnPos.x, btnPos.y, 0.55), {
		color: 0xff6a4a,
		maxScale: 2.6,
		duration: 550,
		z: 0.55
	});
	tween(450, 'inOutQuad', (v) => (pourer.rotation.z = -2.2 + v * 2.2));

	// ================================================================ ¡SUERTE! (8s)
	await at(8000);
	scene.shake(0.22);
	haptics.vibrate([30, 30, 60]);
	const cannon = (x: number) =>
		particles.burst({
			texture: sprites.star4,
			count: 70,
			origin: new THREE.Vector3(x, -1.4, 0.7),
			direction: new THREE.Vector3(-Math.sign(x) * 0.4, 1, 0.1),
			cone: 0.45,
			speed: [2.6, 5.2],
			gravity: new THREE.Vector3(0, -2, 0),
			life: [1.2, 2.2],
			size: [0.04, 0.1],
			colors: FIESTA,
			spin: [-7, 7]
		});
	cannon(-frameHalfW(0.7) * 0.75);
	cannon(frameHalfW(0.7) * 0.75);
	flashPulse(machine, 0.5, 80, 550, 0xffd27a);
	// ¡SUERTE! in sparks, right on the shout
	void luckyWord(ctx, {
		text: '¡SUERTE!',
		color: 0xff8a5e,
		colorB: 0xffd27a,
		gather: 750,
		hold: 1100,
		scatter: 650,
		silent: true
	});
	// the music takes over: groove to full, chips falling, wheels turning
	tween(1400, 'inQuad', (v) => (groove = 0.22 + v * 0.78));
	machine.mechSpeed = 4;
	chipsFalling = true;
	for (const chip of rainChips) chip.visible = true;

	// ---- the sunstone deploys: the pourer flies to its slot, the rest of the
	// ring blooms out around the button piece by piece
	await at(9200);
	machine.setInnerGlow(0.4, 0xff7040);
	const slot0 = ringItems[0];
	const from0 = pourer.position.clone();
	tween(600, 'inOutQuad', (v) => {
		const a = slot0.a0 + ringSpin * slot0.dir;
		const target = new THREE.Vector3(
			btnPos.x + Math.cos(a) * slot0.r * ringOut,
			btnPos.y + Math.sin(a) * slot0.r * ringOut,
			0.82
		);
		pourer.position.lerpVectors(from0, target, v);
	});
	for (const item of ringItems) item.obj.visible = true;
	await tween(1100, 'outCubic', (v) => (ringOut = v));

	// ---- taco fly-bys, big and bouncing, with crumb bursts on every impact
	tacoTime = true;
	const launchTaco = (i: number, dir: number) => {
		const taco = tacos[i];
		taco.visible = true;
		// fly IN FRONT of the popped-out button (its cap sits around z 1.3) —
		// crossing at button depth sliced straight through the performer
		taco.position.set(-dir * (frameHalfW(1.5) + 0.9), rand(-0.5, 0.3), 1.5);
		// a 3/4 view: face-on the folded disc reads as a flat pac-man
		taco.rotation.set(0.32, dir * 0.55, 0);
		taco.userData = { vx: dir * rand(1.7, 2.4), vy: rand(1.2, 2.2), rock: rand(2.4, 3.4) };
	};
	launchTaco(0, 1);
	setTimeout(() => launchTaco(1, -1), 2600);
	setTimeout(() => launchTaco(2, 1), 5400);

	// ---- sunstone flourish: both rings whip up to double speed and flare
	await at(14800);
	tween(1200, (v) => Math.sin(v * Math.PI), (v) => (ringRate = 0.45 + v * 1.1));
	flashPulse(machine, 0.4, 90, 600, 0xffd27a);

	// ================================================================ THE EXIT (from ~20s)
	// ONE continuous move: bounce dancing straight into a forward swoop, a
	// double pirouette, then a backflip home — during which the hat and both
	// maracas dive down the open socket — and the button drops into place
	// with a DONG. No standing still; performers finish the routine.
	await at(20200);
	tacoTime = false;
	for (const taco of tacos) taco.visible = false;
	chipsFalling = false;
	tween(600, 'inQuad', (v) => (ringOut = 1 - v)).then(() => {
		for (const item of ringItems) item.obj.visible = false;
	});
	setTimeout(() => {
		for (const chip of rainChips) chip.visible = false;
	}, 900);
	await at(20800);

	// the swoop grows straight out of the bounce: no windup pause, the last
	// landing IS the anticipation
	pirouette = true;
	machine.buttonGroup.position.y = btnHome.y;
	await tween(500, 'outCubic', (v) => {
		machine.buttonGroup.position.z = btnHome.z + 0.85 + v * 0.65;
		const s = 1 + v * 0.12; // stretches into the swoop
		machine.buttonGroup.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
	});
	// double pirouette, still travelling
	await tween(1150, 'inOutCubic', (v) => {
		machine.buttonGroup.rotation.y = v * Math.PI * 4;
		const s = 1.12 + Math.sin(v * Math.PI) * 0.08;
		machine.buttonGroup.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s));
		sombrero.rotation.z = Math.sin(v * Math.PI * 2) * 0.12; // hat holds on
	});
	machine.buttonGroup.rotation.y = 0;

	// THE BACKFLIP: head-over-heels on the way home. The hat lets go at the
	// top and dives down the open socket with both maracas right behind it.
	maracasHeld = false;
	machine.buttonGroup.remove(sombrero);
	sombrero.position.set(btnPos.x, btnPos.y + 0.75, 1.2);
	sombrero.rotation.set(-0.2, 0, 0);
	sombrero.scale.setScalar(0.72);
	scene.scene.add(sombrero);
	const holeDive = (obj: THREE.Object3D, ms: number, spin: number) => {
		const from = obj.position.clone();
		const startRot = obj.rotation.z;
		return tween(ms, 'inQuad', (v) => {
			obj.position.set(
				from.x + (btnPos.x - from.x) * v,
				from.y + (btnPos.y - 0.1 - from.y) * v,
				from.z + (0.12 - from.z) * v
			);
			obj.rotation.z = startRot + v * spin;
			obj.scale.setScalar(Math.max(0.001, obj.scale.x * (1 - v * 0.12)));
		}).then(() => (obj.visible = false));
	};
	holeDive(sombrero, 620, 2.5);
	holeDive(maracaL, 560, 4);
	holeDive(maracaR, 640, -4);
	await tween(720, 'inOutQuad', (v) => {
		machine.buttonGroup.rotation.x = -v * Math.PI * 2; // the flip
		machine.buttonGroup.position.z = btnHome.z + 1.5 - v * 1.1;
		machine.buttonGroup.position.y = btnHome.y + Math.sin(v * Math.PI) * 0.5; // the arc
	});
	machine.buttonGroup.rotation.x = 0;
	// and the landing: straight down into the socket, squash, DONG
	await tween(300, 'inQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + 0.4 - v * 0.4;
		machine.buttonGroup.position.y = btnHome.y;
	});
	audio.sfx('gong', { pitch: 0.9, gain: 0.8 });
	scene.shake(0.22);
	haptics.vibrate([25, 25, 70]);
	flashPulse(machine, 0.35, 80, 600, 0xffd27a);
	await tween(380, 'outBack', (v) => {
		const s = 1 - (1 - v) * 0.24; // squash 0.76 -> 1 with overshoot
		machine.buttonGroup.scale.set(1 + (1 - s) * 0.9, s, 1 + (1 - s) * 0.9);
	});
	machine.buttonGroup.scale.set(1, 1, 1);

	// ---- house lights; the track plays itself out
	machine.mechSpeed = 1;
	tween(900, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.4 * (1 - v));
		scene.fxLight.intensity = 1.5 * (1 - v);
	});
	await at(24300);

	// ---- teardown
	stopSim();
	machine.buttonGroup.position.copy(btnHome);
	machine.buttonGroup.scale.set(1, 1, 1);
	machine.buttonGroup.rotation.y = 0;
	machine.buttonGroup.rotation.x = 0;
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	scene.scene.remove(sombrero, maracaL, maracaR, ...tacos, ...rainChips);
	for (const item of ringItems) scene.scene.remove(item.obj);
	disposeObject(sombrero);
	disposeObject(maracaL);
	disposeObject(maracaR);
	for (const bottle of bottles) {
		disposeObject(bottle);
		(bottle.userData.labelTex as THREE.Texture)?.dispose();
	}
	for (const taco of tacos) disposeObject(taco);
	chipGeo.dispose();
	chipMat.dispose();
	scene.crossfadeEnvironment('lounge');
	await restore(900);
}
