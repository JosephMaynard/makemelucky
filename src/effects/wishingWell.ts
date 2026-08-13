// Effect — WISHING WELL: the iris opens on black water and coins are thrown in
// FROM the viewer's side of the glass, tumbling away from the camera into the
// dark. Each one lands with a plink, a splash and spreading rings. Then the well
// answers: a soap bubble climbs out of the shaft and pops into a wish.
//
// The throw direction is the whole trick — nothing else in the roster moves away
// from the camera, so the depth reads instantly as "down a well".
//
// The button doesn't vanish, it gets lifted off and set down in the corner like
// the lid of a real well, and it parks at a fraction of the measured frame width
// so it stays on screen on a phone.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse } from './helpers';
import { backdropWipe } from '../gfx/quiltWipe';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'buttonFall';
export const duration = 9800;

/** A soap bubble is almost entirely rim and one specular highlight — a lit
 *  sphere just reads as a white ball. Painted on a sprite it always faces the
 *  camera, which is exactly right for something spherical. */
let bubbleTex: THREE.CanvasTexture | null = null;
function bubbleTexture(): THREE.CanvasTexture {
	if (bubbleTex) return bubbleTex;
	const S = 256;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	const C = S / 2;

	// the film: transparent through the middle, brightening hard at the edge
	const rim = c.createRadialGradient(C, C, C * 0.52, C, C, C * 0.995);
	rim.addColorStop(0, 'rgba(150,220,240,0.04)');
	rim.addColorStop(0.72, 'rgba(175,232,248,0.16)');
	rim.addColorStop(0.93, 'rgba(226,250,255,0.82)');
	rim.addColorStop(1, 'rgba(255,255,255,0)');
	c.fillStyle = rim;
	c.beginPath();
	c.arc(C, C, C, 0, Math.PI * 2);
	c.fill();

	// soap-film iridescence: two lazy arcs of colour inside the rim
	c.lineWidth = S * 0.055;
	c.globalAlpha = 0.35;
	c.strokeStyle = '#ff9ad8';
	c.beginPath();
	c.arc(C, C, C * 0.87, Math.PI * 0.15, Math.PI * 0.72);
	c.stroke();
	c.strokeStyle = '#9affc8';
	c.beginPath();
	c.arc(C, C, C * 0.87, Math.PI * 1.12, Math.PI * 1.62);
	c.stroke();
	c.globalAlpha = 1;

	// the highlight that says "sphere", and its small partner opposite
	const hi = c.createRadialGradient(C * 0.64, C * 0.6, 0, C * 0.64, C * 0.6, C * 0.3);
	hi.addColorStop(0, 'rgba(255,255,255,0.92)');
	hi.addColorStop(1, 'rgba(255,255,255,0)');
	c.fillStyle = hi;
	c.beginPath();
	c.arc(C * 0.64, C * 0.6, C * 0.3, 0, Math.PI * 2);
	c.fill();
	const lo = c.createRadialGradient(C * 1.3, C * 1.36, 0, C * 1.3, C * 1.36, C * 0.16);
	lo.addColorStop(0, 'rgba(214,246,255,0.5)');
	lo.addColorStop(1, 'rgba(214,246,255,0)');
	c.fillStyle = lo;
	c.beginPath();
	c.arc(C * 1.3, C * 1.36, C * 0.16, 0, Math.PI * 2);
	c.fill();

	bubbleTex = new THREE.CanvasTexture(cv);
	bubbleTex.colorSpace = THREE.SRGBColorSpace;
	return bubbleTex;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();

	// visible half-width at a given depth — the park spot is derived from this,
	// never hardcoded, or the lid lands off-screen on a narrow phone
	const frameHalfW = (z: number) =>
		Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * scene.camera.aspect * (5.35 - z);

	// moonlit, not murky — the well is a hopeful place, keep the room readable
	const restore = dimLights(scene, 0.38, 900);
	scene.crossfadeEnvironment('nightSky', 900);
	// moonlit stone: the room goes cold before the water appears
	const wipe = backdropWipe(machine.backdrop, ctx.textures.quilt.map, 'ice');
	wipe.in(2000);
	scene.fxLight.color.set(0x86c5e8);
	scene.fxLight.position.set(0, 0.6, 1.6);
	tween(900, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 2.4));

	// ---- open the well: the iris parts and the button is lifted off and set
	// down in the bottom-left like a well lid, well clear of the mouth.
	const btnHome = machine.buttonGroup.position.clone();
	const parkX = -Math.min(1.72, frameHalfW(0.9) - 0.7);
	const parkY = btnHome.y - 1.02;
	const opening = machine.openIris(0.62, 1300);
	machine.portal.visible = false;
	machine.setInnerGlow(0.12, 0x86c5e8);
	audio.sfx('clack', { pitch: 0.7, gain: 0.4 });
	tween(1300, 'inOutCubic', (v) => {
		// out towards the viewer first, so it clears the rings before it travels
		const lift = Math.sin(Math.PI * Math.min(1, v * 1.35)) * 0.45;
		machine.buttonGroup.position.x = btnHome.x + (parkX - btnHome.x) * v;
		machine.buttonGroup.position.y = btnHome.y + (parkY - btnHome.y) * v + lift * 0.5;
		machine.buttonGroup.position.z = btnHome.z + 0.55 * v + lift;
		// turns as it's carried, settling at a lazy angle in the corner
		machine.buttonGroup.rotation.z = v * -0.42 - lift * 0.7;
		machine.buttonGroup.scale.setScalar(1 - v * 0.22);
	});

	// The water surface. This started life as a ripple SHADER and never drew a
	// single pixel — injected test meshes at the same position rendered fine, so
	// the geometry and depth were right and the custom material was not. Rings
	// are what the rest of this codebase reaches for anyway (see helpers'
	// shockwave), they read better under bloom, and they cannot silently fail.
	//
	// It lives inside machine.centre so it tracks the machine's own origin — the
	// group hangs at scene y -0.32 and scene-space discs float too high.
	// FLAT. A glossy low-roughness disc collects one big environment hotspot and
	// reads as a dome — a bubble, not a pool. Rough and non-metallic keeps it
	// looking like standing water in shadow; the rings supply all the life.
	const waterMat = new THREE.MeshStandardMaterial({
		color: 0x16323f,
		roughness: 0.82,
		metalness: 0,
		envMapIntensity: 0.4
	});
	// radius must beat the socket bore (R*1.045 ≈ 1.36) or a ring of leather
	// shows between the water and the iris edge — portalDrop's sky disc is the
	// reference for filling the opening completely
	const water = new THREE.Mesh(new THREE.CircleGeometry(1.38, 64), waterMat);
	water.position.set(0, 0, -0.12);
	// present from the first frame so the parting iris REVEALS it, rather than
	// it appearing all at once the moment the doors finish
	machine.centre.add(water);

	const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
	/** One ring of ripples spreading from where a coin went in. Rings live in
	 *  WORLD space just in front of the surface: parked in machine.centre at the
	 *  water's own depth they never appeared, and 0.02 of clearance is not worth
	 *  arguing with a depth buffer over. */
	const ripple = (x: number, y: number, scale = 1) => {
		for (let i = 0; i < 2; i++) {
			const mat = new THREE.MeshBasicMaterial({
				color: 0xcdeeff,
				transparent: true,
				opacity: 0,
				blending: THREE.AdditiveBlending,
				depthWrite: false,
				side: THREE.DoubleSide
			});
			const ring = new THREE.Mesh(ringGeo, mat);
			ring.position.set(x, y - 0.32, 0.06);
			ring.renderOrder = 6;
			scene.scene.add(ring);
			tween(1150 + i * 300, 'outCubic', (v) => {
				ring.scale.setScalar(0.05 + v * 0.5 * scale);
				// snaps on, then fades the whole way out. A sine bell peaked a
				// third of the way in and was gone before the ring had spread —
				// you could watch the whole effect and never see a ripple.
				mat.opacity = Math.min(1, v * 7) * (1 - v) * (i ? 0.26 : 0.5);
			}).then(() => {
				scene.scene.remove(ring);
				mat.dispose();
			});
		}
	};

	await opening;

	// ---- the coins, thrown from behind the glass. They spawn near the camera
	// (z 4.2 of 5.35) and fly AWAY, so perspective shrinks them down the shaft.
	const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.06, 24);
	const coinMat = new THREE.MeshStandardMaterial({
		color: 0xd9a842,
		metalness: 0.95,
		roughness: 0.3,
		emissive: 0x4a3410,
		emissiveIntensity: 0.6
	});
	const throwCoin = async (offX: number, offY: number, flightMs: number) => {
		const coin = new THREE.Mesh(coinGeo, coinMat);
		const spin = new THREE.Group();
		spin.add(coin);
		coin.rotation.x = Math.PI / 2;
		spin.position.set(btn.x + offX, btn.y + offY + 1.1, 4.2);
		spin.scale.setScalar(0.12);
		scene.scene.add(spin);
		audio.sfx('swoosh', { pitch: 1.5, gain: 0.3 });
		const tumble = rand(5, 8);
		const land = new THREE.Vector3(btn.x + offX * 0.62, btn.y + offY * 0.62, -0.1);
		await tween(flightMs, 'inQuad', (v) => {
			spin.position.lerpVectors(
				new THREE.Vector3(btn.x + offX, btn.y + offY + 1.1, 4.2),
				land,
				v
			);
			// a shallow arc up before it drops in
			spin.position.y += Math.sin(Math.PI * v) * 0.22;
			spin.rotation.x = v * tumble;
			spin.rotation.z = v * tumble * 0.4;
			spin.scale.setScalar(0.12 * (1 - v * 0.35));
		});
		scene.scene.remove(spin);
		// plink
		audio.sfx('pop', { pitch: rand(1.5, 2.1), gain: 0.4 });
		audio.sfx('ding', { pitch: rand(1.6, 2.2), gain: 0.22 });
		haptics.vibrate(14);
		ripple(offX * 0.62, offY * 0.62);
		const at = new THREE.Vector3(btn.x + offX * 0.62, btn.y + offY * 0.62, 0);
		// the crown of droplets thrown straight up out of the hole it punched
		particles.burst({
			texture: sprites.softDot,
			count: 26,
			origin: at.clone(),
			originSpread: 0.04,
			direction: new THREE.Vector3(0, 1, 0.3),
			cone: 0.42,
			speed: [1.1, 2.6],
			gravity: new THREE.Vector3(0, -5.2, 0),
			life: [0.35, 0.75],
			size: [0.025, 0.075],
			colors: [0xdfeef2, 0x9fd8e8, 0xffffff],
			fadeIn: 0.02
		});
		// and the fine mist that hangs behind it
		particles.burst({
			texture: sprites.spark,
			count: 14,
			origin: at.clone(),
			originSpread: 0.06,
			direction: new THREE.Vector3(0, 1, 0.4),
			cone: 0.8,
			speed: [0.4, 1.4],
			gravity: new THREE.Vector3(0, -2.6, 0),
			life: [0.3, 0.7],
			size: [0.02, 0.05],
			colors: [0xffffff, 0xbfe8f4]
		});
		machine.setInnerGlow(0.16, 0x86c5e8);
	};

	await delay(260);
	await throwCoin(-0.5, 0.1, 780);
	await delay(240);
	await throwCoin(0.55, -0.05, 720);
	await delay(200);
	await throwCoin(-0.15, 0.2, 660);
	await delay(160);
	await throwCoin(0.28, 0.12, 600);

	// ---- the well answers
	await delay(420);
	audio.sfx('gulp', { pitch: 0.55, gain: 0.5 });
	haptics.vibrate([18, 50, 24]);
	ripple(0, 0, 2.1); // the well stirs from the middle
	tween(900, 'inOutQuad', (v) => {
		machine.setInnerGlow(0.16 + v * 0.42, 0x9fd8e8);
		scene.fxLight.intensity = 2.4 + v * 1.8;
	});
	// a fat bubble climbs out of the shaft, wobbling as it goes
	const bubbleMat = new THREE.SpriteMaterial({
		map: bubbleTexture(),
		transparent: true,
		opacity: 0,
		depthWrite: false
	});
	const bubble = new THREE.Sprite(bubbleMat);
	bubble.position.set(btn.x, btn.y, 0.1);
	bubble.scale.setScalar(0.001);
	bubble.renderOrder = 7;
	scene.scene.add(bubble);
	const rising = particles.emitter({
		texture: sprites.softDot,
		count: 120,
		emitRate: 42,
		origin: new THREE.Vector3(btn.x, btn.y, 0.2),
		originSpread: 0.18,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.3,
		speed: [0.3, 0.9],
		life: [0.9, 1.8],
		size: [0.02, 0.06],
		colors: [0xbfe8f4, 0xffffff, 0x86c5e8],
		fadeIn: 0.2
	});
	await tween(1600, 'outQuad', (v) => {
		// a rising bubble is never quite round — it squashes as it wobbles
		const wob = Math.sin(v * 11);
		const size = Math.max(0.001, v * 0.86);
		bubble.scale.set(size * (1 + wob * 0.07), size * (1 - wob * 0.07), 1);
		bubble.position.y = btn.y + v * 0.9;
		bubble.position.x = btn.x + Math.sin(v * 7) * 0.09;
		bubble.position.z = 0.1 + v * 0.85;
		bubbleMat.opacity = Math.min(1, v * 3.5);
	});

	// ---- pop
	audio.sfx('pop', { pitch: 0.85, gain: 0.6 });
	audio.sfx('chime', { pitch: 1.15, gain: 0.5 });
	haptics.vibrate([25, 30, 80]);
	scene.shake(0.2);
	rising.stop();
	flashPulse(machine, 0.5, 110, 640, 0xd8f2ff);
	particles.burst({
		texture: sprites.star4,
		count: 70,
		origin: bubble.position.clone(),
		speed: [1.2, 3.4],
		gravity: new THREE.Vector3(0, -1.6, 0),
		life: [0.6, 1.4],
		size: [0.03, 0.1],
		colors: [0xffffff, 0xbfe8f4, 0xffe6a8]
	});
	// it bursts into a ring of film and a scatter of droplets, not a white flash
	const popRing = new THREE.Mesh(
		new THREE.RingGeometry(0.86, 1, 40),
		new THREE.MeshBasicMaterial({
			color: 0xd8f2ff,
			transparent: true,
			opacity: 0.9,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide
		})
	);
	popRing.position.copy(bubble.position);
	scene.scene.add(popRing);
	tween(420, 'outCubic', (v) => {
		popRing.scale.setScalar(0.42 + v * 0.7);
		(popRing.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - v);
	}).then(() => {
		scene.scene.remove(popRing);
		popRing.geometry.dispose();
		(popRing.material as THREE.Material).dispose();
	});
	scene.scene.remove(bubble);
	bubbleMat.dispose();

	await luckyWord(ctx, {
		text: 'WISH MADE',
		color: 0xbfe8f4,
		colorB: 0xffe6a8,
		gather: 800,
		hold: 1000,
		scatter: 550
	});

	// ---- teardown: the water drains, the button floats back up, the well closes
	const drainFrom = waterMat.color.clone();
	tween(700, 'inOutQuad', (v) => waterMat.color.copy(drainFrom).multiplyScalar(1 - v));
	audio.sfx('clack', { pitch: 0.85, gain: 0.4 });
	tween(1000, 'inOutCubic', (v) => {
		const lift = Math.sin(Math.PI * v) * 0.4;
		machine.buttonGroup.position.x = parkX + (btnHome.x - parkX) * v;
		machine.buttonGroup.position.y = parkY + (btnHome.y - parkY) * v + lift * 0.5;
		machine.buttonGroup.position.z = btnHome.z + 0.55 * (1 - v) + lift;
		machine.buttonGroup.rotation.z = -0.42 * (1 - v) - lift * 0.7;
		machine.buttonGroup.scale.setScalar(0.78 + v * 0.22);
	});
	await machine.closeIris(1100);
	machine.buttonGroup.position.copy(btnHome);
	machine.buttonGroup.rotation.z = 0;
	machine.buttonGroup.scale.setScalar(1);
	machine.centre.remove(water);
	water.geometry.dispose();
	ringGeo.dispose();
	waterMat.dispose();
	coinGeo.dispose();
	coinMat.dispose();
	machine.portal.visible = false;
	wipe.out(1000);
	scene.crossfadeEnvironment('lounge');
	tween(800, 'outQuad', (v) => {
		machine.setInnerGlow(0.58 * (1 - v));
		scene.fxLight.intensity = 4.2 * (1 - v);
	});
	await restore(900);
}
