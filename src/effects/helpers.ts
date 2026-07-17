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

/** Dim the scene lights for a dramatic moment; returns a restore().
 *  As the lights fall the rim light rises (silhouette stays readable) and the
 *  vignette deepens (dark reads as graded, not just dim). */
export function dimLights(luckyScene: LuckyScene, level = 0.3, duration = 600) {
	const key0 = luckyScene.keyLight.intensity;
	const fill0 = luckyScene.fillLight.intensity;
	const env0 = luckyScene.scene.environmentIntensity;
	const rim0 = luckyScene.rimLight.intensity;
	const darkness = Math.max(0, 1 - level); // 0 = no dim, 1 = blackout
	tween(duration, 'inOutQuad', (v) => {
		luckyScene.keyLight.intensity = key0 * (1 - v * (1 - level));
		luckyScene.fillLight.intensity = fill0 * (1 - v * (1 - level));
		luckyScene.scene.environmentIntensity = env0 * (1 - v * (1 - level));
		luckyScene.rimLight.intensity = rim0 + v * darkness * 1.1;
		luckyScene.setVignetteBoost(v * darkness);
	});
	return (restoreDuration: number = 800) =>
		tween(restoreDuration, 'inOutQuad', (v) => {
			const w = level + (1 - level) * v;
			luckyScene.keyLight.intensity = key0 * w;
			luckyScene.fillLight.intensity = fill0 * w;
			luckyScene.scene.environmentIntensity = env0 * w;
			luckyScene.rimLight.intensity = rim0 + (1 - v) * darkness * 1.1;
			luckyScene.setVignetteBoost((1 - v) * darkness);
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

/** Recursively dispose every geometry and material under `root` (dedup via a
 *  Set so shared resources aren't double-disposed; handles material arrays).
 *  Deliberately leaves textures alone — effects routinely reuse sprites/quilt
 *  textures from the shared ctx bundle via `.map`, and disposing a material
 *  never touches its textures anyway, so nothing shared gets clobbered. If an
 *  effect builds its own local texture (a beam gradient, a canvas texture) it
 *  still owns disposing that itself. Also skips geometry on THREE.Sprite —
 *  every Sprite instance shares one static module-level geometry, so disposing
 *  it here would break every other sprite in the app. */
export function disposeObject(root: THREE.Object3D): void {
	const disposed = new Set<THREE.BufferGeometry | THREE.Material>();
	root.traverse((o) => {
		const obj = o as THREE.Object3D & {
			geometry?: THREE.BufferGeometry;
			material?: THREE.Material | THREE.Material[];
			isSprite?: boolean;
		};
		if (obj.geometry && !obj.isSprite && !disposed.has(obj.geometry)) {
			obj.geometry.dispose();
			disposed.add(obj.geometry);
		}
		if (obj.material) {
			for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
				if (!disposed.has(m)) {
					m.dispose();
					disposed.add(m);
				}
			}
		}
	});
}
