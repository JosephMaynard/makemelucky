// Picks and runs luck effects: shuffled order, never the same one twice in a row.

import { shuffle } from '../core/anim';
import * as powerSurge from './powerSurge';
import * as spinUp from './spinUp';
import * as runeCircle from './runeCircle';
import * as portalDrop from './portalDrop';
import * as cloudTunnel from './cloudTunnel';
import * as starBurst from './starBurst';
import * as goldRush from './goldRush';
import * as cloverVortex from './cloverVortex';
import * as aurora from './aurora';
import * as fireworks from './fireworks';
import * as clockworkOverdrive from './clockworkOverdrive';
import * as fireflies from './fireflies';
import * as rainbow from './rainbow';
import * as cosmicDrift from './cosmicDrift';
import * as diceStorm from './diceStorm';
import * as discoFever from './discoFever';
import * as ufoAbduction from './ufoAbduction';
import * as pinball from './pinball';
import * as cardCyclone from './cardCyclone';
import * as horseshoeToss from './horseshoeToss';
import * as makeItRain from './makeItRain';
import * as slotArm from './slotArm';
import * as solarEclipse from './solarEclipse';
import * as genieOfTheMachine from './genieOfTheMachine';
import * as champagneSalute from './champagneSalute';
import * as gentleGlow from './gentleGlow';
import type { EffectContext, EffectModule } from '../types';

const EFFECTS: Record<string, EffectModule> = {
	powerSurge,
	spinUp,
	runeCircle,
	portalDrop,
	cloudTunnel,
	starBurst,
	goldRush,
	cloverVortex,
	aurora,
	fireworks,
	clockworkOverdrive,
	fireflies,
	rainbow,
	cosmicDrift,
	diceStorm,
	discoFever,
	ufoAbduction,
	pinball,
	cardCyclone,
	horseshoeToss,
	makeItRain,
	slotArm,
	solarEclipse,
	genieOfTheMachine,
	champagneSalute,
};

export class Director {
	ctx: EffectContext;
	names: string[];
	bag: string[];
	index: number;
	last: string | null;
	running: boolean;
	forced: string | null;

	constructor(ctx: EffectContext) {
		this.ctx = ctx;
		this.names = Object.keys(EFFECTS);
		this.bag = shuffle(this.names);
		this.index = 0;
		this.last = null;
		this.running = false;
		this.forced = null; // debug: ?fx=name
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

	async play(): Promise<string | null> {
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
			this.ctx.audio.play(effect.sound ?? '');
			this.ctx.machine.mechSpeed = 5; // the machinery works hard during a luck event
			await effect.play(this.ctx);
		} catch (err) {
			console.error(`Effect ${name} failed:`, err);
			// a crashed effect can leave the iris open, glows lit and loops running
			this.ctx.machine.resetToIdle();
			this.ctx.audio.stopAllLoops();
			this.ctx.lightning.clear();
		} finally {
			this.ctx.machine.mechSpeed = 1;
			this.running = false;
		}
		return name;
	}
}
