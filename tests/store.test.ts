import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LuckStore } from '../src/luck/store';
import { PRESS_CHARMS } from '../src/luck/charmsData';

const KEY = 'luckStore';

const readSaved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

beforeEach(() => {
	localStorage.clear();
});

describe('fresh store', () => {
	it('initialises version 3 defaults and persists them', () => {
		const store = new LuckStore();
		expect(store.data.version).toBe(3);
		expect(store.data.luckyness).toBe(0);
		expect(store.data.visits).toBe(1);
		expect(store.data.soundOn).toBe(true);
		expect(readSaved().version).toBe(3);
	});

	it('survives corrupted JSON by starting fresh', () => {
		localStorage.setItem(KEY, '{not json');
		const store = new LuckStore();
		expect(store.data.version).toBe(3);
		expect(store.data.luckyness).toBe(0);
	});
});

describe('V2 migration (the 2016 luckStore shape must keep working)', () => {
	const v2 = {
		version: 0.35,
		luckyness: 141,
		visits: 52,
		longestPress: 4.2,
		daysInRow: 3,
		soundOn: false,
		vibrationOn: true,
		firstUse: '2016-05-05T12:00:00.000Z',
		charms: [
			{ title: "Beginner's luck!", description: 'old text', x: 10, y: 20, date: '2016-05-05' },
			{ title: 'Lucky 7!', description: 'old text', x: 30, y: 40, date: '2016-06-01' },
			{ title: 'Not a real charm', description: '', x: 0, y: 0, date: '2016-06-02' }
		]
	};

	it('carries presses, prefs and firstUse across', () => {
		localStorage.setItem(KEY, JSON.stringify(v2));
		const store = new LuckStore();
		expect(store.data.version).toBe(3);
		expect(store.data.luckyness).toBe(141);
		expect(store.data.soundOn).toBe(false);
		expect(store.data.longestPress).toBe(4.2);
		expect(store.data.firstUse).toBe('2016-05-05T12:00:00.000Z');
		// migration stamps lastVisit as "now", so the migrating visit itself
		// doesn't double-count as a return visit
		expect(store.data.visits).toBe(52);
	});

	it('matches old charms by title and keeps their original dates', () => {
		localStorage.setItem(KEY, JSON.stringify(v2));
		const store = new LuckStore();
		const beginners = store.data.charms.find((c) => c.id === 'beginnersLuck');
		expect(beginners?.date).toBe('2016-05-05');
		expect(store.hasCharm('luckySeven')).toBe(true);
		// unknown titles are dropped, not kept as junk
		expect(store.data.charms.some((c) => c.title === 'Not a real charm')).toBe(false);
	});

	it('backfills every press milestone the old system missed', () => {
		localStorage.setItem(KEY, JSON.stringify(v2));
		const store = new LuckStore();
		for (const def of PRESS_CHARMS) {
			expect(store.hasCharm(def.id), `${def.id} (${def.amount} presses)`).toBe(def.amount! <= 141);
		}
	});

	it('does not double-award a charm that was both earned in V2 and backfillable', () => {
		localStorage.setItem(KEY, JSON.stringify(v2));
		const store = new LuckStore();
		expect(store.data.charms.filter((c) => c.id === 'beginnersLuck')).toHaveLength(1);
	});
});

describe('current-version load', () => {
	it('passes version 3 data straight through', () => {
		const first = new LuckStore();
		first.data.luckyness = 9;
		first.save();
		const second = new LuckStore();
		expect(second.data.luckyness).toBe(9);
		// lastVisit was just now → not a new visit
		expect(second.data.visits).toBe(first.data.visits);
	});
});

