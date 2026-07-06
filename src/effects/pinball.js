// Effect 19 — PINBALL: a chrome ball ricochets around the lounge, lighting up
// the clamps like bumpers, before draining into the button. Multiball morals.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'luckySymbol';
export const duration = 9500;

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics } = ctx;

	const restore = dimLights(scene, 0.4, 700);
	scene.fxLight.color.set(0xffffff);

	const ball = new THREE.Mesh(
		new THREE.SphereGeometry(0.15, 24, 16),
		new THREE.MeshStandardMaterial({ color: 0xd8e2ec, metalness: 1, roughness: 0.06, envMapIntensity: 2.2 })
	);
	ball.position.set(-2.3, 1.45, 0.45);
	scene.scene.add(ball);
	const vel = new THREE.Vector3(3.2, -0.6, 0);

	// bumpers = the four clamps, and they flick back like pinball flippers
	const bumpers = machine.decos.map((d) => {
		const p = new THREE.Vector3();
		d.userData.clamp.getWorldPosition(p);
		p.z = 0.45;
		return { p, clamp: d.userData.clamp, home: d.userData.clampHome.clone(), busy: false };
	});
	const flick = (b) => {
		if (b.busy) return;
		b.busy = true;
		const inward = b.home.clone().normalize().negate(); // jab toward the button
		tween(90, 'outQuad', (v) => b.clamp.position.copy(b.home).addScaledVector(inward, 0.09 * v))
			.then(() => tween(240, 'outBack', (v) => b.clamp.position.copy(b.home).addScaledVector(inward, 0.09 * (1 - v))))
			.then(() => {
				b.clamp.position.copy(b.home);
				b.busy = false;
			});
	};

	const trail = particles.emitter({
		texture: sprites.softDot,
		count: 140,
		emitRate: 90,
		origin: ball.position,
		originSpread: 0.02,
		speed: [0.02, 0.1],
		gravity: new THREE.Vector3(0, 0, 0),
		life: [0.25, 0.45],
		size: [0.03, 0.07],
		colors: [0xffffff, 0xbfe8ff]
	});

	const bump = (at, strength = 1) => {
		scene.shake(0.12 * strength);
		haptics.vibrate(16);
		scene.fxLight.position.copy(at);
		scene.fxLight.position.z = 1.2;
		scene.fxLight.intensity = 6;
		tween(260, 'outQuad', (v) => (scene.fxLight.intensity = 6 * (1 - v)));
		particles.burst({
			texture: sprites.spark,
			count: 12,
			origin: at.clone(),
			speed: [0.8, 2.2],
			life: [0.25, 0.55],
			size: [0.025, 0.06],
			colors: [0xffffff, 0xffd27a, 0xbfe8ff]
		});
	};

	let playing = true;
	const pull = new THREE.Vector3();
	const stopSim = scene.addUpdatable((dt) => {
		if (!playing) return;
		vel.y -= 1.4 * dt; // gentle table gravity
		// gentle pull toward the bumper cluster keeps the rally going
		pull.set(0, -0.3, 0.45).sub(ball.position).normalize();
		vel.addScaledVector(pull, 1.1 * dt);
		ball.position.addScaledVector(vel, dt);
		ball.rotation.z -= vel.x * dt * 3;
		// walls
		if (ball.position.x > 2.15 && vel.x > 0) { vel.x *= -0.92; bump(ball.position, 0.6); }
		if (ball.position.x < -2.15 && vel.x < 0) { vel.x *= -0.92; bump(ball.position, 0.6); }
		if (ball.position.y > 1.55 && vel.y > 0) { vel.y *= -0.92; bump(ball.position, 0.6); }
		if (ball.position.y < -1.5 && vel.y < 0) { vel.y = Math.abs(vel.y) * 0.96 + 0.4; bump(ball.position, 0.8); }
		// clamp bumpers FLICK the ball away
		for (const b of bumpers) {
			const d = ball.position.distanceTo(b.p);
			if (d < 0.42) {
				const n = ball.position.clone().sub(b.p).normalize();
				const speed = Math.max(vel.length(), 2.6) * 1.28;
				vel.copy(n.multiplyScalar(Math.min(speed, 6)));
				ball.position.copy(b.p).addScaledVector(n, 0.43);
				flick(b);
				bump(b.p, 1);
				machine.setInnerGlow(0.5, 0xbfe8ff);
				tween(300, 'outQuad', (v) => machine.setInnerGlow(0.5 * (1 - v), 0xbfe8ff));
			}
		}
	});

	await delay(5600);

	// drain shot: the ball is drawn into the button
	playing = false;
	haptics.vibrate([30, 40, 30, 40, 120]);
	const from = ball.position.clone();
	const target = new THREE.Vector3(0, -0.32, 0.5);
	await tween(850, 'inQuad', (v) => {
		ball.position.lerpVectors(from, target, v);
		ball.scale.setScalar(1 - v * 0.65);
	});
	trail.stop();
	stopSim();
	scene.scene.remove(ball);
	ball.geometry.dispose();

	// JACKPOT
	scene.shake(0.45);
	particles.burst({
		texture: sprites.star4,
		count: 60,
		origin: target.clone(),
		speed: [1.2, 3.6],
		life: [0.6, 1.4],
		size: [0.035, 0.1],
		colors: [0xffffff, 0xbfe8ff, 0xffd27a]
	});
	await flashPulse(machine, 0.95, 80, 850, 0xdfefff);
	scene.fxLight.intensity = 0;
	await restore(900);
}
