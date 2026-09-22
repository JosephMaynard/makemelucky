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
	violetHour: () => import('./violetHour'),
	wishingWell: () => import('./wishingWell'),
	senbazuru: () => import('./senbazuru'),
	badLuckGauntlet: () => import('./badLuckGauntlet'),
	manekiNeko: () => import('./manekiNeko'),
	luckyTacos: () => import('./luckyTacos'),
	fairyKingdom: () => import('./fairyKingdom'),
	bhangraBaraat: () => import('./bhangraBaraat')
};

// Effects scored to a standalone track rather than the licensed sprite. Kept
// here so the director can tell whether an effect's music is ready WITHOUT
// fetching its code chunk first (a chunk is small, but on the slow first-visit
// connection where this matters, three of them are not). Every other effect
// is cued from the sprite, and one sprite cue stands for all of them.
// tests/director.test.ts checks this against each module's `sound` export.
export const TRACKED: Record<string, string> = {
	discoFever: 'luckyNowDisco',
	fireworks: 'luckyFireworks',
	jollyRoger: 'pirateShanty',
	kpopLuck: 'kpopLuck',
	manekiNeko: 'luckyCatWave',
	fairyKingdom: 'fairyKingdom',
	luckyTacos: 'luckyTacos',
	badLuckGauntlet: 'stillLuckyTonight',
	bhangraBaraat: 'bollywoodLuck'
};
const soundOf = (name: string): string => TRACKED[name] ?? 'lucky';

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

	/** The effect the next press will draw, without drawing it. Reshuffles the
	 *  bag when it is empty, exactly as _next() would, so the answer is final. */
	_peek(): string {
		if (this.index >= this.bag.length) {
			this.bag = shuffle(this.names);
			// avoid an immediate repeat across the reshuffle boundary
			if (this.bag[0] === this.last) {
				this.bag.push(this.bag.shift()!);
			}
			this.index = 0;
		}
		return this.bag[this.index];
	}

	_next(): string {
		const name = this._peek();
		this.index += 1;
		if (import.meta.env.DEV) console.log('Now playing: ', name);
		return name;
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

	/** Get the next effect ready in the background: its code, its soundtrack,
	 *  and any heavy set it can build ahead of time. A track that is still
	 *  downloading when its effect begins starts late and the whole
	 *  choreography lands early, so this is what keeps the scored effects in
	 *  time on a first visit. Call it at boot and after every play. */
	prefetchNext(): void {
		// a reduced-motion visitor draws at random from the calm list, which
		// can't be predicted; those effects are tiny and unscored anyway
		if (this.ctx.scene.reducedMotion) return;
		const upcoming = this.forced && EFFECTS[this.forced] ? this.forced : this._peek();
		if (!upcoming) return;
		this._load(upcoming)
			.then((mod) => {
				if (mod.sound) this.ctx.audio.preload(mod.sound);
				if (mod.warm) whenIdle(() => mod.warm!(this.ctx));
			})
			.catch(() => { /* it'll be fetched on demand */ });
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

	/** The drawn effect's soundtrack isn't ready: look a few slots ahead in the
	 *  bag for one whose sound is, and swap the two so the deferred effect keeps
	 *  its place for a later press. The scan is short — each candidate is a
	 *  code chunk, precached by the service worker but a fetch on a first
	 *  visit — and null means play the original after all. */
	async _swapForReady(drawn: string): Promise<{ name: string; effect: EffectModule } | null> {
		const slot = this.index - 1; // _next() already advanced past the drawn slot
		if (slot < 0 || this.bag[slot] !== drawn) return null;
		const limit = Math.min(this.bag.length, this.index + 3);
		for (let j = this.index; j < limit; j++) {
			const candidate = this.bag[j];
			if (candidate === this.last || !this.ctx.audio.isReady(soundOf(candidate))) continue;
			try {
				const effect = await this._load(candidate);
				this.bag[slot] = candidate;
				this.bag[j] = drawn;
				if (import.meta.env.DEV) console.log(`Deferring ${drawn} (soundtrack still loading); playing ${candidate}`);
				return { name: candidate, effect };
			} catch { /* a chunk that won't load is no better than a silent one */ }
		}
		return null;
	}

	async play(): Promise<string | null> {
		if (this.running) return null;
		this.running = true;
		let name = this.ctx.scene.reducedMotion
			? this.forced && CALM.includes(this.forced as (typeof CALM)[number])
				? this.forced
				: this._nextCalm()
			: this.forced && (EFFECTS[this.forced] || this.forced === 'gentleGlow')
				? this.forced
				: this._next();
		const snap = this._snapshot();
		try {
			let effect = await this._load(name);
			// A scored effect must not start until its music can: half of these
			// are choreographed to the second. If this one's soundtrack hasn't
			// landed yet (first visit, slow network), draw a different effect
			// whose sound IS ready and keep this one in the bag for a later
			// press — its download carries on in the background meanwhile. A
			// silent bhangra is not a performance anyone wants.
			if (effect.sound && !this.forced && !this.ctx.scene.reducedMotion && !this.ctx.audio.isReady(effect.sound)) {
				const swapped = await this._swapForReady(name);
				if (swapped) {
					this.ctx.audio.preload(effect.sound); // the deferred one, for its turn
					name = swapped.name;
					effect = swapped.effect;
				}
			}
			this.last = name;
			// Whatever was drawn, wait for its sound. Only when nothing in
			// reach was ready does this wait get long; if the music still
			// hasn't arrived by then the show goes on WITHOUT it — playing
			// anyway would queue the track to start mid-finale.
			const scored = effect.sound ? await this.ctx.audio.ready(effect.sound, this.ctx.audio.isReady(effect.sound) ? 2500 : 10000) : false;
			if (scored) this.ctx.audio.play(effect.sound!);
			else if (effect.sound) console.warn(`Effect ${name}: soundtrack not ready in time, playing silent`);
			this.ctx.machine.mechSpeed = 5; // the machinery works hard during a luck event
			await effect.play(this.ctx);
		} catch (err) {
			console.error(`Effect ${name} failed:`, err);
			this._recover(snap);
		} finally {
			this.ctx.machine.mechSpeed = 1;
			this.running = false;
			this.prefetchNext();
		}
		return name;
	}
}

/** Run `fn` when the browser has nothing better to do (with a deadline, so a
 *  busy page can't postpone it for ever). Safari has no requestIdleCallback. */
function whenIdle(fn: () => void): void {
	if (typeof requestIdleCallback === 'function') requestIdleCallback(() => fn(), { timeout: 4000 });
	else setTimeout(fn, 800);
}

/** What the console is allowed to summon for a reduced-motion visitor. */
export const CALM_EFFECTS: readonly string[] = CALM;
