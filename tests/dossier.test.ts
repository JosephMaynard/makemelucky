import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initDossier, lifePath, nameNumber, dailyHoroscope } from '../src/luck/dossier';
import { track } from '../src/services/analytics';

// Stubbed so we can assert on calls — and on what is never in them.
vi.mock('../src/services/analytics', () => ({ track: vi.fn() }));

const HTML = `
	<section id="luck-dossier">
		<input id="dossier-dob" type="date" />
		<input id="dossier-name" type="text" />
		<button id="dossier-go"></button>
		<div id="dossier-out"></div>
		<button id="dossier-burn" hidden></button>
	</section>`;

const compile = (dob: string, name = '') => {
	(document.getElementById('dossier-dob') as HTMLInputElement).value = dob;
	(document.getElementById('dossier-name') as HTMLInputElement).value = name;
	(document.getElementById('dossier-go') as HTMLButtonElement).click();
};

beforeEach(() => {
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
	it('is deterministic per sign per day', () => {
		expect(dailyHoroscope(4, 20654)).toEqual(dailyHoroscope(4, 20654));
	});

	it('formats the lucky time as HH:MM', () => {
		expect(dailyHoroscope(0, 1).luckyTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
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

	it('awards the charm callback only on the very first compile', () => {
		const onFirst = vi.fn();
		initDossier({ onFirstDossier: onFirst });
		compile('1985-06-15');
		compile('1985-06-15');
		expect(onFirst).toHaveBeenCalledTimes(1);
	});
});
