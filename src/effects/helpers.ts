import * as THREE from 'three';
import { tween } from '../core/anim';
import type { LuckyScene } from '../core/scene';
import type { Machine } from '../machine/machine';

/** Expanding additive ring shockwave. */
export function shockwave(
	scene: THREE.Scene,
	position: THREE.Vector3,
	{ color = 0xbfe8ff, maxScale = 4, duration = 700, z = 0.3 }: { color?: THREE.ColorRepresentation; maxScale?: number; duration?: number; z?: number } = {}
) {
	const geo = new THREE.RingGeometry(0.88, 1, 64);
	const mat = new THREE.MeshBasicMaterial({
		color,
		transparent: true,
		opacity: 1,
		blending: THREE.AdditiveBlending,
		depthWrite: false,
		side: THREE.DoubleSide
	});
	const ring = new THREE.Mesh(geo, mat);
	ring.position.copy(position);
	ring.position.z = z;
	scene.add(ring);
	return tween(duration, 'outCubic', (v) => {
		ring.scale.setScalar(0.3 + v * maxScale);
		mat.opacity = 0.7 * (1 - v);
	}).then(() => {
		scene.remove(ring);
		geo.dispose();
		mat.dispose();
	});
}

/** Dim the scene lights for a dramatic moment; returns a restore(). */
export function dimLights(luckyScene: LuckyScene, level = 0.3, duration = 600) {
	const key0 = luckyScene.keyLight.intensity;
	const fill0 = luckyScene.fillLight.intensity;
	const env0 = luckyScene.scene.environmentIntensity;
	tween(duration, 'inOutQuad', (v) => {
		luckyScene.keyLight.intensity = key0 * (1 - v * (1 - level));
		luckyScene.fillLight.intensity = fill0 * (1 - v * (1 - level));
		luckyScene.scene.environmentIntensity = env0 * (1 - v * (1 - level));
	});
	return (restoreDuration: number = 800) =>
		tween(restoreDuration, 'inOutQuad', (v) => {
			const w = level + (1 - level) * v;
			luckyScene.keyLight.intensity = key0 * w;
			luckyScene.fillLight.intensity = fill0 * w;
			luckyScene.scene.environmentIntensity = env0 * w;
		});
}

/** Quick white-out pulse using the machine's big glow sprite. */
export async function flashPulse(machine: Machine, peak = 1, upMs = 90, downMs = 500, color: THREE.ColorRepresentation = 0xffffff): Promise<void> {
	await tween(upMs, 'outQuad', (v) => machine.setOuterGlow(v * peak, color));
	return tween(downMs, 'outQuad', (v) => machine.setOuterGlow(peak * (1 - v)));
}

/** Point on the edge of the visible area, roughly, in machine-plane space. */
export function offscreenPoint(angle: number, radius = 4.6, z = 0.35): THREE.Vector3 {
	return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
}
