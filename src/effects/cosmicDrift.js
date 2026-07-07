// Effect 15 — COSMIC DRIFT: the lounge dissolves into deep space. The machine
// levitates gently among nebulae while shooting stars streak past — luck on a
// universal scale.

import * as THREE from 'three';
import { tween, delay, rand, pick } from '../core/anim.js';
import { flashPulse } from './helpers.js';

export const sound = 'rimLight';
export const duration = 10500;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	// night falls hard — the leather wall fades into the void
	const key0 = scene.keyLight.intensity;
	const fill0 = scene.fillLight.intensity;
	const env0 = scene.scene.environmentIntensity;
	const bg0 = scene.scene.background;
	const backdrop = machine.backdrop;
	await tween(1400, 'inOutQuad', (v) => {
		scene.keyLight.intensity = key0 * (1 - v * 0.72);
		scene.fillLight.intensity = fill0 * (1 - v * 0.45);
		scene.scene.environmentIntensity = env0 * (1 - v * 0.7);
		backdrop.material.opacity = 1 - v;
	});
	backdrop.material.transparent = true;
	backdrop.visible = false;
	scene.scene.background = new THREE.Color(0x040510);

	// starfield — twinkles for instant depth, plus two drifting parallax
	// layers so space itself feels like it's slowly sliding past
	const stars = [];
	for (const [depth, size, count] of [[-3, 0.02, 110], [-6, 0.035, 80]]) {
		stars.push(
			particles.burst({
				texture: sprites.softDot,
				count,
				origin: new THREE.Vector3(0, 0, depth),
				originSpread: 7,
				speed: [0.005, 0.02],
				gravity: new THREE.Vector3(0, 0, 0),
				life: [9, 12],
				size: [size * 0.6, size * 1.6],
				colors: [0xffffff, 0xcfe2ff, 0xffe9c0],
				fadeIn: 0.12
			})
		);
	}
	const drifters = [];
	for (const [depth, size, rate, sp] of [[-2.5, 0.028, 26, [0.5, 0.9]], [-5.5, 0.016, 20, [0.18, 0.38]]]) {
		drifters.push(
			particles.emitter({
				texture: sprites.softDot,
				count: 170,
				emitRate: rate,
				origin: new THREE.Vector3(0, 0.2, depth),
				originSpread: 7,
				direction: new THREE.Vector3(-1, -0.08, 0).normalize(),
				cone: 0.05,
				speed: sp,
				gravity: new THREE.Vector3(0, 0, 0),
				life: [5, 8],
				size: [size * 0.6, size * 1.5],
				colors: [0xffffff, 0xcfe2ff, 0xffe9c0],
				fadeIn: 0.25
			})
		);
	}
	// nebulae — vast slow clouds of colour
	const nebulae = [];
	for (const [color, x, y, s] of [[0x5a3a8a, -2.4, 1, 5], [0x1a5a6a, 2.6, -0.5, 6], [0x6a2a4a, 0.5, 2, 4.5]]) {
		const n = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: sprites.softDot,
				color,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false
			})
		);
		n.position.set(x, y, -4);
		n.scale.setScalar(s);
		scene.scene.add(n);
		nebulae.push(n);
		tween(2000, 'inOutQuad', (v) => (n.material.opacity = v * 0.33));
	}

	// ACCRETION RING — debris orbiting the machine like Saturn's rings. Rigid
	// angular motion, so these are their own THREE.Points clouds (not particles).
	const ringCenter = new THREE.Vector3(0, -0.32, 0.15);
	const ringTilt = 0.9; // steep tilt → flat Saturn ellipse crossing the machine
	const buildRing = ({ count, rMin, rMax, size, color, speedMin, speedMax, maxOpacity }) => {
		const positions = new Float32Array(count * 3);
		const angles = new Float32Array(count);
		const speeds = new Float32Array(count);
		const radii = new Float32Array(count);
		const thick = new Float32Array(count); // per-point vertical jitter
		for (let i = 0; i < count; i++) {
			angles[i] = Math.random() * Math.PI * 2;
			speeds[i] = rand(speedMin, speedMax);
			radii[i] = rand(rMin, rMax);
			thick[i] = rand(-0.04, 0.04);
		}
		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		const mat = new THREE.PointsMaterial({
			map: sprites.star4,
			color,
			size,
			transparent: true,
			opacity: 0,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			depthTest: true, // let the machine occlude the far side of the ring
			sizeAttenuation: true
		});
		const points = new THREE.Points(geo, mat);
		scene.scene.add(points);
		return { count, positions, angles, speeds, radii, thick, geo, mat, points, maxOpacity };
	};
	const rings = [
		buildRing({ count: 240, rMin: 1.55, rMax: 1.85, size: 0.1, color: 0xffd27a, speedMin: 0.5, speedMax: 0.8, maxOpacity: 1 }),
		buildRing({ count: 210, rMin: 1.95, rMax: 2.3, size: 0.07, color: 0xbfe0ff, speedMin: 0.25, speedMax: 0.4, maxOpacity: 0.85 })
	];
	const updateRings = (dt) => {
		for (const ring of rings) {
			for (let i = 0; i < ring.count; i++) {
				ring.angles[i] += ring.speeds[i] * dt;
				const a = ring.angles[i];
				const r = ring.radii[i];
				const i3 = i * 3;
				// tilt the plane so points sweep IN FRONT at the bottom, BEHIND at top
				ring.positions[i3] = ringCenter.x + Math.cos(a) * r;
				ring.positions[i3 + 1] = ringCenter.y + Math.sin(a) * r * Math.cos(ringTilt) + ring.thick[i];
				ring.positions[i3 + 2] = ringCenter.z + Math.sin(a) * r * Math.sin(ringTilt);
			}
			ring.geo.attributes.position.needsUpdate = true;
		}
	};
	updateRings(0); // seed positions before the first frame
	const stopRings = scene.addUpdatable((dt) => updateRings(dt));
	for (const ring of rings) tween(1500, 'inOutQuad', (v) => (ring.mat.opacity = v * ring.maxOpacity));

	// the machine levitates, weightless
	const baseY = machine.group.position.y;
	let drifting = true;
	const stopDrift = scene.addUpdatable((dt, t) => {
		if (!drifting) return;
		machine.group.position.y = baseY + Math.sin(t * 0.7) * 0.12 + 0.06;
		machine.group.rotation.z = Math.sin(t * 0.5) * 0.035;
		machine.group.rotation.x = Math.cos(t * 0.44) * 0.02;
		for (const n of nebulae) n.position.x += Math.sin(t * 0.2) * dt * 0.03;
	});
	machine.setInnerGlow(0.45, 0xcfe2ff);
	haptics.vibrate(30);

	// shooting stars streak past on random diagonals
	let shooting = true;
	(async () => {
		while (shooting) {
			const fromLeft = Math.random() < 0.5;
			particles.burst({
				texture: sprites.streak,
				count: 1,
				origin: new THREE.Vector3(fromLeft ? -3.4 : 3.4, rand(0.4, 2.2), rand(-2.5, -0.5)),
				direction: new THREE.Vector3(fromLeft ? 1 : -1, rand(-0.5, -0.2), 0).normalize(),
				cone: 0,
				speed: [7, 11],
				gravity: new THREE.Vector3(0, 0, 0),
				drag: 1,
				life: [0.7, 0.9],
				size: [0.5, 0.8],
				colors: [0xffffff, 0xcfe2ff],
				spin: [0, 0]
			});
			await delay(rand(700, 1500));
		}
	})();

	await delay(6200);

	// wish granted — a bright star falls INTO the button
	shooting = false;
	haptics.vibrate([30, 50, 30, 50, 140]);
	const wish = new THREE.Vector3(-2.8, 2.2, -1);
	await tween(700, 'inQuad', (v) => {
		machine.setOuterGlow(0, 0xffffff);
		wish.lerpVectors(new THREE.Vector3(-2.8, 2.2, -1), new THREE.Vector3(0, -0.26, 0.4), v);
		if (v > 0 && Math.random() < 0.6) {
			particles.burst({
				texture: sprites.star4,
				count: 3,
				origin: wish.clone(),
				speed: [0.1, 0.4],
				life: [0.4, 0.8],
				size: [0.04, 0.1],
				colors: [0xffffff, 0xcfe2ff]
			});
		}
	});
	scene.shake(0.4);
	await flashPulse(machine, 1, 80, 900, 0xdfe8ff);
	particles.burst({
		texture: sprites.star4,
		count: 60,
		origin: new THREE.Vector3(0, -0.26, 0.4),
		speed: [1, 3.5],
		life: [0.6, 1.5],
		size: [0.03, 0.1],
		colors: [0xffffff, 0xcfe2ff, 0xfff3cf]
	});

	// gravity resumes; dawn comes back to the lounge
	drifting = false;
	await tween(1300, 'inOutQuad', (v) => {
		machine.group.position.y = baseY + (1 - v) * 0.06;
		machine.group.rotation.z *= 1 - v;
		machine.group.rotation.x *= 1 - v;
		for (const n of nebulae) n.material.opacity = 0.33 * (1 - v);
		for (const ring of rings) ring.mat.opacity = ring.maxOpacity * (1 - v);
		machine.setInnerGlow(0.3 * (1 - v), 0xcfe2ff);
	});
	for (const n of nebulae) {
		scene.scene.remove(n);
		n.material.dispose();
	}
	stopRings();
	for (const ring of rings) {
		scene.scene.remove(ring.points);
		ring.geo.dispose();
		ring.mat.dispose();
	}
	for (const s of stars) s.emitting = false;
	for (const d of drifters) d.stop();
	backdrop.visible = true;
	await tween(1200, 'inOutQuad', (v) => {
		scene.keyLight.intensity = key0 * (0.15 + v * 0.85);
		scene.fillLight.intensity = fill0 * (0.4 + v * 0.6);
		scene.scene.environmentIntensity = env0 * (0.2 + v * 0.8);
		backdrop.material.opacity = v;
	});
	scene.scene.background = bg0;
	machine.group.position.y = baseY;
	machine.group.rotation.set(0, 0, 0);
}
