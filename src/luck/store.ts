// The luck store — same localStorage key as V2 ('luckStore') so twelve years of
// button presses survive the upgrade.

import { PRESS_CHARMS, VISIT_CHARMS, STREAK_CHARMS, byId, byTitle } from './charmsData';
import type { Charm } from './charmsData';
import { dayKey, shiftDay } from './days';

const KEY = 'luckStore';
// A single raw copy of whatever was in KEY the first time this app rewrote it
// in a different shape (a V2 migration, a repair of a malformed V3 record, or
// unparseable text about to be replaced by a fresh record). Written at most
// once, ever: the point is to preserve the ORIGINAL, not the most recent
// attempt, and a second write would overwrite the very thing worth keeping.
const BACKUP_KEY = 'luckStore.backup';
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

/** A parsed record we are willing to look at: a plain object, not an array,
 *  not null, not a bare number or string. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface SanitizeResult {
	data: LuckData;
	/** True when at least one field had to be coerced, defaulted or dropped —
	 *  i.e. what we are about to save is not the shape we read. */
	repaired: boolean;
}

/**
 * Repair a parsed record FIELD BY FIELD.
 *
 * `{ ...fresh(), ...old }` used to accept anything that was valid JSON, so a
 * stored `{ version: 3, luckyness: 100, charms: null }` booted and then threw
 * inside charm rendering — before the scene existed, leaving the loading
 * overlay up forever. String counters concatenated instead of incrementing and
 * unparseable dates sailed through.
 *
 * The rule here is repair, never discard: a broken `charms` array must not cost
 * someone their press count, and a broken counter must not cost them their
 * charms. Each field falls back to the FRESH DEFAULT FOR THAT FIELD only.
 * Numeric strings ('12') are coerced rather than thrown away, because they are
 * real history written by an older or third-party writer.
 */
export function sanitize(record: Record<string, unknown>, version: number = VERSION): SanitizeResult {
	const base = fresh();
	let repaired = false;

	/** Finite, non-negative counter. `integer` for things that are counted. */
	const num = (value: unknown, fallback: number, integer: boolean): number => {
		const n =
			typeof value === 'number'
				? value
				: typeof value === 'string' && value.trim() !== ''
					? Number(value)
					: NaN;
		if (!Number.isFinite(n) || n < 0) {
			repaired = true;
			return fallback;
		}
		const out = integer ? Math.floor(n) : n;
		if (out !== value) repaired = true; // '12' → 12 is still a shape change
		return out;
	};

	const bool = (value: unknown, fallback: boolean): boolean => {
		if (typeof value === 'boolean') return value;
		repaired = true;
		if (value === 'true' || value === 1) return true;
		if (value === 'false' || value === 0) return false;
		return fallback;
	};

	/** A date we must have. Keeps the stored string when it parses, so
	 *  '2016-05-05T12:00:00.000Z' comes back byte-identical. */
	const date = (value: unknown, fallback: string): string => {
		if (typeof value === 'string' && value !== '' && !Number.isNaN(Date.parse(value))) return value;
		if (typeof value === 'number' && Number.isFinite(value)) {
			const d = new Date(value);
			if (!Number.isNaN(+d)) {
				repaired = true;
				return d.toISOString();
			}
		}
		repaired = true;
		return fallback;
	};

	/** lastRitual is the one date that is legitimately empty ("never"), so an
	 *  absent value is normal rather than damage. */
	const ritualDate = (value: unknown): string => {
		if (value === undefined || value === null || value === '') return '';
		if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value;
		repaired = true;
		return '';
	};

	const charmList = (value: unknown, stampFallback: string): Charm[] => {
		if (!Array.isArray(value)) {
			repaired = true;
			return [];
		}
		const out: Charm[] = [];
		const seen = new Set<string>();
		for (const entry of value) {
			if (!isRecord(entry)) {
				repaired = true;
				continue;
			}
			const id = typeof entry.id === 'string' ? entry.id.trim() : '';
			if (!id || seen.has(id)) {
				repaired = true;
				continue;
			}
			const def = byId.get(id);
			// A known id with a missing title is repairable history, not junk;
			// an entry with no usable id is dropped — nothing can identify it.
			const title = typeof entry.title === 'string' && entry.title.trim() !== '' ? entry.title : def?.title;
			if (!title) {
				repaired = true;
				continue;
			}
			seen.add(id);
			const description = typeof entry.description === 'string' ? entry.description : (def?.description ?? '');
			const icon = typeof entry.icon === 'string' && entry.icon !== '' ? entry.icon : (def?.icon ?? '✨');
			const stamped =
				typeof entry.date === 'string' && entry.date !== '' && !Number.isNaN(Date.parse(entry.date))
					? entry.date
					: stampFallback;
			if (title !== entry.title || description !== entry.description || icon !== entry.icon || stamped !== entry.date) {
				repaired = true;
			}
			out.push({ id, title, description, icon, date: stamped });
		}
		return out;
	};

	const firstUse = date(record.firstUse, base.firstUse);
	const data: LuckData = {
		version,
		luckyness: num(record.luckyness, base.luckyness, true),
		visits: num(record.visits, base.visits, true),
		streak: num(record.streak, base.streak, true),
		longestPress: num(record.longestPress, base.longestPress, false),
		soundOn: bool(record.soundOn, base.soundOn),
		vibrationOn: bool(record.vibrationOn, base.vibrationOn),
		firstUse,
		lastVisit: date(record.lastVisit, base.lastVisit),
		lastRitual: ritualDate(record.lastRitual),
		// undated charms inherit firstUse rather than "now", so a repair does not
		// make an eleven-year-old charm look like it was earned this morning
		charms: charmList(record.charms, firstUse)
	};
	return { data, repaired };
}

