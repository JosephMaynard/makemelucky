// Shared types for the effect system. Every effect module receives one
// EffectContext — the full toolkit of scene, machine and services — and
// exposes the EffectModule shape the director's registry expects.

import type * as THREE from 'three';
import type { LuckyScene } from './core/scene';
import type { Machine } from './machine/machine';
import type { Particles } from './gfx/particles';
import type { Lightning } from './gfx/lightning';
import type { AudioService } from './services/audio';
import type { Haptics } from './services/haptics';
import type { SpriteSet, QuiltTextures, MachineFaceTextures, ButtonTextures } from './gfx/textures';

/** The procedural texture bundle built once at boot (see main.ts). */
export interface TextureBundle {
	quilt: QuiltTextures;
	face: MachineFaceTextures;
	button: ButtonTextures;
	sky: THREE.CanvasTexture;
	cloudSprite: THREE.CanvasTexture;
}

/** Everything an effect gets to play with. */
export interface EffectContext {
	scene: LuckyScene;
	machine: Machine;
	particles: Particles;
	lightning: Lightning;
	sprites: SpriteSet;
	glyphTextures: THREE.CanvasTexture[];
	textures: TextureBundle;
	audio: AudioService;
	haptics: Haptics;
}

/** The module shape of every file in src/effects/ that the director runs. */
export interface EffectModule {
	/** Sprite key or track key passed to AudioService.play() as the effect starts. */
	sound?: string;
	/** Nominal length in ms — the director keeps the screen away this long. */
	duration: number;
	play(ctx: EffectContext): Promise<void>;
	/** Optional: build anything heavy and reusable ahead of time. The director
	 *  calls it in idle time once this effect is next in the bag, so play()
	 *  doesn't stall the run-up (or the soundtrack) constructing a set. */
	warm?(ctx: EffectContext): void;
}

declare global {
	interface Window {
		/** Console party trick — run any effect by name (no name lists them). */
		showEffect?: (name?: string) => Promise<string | undefined>;
		/** Debug handle used by tools/snap.mjs probes. */
		__mml?: Record<string, unknown>;
	}
}
