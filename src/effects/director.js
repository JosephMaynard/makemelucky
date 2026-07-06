// Picks and runs luck effects: shuffled order, never the same one twice in a row.

import { shuffle } from '../core/anim.js';
import * as powerSurge from './powerSurge.js';
import * as spinUp from './spinUp.js';
import * as runeCircle from './runeCircle.js';
import * as portalDrop from './portalDrop.js';
import * as cloudTunnel from './cloudTunnel.js';
import * as starBurst from './starBurst.js';
import * as slotReels from './slotReels.js';
import * as goldRush from './goldRush.js';
import * as cloverVortex from './cloverVortex.js';
import * as aurora from './aurora.js';
import * as fireworks from './fireworks.js';
import * as clockworkOverdrive from './clockworkOverdrive.js';
import * as fireflies from './fireflies.js';
import * as rainbow from './rainbow.js';
import * as cosmicDrift from './cosmicDrift.js';
import * as gentleGlow from './gentleGlow.js';

const EFFECTS = {
	powerSurge,
	spinUp,
	runeCircle,
	portalDrop,
	cloudTunnel,
	starBurst,
	slotReels,
	goldRush,
	cloverVortex,
	aurora,
	fireworks,
	clockworkOverdrive,
	fireflies,
	rainbow,
	cosmicDrift
};

export class Director {
	constructor(ctx) {
		this.ctx = ctx;
		this.names = Object.keys(EFFECTS);
		this.bag = shuffle(this.names);
		this.index = 0;
		this.last = null;
		this.running = false;
		this.forced = null; // debug: ?fx=name
	}

	_next() {
		if (this.index >= this.bag.length) {
			this.bag = shuffle(this.names);
			// avoid an immediate repeat across the reshuffle boundary
			if (this.bag[0] === this.last) {
				this.bag.push(this.bag.shift());
			}
			this.index = 0;
		}
		return this.bag[this.index++];
	}

	async play() {
		if (this.running) return null;
		this.running = true;
		const name = this.ctx.scene.reducedMotion
			? 'gentleGlow'
			: this.forced && EFFECTS[this.forced]
				? this.forced
				: this._next();
		this.last = name;
		const effect = name === 'gentleGlow' ? gentleGlow : EFFECTS[name];
		try {
			this.ctx.audio.play(effect.sound);
			this.ctx.machine.mechSpeed = 5; // the machinery works hard during a luck event
			await effect.play(this.ctx);
		} catch (err) {
			console.error(`Effect ${name} failed:`, err);
		} finally {
			this.ctx.machine.mechSpeed = 1;
			this.running = false;
		}
		return name;
	}
}