/** How the stored record was read, which decides what we are allowed to do
 *  with it afterwards. */
export type LoadKind = 'fresh' | 'v2' | 'v3' | 'future';

export class LuckStore {
	available: boolean;
	data: LuckData;
	newlyAwarded: Charm[];
	/** How the persisted record was interpreted at construction. */
	loadedAs: LoadKind;
	/**
	 * Set when storage holds a record from a NEWER version of the app than this
	 * one (version > 3) — a stale tab, a cached service worker, or a browser
	 * that restored an old bundle. The safest thing we can do with a record we
	 * do not understand is leave it exactly where it is: `save()` becomes a
	 * no-op, so this session cannot downgrade, truncate or strip fields it has
	 * never heard of. The session still runs normally on a sanitized in-memory
	 * copy — luck continues, it simply is not written down.
	 */
	readOnly: boolean;

	constructor() {
		this.available = storageAvailable();
		this.data = fresh();
		this.newlyAwarded = [];
		this.loadedAs = 'fresh';
		this.readOnly = false;

		let raw: string | null = null;
		if (this.available) {
			try {
				raw = localStorage.getItem(KEY);
			} catch {
				raw = null;
			}
		}

		if (raw) {
			let parsed: unknown;
			let readable = true;
			try {
				parsed = JSON.parse(raw);
			} catch {
				readable = false;
			}

			if (!readable || !isRecord(parsed)) {
				// Unusable text that fresh() is about to overwrite. Keep the
				// original bytes: they may still be recoverable by hand.
				this._backup(raw);
				this.data = fresh();
			} else {
				const version = parsed.version;
				if (typeof version === 'number' && version > VERSION) {
					this.loadedAs = 'future';
					this.readOnly = true;
					this.data = sanitize(parsed, version).data;
				} else if (version === VERSION) {
					this.loadedAs = 'v3';
					const { data, repaired } = sanitize(parsed, VERSION);
					this.data = data;
					if (repaired) this._backup(raw);
				} else {
					this.loadedAs = 'v2';
					// the bytes go aside BEFORE anything touches them: a migration
					// that dies halfway must never be the reason history is lost
					this._backup(raw);
					this.data = this._migrateLegacySafely(parsed as V2LegacyData);
				}
			}
		}

		this._trackVisit();
		// Backfill runs after the visit is counted so the two agree on today's
		// numbers, and only for records this version wrote: a V2 migration does
		// its own silent backfill (below), and a future record must not be
		// handed charms this build invented.
		if (this.loadedAs === 'v3') this._backfillThresholdCharms();
		this.save();
	}

	/** Kept for callers that want the version dispatch without the surrounding
	 *  bookkeeping (backup, readOnly, backfill) the constructor performs. */
	_migrate(old: LuckData | V2LegacyData | null | undefined): LuckData {
		if (!isRecord(old)) return fresh();
		const version = old.version;
		if (typeof version === 'number' && version >= VERSION) {
			return sanitize(old as Record<string, unknown>, version).data;
		}
		return this._migrateV2(old as V2LegacyData);
	}

	/** The migration boundary. A legacy record is whatever a decade of other
	 *  code (and the odd hand edit) left behind, so a failure inside the
	 *  migration is contained here: first without the charm list — the only
	 *  part that is a collection — and, if the counters themselves are the
	 *  problem, as a fresh record. The raw bytes are already backed up. */
	_migrateLegacySafely(old: V2LegacyData): LuckData {
		try {
			return this._migrateV2(old);
		} catch {
			try {
				return this._migrateV2({ ...old, charms: [] });
			} catch {
				return fresh();
			}
		}
	}

