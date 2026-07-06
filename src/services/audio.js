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

// Standalone tunes that live outside the licensed sprite. Each gets its own Howl,
// created lazily the first time it's played.
const TRACKS = {
	luckyNowDisco: { src: '/soundfx/lucky-now-disco.mp3', volume: 0.9 }
};

export class AudioService {
	constructor() {
		this.howl = new Howl({ src: ['/soundfx/makemelucky.mp3'], sprite: SPRITE, preload: true });
		this.muted = false;
		this.tracks = {}; // lazily-built Howls, keyed by TRACKS name
	}

	play(name) {
		if (!name || this.muted) return;
		if (SPRITE[name]) {
			this.howl.play(name);
		} else if (TRACKS[name]) {
			this.playTrack(name);
		}
	}

	playTrack(name) {
		let track = this.tracks[name];
		if (!track) {
			const def = TRACKS[name];
			track = new Howl({ src: [def.src], volume: def.volume, preload: true });
			this.tracks[name] = track;
		}
		track.stop(); // never let a track overlap itself
		track.volume(TRACKS[name].volume);
		track.play();
	}

	stopTrack(name, fadeMs = 600) {
		const track = this.tracks[name];
		if (!track || !track.playing()) return;
		track.fade(track.volume(), 0, fadeMs);
		track.once('fade', () => track.stop());
	}

	setMuted(muted) {
		this.muted = muted;
		Howler.mute(muted);
	}
}
