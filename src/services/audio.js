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
	luckyNowDisco: { src: '/soundfx/lucky-now-disco.mp3', volume: 0.9 },
	luckyFireworks: { src: '/soundfx/fireworks-luckyness.mp3', volume: 0.9 }
};

export class AudioService {
	constructor() {
		this.howl = new Howl({ src: ['/soundfx/makemelucky.mp3'], sprite: SPRITE, preload: true });
		this.muted = false;
		this.tracks = {}; // lazily-built Howls, keyed by TRACKS name
		this._noiseBuffer = null; // shared white-noise buffer for all the crunchy SFX
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

	// ─────────────────────────────────────────────────────────────────────────
	// Procedural Web-Audio SFX. These are hand-synthesized one-shots and loops
	// that layer *on top of* the licensed sprite + music bed. We borrow Howler's
	// AudioContext and hang everything off Howler.masterGain so the global mute
	// (setMuted → Howler.mute) silences these too, for free.
	// ─────────────────────────────────────────────────────────────────────────

	// Are we allowed to make noise right now, and is Web Audio actually awake?
	// Howler.ctx is null until the first user gesture unlocks it — but by the
	// time anything calls sfx()/sfxLoop() the unlocking button press has happened.
	_audioReady() {
		if (this.muted) return false;
		const ctx = Howler.ctx;
		if (!ctx || !Howler.masterGain) return false;
		return true;
	}

	// One shared white-noise buffer, built lazily. Pops, booms, swooshes and
	// clicks all just re-window slices of this.
	_getNoise(ctx) {
		if (this._noiseBuffer && this._noiseBuffer.sampleRate === ctx.sampleRate) {
			return this._noiseBuffer;
		}
		const len = Math.floor(ctx.sampleRate * 1.0); // 1s of noise is plenty
		const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
		const data = buffer.getChannelData(0);
		for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
		this._noiseBuffer = buffer;
		return buffer;
	}

	// A single oscillator "blip": a tone that glides freq0→freq1 while its gain
	// swells to `peak` and exponentially decays to silence over `dur` seconds.
	// Returns { osc, gain } so callers can stack partials or keep references.
	_blip(ctx, { type = 'sine', freq0, freq1 = freq0, peak = 0.2, dur = 0.25, attack = 0.005, detune = 0, when = 0 }) {
		const t = ctx.currentTime + when;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.type = type;
		osc.detune.value = detune;
		osc.frequency.setValueAtTime(Math.max(1, freq0), t);
		if (freq1 !== freq0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t + dur);
		// gain envelope: quick attack, exponential tail (ramp to tiny, not 0)
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		osc.connect(gain).connect(Howler.masterGain);
		osc.start(t);
		osc.stop(t + dur + 0.02);
		osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch (e) {} };
		return { osc, gain };
	}

