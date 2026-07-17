import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initLottoPicker } from '../src/luck/lottoPicker';
import { track } from '../src/services/analytics';

// Stubbed so we can assert on calls without PostHog ever needing to be ready.
vi.mock('../src/services/analytics', () => ({ track: vi.fn() }));

// The picker's maths + PRNG live in module scope; we exercise them through the
// public initLottoPicker() by driving the DOM it wires up.

const HTML = `
	<section id="luck-numbers">
		<select id="lng-game"></select>
		<fieldset id="lng-custom" hidden>
			<input id="lng-numberRange" type="range" min="1" max="100" />
			<output id="lng-numberRangeOut"></output>
			<input id="lng-numberCount" type="range" min="1" max="10" />
			<output id="lng-numberCountOut"></output>
			<input id="lng-bonusRange" type="range" min="1" max="100" />
			<output id="lng-bonusRangeOut"></output>
			<input id="lng-bonusCount" type="range" min="0" max="10" />
			<output id="lng-bonusCountOut"></output>
		</fieldset>
		<span id="lng-chance"></span>
		<button id="lng-spin"></button>
		<p id="lng-status"></p>
		<div id="lng-result"></div>
	</section>`;

beforeEach(() => {
	localStorage.clear();
	document.body.innerHTML = HTML;
	vi.mocked(track).mockClear();
});

describe('initLottoPicker wiring', () => {
	it('populates the game menu and defaults to EuroMillions odds', () => {
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		const options = [...select.options].map((o) => o.value);
		expect(options).toContain('euromillions');
		expect(options).toContain('custom');
		expect(select.value).toBe('euromillions');
		// EuroMillions: C(50,5) * C(12,2) = 2,118,760 * 66 = 139,838,160
		expect(document.getElementById('lng-chance')?.textContent).toBe('1 in 139,838,160');
	});

	it('recomputes odds when the game changes', () => {
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		select.value = 'lotto';
		select.dispatchEvent(new Event('change'));
		// UK National: C(59,6) = 45,057,474, no bonus
		expect(document.getElementById('lng-chance')?.textContent).toBe('1 in 45,057,474');
	});

	it('reveals the custom controls only for the custom game', () => {
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		const custom = document.getElementById('lng-custom') as HTMLFieldSetElement;
		expect(custom.hidden).toBe(true);
		select.value = 'custom';
		select.dispatchEvent(new Event('change'));
		expect(custom.hidden).toBe(false);
	});

	it('draws in-range, unique, sorted balls with no network calls', async () => {
		const fetchSpy = vi.fn();
		vi.stubGlobal('fetch', fetchSpy); // the old CodePen POSTed every number to a random IP
		initLottoPicker();
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();
		// wait out the incantation delays + pop stagger + ripple wait
		await vi.waitFor(
			() => {
				const balls = document.querySelectorAll('#lng-result .lng-ball');
				expect(balls.length).toBe(7); // EuroMillions: 5 main + 2 bonus
			},
			{ timeout: 4000, interval: 50 }
		);
		const nums = [...document.querySelectorAll('#lng-result .lng-ball-row .lng-ball')].map((b) =>
			Number(b.textContent)
		);
		const main = nums.slice(0, 5);
		const bonus = nums.slice(5);
		expect(new Set(main).size).toBe(5); // unique
		expect(new Set(bonus).size).toBe(2); // unique
		expect([...main]).toEqual([...main].sort((a, b) => a - b)); // sorted
		for (const n of main) expect(n).toBeGreaterThanOrEqual(1), expect(n).toBeLessThanOrEqual(50);
		for (const n of bonus) expect(n).toBeGreaterThanOrEqual(1), expect(n).toBeLessThanOrEqual(12);
		expect(fetchSpy).not.toHaveBeenCalled(); // the DDoS stunt is gone for good
	});

	it('clamps absurd custom settings instead of throwing', async () => {
		localStorage.setItem('lotto-prefs', JSON.stringify({ gameKey: 'custom', custom: { range: 3, count: 10, bonusRange: 0, bonusCount: 5 } }));
		expect(() => initLottoPicker()).not.toThrow();
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();
		// a completed spin proves the clamp held the whole way through:
		// count clamped to range (3 balls), bonus clamped away entirely
		await vi.waitFor(
			() => {
				expect(document.querySelectorAll('#lng-result .lng-ball').length).toBe(3);
				expect(document.getElementById('lng-status')?.textContent).toContain('resonance');
			},
			{ timeout: 4000, interval: 50 }
		);
	});

	it('ignores malformed persisted custom values and falls back to defaults', () => {
		localStorage.setItem(
			'lotto-prefs',
			JSON.stringify({ gameKey: 'custom', custom: { range: 50.5, count: 'abc', bonusRange: null } })
		);
		expect(() => initLottoPicker()).not.toThrow();
		// defaults survive: C(50,5) * C(10,1) = 2,118,760 * 10
		expect(document.getElementById('lng-chance')?.textContent).toBe('1 in 21,187,600');
	});
});

describe('share button', () => {
	it('does not exist before a draw', () => {
		initLottoPicker();
		expect(document.querySelector('.lng-share')).toBeNull();
	});

	it('appears after a draw, copies the expected text, and tracks the share', async () => {
		const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
		// happy-dom has no navigator.share, so the clipboard branch is exercised by default

		initLottoPicker();
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();

		let shareBtn: HTMLButtonElement | null = null;
		await vi.waitFor(
			() => {
				shareBtn = document.querySelector('.lng-share');
				expect(shareBtn).toBeTruthy();
				expect(document.getElementById('lng-status')?.textContent).toContain('resonance');
			},
			{ timeout: 4000, interval: 50 }
		);
		expect(shareBtn!.textContent).toBe('🍀 Share these numbers');

		shareBtn!.click();
		await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));

		const text = writeText.mock.calls[0][0] as string;
		// EuroMillions: 5 main + bonus 2, e.g. "My lucky numbers: 7, 19, 23, 31, 48 + bonus 3, 9 — EuroMillions, resonance 87%. Conjured at makemelucky.com 🍀"
		expect(text).toMatch(
			/^My lucky numbers: \d+(, \d+){4} \+ bonus \d+, \d+ — EuroMillions, resonance \d+%\. Conjured at makemelucky\.com 🍀$/
		);
		expect(track).toHaveBeenCalledWith('numbers_shared', { game: 'euromillions' });

		// brief feedback, reverts after ~2s
		expect(shareBtn!.textContent).toBe('🍀 Copied!');
		await vi.waitFor(
			() => expect(shareBtn!.textContent).toBe('🍀 Share these numbers'),
			{ timeout: 3000, interval: 50 }
		);
	});

	it('disappears when the game is switched (no stale draw to share)', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
		initLottoPicker();
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();
		await vi.waitFor(() => expect(document.querySelector('.lng-share')).toBeTruthy(), {
			timeout: 4000,
			interval: 50
		});

		const select = document.getElementById('lng-game') as HTMLSelectElement;
		select.value = 'lotto';
		select.dispatchEvent(new Event('change'));
		expect(document.querySelector('.lng-share')).toBeNull();
	});
});
