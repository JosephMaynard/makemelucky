// The luck store — same localStorage key as V2 ('luckStore') so twelve years of
// button presses survive the upgrade.

import { PRESS_CHARMS, VISIT_CHARMS, STREAK_CHARMS, byId, byTitle } from './charmsData';
import type { Charm } from './charmsData';

const KEY = 'luckStore';
const VERSION = 3;
const HOUR = 3600000;

// The current (V3) persisted shape.
export interface LuckData {
	version: number;
	luckyness: number;
	visits: number;
	streak: number;
	longestPress: number;
	soundOn: boolean;
	vibrationOn: boolean;
	firstUse: string;
	lastVisit: string;
	lastRitual: string; // ISO date of the last Daily Luck Ritual press
	charms: Charm[]; // [{ id, title, description, icon, date }]
}

// The V2 store (version 0.35) shape we still migrate from.
interface V2Charm {
	title: string;
	description?: string;
	x?: number;
	y?: number;
	date?: string;
}

interface V2LegacyData {
	version?: number;
	luckyness?: number;
	visits?: number;
	longestPress?: number;
	daysInRow?: number;
	soundOn?: boolean;
	vibrationOn?: boolean;
	firstUse?: string;
	charms?: V2Charm[];
}

function storageAvailable(): boolean {
	try {
		localStorage.setItem('__t', '1');
		localStorage.removeItem('__t');
		return true;
	} catch {
		return false;
	}
}

function fresh(): LuckData {
	return {
		version: VERSION,
		luckyness: 0,
		visits: 1,
		streak: 1,
		longestPress: 0,
		soundOn: true,
		vibrationOn: true,
		firstUse: new Date().toISOString(),
		lastVisit: new Date().toISOString(),
		lastRitual: '',
		charms: [] // [{ id, title, description, icon, date }]
	};
}

export class LuckStore {
	available: boolean;
	data: LuckData;
	newlyAwarded: Charm[];

	constructor() {
		this.available = storageAvailable();
		this.data = fresh();
		this.newlyAwarded = [];

		if (this.available) {
			try {
				const raw = localStorage.getItem(KEY);
				if (raw) this.data = this._migrate(JSON.parse(raw));
			} catch {
				this.data = fresh();
			}
		}
		this._trackVisit();
		this.save();
	}

	_migrate(old: LuckData | V2LegacyData | null | undefined): LuckData {
		if (!old || typeof old !== 'object') return fresh();
		if (old.version === VERSION) return { ...fresh(), ...(old as LuckData) };

		// V2 store (version 0.35): { luckyness, visits, longestPress, daysInRow,
		//   charms: [{title, description, x, y, date}], soundOn, vibrationOn, firstUse }
		const migrated = fresh();
		migrated.luckyness = Number(old.luckyness) || 0;
		migrated.visits = Number(old.visits) || 1;
		migrated.longestPress = Number(old.longestPress) || 0;
		migrated.soundOn = old.soundOn !== false;
		migrated.vibrationOn = old.vibrationOn !== false;
		if (old.firstUse) migrated.firstUse = old.firstUse;

		// carry over earned charms (matched by title), then silently backfill any
		// press milestones the old system missed
		const seen = new Set<string>();
		for (const c of old.charms || []) {
			const def = byTitle.get(c.title);
			if (def && !seen.has(def.id)) {
				seen.add(def.id);
				migrated.charms.push({
					id: def.id,
					title: def.title,
					description: def.description,
					icon: def.icon,
					date: c.date || migrated.firstUse
				});
			}
		}
		for (const def of PRESS_CHARMS) {
			if (def.amount! <= migrated.luckyness && !seen.has(def.id)) {
				migrated.charms.push({ ...def, date: new Date().toISOString() });
			}
		}
		return migrated;
	}

	_trackVisit(): void {
		const now = new Date();
		const last = new Date(this.data.lastVisit || this.data.firstUse);
		if (+now - +last > HOUR) {
			this.data.visits += 1;
			for (const def of VISIT_CHARMS) {
				if (def.amount === this.data.visits) this._award(def);
			}
			// daily streak
			const dayNow = now.toDateString();
			const dayLast = last.toDateString();
			const yesterday = new Date(+now - 86400000).toDateString();
			if (dayLast === yesterday) {
				this.data.streak = (this.data.streak || 1) + 1;
				for (const def of STREAK_CHARMS) {
					if (def.amount === this.data.streak) this._award(def);
				}
			} else if (dayLast !== dayNow) {
				this.data.streak = 1;
			}
		}
		this.data.lastVisit = now.toISOString();
	}

	_award(def: Charm): Charm | null {
		if (this.hasCharm(def.id)) return null;
		const charm = { ...def, date: new Date().toISOString() };
		this.data.charms.push(charm);
		this.newlyAwarded.push(charm);
		return charm;
	}

	hasCharm(id: string): boolean {
		return this.data.charms.some((c) => c.id === id);
	}

	/** One-off charms awarded outside the normal press/hold/share flow. */
	awardSpecial(id: string, title: string, description: string, icon: string): Charm | null {
		const charm = this._award({ id, title, description, icon });
		if (charm) this.save();
		return charm;
	}

	/** Returns array of newly awarded charms (usually empty or one). */
	registerPress(): Charm[] {
		this.data.luckyness += 1;
		const awarded: (Charm | null)[] = [];
		for (const def of PRESS_CHARMS) {
			if (def.amount === this.data.luckyness && !this.hasCharm(def.id)) {
				awarded.push(this._award(def));
			}
		}
		this.save();
		return awarded.filter(Boolean) as Charm[];
	}

	registerHold(seconds: number): Charm[] {
		const awarded: Charm[] = [];
		if (seconds > (this.data.longestPress || 0)) {
			this.data.longestPress = seconds;
		}
		if (seconds >= 8) {
			const charm = this._award(byId.get('steadyHand')!);
			if (charm) awarded.push(charm);
		}
		this.save();
		return awarded;
	}

	registerShare(): Charm[] {
		const charm = this._award(byId.get('share')!);
		this.save();
		return charm ? [charm] : [];
	}

	registerInstall(): Charm[] {
		const charm = this._award(byId.get('installed')!);
		this.save();
		return charm ? [charm] : [];
	}

	nextPressCharm(): Charm | undefined {
		return PRESS_CHARMS.find((def) => def.amount! > this.data.luckyness && !this.hasCharm(def.id));
	}

	/** The Daily Luck Ritual: the first press of each calendar day is special. */
	ritualAvailable(): boolean {
		if (!this.data.lastRitual) return true;
		return new Date(this.data.lastRitual).toDateString() !== new Date().toDateString();
	}

	registerRitual(): void {
		this.data.lastRitual = new Date().toISOString();
		this.save();
	}

	setSound(on: boolean): void {
		this.data.soundOn = on;
		this.save();
	}

	save(): void {
		if (!this.available) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.data));
		} catch {
			/* full or blocked — luck continues regardless */
		}
	}
}