describe('awarding', () => {
	it('registerPress awards each milestone exactly once', () => {
		const store = new LuckStore();
		const first = store.registerPress(); // press #1 = beginnersLuck
		expect(first.map((c) => c.id)).toEqual(['beginnersLuck']);
		expect(store.registerPress()).toHaveLength(0); // press #2, no milestone
		const third = store.registerPress(); // press #3 = magicNumber
		expect(third.map((c) => c.id)).toEqual(['magicNumber']);
		expect(store.data.luckyness).toBe(3);
	});

	it('awardSpecial is one-time', () => {
		const store = new LuckStore();
		const charm = store.awardSpecial('consoleWizard', 'Behind the curtain', 'desc', '🧙');
		expect(charm?.id).toBe('consoleWizard');
		expect(store.awardSpecial('consoleWizard', 'Behind the curtain', 'desc', '🧙')).toBeNull();
		expect(readSaved().charms.some((c: { id: string }) => c.id === 'consoleWizard')).toBe(true);
	});

	it('registerHold tracks the longest press and awards steadyHand at 8s', () => {
		const store = new LuckStore();
		expect(store.registerHold(2)).toHaveLength(0);
		expect(store.data.longestPress).toBe(2);
		const awarded = store.registerHold(8.5);
		expect(awarded.map((c) => c.id)).toEqual(['steadyHand']);
		expect(store.registerHold(9)).toHaveLength(0); // only once
		expect(store.data.longestPress).toBe(9);
	});

	it('share and install are one-time awards', () => {
		const store = new LuckStore();
		expect(store.registerShare().map((c) => c.id)).toEqual(['share']);
		expect(store.registerShare()).toHaveLength(0);
		expect(store.registerInstall().map((c) => c.id)).toEqual(['installed']);
		expect(store.registerInstall()).toHaveLength(0);
	});
});

describe('_trackVisit', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('a second construction under an hour later does not count as a new visit', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T10:00:00.000Z'));
		const first = new LuckStore();
		vi.setSystemTime(new Date('2026-01-01T10:30:00.000Z'));
		const second = new LuckStore();
		expect(second.data.visits).toBe(first.data.visits);
		expect(second.data.streak).toBe(1);
	});

	it('a visit over an hour later the same day adds a visit but not a streak day', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'));
		const first = new LuckStore();
		vi.setSystemTime(new Date('2026-01-01T12:00:00.000Z'));
		const second = new LuckStore();
		expect(second.data.visits).toBe(first.data.visits + 1);
		expect(second.data.streak).toBe(1);
	});

	it('a visit the next calendar day increments the streak', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'));
		new LuckStore();
		vi.setSystemTime(new Date('2026-01-02T09:30:00.000Z'));
		const second = new LuckStore();
		expect(second.data.streak).toBe(2);
	});

	it('a gap of two or more days resets the streak to 1', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'));
		new LuckStore();
		vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'));
		const second = new LuckStore();
		expect(second.data.streak).toBe(2);
		vi.setSystemTime(new Date('2026-01-04T09:00:00.000Z')); // skipped a day
		const third = new LuckStore();
		expect(third.data.streak).toBe(1);
	});

	it('hitting a 3-day streak awards streak3 exactly once, via newlyAwarded', () => {
		vi.useFakeTimers();
		let day = new Date('2026-01-01T09:00:00.000Z');
		vi.setSystemTime(day);
		let store = new LuckStore();
		for (let i = 1; i < 3; i++) {
			day = new Date(+day + 86400000);
			vi.setSystemTime(day);
			store = new LuckStore();
		}
		expect(store.data.streak).toBe(3);
		expect(store.newlyAwarded.map((c) => c.id)).toContain('streak3');
		expect(store.data.charms.filter((c) => c.id === 'streak3')).toHaveLength(1);
	});

	it('hitting a 7-day streak awards the week charm', () => {
		vi.useFakeTimers();
		let day = new Date('2026-01-01T09:00:00.000Z');
		vi.setSystemTime(day);
		let store = new LuckStore();
		for (let i = 1; i < 7; i++) {
			day = new Date(+day + 86400000);
			vi.setSystemTime(day);
			store = new LuckStore();
		}
		expect(store.data.streak).toBe(7);
		expect(store.hasCharm('week')).toBe(true);
	});

	it('charms survive a reload (localStorage round-trip)', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'));
		const first = new LuckStore();
		first.registerPress();
		vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'));
		const second = new LuckStore();
		expect(second.hasCharm('beginnersLuck')).toBe(true);
		expect(readSaved().charms.some((c: { id: string }) => c.id === 'beginnersLuck')).toBe(true);
	});
});

describe('ritual', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('is available on a fresh store', () => {
		const store = new LuckStore();
		expect(store.ritualAvailable()).toBe(true);
	});

	it('becomes unavailable after registerRitual', () => {
		const store = new LuckStore();
		store.registerRitual();
		expect(store.ritualAvailable()).toBe(false);
	});

	it('becomes available again on the next calendar day', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'));
		const store = new LuckStore();
		store.registerRitual();
		expect(store.ritualAvailable()).toBe(false);
		vi.setSystemTime(new Date('2026-01-02T09:00:00.000Z'));
		expect(store.ritualAvailable()).toBe(true);
	});

	it('lastRitual persists through reload', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T09:00:00.000Z'));
		const first = new LuckStore();
		first.registerRitual();
		vi.setSystemTime(new Date('2026-01-01T09:30:00.000Z'));
		const second = new LuckStore();
		expect(second.data.lastRitual).toBe(first.data.lastRitual);
		expect(second.ritualAvailable()).toBe(false);
	});
});

