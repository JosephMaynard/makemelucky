// Effect — LUCKY PENNY: found heads up. One enormous copper penny is flicked
// off the button, tumbles end over end in bullet time while the lounge goes
// burgundy behind it, and lands showing heads. Four and a half seconds, no
// ceremony. Sometimes luck is just a coin on the pavement.

import * as THREE from 'three';
import { tween, delay } from '../core/anim';
import { dimLights, flashPulse, shockwave } from './helpers';
import { backdropWipe } from '../gfx/quiltWipe';
import type { EffectContext } from '../types';

export const sound = 'lucky';
export const duration = 4700;

/** The heads side: a clover where the monarch should be, reeded rim, legend. */
let faceTex: THREE.CanvasTexture | null = null;
function pennyFace(): THREE.CanvasTexture {
	if (faceTex) return faceTex;
	const S = 512;
	const cv = document.createElement('canvas');
	cv.width = cv.height = S;
	const c = cv.getContext('2d')!;
	const C = S / 2;

	// lit from the upper left, the way a coin on the pavement catches the sun
	const grad = c.createRadialGradient(C * 0.72, C * 0.68, 0, C, C, C);
	grad.addColorStop(0, '#d99155');
	grad.addColorStop(0.5, '#a35c2b');
	grad.addColorStop(1, '#5e3014');
	c.fillStyle = grad;
	c.beginPath();
	c.arc(C, C, C, 0, Math.PI * 2);
	c.fill();

	// reeded rim: fine radial ticks just inside the edge
	c.strokeStyle = 'rgba(70,34,12,0.55)';
	c.lineWidth = 3;
	for (let i = 0; i < 132; i++) {
		const a = (i / 132) * Math.PI * 2;
		c.beginPath();
		c.moveTo(C + Math.cos(a) * C * 0.955, C + Math.sin(a) * C * 0.955);
		c.lineTo(C + Math.cos(a) * C * 0.995, C + Math.sin(a) * C * 0.995);
		c.stroke();
	}
	c.strokeStyle = 'rgba(60,28,10,0.5)';
	c.lineWidth = 6;
	c.beginPath();
	c.arc(C, C, C * 0.9, 0, Math.PI * 2);
	c.stroke();

	// struck legend around the top, upside-down-safe (single arc, top only)
	c.save();
	c.translate(C, C);
	c.fillStyle = 'rgba(58,26,8,0.72)';
	c.font = `bold ${Math.round(S * 0.072)}px 'Roboto Slab', Georgia, serif`;
	c.textAlign = 'center';
	c.textBaseline = 'middle';
	const legend = 'ONE LUCK · FOUND HEADS UP ·';
	for (let i = 0; i < legend.length; i++) {
		const a = -Math.PI / 2 + (i - (legend.length - 1) / 2) * 0.148;
		c.save();
		c.rotate(a);
		c.translate(0, -C * 0.79);
		c.fillText(legend[i], 0, 0);
		c.restore();
	}
	c.restore();

	// the clover, embossed: a dark stamp with a bright top-left highlight
	const leaf = (fill: string, dx: number, dy: number) => {
		c.fillStyle = fill;
		for (let k = 0; k < 4; k++) {
			const a = (k / 4) * Math.PI * 2 - Math.PI / 4;
			c.beginPath();
			c.ellipse(
				C + dx + Math.cos(a) * C * 0.215,
				C + dy + Math.sin(a) * C * 0.215,
				C * 0.135,
				C * 0.1,
				a,
				0,
				Math.PI * 2
			);
			c.fill();
		}
		c.fillRect(C + dx - C * 0.018, C + dy + C * 0.1, C * 0.036, C * 0.26); // stem
	};
	leaf('rgba(40,16,4,0.8)', 4, 5);
	leaf('rgba(255,220,178,0.9)', -3, -4);
	leaf('rgba(150,86,42,1)', 0, 0);

	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.anisotropy = 4;
	faceTex = tex;
	return tex;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;
	const btn = machine.buttonWorldPosition();

	const restore = dimLights(scene, 0.68, 420);
	// the room goes old-money burgundy for the four seconds this takes
	const wipe = backdropWipe(machine.backdrop, ctx.textures.quilt.map, 'claret');
	wipe.in(1500);
	scene.fxLight.color.set(0xffb877);
	scene.fxLight.position.set(0.5, 0.8, 1.9);
	tween(500, 'outQuad', (v) => (scene.fxLight.intensity = v * 3.4));

	// ---- the penny. Cylinder axis is Y, so the mesh is tipped a quarter turn
	// to face the camera and the GROUP does the tumbling — spin the mesh itself
	// and the flip axis tips with it.
	const face = pennyFace();
	const rim = new THREE.MeshStandardMaterial({ color: 0xb06f33, metalness: 0.55, roughness: 0.4 });
	const faceMatOpts = {
		map: face,
		metalness: 0.5,
		roughness: 0.36,
		emissiveMap: face,
		emissive: 0xffffff,
		emissiveIntensity: 0.34 // struck copper still catches light in a dim room
	};
	const heads = new THREE.MeshStandardMaterial(faceMatOpts);
	const tails = new THREE.MeshStandardMaterial(faceMatOpts);
	const penny = new THREE.Group();
	const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.07, 56, 1), [rim, heads, tails]);
	disc.rotation.x = Math.PI / 2; // faces the camera at group rotation 0
	penny.add(disc);
	penny.position.set(btn.x, btn.y, 0.55);
	// it flies well clear of the machine plane — the parallax is what sells it
	// as a foreground object rather than a new face for the button
	penny.scale.setScalar(0.001);
	scene.scene.add(penny);

	// ---- the flick
	audio.sfx('clack', { pitch: 1.6, gain: 0.5 });
	audio.sfx('swoosh', { pitch: 1.3, gain: 0.4 });
	haptics.vibrate(22);
	machine.setInnerGlow(0.3, 0xffb877);

	// Bullet time: the whole flip is one eased rotation, so it starts fast and
	// arrives slowly. Three full turns (6π) lands heads-up by construction.
	const flight = tween(2500, 'outQuart', (v) => {
		penny.rotation.x = v * Math.PI * 6;
		penny.rotation.y = v * -0.34; // settles at an angle, not flat-on
		penny.rotation.z = v * 0.16;
		penny.position.x = btn.x + v * 0.84;
		penny.position.y = btn.y + Math.sin(Math.PI * Math.min(1, v * 1.12)) * 0.78 + v * 0.3;
		penny.position.z = 0.55 + v * 1.35;
		penny.scale.setScalar(Math.min(1, v * 6));
	});
	// glints as it turns edge-on through the key light
	for (let i = 0; i < 4; i++) {
		await delay(170 + i * 130);
		particles.burst({
			texture: sprites.star4,
			count: 5,
			origin: penny.position.clone(),
			speed: [0.4, 1.4],
			life: [0.25, 0.5],
			size: [0.05, 0.13],
			colors: [0xfff0cf, 0xffd27a]
		});
	}
	await flight;

	// ---- heads. Obviously heads.
	audio.sfx('ding', { pitch: 1.35, gain: 0.7 });
	audio.sfx('chime', { pitch: 1.1, gain: 0.45 });
	haptics.vibrate([25, 40, 60]);
	scene.shake(0.22);
	shockwave(scene.scene, new THREE.Vector3(btn.x + 0.84, btn.y + 0.3, 1.88), {
		color: 0xffc98a,
		maxScale: 3.6,
		duration: 620,
		z: 1.88
	});
	flashPulse(machine, 0.5, 90, 520, 0xffc98a);
	particles.burst({
		texture: sprites.coin,
		count: 46,
		origin: penny.position.clone(),
		originSpread: 0.1,
		direction: new THREE.Vector3(0, 1, 0),
		cone: 0.95,
		speed: [1.4, 3.6],
		gravity: new THREE.Vector3(0, -4.2, 0),
		life: [0.7, 1.5],
		size: [0.05, 0.11],
		colors: [0xd08a4a, 0xf0b878, 0xffe0b0],
		spin: [-7, 7]
	});
	// it holds dead still for a beat, showing its face
	await tween(520, 'outQuad', (v) => {
		penny.scale.setScalar(1 + Math.sin(Math.PI * v) * 0.09);
	});

	// ---- pocket it
	audio.sfx('pop', { pitch: 1.5, gain: 0.4 });
	await tween(420, 'inQuad', (v) => {
		penny.scale.setScalar(1 - v);
		penny.rotation.x = Math.PI * 6 + v * 2.4;
		penny.position.z = 1.9 - v * 0.9;
	});
	scene.scene.remove(penny);
	disc.geometry.dispose();
	rim.dispose();
	heads.dispose();
	tails.dispose();

	wipe.out(900);
	tween(700, 'outQuad', (v) => {
		machine.setInnerGlow(0.3 * (1 - v));
		scene.fxLight.intensity = 3.4 * (1 - v);
	});
	await restore(700);
}
