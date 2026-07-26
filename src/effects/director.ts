// Picks and runs luck effects: shuffled order, never the same one twice in a row.

import { shuffle } from '../core/anim';
import { resetBackdropWipe } from '../gfx/quiltWipe';
import * as gentleGlow from './gentleGlow';
import type { EffectContext, EffectModule } from '../types';

// Effects are code-split. The bag only needs their NAMES up front and a visitor
// sees one per press, so each entry is an import thunk — Vite emits a chunk per
// effect, the service worker precaches them all, and the initial bundle carries
// the machine instead of thirty set-pieces. gentleGlow is the exception: it is
// tiny and reduced-motion visitors must never wait on a network fetch for it.
const EFFECTS: Record<string, () => Promise<EffectModule>> = {
	powerSurge: () => import('./powerSurge'),
	spinUp: () => import('./spinUp'),
	runeCircle: () => import('./runeCircle'),
	portalDrop: () => import('./portalDrop'),
	cloudTunnel: () => import('./cloudTunnel'),
	starBurst: () => import('./starBurst'),
	goldRush: () => import('./goldRush'),
	cloverVortex: () => import('./cloverVortex'),
	aurora: () => import('./aurora'),
	fireworks: () => import('./fireworks'),
	clockworkOverdrive: () => import('./clockworkOverdrive'),
	fireflies: () => import('./fireflies'),
	rainbow: () => import('./rainbow'),
	cosmicDrift: () => import('./cosmicDrift'),
	diceStorm: () => import('./diceStorm'),
	discoFever: () => import('./discoFever'),
	ufoAbduction: () => import('./ufoAbduction'),
	pinball: () => import('./pinball'),
	cardCyclone: () => import('./cardCyclone'),
	horseshoeToss: () => import('./horseshoeToss'),
	makeItRain: () => import('./makeItRain'),
	jollyRoger: () => import('./jollyRoger'),
	kpopLuck: () => import('./kpopLuck'),
	luckDragon: () => import('./luckDragon'),
	slotArm: () => import('./slotArm'),
	solarEclipse: () => import('./solarEclipse'),
	genieOfTheMachine: () => import('./genieOfTheMachine'),
	champagneSalute: () => import('./champagneSalute'),
	luckyPenny: () => import('./luckyPenny'),
	violetHour: () => import('./violetHour'),
	knockOnWood: () => import('./knockOnWood'),
	wishingWell: () => import('./wishingWell'),
	senbazuru: () => import('./senbazuru'),
	badLuckGauntlet: () => import('./badLuckGauntlet'),
	manekiNeko: () => import('./manekiNeko')
};

// What a prefers-reduced-motion visitor is allowed to see. The bar: nothing
// that moves the camera or the machine, no props sweeping across the whole
// frame, no tunnels or dives — just lovely things happening around a stationary
// machine. (scene.shake() already no-ops under reduced motion.) Five of these
// beats the one fallback they used to get forever.
const CALM = ['gentleGlow', 'aurora', 'fireflies', 'runeCircle', 'rainbow', 'violetHour'] as const;

export class Director {
	ctx: EffectContext;
	names: string[];
	bag: string[];
	index: number;
	last: string | null;
	running: boolean;
	forced: string | null;
	_loaded: Map<string, EffectModule>;

	constructor(ctx: EffectContext) {
		this.ctx = ctx;
		this.names = Object.keys(EFFECTS);
		this.bag = shuffle(this.names);
		this.index = 0;
		this.last = null;
		this.running = false;
		this.forced = null; // debug: ?fx=name
		this._loaded = new Map();
	}

	_next(): string {
		if (this.index >= this.bag.length) {
			this.bag = shuffle(this.names);
			// avoid an immediate repeat across the reshuffle boundary
			if (this.bag[0] === this.last) {
				this.bag.push(this.bag.shift()!);
			}
			this.index = 0;
		}
		if (import.meta.env.DEV) console.log('Now playing: ', this.bag[this.index]);
		return this.bag[this.index++];
	}

	/** Reduced-motion visitors draw from the calm shortlist instead of the bag. */
	_nextCalm(): string {
		const options = CALM.filter((n) => n !== this.last);
		return options[Math.floor(Math.random() * options.length)];
	}