describe('the SIX SEVEN charm', () => {
	it('awards at exactly 67 presses, exactly once', () => {
		const store = new LuckStore();
		let awarded: string[] = [];
		for (let i = 0; i < 67; i++) awarded = store.registerPress().map((c) => c.id);
		expect(awarded).toEqual(['sixSeven']); // the 67th press, and only the 67th
		expect(store.hasCharm('sixSeven')).toBe(true);
		expect(store.registerPress().map((c) => c.id)).toEqual([]); // 68: mercifully silent
		expect(store.data.charms.filter((c) => c.id === 'sixSeven')).toHaveLength(1);
	});

	it('sits in ascending press order so nextPressCharm() stays truthful', () => {
		const amounts = PRESS_CHARMS.map((c) => c.amount!);
		expect(amounts).toEqual([...amounts].sort((a, b) => a - b));
	});
});

// --- boundary validation of the persisted record -------------------------

const BACKUP_KEY = 'luckStore.backup';
const readBackup = () => localStorage.getItem(BACKUP_KEY);

/** A complete, valid V3 record. `lastVisit` is "now" so construction does not
 *  count a fresh visit and muddy the numbers under test. */
function v3(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	const now = new Date().toISOString();
	return {
		version: 3,
		luckyness: 0,
		visits: 1,
		streak: 1,
		longestPress: 0,
		soundOn: true,
		vibrationOn: true,
		firstUse: now,
		lastVisit: now,
		lastRitual: '',
		charms: [],
		...overrides
	};
}

