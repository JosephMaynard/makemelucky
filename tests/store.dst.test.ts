// Daylight-saving behaviour of the streak, in a fixed zone.
//
// TZ has to be set before anything reads a Date. ESM hoists the imports below
// above this assignment, but V8 resolves the zone lazily on each Date call and
// Node re-reads process.env.TZ when it changes, so the zone is live by the time
// any test runs — verified, not assumed. It is set in a FILE OF ITS OWN because
// vitest isolates test files from one another; setting it inside a shared file
// would leak into whatever ran next in the same worker.
process.env.TZ = 'Europe/London';

import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { LuckStore } from '../src/luck/store';
import { dayKey, shiftDay } from '../src/luck/days';

const KEY = 'luckStore';
const originalTZ = process.env.TZ;

beforeEach(() => {
	localStorage.clear();
});

afterEach(() => {
	vi.useRealTimers();
});

afterAll(() => {
	process.env.TZ = originalTZ;
});

// The UK moves to BST at 01:00 on Sunday 29 March 2026, so that Sunday is 23
// hours long. 2026-03-30 00:30 BST is 2026-03-29T23:30Z; subtracting 24 hours
// from it lands on 2026-03-28T23:30Z — March 28 — stepping clean over the
// short day and breaking the streak of anyone who visited on the 29th.
const SPRING_FORWARD_MIDNIGHT = new Date('2026-03-29T23:30:00.000Z'); // 2026-03-30 00:30 BST
const DAY_BEFORE = new Date('2026-03-29T11:00:00.000Z'); // 2026-03-29 12:00 BST

describe('the zone under test', () => {
	it('really is Europe/London, so these dates mean what they say', () => {
		expect(SPRING_FORWARD_MIDNIGHT.getHours()).toBe(0);
		expect(SPRING_FORWARD_MIDNIGHT.getDate()).toBe(30);
		expect(DAY_BEFORE.getTimezoneOffset()).toBe(-60); // BST
	});
});

describe('day arithmetic across a DST boundary', () => {
	it('shiftDay steps one CALENDAR day back, not 86,400,000 ms', () => {
		expect(dayKey(shiftDay(SPRING_FORWARD_MIDNIGHT))).toBe('2026-03-29');
		// the naive version the store used to use, for contrast
		expect(dayKey(new Date(+SPRING_FORWARD_MIDNIGHT - 86400000))).toBe('2026-03-28');
	});

	it('works the same way over the autumn 25-hour day', () => {
		// clocks go back at 02:00 BST on Sunday 25 October 2026
		const after = new Date('2026-10-26T00:30:00.000Z'); // 2026-10-26 00:30 GMT
		expect(after.getDate()).toBe(26);
		expect(dayKey(shiftDay(after))).toBe('2026-10-25');
	});

	it('lands on midday so no shifted day can fall back over its own boundary', () => {
		expect(shiftDay(SPRING_FORWARD_MIDNIGHT).getHours()).toBe(12);
		expect(dayKey(shiftDay(new Date('2026-06-15T12:00:00.000Z'), 1))).toBe('2026-06-16');
	});
});

describe('_trackVisit across a DST boundary', () => {
	it('keeps the streak for a just-after-midnight visit on a spring-forward day', () => {
		vi.useFakeTimers();
		vi.setSystemTime(DAY_BEFORE);
		const first = new LuckStore();
		expect(first.data.streak).toBe(1);

		vi.setSystemTime(SPRING_FORWARD_MIDNIGHT);
		const second = new LuckStore();
		expect(second.data.streak).toBe(2); // was 1 — "yesterday" had been March 28
		expect(JSON.parse(localStorage.getItem(KEY)!).streak).toBe(2);
	});

	it('still resets the streak when a whole day really was missed', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-28T11:00:00.000Z')); // Saturday
		new LuckStore();
		vi.setSystemTime(SPRING_FORWARD_MIDNIGHT); // Monday 00:30, Sunday skipped
		expect(new LuckStore().data.streak).toBe(1);
	});

	it('keeps the streak over the autumn 25-hour day too', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-25T11:00:00.000Z')); // Sunday 11:00 GMT
		new LuckStore();
		vi.setSystemTime(new Date('2026-10-26T00:30:00.000Z')); // Monday 00:30 GMT
		expect(new LuckStore().data.streak).toBe(2);
	});

	it('does not count a late-evening and after-midnight pair as two days twice over', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-29T22:50:00.000Z')); // 23:50 BST, the 29th
		new LuckStore();
		vi.setSystemTime(SPRING_FORWARD_MIDNIGHT); // 00:30 BST, the 30th — 40 minutes later
		const second = new LuckStore();
		expect(second.data.streak).toBe(2); // a new calendar day, despite the one-hour visit gate
		expect(second.data.visits).toBe(1); // but not a new visit
	});
});

describe('ritualAvailable across a DST boundary', () => {
	it('comes back at local midnight, not 24 hours after the last ritual', () => {
		vi.useFakeTimers();
		vi.setSystemTime(DAY_BEFORE);
		const store = new LuckStore();
		store.registerRitual();
		expect(store.ritualAvailable()).toBe(false);

		vi.setSystemTime(SPRING_FORWARD_MIDNIGHT); // 12.5 hours later, but a new day
		expect(store.ritualAvailable()).toBe(true);
	});

	it('stays unavailable later the same local day', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-03-29T00:30:00.000Z')); // 00:30 GMT, before the jump
		const store = new LuckStore();
		store.registerRitual();
		vi.setSystemTime(new Date('2026-03-29T22:00:00.000Z')); // 23:00 BST, same day
		expect(store.ritualAvailable()).toBe(false);
	});
});