	// V2 store (version 0.35): { luckyness, visits, longestPress, daysInRow,
	//   charms: [{title, description, x, y, date}], soundOn, vibrationOn, firstUse }
	_migrateV2(old: V2LegacyData): LuckData {
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
		// `charms` has been seen as {} and as a string; only an array is iterable
		const legacyCharms: unknown[] = Array.isArray(old.charms) ? old.charms : [];
		for (const entry of legacyCharms) {
			const c = entry && typeof entry === 'object' ? (entry as V2Charm) : null;
			const def = c && typeof c.title === 'string' ? byTitle.get(c.title) : undefined;
			if (def && !seen.has(def.id)) {
				seen.add(def.id);
				migrated.charms.push({
					id: def.id,
					title: def.title,
					description: def.description,
					icon: def.icon,
					date: c?.date || migrated.firstUse
				});
			}
		}
		for (const def of PRESS_CHARMS) {
			if (def.amount! <= migrated.luckyness && !seen.has(def.id)) {
				migrated.charms.push({ ...def, date: new Date().toISOString() });
			}
		}
		// A V2 record can still carry nonsense (a hand-edited counter, a charm
		// with no title); run the same boundary validation as a V3 load rather
		// than trusting the migration's own arithmetic.
		return sanitize(migrated as unknown as Record<string, unknown>, VERSION).data;
	}

	/** Write the pre-migration bytes aside exactly once. Best effort: a full or
	 *  blocked storage must never stop someone using the site. */
	_backup(raw: string): void {
		if (!this.available) return;
		try {
			if (localStorage.getItem(BACKUP_KEY) !== null) return; // keep the first copy
			localStorage.setItem(BACKUP_KEY, raw);
		} catch {
			/* quota, blocked or private mode — the backup is a courtesy */
		}
	}

	/**
	 * Threshold charms are awarded on exact equality (`def.amount === count`),
	 * which is correct for the press that crosses the line but leaves a
	 * long-standing visitor permanently unable to earn a threshold ADDED to
	 * charmsData.ts after they had already passed it: someone on 400 presses
	 * would sail past a new charm at 300 and never see it.
	 *
	 * Policy: on every load of a version-3 record, award any press or visit
	 * charm the stored counters have already earned, stamped now, and push it
	 * to `newlyAwarded` so main.ts gives it the same ceremony as a live award.
	 *
	 * Streak charms are deliberately NOT backfilled. A streak is a current run
	 * rather than a total, and `streak` can legitimately fall back to 1
	 * tomorrow; awarding "30 days in a row" to someone mid-run because the
	 * number happens to be there would be a lie about what they did. Specials
	 * (share, hold, install) have no counter to backfill from.
	 */
	_backfillThresholdCharms(): void {
		for (const def of PRESS_CHARMS) {
			if (def.amount! <= this.data.luckyness) this._award(def);
		}
		for (const def of VISIT_CHARMS) {
			if (def.amount! <= this.data.visits) this._award(def);
		}
	}

	_trackVisit(): void {
		const now = new Date();
		let last = new Date(this.data.lastVisit || this.data.firstUse);
		if (Number.isNaN(+last)) last = now; // sanitize should prevent this; belt and braces
		if (+now - +last > HOUR) {
			this.data.visits += 1;
			for (const def of VISIT_CHARMS) {
				if (def.amount === this.data.visits) this._award(def);
			}
		}
		// The streak is counted in DAYS, so it must be judged on the calendar and
		// not on the one-hour visit gate: someone who closes the tab at 23:50 and
		// opens it again at 00:20 has started a new day, and used to lose the
		// streak for it because the whole block was skipped.
		const dayNow = dayKey(now);
		const dayLast = dayKey(last);
		if (dayLast !== dayNow) {
			// "Yesterday" is a calendar day, not 86,400,000 ms: in Europe/London,
			// 2026-03-30 00:30 minus 24 hours is March 28, which silently broke
			// the streak of anyone who had visited on the 29th.
			if (dayLast === dayKey(shiftDay(now))) {
				this.data.streak = (this.data.streak || 1) + 1;
				for (const def of STREAK_CHARMS) {
					if (def.amount === this.data.streak) this._award(def);
				}
			} else {
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
		const last = new Date(this.data.lastRitual);
		if (Number.isNaN(+last)) return true;
		// Local calendar days, same helper as the streak and the dossier — the
		// ritual promises "a new one at midnight", and it has to be YOUR midnight.
		return dayKey(last) !== dayKey();
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
		if (!this.available || this.readOnly) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.data));
		} catch {
			/* full or blocked — luck continues regardless */
		}
	}
}