describe('malformed V3 records are repaired, never fatal', () => {
	it('survives charms:null and keeps the press count', () => {
		// the exact record from the review: boots, then used to throw inside
		// charm rendering before the scene existed
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: 100, charms: null })));
		const store = new LuckStore();
		expect(Array.isArray(store.data.charms)).toBe(true);
		expect(store.data.luckyness).toBe(100);
		expect(() => store.data.charms.map((c) => c.id)).not.toThrow();
	});

	it('coerces a numeric string counter instead of concatenating it', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: '12' })));
		const store = new LuckStore();
		expect(store.data.luckyness).toBe(12);
		store.registerPress();
		expect(store.data.luckyness).toBe(13); // not '121'
	});

	it('falls back per field: a bad counter costs nothing else', () => {
		localStorage.setItem(
			KEY,
			JSON.stringify(
				v3({
					luckyness: -5,
					visits: 'not a number',
					streak: 1.9,
					longestPress: -3,
					charms: [{ id: 'share', title: 'Share the Luck!', description: 'd', icon: '⭐', date: '2020-01-01' }]
				})
			)
		);
		const store = new LuckStore();
		expect(store.data.luckyness).toBe(0); // negative → fresh default
		expect(store.data.visits).toBe(1); // unparseable → fresh default
		expect(store.data.streak).toBe(1); // floored
		expect(store.data.longestPress).toBe(0);
		// the good history in the same record is untouched
		expect(store.hasCharm('share')).toBe(true);
		expect(store.data.charms.find((c) => c.id === 'share')?.date).toBe('2020-01-01');
	});

	it('treats JSON null and non-finite counters as missing', () => {
		// JSON cannot hold NaN/Infinity — JSON.stringify writes null — so the
		// record a real browser hands back looks like this
		localStorage.setItem(KEY, '{"version":3,"luckyness":null,"visits":null,"streak":null,"longestPress":null}');
		const store = new LuckStore();
		expect(store.data.luckyness).toBe(0);
		expect(store.data.visits).toBe(1);
		expect(store.data.streak).toBe(1);
		expect(store.data.longestPress).toBe(0);
		expect(store.data.charms).toEqual([]);
	});

	it('coerces booleans and keeps a genuine false', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ soundOn: 'false', vibrationOn: 0 })));
		expect(new LuckStore().data.soundOn).toBe(false);
		expect(new LuckStore().data.vibrationOn).toBe(false);
		localStorage.clear();
		localStorage.setItem(KEY, JSON.stringify(v3({ soundOn: 'yes please', vibrationOn: false })));
		const store = new LuckStore();
		expect(store.data.soundOn).toBe(true); // unreadable → fresh default
		expect(store.data.vibrationOn).toBe(false); // a real boolean survives
	});

	it('resets unparseable dates, and lastRitual to empty', () => {
		localStorage.setItem(
			KEY,
			JSON.stringify(v3({ firstUse: 'the olden days', lastVisit: '////', lastRitual: 'yesterday-ish' }))
		);
		const store = new LuckStore();
		expect(Number.isNaN(Date.parse(store.data.firstUse))).toBe(false);
		expect(Number.isNaN(Date.parse(store.data.lastVisit))).toBe(false);
		expect(store.data.lastRitual).toBe('');
		expect(store.ritualAvailable()).toBe(true); // a broken date must not lock the ritual out
	});

	it('keeps a valid stored date byte-for-byte', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ firstUse: '2016-05-05T12:00:00.000Z' })));
		expect(new LuckStore().data.firstUse).toBe('2016-05-05T12:00:00.000Z');
	});

	it('drops charm entries with no id, dedupes by id and fills defaults', () => {
		localStorage.setItem(
			KEY,
			JSON.stringify(
				v3({
					firstUse: '2016-05-05T12:00:00.000Z',
					charms: [
						{ title: 'Lucky 7!', description: 'no id at all' },
						null,
						'share',
						{ id: 'share', title: 'Share the Luck!' }, // no icon/description/date
						{ id: 'share', title: 'Share the Luck!', date: '2021-01-01' }, // duplicate id
						{ id: 'steadyHand' } // known id, missing title → recovered
					]
				})
			)
		);
		const store = new LuckStore();
		const ids = store.data.charms.map((c) => c.id);
		expect(ids).toEqual(['share', 'steadyHand']);
		const share = store.data.charms[0];
		expect(share.icon).toBe('⭐');
		expect(share.description).not.toBe('');
		// an undated charm inherits firstUse, not "now" — an eleven-year-old
		// charm must not look like it was earned this morning
		expect(share.date).toBe('2016-05-05T12:00:00.000Z');
		expect(store.data.charms[1].title).toBe('Steady Hand of Fortune!');
	});

	it('starts fresh from parseable JSON that is not a record', () => {
		localStorage.setItem(KEY, '[1,2,3]');
		expect(new LuckStore().data.version).toBe(3);
		localStorage.clear();
		localStorage.setItem(KEY, '42');
		expect(new LuckStore().data.luckyness).toBe(0);
	});

	it('writes the repaired record back so the next boot is clean', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: '12', charms: null })));
		new LuckStore();
		expect(readSaved().luckyness).toBe(12);
		expect(Array.isArray(readSaved().charms)).toBe(true); // was null
		// and the second boot has nothing left to repair
		const backupBefore = readBackup();
		new LuckStore();
		expect(readSaved().luckyness).toBe(12);
		expect(readBackup()).toBe(backupBefore);
	});
});

describe('unknown future versions are left alone', () => {
	const future = JSON.stringify({
		version: 4,
		luckyness: 500,
		visits: 40,
		streak: 2,
		longestPress: 9,
		soundOn: false,
		vibrationOn: true,
		firstUse: '2016-05-05T12:00:00.000Z',
		lastVisit: new Date('2016-05-05T12:00:00.000Z').toISOString(),
		lastRitual: '',
		charms: [{ id: 'share', title: 'Share the Luck!', description: 'd', icon: '⭐', date: '2020-01-01' }],
		somethingNewWeHaveNeverHeardOf: { keep: 'me' }
	});

	it('runs on a sanitized copy without touching storage', () => {
		localStorage.setItem(KEY, future);
		const store = new LuckStore();
		expect(store.readOnly).toBe(true);
		expect(store.data.luckyness).toBe(500);
		expect(store.data.soundOn).toBe(false);
		expect(localStorage.getItem(KEY)).toBe(future); // byte-identical
	});

	it('makes save() a no-op so a stale tab cannot downgrade the record', () => {
		localStorage.setItem(KEY, future);
		const store = new LuckStore();
		store.registerPress();
		store.registerRitual();
		store.setSound(true);
		expect(store.data.luckyness).toBe(501); // the session still works
		expect(localStorage.getItem(KEY)).toBe(future); // but nothing is written
	});

	it('does not back up a record it never overwrites', () => {
		localStorage.setItem(KEY, future);
		new LuckStore();
		expect(readBackup()).toBeNull();
	});
});

