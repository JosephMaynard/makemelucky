// The black glass message screen — the machine's voice.

import { pick } from '../core/anim';

// A screen message is two lines, with an optional third style-variant slot.
export type ScreenMessage = readonly [string, string, ('giant')?];

const ADVERBS: string[] = [
	'MEGA', 'SUPER', 'EXTRA', 'HIGHLY', 'AWFULLY', 'AMAZINGLY', 'EMINENTLY', 'EXTREMELY',
	'ENORMOUSLY', 'FABULOUSLY', 'INCREDIBLY', 'ABNORMALLY', 'REMARKABLY', 'STRIKINGLY',
	'UNCOMMONLY', 'STARTLINGLY', 'WONDERFULLY', 'BRILLIANTLY', 'EXCEEDINGLY', 'MARVELOUSLY',
	'MONUMENTALLY', 'OUTRAGEOUSLY', 'PRODIGIOUSLY', 'TRIUMPHANTLY', 'TREMENDOUSLY',
	'INORDINATELY', 'EXTRAORDINARY', 'FANTASTICALLY', 'ASTONISHINGLY', 'EXCEPTIONALLY',
	'OUTSTANDINGLY'
];

const MORE_LUCK: ScreenMessage[] = [
	['LOOKING FOR', 'MORE LUCK?'],
	['NEED A BIT', 'MORE LUCK?'],
	['WANT SOME', 'MORE LUCK?'],
	['WANT EVEN', 'MORE LUCK?'],
	['NEED EXTRA', 'GOOD LUCK?'],
	['WANT TO BE', 'MORE LUCKY?']
];

const PRESS_AGAIN: ScreenMessage[] = [
	['PRESS THE', 'BUTTON'],
	['KEEP PRESSING', 'THE BUTTON'],
	['HAVE ANOTHER', 'PRESS!'],
	['PRESS', 'AGAIN!']
];

export class ScreenPanel {
	el: HTMLElement;
	panel: HTMLElement;
	sparkle: HTMLElement;
	timer: ReturnType<typeof setInterval> | null;
	seq: number;

	constructor() {
		this.el = document.getElementById('screen-text')!;
		this.panel = document.getElementById('screen-panel')!;
		this.sparkle = document.getElementById('screen-sparkle')!;
		this.timer = null;
		this.seq = 0; // cancels stale async sequences
	}

	_render(lines: ScreenMessage | string): void {
		this.panel.classList.remove('away'); // swing back if we were hidden
		// third item, when present, is an opt-in style variant (e.g. 'giant')
		const [l1, l2, variant] = Array.isArray(lines) ? lines : [lines, ''];
		this.el.classList.remove('text-in');
		this.sparkle.classList.remove('go');
		void this.el.offsetWidth; // restart animations
		this.el.innerHTML =
			`<span class="line1">${l1 || ''}</span>` + (l2 ? `<span class="line2">${l2}</span>` : '');
		this.el.classList.toggle('giant', variant === 'giant');
		this.el.classList.toggle('small', variant !== 'giant' && ((l1 || '').length > 12 || (l2 || '').length > 12));
		this.el.classList.add('text-in');
		// the bling lands somewhere new behind the text every time
		this.sparkle.style.left = `${28 + Math.random() * 44}%`;
		this.sparkle.style.top = `${34 + Math.random() * 32}%`;
		this.sparkle.style.setProperty('--spk', (0.5 + Math.random() * 0.5).toFixed(2));
		this.sparkle.classList.add('go');
	}

	_stopLoop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	blank(): void {
		this.seq++;
		this._stopLoop();
		this.el.innerHTML = '';
		this.panel.classList.add('away'); // the screen retires while magic happens
	}

	/** Show items in order (interval ms apart), then keep cycling loopItems. */
	sequence(items: ScreenMessage[], loopItems: ScreenMessage[] | null = null, interval = 1360): void { // 1700 * 0.8 — +20% faster pacing
		this.seq++;
		const mySeq = this.seq;
		this._stopLoop();
		let i = 0;
		const all = items.slice();
		this._render(all[0]);
		this.timer = setInterval(() => {
			if (mySeq !== this.seq) return;
			i++;
			if (i < all.length) {
				this._render(all[i]);
			} else if (loopItems && loopItems.length) {
				this._render(loopItems[(i - all.length) % loopItems.length]);
			} else {
				this._stopLoop();
			}
		}, interval);
	}

	welcome(isReturn: boolean): void {
		this.sequence(
			[[isReturn ? 'WELCOME BACK' : 'WELCOME', ''], ['NEED A BIT', 'OF LUCK?']],
			[['PRESS THE', 'BUTTON'], ['MAKE ME', 'LUCKY']]
		);
	}

	charmAwarded(): void {
		this.sequence([['LUCKY', 'CHARM!']], null);
	}

	youAreNowLucky(presses: number, charmAwarded = false, quip: ScreenMessage | string | null = null): void {
		const items: ScreenMessage[] = [];
		if (quip) items.push((Array.isArray(quip) ? quip : [quip, '']) as ScreenMessage);
		if (charmAwarded) items.push(['LUCKY', 'CHARM!']);
		items.push(['YOU ARE NOW', '']);
		const adverbCount = presses < 2 ? 0 : presses < 4 ? 1 : presses < 8 ? 2 : 3;
		const used = new Set<string>();
		for (let i = 0; i < adverbCount; i++) {
			let adv = pick(ADVERBS);
			while (used.has(adv)) adv = pick(ADVERBS);
			used.add(adv);
			items.push([adv, '']);
		}
		items.push(['LUCKY!', '', 'giant']);
		this.sequence(items, [pick(MORE_LUCK), pick(PRESS_AGAIN)]);
	}
}
