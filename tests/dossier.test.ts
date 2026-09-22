import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initDossier, lifePath, nameNumber, dailyHoroscope, personalSeed } from '../src/luck/dossier';
import { dayIndex } from '../src/luck/days';
import { track } from '../src/services/analytics';

// Stubbed so we can assert on calls — and on what is never in them.
vi.mock('../src/services/analytics', () => ({ track: vi.fn() }));

// Pinned so the local-midnight/DST tests below are deterministic regardless
// of the host machine's own timezone.
const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
	process.env.TZ = ORIGINAL_TZ;
	vi.useRealTimers();
});

const HTML = `
	<section id="luck-dossier">
		<form id="dossier-form">
			<input id="dossier-dob" type="date" aria-describedby="dossier-status" />
			<input id="dossier-name" type="text" />
			<button id="dossier-go" type="submit"></button>
		</form>
		<p id="dossier-status" aria-live="polite"></p>
		<div id="dossier-out"></div>
		<button id="dossier-burn" hidden></button>
	</section>`;

const compile = (dob: string, name = '') => {
	(document.getElementById('dossier-dob') as HTMLInputElement).value = dob;
	(document.getElementById('dossier-name') as HTMLInputElement).value = name;
	(document.getElementById('dossier-go') as HTMLButtonElement).click();
};

beforeEach(() => {
	process.env.TZ = 'Europe/London';
	localStorage.clear();
	document.body.innerHTML = HTML;
	vi.mocked(track).mockClear();
});

describe('real facts', () => {
	it('assigns star signs on the conventional boundaries', () => {
		initDossier();
		compile('1990-04-25');
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Taurus');
		compile('1990-01-10');
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Capricorn');
		compile('2000-02-29'); // leap babies are Pisces
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Pisces');
	});

	// The array of sign start dates begins with Capricorn (which wraps the
	// year boundary, Dec 22 – Jan 19) and then runs Jan → Nov. A naive
	// backwards scan of that list matches Sagittarius — the last entry it can
	// still find "on or after" — for every December date before it ever
	// reaches Capricorn at index 0. 1990-12-25 is the review's own repro.
	// Exercise the day before, on, and after all twelve boundaries.
	const SIGN_BOUNDARIES: [month: number, day: number, sign: string, prevSign: string][] = [
		[1, 20, 'Aquarius', 'Capricorn'],
		[2, 19, 'Pisces', 'Aquarius'],
		[3, 21, 'Aries', 'Pisces'],
		[4, 20, 'Taurus', 'Aries'],
		[5, 21, 'Gemini', 'Taurus'],
		[6, 21, 'Cancer', 'Gemini'],
		[7, 23, 'Leo', 'Cancer'],
		[8, 23, 'Virgo', 'Leo'],
		[9, 23, 'Libra', 'Virgo'],
		[10, 23, 'Scorpio', 'Libra'],
		[11, 22, 'Sagittarius', 'Scorpio'],
		[12, 22, 'Capricorn', 'Sagittarius']
	];

	it.each(SIGN_BOUNDARIES)('assigns %s from %i/%i, with %s the day before and %s still the day after', (month, day, sign, prevSign) => {
		initDossier();
		const pad = (n: number) => String(n).padStart(2, '0');

		compile(`1990-${pad(month)}-${pad(day - 1)}`);
		expect(document.querySelector('.dossier-card')?.textContent).toContain(prevSign);

		compile(`1990-${pad(month)}-${pad(day)}`);
		expect(document.querySelector('.dossier-card')?.textContent).toContain(sign);

		compile(`1990-${pad(month)}-${pad(day + 1)}`);
		expect(document.querySelector('.dossier-card')?.textContent).toContain(sign);
	});

	it('specifically gets 1990-12-25 right (the review’s own repro)', () => {
		initDossier();
		compile('1990-12-25');
		const text = document.querySelector('.dossier-card')?.textContent;
		expect(text).toContain('Capricorn');
		expect(text).not.toContain('Sagittarius');
	});

	it('shows the month birthstone and flower', () => {
		initDossier();
		compile('1988-04-02');
		const text = document.querySelector('.dossier-card')?.textContent;
		expect(text).toContain('Diamond');
		expect(text).toContain('Daisy');
	});

	it('respects the lunar new year boundary for the Chinese zodiac', () => {
		initDossier();
		// CNY 1985 fell on Feb 20 — the day before still belongs to the 1984 Rat
		compile('1985-02-19');
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Wood Rat (1984)');
		compile('1985-02-20');
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Wood Ox (1985)');
		// CNY 2020 fell on Jan 25 — Metal Rat from that day
		compile('2020-01-25');
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Metal Rat (2020)');
		compile('2020-01-24');
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Earth Pig (2019)');
	});
});

