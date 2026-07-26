// Effect — MANEKI-NEKO: the beckoning cat. A solid gold lucky cat rises out of
// the bore, raises its paw, and waves — and every wave DRAGS a wall of coins in
// from off-screen, because that is what beckoning is for. Sakura falls
// throughout, because it is also very pleased with itself.
//
// Gold statue rather than painted ceramic: it belongs to the machine's metalwork
// that way, and a cast figure needs no fur, whiskers or texture work to read.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'luckySymbol';
export const duration = 10800;

/** A single sakura petal: a soft pink teardrop with a notched tip. */
let petalTex: THREE.CanvasTexture | null = null;
function petalTexture(): THREE.CanvasTexture {
	if (petalTex) return petalTex;
	const S = 64;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	const g = c.createLinearGradient(0, 0, 0, S);
	g.addColorStop(0, 'rgba(255,225,236,0)');
	g.addColorStop(0.25, 'rgba(255,205,224,0.95)');
	g.addColorStop(1, 'rgba(246,150,190,0.85)');
	c.fillStyle = g;
	c.beginPath();
	c.moveTo(S / 2, S * 0.06);
	c.bezierCurveTo(S * 0.94, S * 0.3, S * 0.86, S * 0.86, S / 2, S * 0.96);
	c.bezierCurveTo(S * 0.14, S * 0.86, S * 0.06, S * 0.3, S / 2, S * 0.06);
	c.fill();
	// the notch at the tip that makes it a cherry petal and not a leaf
	c.globalCompositeOperation = 'destination-out';
	c.beginPath();
	c.ellipse(S / 2, S * 0.99, S * 0.14, S * 0.13, 0, 0, Math.PI * 2);
	c.fill();
	petalTex = new THREE.CanvasTexture(cv);
	petalTex.colorSpace = THREE.SRGBColorSpace;
	return petalTex;
}

interface Neko {
	cat: THREE.Group;
	pawPivot: THREE.Group;
	head: THREE.Group;
	dispose: () => void;
}

