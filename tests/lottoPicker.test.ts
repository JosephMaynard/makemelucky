import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initLottoPicker, GAMES, pickUnique, oddsString, numerology, digitalRoot } from '../src/luck/lottoPicker';
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

// Several tests below spy on shared globals (clipboard, storage, matchMedia,
// rAF, IntersectionObserver). Restore them after every test so one test's spy
// can't wrap/shadow another's and skew call counts.
afterEach(() => {
	vi.restoreAllMocks();
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

	it('knows the 2026 international lineup with verified odds', () => {
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		const expectOdds = (key: string, odds: string) => {
			select.value = key;
			select.dispatchEvent(new Event('change'));
			expect(document.getElementById('lng-chance')?.textContent).toBe(odds);
		};
		expectOdds('germanyLotto', '1 in 139,838,160'); // C(49,6) × 10
		expectOdds('megaSena', '1 in 50,063,860'); // C(60,6)
		expectOdds('canadaLottoMax', '1 in 133,784,560'); // C(52,7) — 7/52 since Apr 2026
		expectOdds('japanLoto7', '1 in 10,295,472'); // C(37,7)
		expectOdds('franceLoto', '1 in 19,068,840'); // C(49,5) × 10
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
		// EuroMillions: 5 main + bonus 2, e.g. "My lucky numbers: 7, 19, 23, 31, 48 + bonus 3, 9 (EuroMillions, resonance 87%). Conjured at makemelucky.com 🍀"
		expect(text).toMatch(
			/^My lucky numbers: \d+(, \d+){4} \+ bonus \d+, \d+ \(EuroMillions, resonance \d+%\)\. Conjured at makemelucky\.com 🍀$/
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

// Finding 6: German Lotto's Superzahl, La Primitiva's Reintegro, and SA
// Lotto's real 6/58 pool were all misrepresented. These are boundary tests on
// the pure data/maths (pickUnique/oddsString/GAMES), not full UI spins, so
// "reachable"/"unreachable" is proven by construction rather than sampled.
describe('lottery pool corrections (finding 6)', () => {
	it('German Lotto Superzahl and La Primitiva Reintegro are 0-9, not 1-10', () => {
		for (const key of ['germanyLotto', 'laPrimitiva'] as const) {
			const { bonusRange, bonusMin } = GAMES[key].config;
			expect(bonusRange).toBe(10);
			expect(bonusMin).toBe(0);
			// drawing the whole pool (count === range) proves both ends are reachable
			const wholePool = pickUnique(bonusRange, bonusRange, () => 0, bonusMin);
			expect(wholePool[0]).toBe(0); // zero is reachable
			expect(wholePool[wholePool.length - 1]).toBe(9);
			expect(wholePool).not.toContain(10); // 10 is unreachable
		}
		expect(GAMES.germanyLotto.bonusLabel).toBe('Superzahl');
		expect(GAMES.laPrimitiva.bonusLabel).toBe('Reintegro');
	});

	it('South African Lotto draws 6 from 1-58, with 58 reachable', () => {
		const cfg = GAMES.southAfricaLotto.config;
		expect(cfg.range).toBe(58);
		expect(cfg.count).toBe(6);
		const wholePool = pickUnique(cfg.range, cfg.range, () => 0);
		expect(wholePool[0]).toBe(1);
		expect(wholePool[wholePool.length - 1]).toBe(58); // 58 reachable
	});

	it("SA Lotto's displayed jackpot odds use the 58-number pool", () => {
		expect(oddsString(GAMES.southAfricaLotto.config)).toBe('1 in 40,475,358'); // C(58,6)
	});

	it('a custom game stays 1-based', async () => {
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		select.value = 'custom';
		select.dispatchEvent(new Event('change'));
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();
		await vi.waitFor(
			() => expect(document.querySelectorAll('#lng-result .lng-ball').length).toBeGreaterThan(0),
			{ timeout: 4000, interval: 50 }
		);
		const nums = [...document.querySelectorAll('#lng-result .lng-ball-row .lng-ball .lng-num')].map((n) =>
			Number(n.textContent)
		);
		for (const n of nums) expect(n).toBeGreaterThanOrEqual(1); // never 0 — custom has no bonusMin of its own
	});

	it('does not touch EuroMillions (its Sept 2026 format-change comment is unverified)', () => {
		expect(GAMES.euromillions.config).toEqual({ range: 50, count: 5, bonusRange: 12, bonusCount: 2 });
		expect(GAMES.euromillions.bonusLabel).toBeUndefined();
	});

	it('the decorative numerology engine handles a zero value cleanly (no NaN, no infinite loop)', () => {
		expect(digitalRoot(0)).toBe(9);
		const num = numerology(0, 0.37);
		expect(Number.isFinite(num.resonance)).toBe(true);
		expect(num.resonance).toBeGreaterThanOrEqual(40);
		expect(num.resonance).toBeLessThanOrEqual(99);
		expect(num.vibe).toBeDefined();
	});

	it('labels the German Lotto bonus ball "Superzahl" instead of the generic bonus label', async () => {
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		select.value = 'germanyLotto';
		select.dispatchEvent(new Event('change'));
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();
		await vi.waitFor(() => expect(document.querySelectorAll('#lng-result .lng-ball').length).toBe(7), {
			timeout: 4000,
			interval: 50
		});
		const balls = [...document.querySelectorAll('#lng-result .lng-ball-row .lng-ball')];
		expect(balls[0].getAttribute('aria-label')).toMatch(/^Main number \d+$/);
		expect(balls[balls.length - 1].getAttribute('aria-label')).toMatch(/^Superzahl \d+$/);
	});

	it('uses the Superzahl label, not "bonus", in the share text', async () => {
		vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
		initLottoPicker();
		const select = document.getElementById('lng-game') as HTMLSelectElement;
		select.value = 'germanyLotto';
		select.dispatchEvent(new Event('change'));
		const spin = document.getElementById('lng-spin') as HTMLButtonElement;
		spin.click();
		let shareBtn: HTMLButtonElement | null = null;
		await vi.waitFor(
			() => {
				shareBtn = document.querySelector('.lng-share');
				expect(shareBtn).toBeTruthy();
			},
			{ timeout: 4000, interval: 50 }
		);
		shareBtn!.click();
		await vi.waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1));
		const text = vi.mocked(navigator.clipboard.writeText).mock.calls[0][0] as string;
		expect(text).toMatch(/ \+ Superzahl \d+ \(German Lotto 6aus49,/);
	});
});

// Finding 5: after a draw the seven ball canvases (plus the field canvas) kept
// painting at ~60fps forever, even 1,000px off-screen or with the tab hidden,
// and a live prefers-reduced-motion change never reached the running loop.
describe('off-screen / reduced-motion loop gating (finding 5)', () => {
	it('observes the lottery section for visibility-based loop gating', () => {
		const observeSpy = vi.spyOn(IntersectionObserver.prototype, 'observe');
		initLottoPicker();
		expect(observeSpy).toHaveBeenCalledWith(document.getElementById('luck-numbers'));
		observeSpy.mockRestore();
	});

	it('never schedules an animation frame while the tab is hidden', async () => {
		Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
		try {
			initLottoPicker();
			const spin = document.getElementById('lng-spin') as HTMLButtonElement;
			spin.click();
			await vi.waitFor(() => expect(document.querySelectorAll('#lng-result .lng-ball').length).toBe(7), {
				timeout: 4000,
				interval: 50
			});
			expect(rafSpy).not.toHaveBeenCalled(); // zero painting while hidden
		} finally {
			rafSpy.mockRestore();
			delete (document as unknown as { hidden?: boolean }).hidden; // restore the live prototype getter
		}
	});

	it('renders one static frame, never a loop, when the OS already prefers reduced motion', async () => {
		const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(
			(query: string) =>
				({
					matches: query.includes('prefers-reduced-motion'),
					media: query,
					addEventListener: vi.fn(),
					removeEventListener: vi.fn(),
					addListener: vi.fn(),
					removeListener: vi.fn(),
					dispatchEvent: vi.fn(),
					onchange: null
				}) as unknown as MediaQueryList
		);
		const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
		try {
			initLottoPicker();
			const spin = document.getElementById('lng-spin') as HTMLButtonElement;
			spin.click();
			await vi.waitFor(() => expect(document.querySelectorAll('#lng-result .lng-ball').length).toBe(7), {
				timeout: 4000,
				interval: 50
			});
			expect(rafSpy).not.toHaveBeenCalled(); // static render, no loop ever started
		} finally {
			rafSpy.mockRestore();
			matchMediaSpy.mockRestore();
		}
	});

	it('stops the loop the instant the OS flips to reduced motion mid-session', async () => {
		const realMatchMedia = window.matchMedia.bind(window);
		let capturedMql: MediaQueryList | null = null;
		const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => {
			const mql = realMatchMedia(query);
			if (query.includes('prefers-reduced-motion')) capturedMql = mql;
			return mql;
		});
		try {
			initLottoPicker();
			const spin = document.getElementById('lng-spin') as HTMLButtonElement;
			spin.click();
			await vi.waitFor(() => expect(document.querySelectorAll('#lng-result .lng-ball').length).toBe(7), {
				timeout: 4000,
				interval: 50
			});
			expect(capturedMql).toBeTruthy();

			const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
			capturedMql!.dispatchEvent(new MediaQueryListEvent('change', { matches: true, media: capturedMql!.media }));
			const callsRightAfterFlip = rafSpy.mock.calls.length;
			await new Promise((r) => setTimeout(r, 100));
			expect(rafSpy.mock.calls.length).toBe(callsRightAfterFlip); // no further frames once reduced motion kicks in
			rafSpy.mockRestore();
		} finally {
			matchMediaSpy.mockRestore();
		}
	});
});

// Maintenance bullet: lottery preference saves didn't catch storage errors,
// unlike other persistence paths in the app.
describe('preference save resilience (maintenance)', () => {
	it('does not throw when localStorage is blocked (private mode / full quota)', () => {
		const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new DOMException('blocked', 'QuotaExceededError');
		});
		try {
			initLottoPicker();
			const select = document.getElementById('lng-game') as HTMLSelectElement;
			expect(() => {
				select.value = 'lotto';
				select.dispatchEvent(new Event('change'));
			}).not.toThrow();
		} finally {
			setItemSpy.mockRestore();
		}
	});
});
