import './styles/main.css';
import * as THREE from 'three';
import { LuckyScene } from './core/scene';
import { Machine } from './machine/machine';
import { Particles } from './gfx/particles';
import { Lightning } from './gfx/lightning';
import {
	createQuiltTextures,
	createMachineFaceTextures,
	createButtonTextures,
	createGlyphRingTexture,
	createParticleSprites,
	createSkyTexture,
	createCloudSprite
} from './gfx/textures';
import { Director } from './effects/director';
import { ScreenPanel } from './ui/screenPanel';
import { CharmsUI } from './ui/charmsUI';
import { PressController } from './ui/pressController';
import { QUIPS } from './ui/quips';
import { printConsoleBanner, printEffectList } from './ui/console';
import { LuckStore } from './luck/store';
import type { Charm } from './luck/charmsData';
import { initLottoPicker } from './luck/lottoPicker';
import { initDossier } from './luck/dossier';
import { AudioService } from './services/audio';
import { Haptics } from './services/haptics';
import { WakeLock } from './services/wakeLock';
import { initAnalytics, track } from './services/analytics';
import { dayIndex } from './luck/days';
import type { EffectContext, TextureBundle } from './types';

// Whatever boot managed to wire before anything went wrong. If the 3D machine
// never starts, the fallback presses these pieces back into service; an earlier
// failure simply means there are fewer of them.
const kit: {
	store?: LuckStore;
	charmsUI?: CharmsUI;
	screen?: ScreenPanel;
	/** How a charm gets its ceremony right now. Boot upgrades this to the full
	 *  version (sound, particles) once the scene exists; until then, and for
	 *  ever if the machine never starts, it is the DOM-only one below. */
	celebrate: (awarded: Charm[]) => void;
} = { celebrate: plainCelebrate };

/** Toast, grid card, analytics, progress — everything a charm ceremony needs
 *  that does not need a renderer. */
function plainCelebrate(awarded: Charm[]): void {
	for (const charm of awarded) {
		kit.charmsUI?.showToast(charm);
		kit.charmsUI?.addCharm(charm);
		track('charm_awarded', { charm: charm.id });
	}
	kit.charmsUI?.updateProgress();
}

// rAF with a timeout fallback (headless/background tabs may not paint)
const nextFrame = () =>
	new Promise<void>((r) => {
		const fallback = setTimeout(() => r(), 120);
		requestAnimationFrame(() => {
			clearTimeout(fallback);
			r();
		});
	});

