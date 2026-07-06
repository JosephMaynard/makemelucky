// The original licensed AudioJungle sprite, remapped to the V3 effects.

import { Howl, Howler } from 'howler';

const SPRITE = {
	cloudsTunnel: [1000, 12013],
	spinningRim: [14030, 9670],
	luckySymbol: [24000, 4400],
	rimLight: [29000, 5800],
	powerStreams: [35000, 8500],
	buttonFall: [44000, 9620],
	button: [54000, 2500],
	charmAward: [57000, 3520],
	lucky: [61000, 4000]
};

export class AudioService {
	constructor() {
		this.howl = new Howl({ src: ['/soundfx/makemelucky.mp3'], sprite: SPRITE, preload: true });
		this.muted = false;
	}

	play(name) {
		if (!name || this.muted || !SPRITE[name]) return;
		this.howl.play(name);
	}

	setMuted(muted) {
		this.muted = muted;
		Howler.mute(muted);
	}
}