function buildNeko(): Neko {
	const cat = new THREE.Group();
	const gold = new THREE.MeshStandardMaterial({
		color: 0xd9a842,
		metalness: 0.94,
		roughness: 0.24,
		emissive: 0x3a2708,
		emissiveIntensity: 0.5
	});
	const bright = new THREE.MeshStandardMaterial({
		color: 0xf7ce6b,
		metalness: 0.95,
		roughness: 0.16,
		emissive: 0x5a3f10,
		emissiveIntensity: 0.8
	});
	const dark = new THREE.MeshStandardMaterial({ color: 0x201406, metalness: 0.5, roughness: 0.5 });
	const geos: THREE.BufferGeometry[] = [];
	const keep = <T extends THREE.BufferGeometry>(g: T) => {
		geos.push(g);
		return g;
	};

	// seated body: a squat egg, widest at the base
	const body = new THREE.Mesh(keep(new THREE.SphereGeometry(0.34, 28, 22)), gold);
	body.scale.set(1, 1.06, 0.92);
	body.position.y = 0.32;
	cat.add(body);
	// haunches
	for (const s of [-1, 1]) {
		const paw = new THREE.Mesh(keep(new THREE.SphereGeometry(0.11, 16, 12)), gold);
		paw.scale.set(1.25, 0.75, 1.1);
		paw.position.set(s * 0.24, 0.08, 0.2);
		cat.add(paw);
	}

	const head = new THREE.Group();
	head.position.set(0, 0.74, 0.02);
	const skull = new THREE.Mesh(keep(new THREE.SphereGeometry(0.27, 28, 22)), gold);
	skull.scale.set(1.06, 0.96, 0.94);
	head.add(skull);
	for (const s of [-1, 1]) {
		const ear = new THREE.Mesh(keep(new THREE.ConeGeometry(0.1, 0.17, 12)), gold);
		ear.position.set(s * 0.17, 0.23, -0.01);
		ear.rotation.z = -s * 0.34;
		head.add(ear);
		// eyes: closed-happy arcs read as content; two dark beads are enough
		const eye = new THREE.Mesh(keep(new THREE.SphereGeometry(0.032, 12, 10)), dark);
		eye.position.set(s * 0.1, 0.03, 0.245);
		eye.scale.set(1, 1.25, 0.5);
		head.add(eye);
	}
	const muzzle = new THREE.Mesh(keep(new THREE.SphereGeometry(0.085, 16, 12)), bright);
	muzzle.scale.set(1.2, 0.8, 0.7);
	muzzle.position.set(0, -0.07, 0.23);
	head.add(muzzle);
	cat.add(head);

	// the beckoning paw, hinged at the shoulder so one rotation.z is the wave
	const pawPivot = new THREE.Group();
	pawPivot.position.set(0.26, 0.5, 0.12);
	const arm = new THREE.Mesh(keep(new THREE.CapsuleGeometry(0.062, 0.24, 6, 12)), gold);
	arm.position.y = 0.14;
	pawPivot.add(arm);
	const mitt = new THREE.Mesh(keep(new THREE.SphereGeometry(0.09, 16, 12)), bright);
	mitt.position.y = 0.3;
	pawPivot.add(mitt);
	cat.add(pawPivot);

	// the other paw stays down, holding the koban
	const koban = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.15, 0.15, 0.045, 24)), bright);
	koban.scale.set(1, 1, 0.62); // the oval of an Edo gold piece
	koban.rotation.x = Math.PI / 2;
	koban.position.set(-0.17, 0.27, 0.34);
	koban.rotation.z = 0.42;
	cat.add(koban);

	// collar and bell
	const collar = new THREE.Mesh(keep(new THREE.TorusGeometry(0.22, 0.028, 10, 24)), dark);
	collar.position.set(0, 0.55, 0.02);
	collar.rotation.x = 1.35;
	cat.add(collar);
	const bell = new THREE.Mesh(keep(new THREE.SphereGeometry(0.055, 14, 12)), bright);
	bell.position.set(0, 0.5, 0.24);
	cat.add(bell);

	// tail curled round the base
	const tail = new THREE.Mesh(keep(new THREE.TorusGeometry(0.16, 0.045, 10, 24, Math.PI * 1.3)), gold);
	tail.position.set(-0.3, 0.16, -0.16);
	tail.rotation.set(0.4, 0.9, 1.4);
	cat.add(tail);

	return {
		cat,
		pawPivot,
		head,
		dispose: () => {
			for (const g of geos) g.dispose();
			gold.dispose();
			bright.dispose();
			dark.dispose();
		}
	};
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();
	const btnHome = machine.buttonGroup.position.clone();

	const restore = dimLights(scene, 0.4, 800);
	scene.crossfadeEnvironment('gold', 900);
	scene.fxLight.color.set(0xffd9a0);
	scene.fxLight.position.set(0, 0.4, 1.8);
	tween(800, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.6));
	machine.setInnerGlow(0.24, 0xffd27a);
	machine.mechSpeed = 3.5;

	// ---- sakura, from the very first frame — it sets the register before
	// anything else happens
	const petals = particles.emitter({
		texture: petalTexture(),
		count: 260,
		emitRate: 44,
		origin: new THREE.Vector3(0, 2.5, 0.7),
		originSpread: 2.6,
		direction: new THREE.Vector3(-0.25, -1, 0),
		cone: 0.35,
		speed: [0.35, 0.85],
		gravity: new THREE.Vector3(0.05, -0.28, 0),
		drag: 0.995,
		life: [3.4, 5.2],
		size: [0.05, 0.115],
		colors: [0xffffff, 0xffd6e6, 0xf6a8c8],
		spin: [-2.4, 2.4],
		fadeIn: 0.12
	});

	// ---- the hatch: the button lifts out of the way and the cat rises through
	const { cat, pawPivot, head, dispose } = buildNeko();
	cat.position.set(btnHome.x, btnHome.y - 0.5, btnHome.z - 0.2);
	cat.scale.setScalar(0.001);
	machine.centre.add(cat);

	await delay(500);
	audio.sfx('clang', { pitch: 1.25, gain: 0.45 });
	await tween(240, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + v * 0.22;
	});
	tween(760, 'outCubic', (v) => {
		machine.buttonGroup.position.y = btnHome.y + v * 1.02;
	});
	audio.sfx('chime', { pitch: 0.8, gain: 0.55 });
	haptics.vibrate([18, 40, 60]);
	particles.burst({
		texture: sprites.softDot,
		count: 34,
		origin: new THREE.Vector3(btn.x, btn.y, 0.5),
		originSpread: 0.22,
		speed: [0.25, 0.8],
		gravity: new THREE.Vector3(0, 0.5, 0),
		life: [0.7, 1.6],
		size: [0.07, 0.2],
		colors: [0xffe9ad, 0xffd27a, 0xfff6e0],
		fadeIn: 0.15
	});
	await tween(900, 'outCubic', (v) => {
		cat.scale.setScalar(Math.max(0.001, v * 1.18));
		cat.position.y = btnHome.y - 0.5 + v * 0.62;
		cat.position.z = btnHome.z - 0.2 + v * 1.05;
	});

	// ---- the wave. One value drives paw, head and bell together.
	let waveT = -1;
	let bob = 0;
	const stopWave = scene.addUpdatable((dt, t) => {
		if (waveT >= 0) {
			waveT += dt;
			// the classic maneki-neko motion: paw arcs down and back up, never
			// pausing at the bottom
			const swing = Math.sin(waveT * 5.6);
			pawPivot.rotation.z = -0.35 - swing * 0.55;
			head.rotation.z = swing * 0.07;
			head.rotation.y = Math.sin(waveT * 2.8) * 0.13;
		}
		cat.position.y = btnHome.y + 0.12 + Math.sin(t * 1.6) * 0.018 + bob;
	});
	pawPivot.rotation.z = -0.35;
	waveT = 0;

	/** Each wave HAULS money in from off the sides of the frame. */
	const beckon = (strength: number) => {
		audio.sfx('ding', { pitch: 1.1 + strength * 0.25, gain: 0.4 + strength * 0.2 });
		haptics.vibrate(22 + strength * 20);
		tween(260, 'outQuad', (v) => (bob = Math.sin(Math.PI * v) * 0.05));
		for (const side of [-1, 1]) {
			particles.burst({
				texture: sprites.coin,
				count: Math.round(30 + strength * 44),
				origin: new THREE.Vector3(side * 3.4, btn.y + rand(-0.5, 0.7), 0.75),
				originSpread: 0.55,
				direction: new THREE.Vector3(-side * 1, 0.18, 0),
				cone: 0.24,
				speed: [3.4 + strength * 1.6, 5.6 + strength * 2.2],
				drag: 0.985,
				gravity: new THREE.Vector3(0, -1.4, 0),
				life: [1, 1.7],
				size: [0.05, 0.12],
				colors: [0xf7ce6b, 0xffe9ad, 0xd9a842],
				spin: [-7, 7],
				fadeIn: 0.05
			});
		}
		tween(700, 'outQuad', (v) => {
			machine.setInnerGlow(0.24 + Math.sin(Math.PI * v) * (0.2 + strength * 0.25), 0xffd27a);
		});
	};

	await delay(320);
	beckon(0);
	await delay(1100);
	beckon(0.5);
	await delay(1100);
	beckon(1);
	await delay(900);

	// ---- the big one: it beckons with everything it has
	audio.sfx('gong', { pitch: 0.92, gain: 0.8 });
	audio.sfx('boom', { pitch: 0.7, gain: 0.6 });
	haptics.vibrate([45, 30, 120]);
	scene.shake(0.4);
	flashPulse(machine, 0.75, 110, 780, 0xffd27a);
	shockwave(scene.scene, new THREE.Vector3(btn.x, btn.y, 0.7), {
		color: 0xffd27a,
		maxScale: 5.4,
		duration: 820,
		z: 0.7
	});
	beckon(1.4);
	tween(500, 'outQuad', (v) => {
		pawPivot.rotation.z = -0.35 - v * 1.1; // paw held high
		scene.fxLight.intensity = 2.6 + v * 3;
	});
	waveT = -1;
	particles.burst({
		texture: sprites.coin,
		count: 150,
		origin: new THREE.Vector3(btn.x, btn.y, 0.6),
		originSpread: 0.2,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.95,
		speed: [2.4, 5.4],
		gravity: new THREE.Vector3(0, -3.2, 0),
		life: [1.2, 2.3],
		size: [0.06, 0.14],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff0cf],
		spin: [-6, 6]
	});

	await luckyWord(ctx, {
		text: 'BECKONED',
		color: 0xffd27a,
		colorB: 0xfff0c8,
		gather: 850,
		hold: 1050,
		scatter: 560
	});

	// ---- back into the machine, hatch shut
	petals.stop();
	audio.sfx('chime', { pitch: 0.7, gain: 0.4 });
	await tween(700, 'inCubic', (v) => {
		cat.scale.setScalar(Math.max(0.001, 1.18 * (1 - v)));
		cat.position.y = btnHome.y + 0.12 - v * 0.6;
		cat.position.z = btnHome.z + 0.85 - v * 1.05;
	});
	stopWave();
	machine.centre.remove(cat);
	dispose();
	await tween(620, 'outBack', (v) => {
		machine.buttonGroup.position.y = btnHome.y + 1.02 * (1 - v);
	});
	audio.sfx('clack', { pitch: 0.9, gain: 0.5 });
	await tween(220, 'outQuad', (v) => {
		machine.buttonGroup.position.z = btnHome.z + 0.22 * (1 - v);
	});
	machine.buttonGroup.position.copy(btnHome);

	machine.mechSpeed = 1;
	scene.crossfadeEnvironment('lounge');
	tween(900, 'outQuad', (v) => {
		machine.setInnerGlow(0.44 * (1 - v));
		scene.fxLight.intensity = 5.6 * (1 - v);
	});
	await restore(900);
}
