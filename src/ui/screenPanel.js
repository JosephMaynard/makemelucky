// The black glass message screen — the machine's voice.

import { pick } from '../core/anim.js';

const ADVERBS = [
	'MEGA', 'SUPER', 'EXTRA', 'HIGHLY', 'AWFULLY', 'AMAZINGLY', 'EMINENTLY', 'EXTREMELY',
	'ENORMOUSLY', 'FABULOUSLY', 'INCREDIBLY', 'ABNORMALLY', 'REMARKABLY', 'STRIKINGLY',
	'UNCOMMONLY', 'STARTLINGLY', 'WONDERFULLY', 'BRILLIANTLY', 'EXCEEDINGLY', 'MARVELOUSLY',
	'MONUMENTALLY', 'OUTRAGEOUSLY', 'PRODIGIOUSLY', 'TRIUMPHANTLY', 'TREMENDOUSLY',
	'INORDINATELY', 'EXTRAORDINARY', 'FANTASTICALLY', 'ASTONISHINGLY', 'EXCEPTIONALLY',
	'OUTSTANDINGLY'
];

const MORE_LUCK = [
	['LOOKING FOR', 'MORE LUCK?'],
	['NEED A BIT', 'MORE LUCK?'],
	['WANT SOME', 'MORE LUCK?'],
	['WANT EVEN', 'MORE LUCK?'],
	['NEED EXTRA', 'GOOD LUCK?'],
	['WANT TO BE', 'MORE LUCKY?']
];

const PRESS_AGAIN = [
	['PRESS THE', 'BUTTON'],
	['KEEP PRESSING', 'THE BUTTON'],
	['HAVE ANOTHER', 'PRESS!'],
	['PRESS', 'AGAIN!']
];

export class ScreenPanel {
	constructor() {
		this.el = document.getElementById('screen-text');
		this.timer = null;
		this.seq = 0; // cancels stale async sequences
	}

	_render(lines) {
		const [l1, l2] = Array.isArray(lines) ? lines : [lines, ''];
		this.el.classList.remove('text-in');
		void this.el.offsetWidth; // restart animation
		this.el.innerHTML =
			`<span class="line1">${l1 || ''}</span>` + (l2 ? `<span class="line2">${l2}</span>` : '');
		this.el.classList.toggle('small', (l1 || '').length > 12 || (l2 || '').length > 12);
		this.el.classList.add('text-in');
	}

	_stopLoop() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	blank() {
		this.seq++;
		this._stopLoop();
		this.el.innerHTML = '';
	}

	/** Show items in order (interval ms apart), then keep cycling loopItems. */
	sequence(items, loopItems = null, interval = 1700) {
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

	welcome(isReturn) {
		this.sequence(
			[[isReturn ? 'WELCOME BACK' : 'WELCOME', ''], ['NEED A BIT', 'OF LUCK?']],
			[['PRESS THE', 'BUTTON'], ['MAKE ME', 'LUCKY']]
		);
	}

	charmAwarded() {
		this.sequence([['LUCKY', 'CHARM!']], null);
	}

	youAreNowLucky(presses, charmAwarded = false) {
		const items = [];
		if (charmAwarded) items.push(['LUCKY', 'CHARM!']);
		items.push(['YOU ARE NOW', '']);
		const adverbCount = presses < 2 ? 0 : presses < 4 ? 1 : presses < 8 ? 2 : 3;
		const used = new Set();
		for (let i = 0; i < adverbCount; i++) {
			let adv = pick(ADVERBS);
			while (used.has(adv)) adv = pick(ADVERBS);
			used.add(adv);
			items.push([adv, '']);
		}
		items.push(['LUCKY!', '']);
		this.sequence(items, [pick(MORE_LUCK), pick(PRESS_AGAIN)]);
	}
}
