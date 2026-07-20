// Effect — MAKE IT RAIN: a downpour of Bank of Luck banknotes flutters past
// the machine while gold coins drizzle through it — then money cannons open
// fire from below: left, right, and a final JACKPOT volley of golden notes
// erupting dead centre with a coin geyser. It's raining luck, heavily.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 7300;

/** A Bank of Luck note, drawn once per palette and shared by every bill.
 *  The golden variant is the jackpot payout — same plates, richer ink. */
function billTexture(bg = '#cfeccb', ink = '#2f7d4f', glyphInk = '#1f6b3f') {
	const cv = document.createElement('canvas');
	cv.width = 256;
	cv.height = 128;
	const ctx = cv.getContext('2d')!;
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, 256, 128);
	ctx.strokeStyle = ink;
	ctx.lineWidth = 8;
	ctx.strokeRect(9, 9, 238, 110);
	ctx.globalAlpha = 0.5;
	ctx.strokeStyle = ink;
	ctx.lineWidth = 2;
	ctx.strokeRect(22, 22, 212, 84);
	ctx.globalAlpha = 1;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	// centre medallion with a clover
	ctx.globalAlpha = 0.14;
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.arc(128, 64, 34, 0, Math.PI * 2);
	ctx.fill();
	ctx.globalAlpha = 1;
	ctx.strokeStyle = ink;
	ctx.lineWidth = 3;
	ctx.stroke();
	ctx.fillStyle = glyphInk;
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

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, haptics, audio } = ctx;

	const restore = dimLights(scene, 0.5, 700);
	scene.fxLight.color.set(0x9be89b);
	scene.fxLight.position.set(0, 0.1, 1.6);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.4));

	// ---- banknotes: one geometry, two materials (green rain / golden jackpot)
	const billTex = billTexture();
	const goldTex = billTexture('#f5e4ae', '#8a6420', '#6e4e14');
	const billMat = new THREE.MeshBasicMaterial({ map: billTex, side: THREE.DoubleSide, transparent: true });
	const goldMat = new THREE.MeshBasicMaterial({ map: goldTex, side: THREE.DoubleSide, transparent: true });
	const billGeo = new THREE.PlaneGeometry(0.42, 0.2);
	const bills: THREE.Mesh[] = [];
	const makeBill = (mat: THREE.MeshBasicMaterial, parked: boolean) => {
		const bill = new THREE.Mesh(billGeo, mat);
		bill.userData = {
			baseX: rand(-2, 2),
			phase: rand(0, Math.PI * 2),
			swayFreq: rand(0.8, 1.8),
			swayAmp: rand(0.1, 0.32),
			fall: rand(1, 1.6),
			vx: 0,
			vy: null as number | null, // ballistic velocity while cannon-launched
			parked,
			spinX: rand(-2.2, 2.2),
			spinZ: rand(-1.6, 1.6)
		};
		bill.rotation.set(rand(0, Math.PI), 0, rand(0, Math.PI));
		bill.position.set(bill.userData.baseX, -5, 0.9); // parked out of shot
		scene.scene.add(bill);
		bills.push(bill);
		return bill;
	};
	// the rain: spawn the column TALL, with higher notes falling faster, so the
	// downpour is continuous — a narrow band empties the frame in one wave and
	// leaves an awkward gap before the recycled notes fall back in
	for (let i = 0; i < 32; i++) {
		const bill = makeBill(billMat, false);
		const y = rand(1.8, 5.2);
		bill.userData.fall = rand(1, 1.6) + (y - 1.8) * 0.22;
		bill.position.set(bill.userData.baseX, y, rand(0.7, 1.1));
	}
	// cannon ammunition, parked below frame until a volley fires it
	const leftAmmo = Array.from({ length: 8 }, () => makeBill(billMat, true));
	const rightAmmo = Array.from({ length: 8 }, () => makeBill(billMat, true));
	const jackpotAmmo = Array.from({ length: 12 }, () => makeBill(goldMat, true));

	// flutter + fall physics, recycling bills back to the top for a steady rain.
	// Recycle WELL below the frame edge so notes visibly fall out of shot.
	// Launched bills fly ballistically until gravity brings them back down to
	// flutter speed, then they join the rain like everyone else.
	let recycling = true;
	const stopSim = scene.addUpdatable((dt, t) => {
		for (const bill of bills) {
			const u = bill.userData;
			if (u.parked) continue;
			if (u.vy != null) {
				u.vy -= 5.2 * dt;
				u.baseX += u.vx * dt;
				bill.position.y += u.vy * dt;
				if (u.vy <= -u.fall) {
					u.vy = null;
					u.vx = 0;
				}
			} else {
				bill.position.y -= u.fall * dt;
			}
			bill.position.x = u.baseX + Math.sin(t * u.swayFreq + u.phase) * u.swayAmp;
			bill.rotation.x += u.spinX * dt;
			bill.rotation.z += u.spinZ * dt;
			if (recycling && u.vy == null && bill.position.y < -2.4) {
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

	// ---- money cannons: notes erupt from below frame and arc over the
	// machine, each launch riding a coin geyser. The jackpot volley is golden.
	const fireVolley = (x: number, ammo: THREE.Mesh[], jackpot: boolean) => {
		audio.sfx(jackpot ? 'boom' : 'pop', { pitch: jackpot ? 0.9 : 1.25, gain: jackpot ? 0.8 : 0.6 });
		audio.sfx('ding', { pitch: jackpot ? 1.5 : rand(1.05, 1.3), gain: 0.5 });
		scene.shake(jackpot ? 0.35 : 0.2);
		haptics.vibrate(jackpot ? [30, 30, 90] : [15, 20, 45]);
		particles.burst({
			texture: sprites.coin,
			count: jackpot ? 70 : 36,
			origin: new THREE.Vector3(x, -1.8, 0.85),
			originSpread: 0.18,
			direction: new THREE.Vector3(0, 1, 0),
			cone: jackpot ? 0.5 : 0.32,
			speed: [3.0, jackpot ? 5.6 : 4.6],
			gravity: new THREE.Vector3(0, -3.2, 0),
			life: [1.3, 2.4],
			size: [0.07, 0.15],
			colors: [0xf7ce6b, 0xffe9ad, 0xd9a842, 0xfff0cf],
			spin: [-6, 6]
		});
		for (const bill of ammo) {
			const u = bill.userData;
			u.parked = false;
			u.baseX = x + rand(-0.25, 0.25);
			u.vx = (u.baseX - x) * rand(2, 4) * (jackpot ? 2 : 1); // fan out from the muzzle
			u.vy = jackpot ? rand(5.4, 6.6) : rand(4.8, 5.8);
			u.spinX = rand(-4.5, 4.5);
			u.spinZ = rand(-3, 3);
			bill.position.set(u.baseX, -2.0, rand(0.7, 1.1));
		}
		if (jackpot) {
			// slam the light bright for a beat — the machine is PAYING OUT
			tween(700, (t) => 1 - Math.abs(t * 2 - 1), (v) => (scene.fxLight.intensity = 2.4 + v * 2.2));
		}
	};

	await delay(900);
	fireVolley(-1.3, leftAmmo, false);
	await delay(1000);
	fireVolley(1.3, rightAmmo, false);
	await delay(1000);
	fireVolley(0, jackpotAmmo, true);
	await delay(1700);

	// ---- finale: the rain simply dries up — last notes flutter away and fade
	recycling = false;
	coinDrizzle.stop();
	audio.sfx('gong', { pitch: 1.15, gain: 0.7 });
	haptics.vibrate([30, 30, 80]);
	await tween(1000, 'inQuad', (v) => {
		billMat.opacity = 1 - v;
		goldMat.opacity = 1 - v;
	});
	stopSim();
	await flashPulse(machine, 0.8, 90, 750, 0x9be89b);

	// ---- teardown
	scene.scene.remove(...bills);
	billGeo.dispose();
	billMat.dispose();
	billTex.dispose();
	goldMat.dispose();
	goldTex.dispose();
	tween(700, 'outQuad', (v) => {
		machine.setInnerGlow(0.45 * (1 - v), 0x7dd87d);
		scene.fxLight.intensity = 2.4 * (1 - v);
	});
	await delay(400);
	machine.setInnerGlow(0);
	scene.fxLight.intensity = 0;
	await restore(900);
}