describe('raw backup before the first shape change', () => {
	const v2 = JSON.stringify({ version: 0.35, luckyness: 141, visits: 52, charms: [] });

	it('keeps the pre-migration bytes when migrating from V2', () => {
		localStorage.setItem(KEY, v2);
		new LuckStore();
		expect(readBackup()).toBe(v2);
	});

	it('keeps the original bytes when repairing a malformed V3 record', () => {
		const broken = JSON.stringify(v3({ luckyness: 100, charms: null }));
		localStorage.setItem(KEY, broken);
		new LuckStore();
		expect(readBackup()).toBe(broken);
	});

	it('keeps unreadable text that a fresh record is about to replace', () => {
		localStorage.setItem(KEY, '{not json');
		new LuckStore();
		expect(readBackup()).toBe('{not json');
	});

	it('is written only once, ever — the first copy is the one worth keeping', () => {
		localStorage.setItem(KEY, v2);
		new LuckStore(); // migrates, backs up
		localStorage.setItem(KEY, JSON.stringify(v3({ charms: null })));
		new LuckStore(); // repairs, must NOT overwrite the V2 backup
		expect(readBackup()).toBe(v2);
	});

	it('is not written for a healthy V3 record', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: 4 })));
		new LuckStore();
		expect(readBackup()).toBeNull();
	});
});

describe('threshold backfill on load (charms added after someone passed them)', () => {
	it('awards every press charm the stored count has already earned', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: 100, charms: [] })));
		const store = new LuckStore();
		for (const def of PRESS_CHARMS) {
			expect(store.hasCharm(def.id), `${def.id} (${def.amount} presses)`).toBe(def.amount! <= 100);
		}
	});

	it('gives the backfilled charms their ceremony via newlyAwarded', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: 7, charms: [] })));
		const store = new LuckStore();
		expect(store.newlyAwarded.map((c) => c.id)).toEqual(['beginnersLuck', 'magicNumber', 'luckySeven']);
	});

	it('backfills visit charms too', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ visits: 10, charms: [] })));
		const store = new LuckStore();
		expect(store.hasCharm('backForMore')).toBe(true);
		expect(store.hasCharm('regular')).toBe(true);
	});

	it('leaves streak charms alone — a streak is a current run, not a total', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ streak: 30, charms: [] })));
		const store = new LuckStore();
		expect(store.data.streak).toBe(30);
		expect(store.hasCharm('streak3')).toBe(false);
		expect(store.hasCharm('week')).toBe(false);
		expect(store.hasCharm('streak30')).toBe(false);
	});

	it('is silent and duplicate-free when there is nothing to catch up on', () => {
		localStorage.setItem(KEY, JSON.stringify(v3({ luckyness: 100 })));
		const first = new LuckStore();
		expect(first.newlyAwarded.length).toBeGreaterThan(0);
		const second = new LuckStore(); // same record, now complete
		expect(second.newlyAwarded).toEqual([]);
		const ids = second.data.charms.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('does not invent charms for a brand new visitor', () => {
		const store = new LuckStore();
		expect(store.newlyAwarded).toEqual([]);
		expect(store.data.charms).toEqual([]);
	});
});