	/** Load (and remember) an effect module. gentleGlow is already in the bundle. */
	async _load(name: string): Promise<EffectModule> {
		if (name === 'gentleGlow') return gentleGlow;
		const hit = this._loaded.get(name);
		if (hit) return hit;
		const mod = await EFFECTS[name]();
		this._loaded.set(name, mod);
		return mod;
	}

	/** Warm the chunk for whatever is next, so the following press is instant. */
	_prefetchNext(): void {
		const upcoming = this.bag[this.index];
		if (!upcoming || this._loaded.has(upcoming)) return;
		this._load(upcoming).catch(() => { /* it'll be fetched on demand */ });
	}

	// Everything a crashed effect could plausibly have left behind. Snapshotted
	// before play() and only restored on the failure path — on the happy path the
	// effect's own teardown is mid-flight and forcing values would fight it.
	_snapshot() {
		const { scene, machine } = this.ctx;
		return {
			updatables: new Set(scene.updatables),
			key: scene.keyLight.intensity,
			fill: scene.fillLight.intensity,
			rim: scene.rimLight.intensity,
			envIntensity: scene.scene.environmentIntensity,
			background: scene.scene.background,
			groupPos: machine.group.position.clone(),
			groupRot: machine.group.rotation.clone(),
			buttonPos: machine.buttonGroup.position.clone(),
			buttonRot: machine.buttonGroup.rotation.clone(),
			buttonScale: machine.buttonGroup.scale.clone(),
			buttonParent: machine.buttonGroup.parent,
			backdropVisible: machine.backdrop.visible
		};
	}

	/** Put the stage back after an effect dies mid-performance. Without this a
	 *  single thrown error leaves the room dark, the sim loops running and a
	 *  pirate ship parked in front of the machine until the visitor reloads. */
	_recover(snap: ReturnType<Director['_snapshot']>): void {
		const { scene, machine, particles, audio, lightning } = this.ctx;
		// sims the effect registered and never unhooked would run forever
		for (const fn of scene.updatables) {
			if (!snap.updatables.has(fn)) scene.updatables.delete(fn);
		}
		particles.clear();
		lightning.clear();
		audio.stopAllLoops();
		audio.stopAllTracks();
		machine.resetToIdle();
		// effects reparent the button (UFO tractor beam, cloud tunnel pirouette)
		if (machine.buttonGroup.parent !== snap.buttonParent) {
			snap.buttonParent?.add(machine.buttonGroup);
		}
		machine.buttonGroup.position.copy(snap.buttonPos);
		machine.buttonGroup.rotation.copy(snap.buttonRot);
		machine.buttonGroup.scale.copy(snap.buttonScale);
		machine.group.position.copy(snap.groupPos);
		machine.group.rotation.copy(snap.groupRot);
		machine.backdrop.visible = snap.backdropVisible;
		resetBackdropWipe(machine.backdrop);
		scene.keyLight.intensity = snap.key;
		scene.fillLight.intensity = snap.fill;
		scene.rimLight.intensity = snap.rim;
		scene.scene.environmentIntensity = snap.envIntensity;
		scene.scene.background = snap.background;
		scene.fxLight.intensity = 0;
		scene.setVignetteBoost(0);
		scene.cameraRoll = 0;
		scene.parallaxStrength = 1;
		scene.scene.fog = null;
		// the environment swap is a plain assignment, not a tween — no crossfade
		// to await here, we just need the lounge back
		scene.scene.environment = scene.envTexture('lounge');
		scene.environmentName = 'lounge';
	}

	async play(): Promise<string | null> {
		if (this.running) return null;
		this.running = true;
		const name = this.ctx.scene.reducedMotion
			? this.forced && CALM.includes(this.forced as (typeof CALM)[number])
				? this.forced
				: this._nextCalm()
			: this.forced && (EFFECTS[this.forced] || this.forced === 'gentleGlow')
				? this.forced
				: this._next();
		this.last = name;
		const snap = this._snapshot();
		try {
			const effect = await this._load(name);
			this.ctx.audio.play(effect.sound ?? '');
			this.ctx.machine.mechSpeed = 5; // the machinery works hard during a luck event
			await effect.play(this.ctx);
		} catch (err) {
			console.error(`Effect ${name} failed:`, err);
			this._recover(snap);
		} finally {
			this.ctx.machine.mechSpeed = 1;
			this.running = false;
			this._prefetchNext();
		}
		return name;
	}
}

/** What the console is allowed to summon for a reduced-motion visitor. */
export const CALM_EFFECTS: readonly string[] = CALM;