describe('numerology', () => {
	it('computes life path with master numbers preserved', () => {
		expect(lifePath(new Date('2000-09-29T12:00:00'))).toBe(22); // digits sum to 22 — exempt
		expect(lifePath(new Date('1983-11-29T12:00:00'))).toBe(7); // 34 → 7
	});

	it('computes Pythagorean name numbers, ignoring non-letters', () => {
		expect(nameNumber('Joseph')).toBe(1); // 28 → 10 → 1
		expect(nameNumber('j-o-s-e-p-h!!')).toBe(1); // punctuation is not cosmic
		expect(nameNumber('')).toBe(0);
	});
});

describe('the horoscope engine', () => {
	it('is deterministic per bearer per day', () => {
		expect(dailyHoroscope(4, 20654)).toEqual(dailyHoroscope(4, 20654));
	});

	it('personalises the seed by full birth date and name', () => {
		const a = personalSeed('1990-04-25', 'Joseph');
		expect(a).toBe(personalSeed('1990-04-25', 'Joseph')); // stable
		expect(a).toBe(personalSeed('1990-04-25', '  joseph ')); // case/space-insensitive
		expect(a).not.toBe(personalSeed('1990-04-25', 'Josephine')); // name matters
		expect(a).not.toBe(personalSeed('1991-04-25', 'Joseph')); // year matters
		expect(a).not.toBe(personalSeed('1990-04-26', 'Joseph')); // day matters
	});

	it('formats the lucky time as HH:MM and always stamps a closer', () => {
		const scope = dailyHoroscope(0, 1);
		expect(scope.luckyTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
		expect(scope.closer.length).toBeGreaterThan(10);
	});
});

describe('the dossier form', () => {
	it('submits on Enter in a field, not just a click on the button', () => {
		initDossier();
		(document.getElementById('dossier-dob') as HTMLInputElement).value = '1990-04-25';
		const form = document.getElementById('dossier-form') as HTMLFormElement;
		// this is exactly what pressing Enter in a text field of a form does —
		// dispatch the form's own submit event, not a click on any button
		form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
		expect(document.querySelector('.dossier-card')?.textContent).toContain('Taurus');
	});

	it('announces a concise status without repeating the whole dossier', () => {
		initDossier();
		compile('1990-04-25', 'Joseph');
		const status = document.getElementById('dossier-status')?.textContent ?? '';
		expect(status.length).toBeGreaterThan(0);
		expect(status).not.toContain('OFFICIAL LUCK DOSSIER');
		expect(status).not.toContain('Taurus');
	});

	it('announces a validation error and associates it with the date field', () => {
		initDossier();
		compile(''); // no date of birth entered
		expect(document.querySelector('.dossier-card')).toBeFalsy();
		const status = document.getElementById('dossier-status')?.textContent ?? '';
		expect(status).toMatch(/real birthday/i);
		const dob = document.getElementById('dossier-dob') as HTMLInputElement;
		expect(dob.getAttribute('aria-describedby')).toBe('dossier-status');
	});
});

describe('local calendar day, not UTC', () => {
	it('seeds the forecast from the local calendar day (dayIndex), matching days.ts', () => {
		// 00:30 local on 16 June is still 15 June in UTC during British Summer
		// Time — the exact divergence the review's UTC-floor bug produced.
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-06-15T23:30:00.000Z'));
		initDossier();
		compile('1990-04-25', 'Joseph');
		const expected = dailyHoroscope(personalSeed('1990-04-25', 'Joseph'), dayIndex());
		const text = document.querySelector('.dossier-scope')?.textContent ?? '';
		expect(text).toContain(expected.omen);
		expect(text).toContain(expected.hedge);
		expect(text).toContain(expected.advice);
	});

	it('refreshes an already-rendered dossier at local midnight', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T23:59:30'));
		initDossier();
		compile('1990-04-25', 'Max');
		vi.advanceTimersByTime(60_000); // crosses local midnight into 2 Jan
		const expected = dailyHoroscope(personalSeed('1990-04-25', 'Max'), dayIndex(new Date()));
		const text = document.querySelector('.dossier-scope')?.textContent ?? '';
		expect(text).toContain(expected.omen);
		expect(text).toContain(expected.advice);
	});

	it('refreshes on returning to a visible tab after the day changed, without waiting for a timer', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T12:00:00'));
		initDossier();
		compile('1990-04-25', 'Max');

		// simulate the tab backgrounding and time passing into the next local day
		vi.setSystemTime(new Date('2026-01-02T09:00:00'));
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));

		const expected = dailyHoroscope(personalSeed('1990-04-25', 'Max'), dayIndex(new Date()));
		const text = document.querySelector('.dossier-scope')?.textContent ?? '';
		expect(text).toContain(expected.omen);
	});

	it('does not refresh on visibilitychange when the day has not changed', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-01-01T12:00:00'));
		initDossier();
		compile('1990-04-25', 'Max');
		const before = document.querySelector('.dossier-scope')?.textContent;

		vi.setSystemTime(new Date('2026-01-01T18:00:00')); // same local day
		Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
		document.dispatchEvent(new Event('visibilitychange'));

		expect(document.querySelector('.dossier-scope')?.textContent).toBe(before);
	});
});