describe('the classic archive record (version 0.42)', () => {
	// /v2/ now keeps its own 'luckStoreClassic' key, but anyone who used the
	// archive before that fix has a 0.42-shaped record sitting in 'luckStore'.
	// The fixture is one of those, exactly as the archive writes it.
	const loadArchiveFixture = async () => {
		const raw = (await import('./fixtures/archive-0.42.json?raw')).default;
		localStorage.setItem(KEY, raw);
		return JSON.parse(raw);
	};

	it('is treated as legacy data and migrated to a version 3 record', async () => {
		const fixture = await loadArchiveFixture();
		expect(fixture.version).toBe(0.42);
		const store = new LuckStore();
		expect(store.data.version).toBe(3);
		expect(store.data.luckyness).toBe(9);
		expect(store.data.visits).toBe(3);
		expect(store.data.longestPress).toBe(3.6);
		expect(store.data.soundOn).toBe(true);
		expect(store.data.vibrationOn).toBe(true);
		expect(store.data.firstUse).toBe('2016-05-05T12:04:22.881Z');
		expect(Number.isFinite(store.data.streak)).toBe(true);
		expect(store.data.streak).toBeGreaterThanOrEqual(1);
	});

	it('turns every archive charm into a V3 charm, dates and all', async () => {
		await loadArchiveFixture();
		const store = new LuckStore();
		for (const id of ['beginnersLuck', 'magicNumber', 'luckySeven', 'suddenFortune', 'luckyLongTime', 'share']) {
			expect(store.hasCharm(id), id).toBe(true);
		}
		expect(store.data.charms.find((c) => c.id === 'beginnersLuck')?.date).toBe('2016-05-05T12:04:31.117Z');
		expect(store.data.charms.find((c) => c.id === 'share')?.date).toBe('2016-05-05T12:07:44.019Z');
		// every charm now carries an icon, and none of V2's sprite co-ordinates
		for (const charm of store.data.charms) {
			expect(charm.icon, charm.id).toBeTruthy();
			expect(charm).not.toHaveProperty('x');
			expect(charm).not.toHaveProperty('y');
		}
		// nothing is awarded twice by the migration plus the press backfill
		const ids = store.data.charms.map((c) => c.id);
		expect(ids).toHaveLength(new Set(ids).size);
	});

	it('does not hand out press charms the archive never reached', async () => {
		await loadArchiveFixture();
		const store = new LuckStore();
		for (const def of PRESS_CHARMS) {
			expect(store.hasCharm(def.id), `${def.id} (${def.amount} presses)`).toBe(def.amount! <= 9);
		}
	});

	it('persists the migrated record back as version 3', async () => {
		await loadArchiveFixture();
		new LuckStore();
		const saved = readSaved();
		expect(saved.version).toBe(3);
		expect(saved.luckyness).toBe(9);
		expect(saved.charms.some((c: { id: string }) => c.id === 'luckyLongTime')).toBe(true);
	});
});

describe('malformed LEGACY records are contained at the migration boundary', () => {
	const legacy = { version: 0.42, luckyness: 123, visits: 9, daysInRow: 4, firstUse: '2016-05-05T12:00:00.000Z' };

	it.each([
		['charms is an object', {}],
		['charms is a string', 'clover'],
		['charms is a number', 7],
		['charms is null', null]
	])('%s: counters survive, charms are backfilled from presses, nothing throws', (_label, charms) => {
		localStorage.setItem(KEY, JSON.stringify({ ...legacy, charms }));
		const store = new LuckStore();
		expect(store.data.version).toBe(3);
		expect(store.data.luckyness).toBe(123);
		expect(store.data.visits).toBeGreaterThanOrEqual(9);
		expect(store.data.firstUse).toBe(legacy.firstUse);
		expect(Array.isArray(store.data.charms)).toBe(true);
		// the press milestones the record had earned are still awarded
		for (const def of PRESS_CHARMS) {
			if (def.amount! <= 123) expect(store.hasCharm(def.id), def.id).toBe(true);
		}
		expect(readSaved().version).toBe(3);
	});

	it('malformed charm ENTRIES are skipped, valid ones kept', () => {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				...legacy,
				charms: [null, 5, 'x', { title: 7 }, {}, { title: "Beginner's luck!", date: '2016-06-01T00:00:00.000Z' }]
			})
		);
		const store = new LuckStore();
		const beginner = store.data.charms.find((c) => c.title === "Beginner's luck!");
		expect(beginner?.date).toBe('2016-06-01T00:00:00.000Z');
		expect(store.data.charms.every((c) => typeof c.id === 'string' && typeof c.title === 'string')).toBe(true);
	});

	it('the raw bytes are backed up BEFORE migration runs', () => {
		const raw = JSON.stringify({ ...legacy, charms: {} });
		localStorage.setItem(KEY, raw);
		new LuckStore();
		expect(localStorage.getItem('luckStore.backup')).toBe(raw);
	});

	it('a migration that throws for any other reason still yields a usable store', () => {
		localStorage.setItem(KEY, JSON.stringify({ ...legacy, charms: [{ title: 'x' }] }));
		const spy = vi.spyOn(LuckStore.prototype, '_migrateV2').mockImplementation(() => {
			throw new Error('boom');
		});
		try {
			const store = new LuckStore();
			expect(store.data.version).toBe(3);
			expect(readSaved().version).toBe(3);
		} finally {
			spy.mockRestore();
		}
	});
});