async function boot(): Promise<void> {
	initAnalytics();

	const store = new LuckStore();
	kit.store = store;
	const audio = new AudioService();
	const haptics = new Haptics();
	const wakeLock = new WakeLock();
	audio.setMuted(!store.data.soundOn);
	haptics.enabled = store.data.vibrationOn !== false;

	const screen = new ScreenPanel();
	const charmsUI = new CharmsUI(store);
	charmsUI.renderAll();
	kit.screen = screen;
	kit.charmsUI = charmsUI;

	// the below-the-fold features are self-contained; wire them up now so they
	// work even before the WebGL scene finishes booting
	try {
		initLottoPicker();
	} catch {
		// the generator must never take the core experience down with it
	}
	try {
		initDossier({
			onFirstDossier: () => {
				const charm = store.awardSpecial(
					'stargazer',
					'Cosmically Documented',
					'Compiled a Birthday Dossier. The stars now have you on file. (Your device does. The stars know nothing.)',
					'🔭'
				);
				// through the kit, not celebrateCharms directly: the dossier can be
				// compiled before the scene exists (or after it failed to), and the
				// full ceremony needs particles that may never have been built
				if (charm) kit.celebrate([charm]);
			}
		});
	} catch {
		// same rule: the dossier never takes the machine down with it
	}

	// wait for Roboto Slab so the canvas-painted button label uses it
	try {
		await Promise.race([
			Promise.all([
				document.fonts.load("700 100px 'Roboto Slab'"),
				document.fonts.load("400 16px 'Roboto Slab'")
			]),
			new Promise((r) => setTimeout(r, 2500))
		]);
	} catch { /* fall back to serif */ }

	// ---- build procedural textures (yield between the heavy ones)
	const quilt = createQuiltTextures(512);
	await nextFrame();
	const face = createMachineFaceTextures(2048);
	await nextFrame();
	const button = createButtonTextures(1024);
	const sky = createSkyTexture(1024);
	await nextFrame();
	const cloudSprite = createCloudSprite(256);
	const textures: TextureBundle = { quilt, face, button, sky, cloudSprite };
	const sprites = createParticleSprites();
	const glyphTextures = [createGlyphRingTexture(1024, 3), createGlyphRingTexture(1024, 7), createGlyphRingTexture(1024, 13)];

	// ---- scene
	const canvas = document.getElementById('lucky-canvas') as HTMLCanvasElement;
	const scene = new LuckyScene(canvas);
	const machine = new Machine(scene.scene, textures, sprites);
	const particles = new Particles(scene.scene);
	const lightning = new Lightning(scene.scene);

	scene.addUpdatable((dt, t) => {
		machine.update(dt, t);
		particles.update(dt);
		lightning.update(dt);
		// slow travelling highlight: reflections glide across the metalwork
		scene.keyLight.position.x = 2.5 + Math.sin(t * 0.11) * 2.2;
		scene.keyLight.position.y = 3.5 + Math.cos(t * 0.07) * 1.1;
	});
	const syncParticleScale = () => particles.setScale(canvas.clientHeight || innerHeight);
	window.addEventListener('resize', syncParticleScale);

	const ctx: EffectContext = { scene, machine, particles, lightning, sprites, glyphTextures, textures, audio, haptics };
	kit.celebrate = celebrateCharms; // the scene is up: charms get the full ceremony from here on
	const director = new Director(ctx);
	// effects hold full frame rate for their whole run, including the delay()
	// gaps between tweens where particles are still flying
	scene.busyCheck = () => director.running;

	// the drifting glow blobs behind #content are 80px-blurred and huge — pause
	// their animations while the section is off-screen so the compositor stays
	// quiet when the hero fills the viewport
	const content = document.getElementById('content');
	if (content && 'IntersectionObserver' in window) {
		new IntersectionObserver(([entry]) => {
			content.classList.toggle('in-view', entry.isIntersecting);
		}).observe(content);
	}

	// debug hooks: ?fx=powerSurge forces an effect
	const params = new URLSearchParams(location.search);
	if (params.get('fx')) director.forced = params.get('fx');
	// dev-only: exporting THREE here would pin the whole namespace into the bundle
	if (import.meta.env.DEV) {
		window.__mml = { scene, machine, director, particles, lightning, store, ctx, wakeLock, THREE };
	}

	scene.start();
	syncParticleScale();
	await nextFrame();
	await nextFrame();

	// ---- reveal
	const loading = document.getElementById('loading');
	loading?.classList.add('done');
	// remove it once faded — a merely-transparent overlay keeps its spinner
	// animation (and a compositor layer) alive forever
	setTimeout(() => loading?.remove(), 1000);
	// boot's done with the bandwidth — but a muted visitor is not spending
	// 900KB on a sprite they have told us they don't want to hear. Unmuting
	// warms it instead.
	if (store.data.soundOn) audio.warm();
	director.prefetchNext(); // and the first effect's code, soundtrack and set
	track('page_loaded', { visits: store.data.visits, luckyness: store.data.luckyness });
	screen.welcome(store.data.visits > 1, store.data.streak);

	// visit/streak charms awarded during store construction used to appear
	// silently in the drawer — give them their ceremony once the scene is up
	const pendingCharms = store.newlyAwarded.splice(0);
	if (pendingCharms.length) setTimeout(() => celebrateCharms(pendingCharms), 1800);

	// ---- button wiring
	const pressTarget = document.getElementById('press-target')!;

	// Portrait phones get a bigger button (Machine.fitAspect), and the
	// invisible hit area is pinned over the drawn one. A fixed CSS spot
	// drifted off it wherever the camera fits the machine to the screen's
	// width, leaving the top of the button dead on phones.
	const fitButton = () => {
		machine.fitAspect(scene.camera.aspect);
		const { centre, radius } = machine.buttonRestRim();
		const c = scene.projectAtRest(centre);
		const edge = scene.projectAtRest(centre.clone().setX(radius));
		const diameter = (edge.x - c.x) * 2 * 1.2; // a little grace past the rim
		pressTarget.style.setProperty('--btn-x', `${c.x.toFixed(1)}px`);
		pressTarget.style.setProperty('--btn-y', `${c.y.toFixed(1)}px`);
		pressTarget.style.setProperty('--btn-d', `${diameter.toFixed(1)}px`);
	};
	window.addEventListener('resize', fitButton); // after the scene's own resize
	fitButton();

	// The one true charm celebration: sound, toast, grid entry, analytics,
	// sparkle, progress. Every award path routes through here.
	function celebrateCharms(awarded: Charm[]): void {
		for (const charm of awarded) {
			audio.play('charmAward');
			charmsUI.showToast(charm);
			charmsUI.addCharm(charm);
			track('charm_awarded', { charm: charm.id });
			particles.burst({
				texture: sprites.star4,
				count: 30,
				origin: new THREE.Vector3(0, 0.9, 0.5),
				speed: [0.5, 2],
				life: [0.6, 1.4],
				size: [0.03, 0.08],
				colors: [0xfff3cf, 0xffd27a]
			});
		}
		// (addCharm refreshes the progress line itself; the press counter is
		// refreshed on every press, award or not, in completePress)
	}

	// The Daily Luck Ritual: the first press of each calendar day gets a
	// date-stamped announcement and a fortune instead of the usual quip.
	// Deterministic per day — the cosmos does not reroll for refreshes.
	const FORTUNES: readonly (readonly [string, string])[] = [
		['FORTUNE FAVOURS', 'THE BOLD PRESS'],
		['LUCK LEVEL:', 'SUSPICIOUS'],
		['GOOD OMENS', 'DETECTED'],
		['THE OWLS NOD', 'APPROVINGLY'],
		['TODAY: YES.', 'DEFINITELY YES.'],
		['A FOUND-PENNY', 'KIND OF DAY'],
		['GREEN LIGHTS', 'ALL THE WAY'],
		['THE UNIVERSE', 'OWES YOU ONE'],
		['SEVENS ARE', 'FOLLOWING YOU'],
		['YOUR STARS ARE', 'SHOWING OFF'],
		['KISMET SAYS', 'HI'],
		['LUCK FORECAST:', 'BLINDING'],
		['TODAY BENDS', 'YOUR WAY'],
		['DESTINY LEFT', 'THE DOOR OPEN']
	];
	// dayIndex() is the LOCAL calendar day, so the fortune turns over at the
	// visitor's own midnight — the one the machine promises — and not at UTC's.
	const todaysFortune = () => FORTUNES[dayIndex() % FORTUNES.length];

	// effect_played carries seq + prev so exit analysis is free: the number of
	// sessions whose LAST effect was E = plays(E) minus events where prev = E.
	// PostHog bills per event, not per property, so this costs nothing extra.
	let effectSeq = 0;
	let prevEffect: string | null = null;

	// Every performance goes through here, whichever way it was summoned: the
	// screen is held awake for the whole run (a phone's idle timer would dim it
	// mid-finale — the last touch was the press, half a minute ago) and released
	// a few seconds after, once the parting quip has been read.
	async function performEffect(via: Record<string, unknown>): Promise<string | null> {
		wakeLock.hold();
		let fx: string | null = null;
		try {
			fx = await director.play();
		} finally {
			wakeLock.release(4000);
		}
		effectSeq += 1;
		track('effect_played', { effect: fx, ...via, seq: effectSeq, prev: prevEffect });
		prevEffect = fx;
		return fx;
	}

	// Runs inside the press controller's busy window: from the moment the press
	// is accepted until this settles, no other press, key or console summons
	// gets in — including during the ritual's 1.3-second announcement, when the
	// director is not yet "running" and a second press used to slip through.
	async function completePress(holdSeconds: number): Promise<void> {
		if (director.running) return;
		const isRitual = store.ritualAvailable();
		if (isRitual) store.registerRitual();
		const awarded = [...store.registerPress(), ...store.registerHold(holdSeconds)];
		// the visible counter belongs to the press, not to the charm ceremony:
		// it used to sit inside celebrateCharms and only moved on milestones
		charmsUI.updateProgress();
		track('button_pressed', { count: store.data.luckyness, ritual: isRitual });
		if (isRitual) {
			const stamp = new Date()
				.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
				.toUpperCase();
			screen.sequence([["TODAY'S LUCK", stamp]]);
			await new Promise((r) => setTimeout(r, 1300));
		}
		screen.blank();
		const fx = await performEffect({ ritual: isRitual });
		celebrateCharms(awarded);
		const quip = isRitual ? todaysFortune() : fx ? QUIPS[fx] : undefined;
		screen.youAreNowLucky(store.data.luckyness, awarded.length > 0, quip);
	}

	// Pointer, keyboard and the bare click assistive technology sends all go
	// through one door, which refuses a second press while the first is still
	// being served. The hold is measured for the eight-second Steady Hand charm.
	const press = new PressController({
		target: pressTarget,
		blocked: () => director.running,
		onDown: () => {
			charmsUI.hideToast(); // a new press clears the old celebration instantly
			void machine.pressDown();
			audio.play('button');
			haptics.vibrate(25);
		},
		onUp: () => machine.pressUp(),
		onComplete: (holdSeconds) => completePress(holdSeconds)
	});

	// party trick: run any effect from the console without waiting for the
	// shuffle bag. Curiosity is its own kind of luck — it earns a charm.
	window.showEffect = async (name?: string): Promise<string> => {
		if (press.busy || director.running) return 'An effect is already running. Patience is lucky too.';
		// gentleGlow isn't in the bag (it's the reduced-motion stand-in) but it is
		// a real effect, so the console is allowed to ask for it by name
		const summonable = [...director.names, 'gentleGlow'];
		if (!name) {
			printEffectList(summonable);
			return "Pick one: showEffect('rainbow') 🍀";
		}
		if (!summonable.includes(name)) {
			printEffectList(summonable);
			return `No effect called "${name}". The full cast is listed above.`;
		}
		// Browsers keep the AudioContext suspended until a real user gesture, so
		// an effect summoned from the console before the first press runs silent
		// — and half of these are choreographed to a soundtrack. Muted visitors
		// aren't missing anything, so they get to skip the ceremony.
		if (!audio.muted && !audio.unlocked) {
			return 'Press the big red button once first — the browser keeps the sound locked until you do, and these effects are scored. Then call showEffect() again. 🔇';
		}
		const charm = store.awardSpecial(
			'consoleWizard',
			'Behind the curtain',
			'Summoned an effect from the developer console. Curiosity is its own kind of luck.',
			'🧙'
		);
		if (charm) celebrateCharms([charm]);
		// the console borrows the same busy window as the button, so a summoned
		// effect and a pressed one can never share the stage
		const played = await press.run(async () => {
			screen.blank();
			// remember any ?fx= override rather than clobbering it
			const wasForced = director.forced;
			director.forced = name;
			try {
				return { fx: await performEffect({ via: 'console' }) };
			} finally {
				director.forced = wasForced;
			}
		});
		if (!played) return 'An effect is already running. Patience is lucky too.';
		const fx = played.fx;
		screen.youAreNowLucky(store.data.luckyness, false, fx ? QUIPS[fx] : undefined);
		// reduced motion substitutes something from the calm shortlist
		return fx === name ? `Played ${fx} 🍀` : `Played ${fx} instead — you've asked for reduced motion. 🍀`;
	};
	printConsoleBanner([...director.names, 'gentleGlow']);

	// ---- mute
	const muteBtn = document.getElementById('mute-button')!;
	const setMuteUI = () => {
		muteBtn.classList.toggle('muted', !store.data.soundOn);
		muteBtn.setAttribute('aria-pressed', String(!store.data.soundOn));
	};
	setMuteUI();
	muteBtn.addEventListener('click', () => {
		store.setSound(!store.data.soundOn);
		audio.setMuted(!store.data.soundOn);
		if (store.data.soundOn) audio.warm(); // sound is wanted now — go and get it
		setMuteUI();
		track('sound_toggled', { on: store.data.soundOn });
	});

	// ---- share the luck
	const shareBtn = document.getElementById('share-button');
	shareBtn?.addEventListener('click', async () => {
		const shareData = {
			title: 'Make Me Lucky',
			text: 'Feeling unlucky? Press the button. It genuinely might help.',
			url: 'https://www.makemelucky.com/'
		};
		let shared = false;
		try {
			if (navigator.share) {
				await navigator.share(shareData);
				shared = true;
			} else {
				await navigator.clipboard.writeText(shareData.url);
				shareBtn.textContent = '🍀 Link copied. Luck attached!';
				shared = true;
			}
		} catch { /* user cancelled the share sheet */ }
		if (shared) {
			track('shared');
			celebrateCharms(store.registerShare());
		}
	});

	// ---- PWA
	if (import.meta.env.PROD) {
		try {
			const { registerSW } = await import('virtual:pwa-register');
			registerSW({ immediate: true });
		} catch { /* SW optional */ }
	}
	window.addEventListener('appinstalled', () => {
		celebrateCharms(store.registerInstall());
		track('pwa_installed');
	});
}