describe('privacy — nothing leaves the device', () => {
	it('makes no network calls and sends no PII to analytics', () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy);
		initDossier();
		compile('1985-06-15', 'Maximilian Moneybags');
		expect(document.querySelector('.dossier-card')).toBeTruthy();
		expect(fetchSpy).not.toHaveBeenCalled();
		// exactly one bare usage event; no payload argument at all
		expect(vi.mocked(track)).toHaveBeenCalledTimes(1);
		expect(vi.mocked(track)).toHaveBeenCalledWith('dossier_generated');
		// belt and braces: nothing derived from the inputs in ANY call
		const allArgs = JSON.stringify(vi.mocked(track).mock.calls);
		expect(allArgs).not.toContain('1985');
		expect(allArgs).not.toContain('Maximilian');
		expect(allArgs).not.toContain('Gemini');
	});

	it('persists locally, restores silently, and burns completely', () => {
		initDossier();
		compile('1985-06-15', 'Max');
		expect(JSON.parse(localStorage.getItem('dossier-prefs')!)).toEqual({ dob: '1985-06-15', name: 'Max' });

		// a fresh init (new visit) restores the card without any analytics
		document.body.innerHTML = HTML;
		vi.mocked(track).mockClear();
		initDossier();
		expect(document.querySelector('.dossier-card')).toBeTruthy();
		expect(vi.mocked(track)).not.toHaveBeenCalled();

		(document.getElementById('dossier-burn') as HTMLButtonElement).click();
		expect(localStorage.getItem('dossier-prefs')).toBeNull();
		expect(document.querySelector('.dossier-card')).toBeFalsy();
		expect(vi.mocked(track)).toHaveBeenCalledWith('dossier_burned');
	});

	it('reports a storage failure when forgetting fails, instead of pretending it worked', () => {
		initDossier();
		compile('1990-04-25', 'Max');
		expect(document.querySelector('.dossier-card')).toBeTruthy();

		const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
			throw new Error('storage blocked');
		});
		vi.mocked(track).mockClear();
		(document.getElementById('dossier-burn') as HTMLButtonElement).click();

		expect(document.getElementById('dossier-status')?.textContent).toMatch(/storage|couldn.?t|refused/i);
		// nothing was actually wiped — the card, inputs and record all remain
		expect(document.querySelector('.dossier-card')).toBeTruthy();
		expect(vi.mocked(track)).not.toHaveBeenCalledWith('dossier_burned');

		removeSpy.mockRestore();
	});

	it('awards the charm callback only on the very first compile', () => {
		const onFirst = vi.fn();
		initDossier({ onFirstDossier: onFirst });
		compile('1985-06-15');
		compile('1985-06-15');
		expect(onFirst).toHaveBeenCalledTimes(1);
	});
});
