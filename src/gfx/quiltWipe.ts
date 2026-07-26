// Re-dyeing the lounge. The quilted leather backdrop is green, and several
// effects want the whole room to change colour as they arrive — the dragon
// scorches it red, the amethyst floods it violet.
//
// Two tricks make this cheap:
//
//  1. The alternate albedo is DERIVED from the green canvas rather than painted
//     again. The green channel of the original encodes shade*tint, so recovering
//     that one scalar and re-tinting it keeps every seam, stitch and grain fleck
//     exactly where it was. One canvas pass per palette, cached forever.
//
//  2. The blend happens inside the backdrop's own shader via onBeforeCompile, so
//     there's no second mesh and no transparency sorting. The wipe front is
//     measured in VIEW space (length(vViewPosition.xy)) because the quilt tiles
//     its UVs 22x — vMapUv is useless for anything screen-shaped.
//
// The material is patched exactly once and its uniforms are reused, so effects
// with different palettes can share it without triggering a shader recompile.

import * as THREE from 'three';
import { tween } from '../core/anim';

/** [highlight, shadow] leather tint, plus the colour of the burning wipe edge. */
interface Palette {
	top: readonly [number, number, number];
	base: readonly [number, number, number];
	rim: readonly [number, number, number];
}

// top/base are the 0-255 leather tints at full light and in the pillow creases;
// rim is the glow that travels with the wipe front (linear 0-1, added on top).
const PALETTES: Record<string, Palette> = {
	// the dragon's scorch — matched to the original hand-tuned ember values.
	// Veins must stay FULLY saturated; any grey component reads as dirt.
	ember: { top: [118, 26, 20], base: [6, 4, 4], rim: [1.0, 0.45, 0.12] },
	// deep amethyst, magenta-lit
	violet: { top: [104, 44, 162], base: [9, 5, 20], rim: [0.78, 0.38, 1.0] },
	// midnight blue, for cold effects
	ice: { top: [34, 82, 142], base: [4, 8, 16], rim: [0.45, 0.82, 1.0] },
	// old-money burgundy and brass
	claret: { top: [126, 22, 52], base: [8, 3, 6], rim: [1.0, 0.35, 0.45] },
	// warm waxed oak — the quilting reads as grain once it's this colour
	oak: { top: [148, 96, 44], base: [16, 9, 4], rim: [1.0, 0.72, 0.34] }
};

export type QuiltPalette = keyof typeof PALETTES;

const dyeCache: Partial<Record<QuiltPalette, THREE.CanvasTexture>> = {};

/** Re-tint the green quilt albedo into another colour. Cached per palette. */
function dyedQuilt(src: THREE.Texture, name: QuiltPalette): THREE.CanvasTexture {
	const hit = dyeCache[name];
	if (hit) return hit;
	const { top, base } = PALETTES[name];
	const img = src.image as HTMLCanvasElement;
	const cv = document.createElement('canvas');
	cv.width = img.width;
	cv.height = img.height;
	const c = cv.getContext('2d')!;
	c.drawImage(img, 0, 0);
	const px = c.getImageData(0, 0, cv.width, cv.height);
	for (let i = 0; i < px.data.length; i += 4) {
		const st = (px.data[i + 1] - 6) / 92; // recover shade*tint from green
		px.data[i] = top[0] * st + base[0];
		px.data[i + 1] = top[1] * st + base[1];
		px.data[i + 2] = top[2] * st + base[2];
	}
	c.putImageData(px, 0, 0);
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.repeat.copy(src.repeat);
	dyeCache[name] = tex;
	return tex;
}

interface WipeUniforms {
	uWipe: { value: number };
	uMap2: { value: THREE.Texture | null };
	uRim: { value: THREE.Vector3 };
}

/** Patch the backdrop material once; later calls reuse the same uniforms. */
function patch(mat: THREE.MeshStandardMaterial): WipeUniforms {
	const cached = mat.userData.quiltWipe as WipeUniforms | undefined;
	if (cached) return cached;
	const uniforms: WipeUniforms = {
		uWipe: { value: -1 }, // rest: pure green, no rim
		uMap2: { value: null },
		uRim: { value: new THREE.Vector3(1, 0.45, 0.12) }
	};
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uWipe = uniforms.uWipe;
		shader.uniforms.uMap2 = uniforms.uMap2;
		shader.uniforms.uRim = uniforms.uRim;
		shader.fragmentShader = shader.fragmentShader
			.replace(
				'#include <common>',
				'#include <common>\nuniform float uWipe;\nuniform sampler2D uMap2;\nuniform vec3 uRim;'
			)
			.replace(
				'#include <map_fragment>',
				/* glsl */ `
				vec4 sampledDiffuseColor = texture2D( map, vMapUv );
				vec4 dyedDiffuse = texture2D( uMap2, vMapUv );
				float dWipe = length( vViewPosition.xy );
				float dyeA = 1.0 - smoothstep( uWipe, uWipe + 0.4, dWipe );
				sampledDiffuseColor = mix( sampledDiffuseColor, dyedDiffuse, dyeA );
				float rim = smoothstep( uWipe - 0.12, uWipe + 0.2, dWipe )
					* ( 1.0 - smoothstep( uWipe + 0.2, uWipe + 0.55, dWipe ) );
				sampledDiffuseColor.rgb += uRim * rim * 0.55 * step( -0.4, uWipe );
				diffuseColor *= sampledDiffuseColor;`
			);
	};
	// constant key: the program is the same whatever palette is loaded, and a
	// varying key would recompile the shader mid-effect
	mat.customProgramCacheKey = () => 'quilt-colour-wipe';
	mat.needsUpdate = true;
	mat.userData.quiltWipe = uniforms;
	return uniforms;
}

/** The far edge of the wipe: past this the whole visible backdrop has turned. */
const FULL = 8;

export interface QuiltWipe {
	/** Sweep the new colour out from the centre. */
	in(duration?: number): Promise<void>;
	/** Pull it back and settle at exactly-green rest. */
	out(duration?: number): Promise<void>;
}

/**
 * backdropWipe(machine.backdrop, quiltMap, 'violet').in(2000)
 *
 * Effects MUST call out() (or reset) in their teardown — the backdrop is shared
 * furniture and a half-wiped lounge follows you into the next effect.
 */
export function backdropWipe(
	backdrop: THREE.Mesh,
	quiltMap: THREE.Texture,
	palette: QuiltPalette
): QuiltWipe {
	const mat = backdrop.material as THREE.MeshStandardMaterial;
	const u = patch(mat);
	u.uMap2.value = dyedQuilt(quiltMap, palette);
	u.uRim.value.set(...PALETTES[palette].rim);
	return {
		in: (duration = 2600) =>
			tween(duration, 'inOutQuad', (v) => (u.uWipe.value = -0.5 + v * (FULL + 0.5))),
		out: async (duration = 1100) => {
			const from = u.uWipe.value;
			await tween(duration, 'inQuad', (v) => (u.uWipe.value = from - v * (from + 1)));
			u.uWipe.value = -1; // exact rest, no lingering rim
		}
	};
}

/** Slam the backdrop back to green. The director's crash net calls this. */
export function resetBackdropWipe(backdrop: THREE.Mesh): void {
	const u = (backdrop.material as THREE.MeshStandardMaterial).userData.quiltWipe as
		| WipeUniforms
		| undefined;
	if (u) u.uWipe.value = -1;
}