/** The machine could not be built — no WebGL, a refused context, anything at
 *  all. The old behaviour was to leave "Charging the Luck Machine…" pinned over
 *  the whole viewport for ever, hiding the writing, the charms, the lottery
 *  picker and the dossier along with the machine. So: own up in character, get
 *  the overlay out of the way, and keep the button pressable. A press still
 *  counts, still earns charms, and still says something nice. Luck was never
 *  made of polygons; the 2016 machine is one link away for anyone who wants
 *  the full contraption. */
function bootFallback(err: unknown): void {
	const reason = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
	try {
		track('boot_failed', { reason: reason.slice(0, 200) });
	} catch { /* analytics never gets to block the rescue */ }

	// 1. the overlay goes immediately — it is fixed over everything
	document.getElementById('loading')?.remove();
	document.getElementById('hero')?.classList.add('machine-down');
	kit.celebrate = plainCelebrate; // no particles to burst, whatever boot managed

	// 2. salvage whatever boot didn't reach
	if (!kit.store) {
		try {
			kit.store = new LuckStore();
		} catch { /* storage blocked too; presses simply won't be remembered */ }
	}
	if (kit.store && !kit.charmsUI) {
		try {
			kit.charmsUI = new CharmsUI(kit.store);
			kit.charmsUI.renderAll();
		} catch {
			kit.charmsUI = undefined;
		}
	}
	// the message screen is plain DOM, so it survives a dead renderer
	if (!kit.screen && document.getElementById('screen-text') && document.getElementById('screen-panel')) {
		try {
			kit.screen = new ScreenPanel();
		} catch { /* then the note below does the talking */ }
	}
	const { store, charmsUI, screen } = kit;

	// 3. the apology, in the machine's own voice
	const hero = document.getElementById('hero');
	const note = document.createElement('div');
	note.id = 'boot-fallback';
	const apology = document.createElement('p');
	apology.textContent =
		'The 3D machine would not start on this device — no WebGL, or it took one look at us and kept the shutters down. ' +
		'The button still works. Luck was never made of polygons.';
	const quip = document.createElement('p');
	quip.className = 'fallback-quip';
	quip.setAttribute('role', 'status');
	const link = document.createElement('a');
	link.href = '/v2/';
	link.rel = 'nofollow';
	link.textContent = 'Or press the classic 2016 machine →';
	const linkLine = document.createElement('p');
	linkLine.appendChild(link);
	note.append(apology, quip, linkLine);
	hero?.appendChild(note);

	// 4. the button, as a plain button. A fresh node drops any listeners boot
	//    managed to attach before it fell over.
	const old = document.getElementById('press-target');
	if (!old) return;
	const pressTarget = old.cloneNode(true) as HTMLElement;
	const label = document.createElement('span');
	label.className = 'fallback-label';
	label.setAttribute('aria-hidden', 'true');
	label.textContent = 'MAKE ME LUCKY';
	pressTarget.appendChild(label);
	old.replaceWith(pressTarget);

	// 5. the mute button. Boot wires it only after the scene exists, so here it
	//    is a live control with no handler — wire it to the stored preference
	//    (a fresh node, in case boot got that far before falling over). Sound
	//    itself stays off: there is no machine to score.
	const oldMute = document.getElementById('mute-button');
	if (oldMute && store) {
		const muteBtn = oldMute.cloneNode(true) as HTMLElement;
		oldMute.replaceWith(muteBtn);
		const setMuteUI = () => {
			muteBtn.classList.toggle('muted', !store.data.soundOn);
			muteBtn.setAttribute('aria-pressed', String(!store.data.soundOn));
		};
		setMuteUI();
		muteBtn.addEventListener('click', () => {
			store.setSound(!store.data.soundOn);
			setMuteUI();
			track('sound_toggled', { on: store.data.soundOn, fallback: true });
		});
	} else {
		oldMute?.setAttribute('disabled', '');
	}

	const say = (presses: number, awarded: boolean): void => {
		if (screen) screen.youAreNowLucky(presses, awarded);
		else quip.textContent = `You are now lucky. That is ${presses.toLocaleString()} presses of good fortune.`;
	};

	new PressController({
		target: pressTarget,
		onDown: () => charmsUI?.hideToast(),
		onUp: () => { /* no 3D button to let back up */ },
		onComplete: (holdSeconds) => {
			if (!store) {
				if (screen) screen.youAreNowLucky(1, false);
				else quip.textContent = 'You are now lucky. (Nothing can be saved on this device, but the luck still counts.)';
				return;
			}
			const awarded = [...store.registerPress(), ...store.registerHold(holdSeconds)];
			plainCelebrate(awarded);
			track('button_pressed', { count: store.data.luckyness, fallback: true });
			say(store.data.luckyness, awarded.length > 0);
		}
	});
}

boot().catch(bootFallback);
