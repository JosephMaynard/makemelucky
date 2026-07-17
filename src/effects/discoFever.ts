// Effect 17 — DISCO FEVER: a mirror ball descends, coloured spots sweep the
// leather, and the machine gets its groove on. Luck loves a dance floor.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, disposeObject } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'luckyNowDisco';
export const duration = 10400;

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.12, 900);

	// the mirror ball, on its little rod
	const ballGroup = new THREE.Group();
	const ball = new THREE.Mesh(
		new THREE.IcosahedronGeometry(0.42, 2), // finer facets = proper mirror tiles
		new THREE.MeshStandardMaterial({
			color: 0xffffff,
			metalness: 1,
			roughness: 0.02,
			envMapIntensity: 5.5,
			flatShading: true
		})
	);
	const rod = new THREE.Mesh(
		new THREE.CylinderGeometry(0.02, 0.02, 2.4, 8),
		new THREE.MeshStandardMaterial({ color: 0x444a52, metalness: 1, roughness: 0.4 })
	);
	rod.position.y = 1.6;
	ballGroup.add(ball, rod);
	ballGroup.position.set(0, 4.6, 0.7); // parked above the frame
	scene.scene.add(ballGroup);

	// four coloured party spots orbiting the room
	const spotColors = [0xff3da0, 0x38d0ff, 0xffd23d, 0x51e05c];
	const spots = spotColors.map((c) => {
		const l = new THREE.PointLight(c, 0, 14, 2);
		scene.scene.add(l);
		return l;
	});
	// a white spot trained on the ball itself so the mirror tiles read bright
	const ballSpot = new THREE.PointLight(0xffffff, 0, 5, 1.6);
	ballSpot.position.set(0.7, 1.7, 2.3);
	scene.scene.add(ballSpot);
	tween(1400, 'inOutQuad', (v) => (ballSpot.intensity = v * 4));

	// glints twinkling off the mirror tiles
	const glintMat = new THREE.SpriteMaterial({
		map: sprites.star4,
		color: 0xffffff,
		transparent: true,
		depthTest: false,
		blending: THREE.AdditiveBlending
	});
	const glints = [0, 1, 2].map((i) => {
		const s = new THREE.Sprite(glintMat.clone());
		s.renderOrder = 9;
		s.position.setFromSphericalCoords(0.44, Math.PI / 2 - 0.3 + i * 0.3, i * 2.1);
		s.scale.setScalar(0.001); // invisible until the party loop drives them
		s.material.opacity = 0;
		ballGroup.add(s);
		return s;
	});

	// descend! (parked low enough to actually be on camera)
	haptics.vibrate(30);
	await tween(1400, 'outBack', (v) => {
		ballGroup.position.y = 4.6 - v * 3.55;
	});

	// let there be dance
	let bpmPhase = 0;
	let lastBeat = -1;
	const stopParty = scene.addUpdatable((dt, t) => {
		ball.rotation.y += dt * 1.6;
		bpmPhase += dt * (118 / 60); // locked to the tune's 118 bpm
		const beat = Math.floor(bpmPhase);
		const pulse = 1 - (bpmPhase - beat);
		if (beat !== lastBeat) {
			lastBeat = beat;
			haptics.vibrate(10);
		}
		// machine dances: bounce + wiggle on the beat
		machine.group.scale.setScalar(1 + pulse * 0.02);
		machine.group.rotation.z = Math.sin(bpmPhase * Math.PI) * 0.022;
		// spots orbit and pulse
		for (let i = 0; i < spots.length; i++) {
			const a = t * (0.7 + i * 0.13) + (i * Math.PI) / 2;
			spots[i].position.set(Math.cos(a) * 2.3, Math.sin(a * 1.3) * 1.5 + 0.2, 1.4);
			spots[i].intensity = 2.6 + pulse * 2.2;
		}
		machine.setInnerGlow(0.25 + pulse * 0.3, spotColors[(beat % 4 + 4) % 4]);
		// mirror-tile glints flare as the ball turns
		glints.forEach((s, i) => {
			const tw = Math.max(0, Math.sin(t * (5.2 + i * 1.7) + i * 2.4));
			s.scale.setScalar(0.1 + tw * 0.34);
			s.material.opacity = 0.35 + tw * 0.65;
		});
	});

	// mirror-ball glints raining through the room
	const glitter = particles.emitter({
		texture: sprites.star4,
		count: 260,
		emitRate: 70,
		origin: new THREE.Vector3(0, 1.05, 0.75),
		originSpread: 0.4,
		speed: [0.8, 2.2],
		gravity: new THREE.Vector3(0, -0.35, 0),
		life: [1.4, 2.6],
		size: [0.015, 0.05],
		colors: [0xffffff, 0xff9ad0, 0x9adfff, 0xffe9a0]
	});

	await delay(6600); // dance until the tune's last chorus (~10.3s track)

	// last chorus — big flash, ball ascends
	glitter.stop();
	haptics.vibrate([40, 60, 40, 60, 120]);
	machine.setOuterGlow(0, 0xffffff);
	await tween(260, 'inQuad', (v) => machine.setOuterGlow(v * 0.8, 0xffd0f0));
	tween(700, 'outQuad', (v) => machine.setOuterGlow(0.8 * (1 - v)));
	stopParty();
	glints.forEach((s) => {
		s.material.opacity = 0;
		s.scale.setScalar(0.001);
	});
	machine.group.scale.setScalar(1);
	machine.group.rotation.z = 0;
	tween(600, 'outQuad', (v) => {
		for (const s of spots) s.intensity = 4 * (1 - v);
		ballSpot.intensity = 4 * (1 - v);
		machine.setInnerGlow(0.5 * (1 - v));
	});
	// fade the tune out with the lights, however long the MP3 actually ran
	audio.stopTrack('luckyNowDisco', 900);
	await tween(1000, 'inQuad', (v) => {
		ballGroup.position.y = 1.05 + v * 3.55;
	});

	for (const s of spots) scene.scene.remove(s);
	scene.scene.remove(ballSpot, ballGroup);
	disposeObject(ballGroup); // ball, rod + their materials (glint sprite geometry is shared, skipped)
	glintMat.dispose(); // the clone template itself — never attached, so traverse never sees it
	await restore(900);
}