	// A noise "burst": a slice of the shared noise buffer pushed through a
	// biquad filter (optionally sweeping) with an exponential gain envelope.
	_noiseBurst(ctx, { filterType = 'bandpass', freq0, freq1 = freq0, Q = 1, peak = 0.2, dur = 0.15, attack = 0.004, when = 0 }) {
		const t = ctx.currentTime + when;
		const src = ctx.createBufferSource();
		src.buffer = this._getNoise(ctx);
		src.loop = true;
		const filter = ctx.createBiquadFilter();
		filter.type = filterType;
		filter.Q.value = Q;
		filter.frequency.setValueAtTime(Math.max(1, freq0), t);
		if (freq1 !== freq0) filter.frequency.exponentialRampToValueAtTime(Math.max(1, freq1), t + dur);
		const gain = ctx.createGain();
		gain.gain.setValueAtTime(0.0001, t);
		gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + attack);
		gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
		src.connect(filter).connect(gain).connect(Howler.masterGain);
		src.start(t, Math.random() * 0.5); // random offset so repeats don't phase-lock
		src.stop(t + dur + 0.02);
		src.onended = () => { try { src.disconnect(); filter.disconnect(); gain.disconnect(); } catch (e) {} };
		return { src, filter, gain };
	}

	// Fire-and-forget one-shot. Unknown names / muted / no-audio are silent no-ops.
	// `pitch` scales every frequency; `gain` scales every loudness.
	sfx(name, { pitch = 1, gain = 1 } = {}) {
		if (!this._audioReady()) return;
		const ctx = Howler.ctx;
		const p = pitch, g = gain;

		switch (name) {
			case 'ding': { // bright pinball-bumper ding: two detuned partials, fast decay
				this._blip(ctx, { type: 'sine',     freq0: 1400 * p, peak: 0.25 * g, dur: 0.25 });
				this._blip(ctx, { type: 'triangle', freq0: 2100 * p, peak: 0.15 * g, dur: 0.22, detune: 6 });
				break;
			}
			case 'pop': { // short bandpass noise blip sweeping down
				this._noiseBurst(ctx, { filterType: 'bandpass', freq0: 900 * p, freq1: 500 * p, Q: 6, peak: 0.28 * g, dur: 0.12 });
				break;
			}
			case 'boom': { // firework: lowpassed noise sweeping down + a sub thump
				this._noiseBurst(ctx, { filterType: 'lowpass', freq0: 300 * p, freq1: 60 * p, Q: 1, peak: 0.32 * g, dur: 0.9, attack: 0.008 });
				this._blip(ctx, { type: 'sine', freq0: 90 * p, freq1: 45 * p, peak: 0.3 * g, dur: 0.5, attack: 0.006 });
				break;
			}
			case 'swoosh': { // soft-attack bandpass noise arcing 400→2800→600Hz
				const t = ctx.currentTime;
				const src = ctx.createBufferSource();
				src.buffer = this._getNoise(ctx);
				src.loop = true;
				const filter = ctx.createBiquadFilter();
				filter.type = 'bandpass';
				filter.Q.value = 2;
				filter.frequency.setValueAtTime(400 * p, t);
				filter.frequency.linearRampToValueAtTime(2800 * p, t + 0.17);
				filter.frequency.linearRampToValueAtTime(600 * p, t + 0.35);
				const gn = ctx.createGain();
				gn.gain.setValueAtTime(0.0001, t);
				gn.gain.linearRampToValueAtTime(0.2 * g, t + 0.09); // gentle swell in
				gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
				src.connect(filter).connect(gn).connect(Howler.masterGain);
				src.start(t, Math.random() * 0.5);
				src.stop(t + 0.37);
				src.onended = () => { try { src.disconnect(); filter.disconnect(); gn.disconnect(); } catch (e) {} };
				break;
			}
			case 'tick': { // very short high filtered click
				this._noiseBurst(ctx, { filterType: 'bandpass', freq0: 2600 * p, Q: 8, peak: 0.18 * g, dur: 0.03, attack: 0.001 });
				break;
			}
			case 'clack': { // dice on felt: lower + louder than tick
				this._noiseBurst(ctx, { filterType: 'bandpass', freq0: 1500 * p, Q: 5, peak: 0.28 * g, dur: 0.05, attack: 0.001 });
				break;
			}
			case 'clang': { // metallic: 3 inharmonic square-ish partials ringing ~0.7s
				this._blip(ctx, { type: 'square', freq0: 520 * p,  peak: 0.14 * g, dur: 0.7,  attack: 0.002 });
				this._blip(ctx, { type: 'square', freq0: 1380 * p, peak: 0.08 * g, dur: 0.5,  attack: 0.002 });
				this._blip(ctx, { type: 'square', freq0: 2600 * p, peak: 0.05 * g, dur: 0.35, attack: 0.002 });
				break;
			}
			case 'gulp': { // comedy swallow: sine 500→120Hz with an amplitude wobble
				const t = ctx.currentTime;
				const osc = ctx.createOscillator();
				const gn = ctx.createGain();
				const lfo = ctx.createOscillator();
				const lfoGain = ctx.createGain();
				osc.type = 'sine';
				osc.frequency.setValueAtTime(500 * p, t);
				osc.frequency.exponentialRampToValueAtTime(120 * p, t + 0.22);
				gn.gain.setValueAtTime(0.0001, t);
				gn.gain.exponentialRampToValueAtTime(0.26 * g, t + 0.02);
				gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
				lfo.type = 'sine';
				lfo.frequency.value = 18; // fast amplitude wobble = "glug"
				lfoGain.gain.value = 0.08 * g;
				lfo.connect(lfoGain).connect(gn.gain);
				osc.connect(gn).connect(Howler.masterGain);
				osc.start(t); lfo.start(t);
				osc.stop(t + 0.26); lfo.stop(t + 0.26);
				osc.onended = () => { try { osc.disconnect(); gn.disconnect(); lfo.disconnect(); lfoGain.disconnect(); } catch (e) {} };
				break;
			}
			case 'chime': { // gentle bell: sine partials at f, 2.7f, 5.4f, long decay
				const f = 880 * p;
				this._blip(ctx, { type: 'sine', freq0: f,       peak: 0.2 * g,  dur: 1.2,  attack: 0.004 });
				this._blip(ctx, { type: 'sine', freq0: f * 2.7, peak: 0.1 * g,  dur: 0.9,  attack: 0.004 });
				this._blip(ctx, { type: 'sine', freq0: f * 5.4, peak: 0.05 * g, dur: 0.6,  attack: 0.004 });
				break;
			}
			case 'zap': { // sawtooth 1800→200Hz + a touch of noise
				this._blip(ctx, { type: 'sawtooth', freq0: 1800 * p, freq1: 200 * p, peak: 0.22 * g, dur: 0.15, attack: 0.002 });
				this._noiseBurst(ctx, { filterType: 'highpass', freq0: 1200 * p, Q: 1, peak: 0.08 * g, dur: 0.12 });
				break;
			}
			default:
				return; // unknown name = silent no-op
		}
	}

	// Start a looping sound. Returns stop(fadeMs = 300). When we can't play
	// (muted / no audio / unknown name) we still hand back a callable no-op stop.
	sfxLoop(name, opts = {}) {
		const noop = () => {};
		if (!this._audioReady()) return noop;
		const ctx = Howler.ctx;
		const pitch = opts.pitch ?? 1;
		const gain = opts.gain ?? 1;

		if (name === 'wooWoo') {
			// Jetsons theremin: a sine warbled by a slow LFO on its frequency.
			const t = ctx.currentTime;
			const carrier = ctx.createOscillator();
			const lfo = ctx.createOscillator();
			const lfoGain = ctx.createGain();
			const out = ctx.createGain();
			carrier.type = 'sine';
			carrier.frequency.value = 700 * pitch;
			lfo.type = 'sine';
			lfo.frequency.value = 4; // ~4Hz warble
			lfoGain.gain.value = 700 * pitch * 0.35; // ±35% frequency depth
			lfo.connect(lfoGain).connect(carrier.frequency);
			out.gain.setValueAtTime(0.0001, t);
			out.gain.linearRampToValueAtTime(0.12 * gain, t + 0.15); // ease in
			carrier.connect(out).connect(Howler.masterGain);
			carrier.start(t); lfo.start(t);

			let stopped = false;
			return (fadeMs = 300) => {
				if (stopped) return;
				stopped = true;
				const now = ctx.currentTime;
				const end = now + fadeMs / 1000;
				try {
					out.gain.cancelScheduledValues(now);
					out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
					out.gain.exponentialRampToValueAtTime(0.0001, end);
					carrier.stop(end + 0.02); lfo.stop(end + 0.02);
					carrier.onended = () => { try { carrier.disconnect(); lfo.disconnect(); lfoGain.disconnect(); out.disconnect(); } catch (e) {} };
				} catch (e) {}
			};
		}

		if (name === 'tickTock') {
			// Alternating tick/tock clicks, ~2 per second, tock a shade lower.
			let toggle = false;
			const id = setInterval(() => {
				if (this.muted) return; // respect a mute toggled mid-loop
				if (toggle) {
					this._noiseBurst(ctx, { filterType: 'bandpass', freq0: 1500 * pitch, Q: 6, peak: 0.16 * gain, dur: 0.04, attack: 0.001 });
				} else {
					this._noiseBurst(ctx, { filterType: 'bandpass', freq0: 2400 * pitch, Q: 6, peak: 0.16 * gain, dur: 0.035, attack: 0.001 });
				}
				toggle = !toggle;
			}, 500); // 2Hz: tick … tock … tick … tock

			let stopped = false;
			return (fadeMs = 300) => { // fadeMs unused here — clicks are instantaneous
				if (stopped) return;
				stopped = true;
				clearInterval(id);
			};
		}

		return noop; // unknown loop name = no-op stop
	}
}
