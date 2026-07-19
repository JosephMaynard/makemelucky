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
