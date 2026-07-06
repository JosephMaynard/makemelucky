// The luck store — same localStorage key as V2 ('luckStore') so twelve years of
// button presses survive the upgrade.

import { PRESS_CHARMS, VISIT_CHARMS, STREAK_CHARMS, byId, byTitle } from './charmsData.js';

const KEY = 'luckStore';
const VERSION = 3;
const HOUR = 3600000;

function storageAvailable() {
	try {
		localStorage.setItem('__t', '1');
		localStorage.removeItem('__t');
		return true;
	} catch {
		return false;
	}
}

function fresh() {
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
		charms: [] // [{ id, title, description, icon, date }]
	};
}

export class LuckStore {
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

	_migrate(old) {
		if (!old || typeof old !== 'object') return fresh();
		if (old.version === VERSION) return { ...fresh(), ...old };

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
		const seen = new Set();
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
			if (def.amount <= migrated.luckyness && !seen.has(def.id)) {
				migrated.charms.push({ ...def, date: new Date().toISOString() });
			}
		}
		return migrated;
	}

	_trackVisit() {
		const now = new Date();
		const last = new Date(this.data.lastVisit || this.data.firstUse);
		if (now - last > HOUR) {
			this.data.visits += 1;
			for (const def of VISIT_CHARMS) {
				if (def.amount === this.data.visits) this._award(def);
			}
			// daily streak
			const dayNow = now.toDateString();
			const dayLast = last.toDateString();
			const yesterday = new Date(now - 86400000).toDateString();
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

	_award(def) {
		if (this.hasCharm(def.id)) return null;
		const charm = { ...def, date: new Date().toISOString() };
		this.data.charms.push(charm);
		this.newlyAwarded.push(charm);
		return charm;
	}

	hasCharm(id) {
		return this.data.charms.some((c) => c.id === id);
	}

	/** Returns array of newly awarded charms (usually empty or one). */
	registerPress() {
		this.data.luckyness += 1;
		const awarded = [];
		for (const def of PRESS_CHARMS) {
			if (def.amount === this.data.luckyness && !this.hasCharm(def.id)) {
				awarded.push(this._award(def));
			}
		}
		this.save();
		return awarded.filter(Boolean);
	}

	registerHold(seconds) {
		const awarded = [];
		if (seconds > (this.data.longestPress || 0)) {
			this.data.longestPress = seconds;
		}
		if (seconds >= 8) {
			const charm = this._award(byId.get('steadyHand'));
			if (charm) awarded.push(charm);
		}
		this.save();
		return awarded;
	}

	registerShare() {
		const charm = this._award(byId.get('share'));
		this.save();
		return charm ? [charm] : [];
	}

	registerInstall() {
		const charm = this._award(byId.get('installed'));
		this.save();
		return charm ? [charm] : [];
	}

	nextPressCharm() {
		return PRESS_CHARMS.find((def) => def.amount > this.data.luckyness && !this.hasCharm(def.id));
	}

	setSound(on) {
		this.data.soundOn = on;
		this.save();
	}

	save() {
		if (!this.available) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.data));
		} catch {
			/* full or blocked — luck continues regardless */
		}
	}
}
