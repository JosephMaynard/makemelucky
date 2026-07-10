// Effect — MAKE IT RAIN: a downpour of Bank of Luck banknotes flutters past
// the machine, a drizzle of gold coins mixed in, before the whole fortune
// whooshes back up off-screen. It's raining luck.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';
import { dimLights, flashPulse } from './helpers.js';

export const sound = 'lucky';
export const duration = 9500;

/** A single pale-green Bank of Luck note, drawn once and shared by every bill. */
function billTexture() {
	const cv = document.createElement('canvas');
	cv.width = 256;
	cv.height = 128;
	const ctx = cv.getContext('2d');
	ctx.fillStyle = '#cfeccb';
	ctx.fillRect(0, 0, 256, 128);
	ctx.strokeStyle = '#2f7d4f';
	ctx.lineWidth = 8;
	ctx.strokeRect(9, 9, 238, 110);
	ctx.strokeStyle = 'rgba(47,125,79,0.5)';
	ctx.lineWidth = 2;
	ctx.strokeRect(22, 22, 212, 84);
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	// centre medallion with a clover
	ctx.fillStyle = 'rgba(47,125,79,0.14)';
	ctx.beginPath();
	ctx.arc(128, 64, 34, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = '#2f7d4f';
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.fillStyle = '#1f6b3f';
	ctx.font = '40px Georgia, serif';
	ctx.fillText('☘', 128, 67);
	ctx.font = 'bold 15px Georgia, serif';
	ctx.fillText('BANK OF LUCK', 128, 32);
	ctx.fillText('BANK OF LUCK', 128, 96);
	ctx.font = 'bold 17px Georgia, serif';
	ctx.fillText('7', 34, 33);
	ctx.fillText('7', 222, 33);
	ctx.fillText('7', 34, 95);
	ctx.fillText('7', 222, 95);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

export async function play(ctx) {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.5, 700);
	scene.fxLight.color.set(0x9be89b);
	scene.fxLight.position.set(0, 0.1, 1.6);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.4));

	// ---- 26 banknotes, all sharing one geometry + one material
	const billTex = billTexture();
	const billMat = new THREE.MeshBasicMaterial({ map: billTex, side: THREE.DoubleSide, transparent: true });
	const billGeo = new THREE.PlaneGeometry(0.42, 0.2);
	const bills = [];
	for (let i = 0; i < 26; i++) {
		const bill = new THREE.Mesh(billGeo, billMat);
		bill.userData = {
			baseX: rand(-2, 2),
			phase: rand(0, Math.PI * 2),
			swayFreq: rand(0.8, 1.8),
			swayAmp: rand(0.1, 0.32),
			fall: rand(1, 1.6),
			spinX: rand(-2.2, 2.2),
			spinZ: rand(-1.6, 1.6)
		};
		bill.position.set(bill.userData.baseX, rand(1.8, 3.5), rand(0.7, 1.1));
		bill.rotation.set(rand(0, Math.PI), 0, rand(0, Math.PI));
		scene.scene.add(bill);
		bills.push(bill);
	}

	// flutter + fall physics, recycling bills back to the top for a steady rain.
	// Recycle WELL below the frame edge so notes visibly fall out of shot.
	let recycling = true;
	const stopSim = scene.addUpdatable((dt, t) => {
		for (const bill of bills) {
			const u = bill.userData;
			bill.position.y -= u.fall * dt;
			bill.position.x = u.baseX + Math.sin(t * u.swayFreq + u.phase) * u.swayAmp;
			bill.rotation.x += u.spinX * dt;
			bill.rotation.z += u.spinZ * dt;
			if (recycling && bill.position.y < -2.4) {
				u.baseX = rand(-2, 2);
				u.fall = rand(1, 1.6);
				bill.position.y = rand(2.2, 3.6);
				bill.position.z = rand(0.7, 1.1);
			}
		}
	});

	// a lazy drizzle of gold coins threaded through the money
	const coinDrizzle = particles.emitter({
		texture: sprites.coin,
		count: 90,
		emitRate: 15,
		origin: new THREE.Vector3(0, 2.4, 0.9),
		originSpread: 2,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.5,
		speed: [0.4, 0.9],
		gravity: new THREE.Vector3(0, -0.6, 0),
		life: [3, 4.6],
		size: [0.08, 0.16],
		colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff0cf],
		spin: [-4, 4]
	});

	// MAKE IT RAIN
	audio.sfx('swoosh');
	haptics.vibrate([20, 40, 20]);
	await tween(1000, 'inOutQuad', (v) => machine.setInnerGlow(v * 0.45, 0x7dd87d));
	await delay(6000);

	// ---- finale: the rain simply dries up — last notes flutter away and fade
	recycling = false;
	coinDrizzle.stop();
	audio.sfx('chime');
	haptics.vibrate([30, 30, 80]);
	await tween(1000, 'inQuad', (v) => (billMat.opacity = 1 - v));
	stopSim();
	await flashPulse(machine, 0.8, 90, 750, 0x9be89b);

	// ---- teardown
	scene.scene.remove(...bills);
	billGeo.dispose();
	billMat.dispose();
	billTex.dispose();
	tween(700, 'outQuad', (v) => {
		machine.setInnerGlow(0.45 * (1 - v), 0x7dd87d);
		scene.fxLight.intensity = 2.4 * (1 - v);
	});
	await delay(600);
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	await restore(900);
}
