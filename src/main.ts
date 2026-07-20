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
import { QUIPS } from './ui/quips';
import { LuckStore } from './luck/store';
import type { Charm } from './luck/charmsData';
import { initLottoPicker } from './luck/lottoPicker';
import { initDossier } from './luck/dossier';
import { AudioService } from './services/audio';
import { Haptics } from './services/haptics';
import { initAnalytics, track } from './services/analytics';
import type { EffectContext, TextureBundle } from './types';

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
	const audio = new AudioService();
	const haptics = new Haptics();
	audio.setMuted(!store.data.soundOn);
	haptics.enabled = store.data.vibrationOn !== false;

	const screen = new ScreenPanel();
	const charmsUI = new CharmsUI(store);
	charmsUI.renderAll();

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
				if (charm) celebrateCharms([charm]);
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
		window.__mml = { scene, machine, director, particles, lightning, store, ctx, THREE };
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
	audio.warm(); // boot's done with the bandwidth — fetch the sound sprite now
	track('page_loaded', { visits: store.data.visits, luckyness: store.data.luckyness });
	screen.welcome(store.data.visits > 1, store.data.streak);

	// visit/streak charms awarded during store construction used to appear
	// silently in the drawer — give them their ceremony once the scene is up
	const pendingCharms = store.newlyAwarded.splice(0);
	if (pendingCharms.length) setTimeout(() => celebrateCharms(pendingCharms), 1800);

	// ---- button wiring
	const pressTarget = document.getElementById('press-target')!;
	let holdStart = 0;
	let pointerHeld = false;

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
		if (awarded.length) charmsUI.updateProgress();
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
	const todaysFortune = () => FORTUNES[Math.floor(Date.now() / 86400000) % FORTUNES.length];

	async function completePress(holdSeconds: number): Promise<void> {
		if (director.running) return;
		const isRitual = store.ritualAvailable();
		if (isRitual) store.registerRitual();
		const awarded = [...store.registerPress(), ...store.registerHold(holdSeconds)];
		track('button_pressed', { count: store.data.luckyness, ritual: isRitual });
		if (isRitual) {
			const stamp = new Date()
				.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
				.toUpperCase();
			screen.sequence([["TODAY'S LUCK", stamp]]);
			await new Promise((r) => setTimeout(r, 1300));
		}
		screen.blank();
		const fx = await director.play();
		track('effect_played', { effect: fx, ritual: isRitual });
		celebrateCharms(awarded);
		const quip = isRitual ? todaysFortune() : fx ? QUIPS[fx] : undefined;
		screen.youAreNowLucky(store.data.luckyness, awarded.length > 0, quip);
	}

	// party trick: run any effect from the console without waiting for the
	// shuffle bag. Curiosity is its own kind of luck — it earns a charm.
	window.showEffect = async (name: string): Promise<string> => {
		if (director.running) return 'An effect is already running — patience is lucky too.';
		if (!name || !director.names.includes(name)) {
			return `Unknown effect. Try one of: ${director.names.join(', ')}`;
		}
		const charm = store.awardSpecial(
			'consoleWizard',
			'Behind the curtain',
			'Summoned an effect from the developer console. Curiosity is its own kind of luck.',
			'🧙'
		);
		if (charm) celebrateCharms([charm]);
		screen.blank();
		director.forced = name;
		const fx = await director.play();
		director.forced = null;
		track('effect_played', { effect: fx, via: 'console' });
		screen.youAreNowLucky(store.data.luckyness, false, fx ? QUIPS[fx] : undefined);
		return `Played ${fx} 🍀`;
	};

	pressTarget.addEventListener('pointerdown', (e) => {
		if (director.running) return;
		e.preventDefault();
		// without capture, dragging off before releasing strands the button down
		try { pressTarget.setPointerCapture(e.pointerId); } catch { /* stale pointer */ }
		charmsUI.hideToast(); // a new press clears the old celebration instantly
		pointerHeld = true;
		holdStart = performance.now();
		machine.pressDown();
		audio.play('button');
		haptics.vibrate(25);
	});
	const release = () => {
		if (!pointerHeld) return;
		pointerHeld = false;
		machine.pressUp();
		completePress((performance.now() - holdStart) / 1000);
	};
	pressTarget.addEventListener('pointerup', release);
	pressTarget.addEventListener('pointercancel', () => {
		if (!pointerHeld) return;
		pointerHeld = false;
		machine.pressUp();
	});
	// keyboard activation — mirrors the pointer path (toast clear + haptic)
	pressTarget.addEventListener('keydown', async (e) => {
		if ((e.key === 'Enter' || e.key === ' ') && !director.running && !e.repeat) {
			e.preventDefault();
			charmsUI.hideToast();
			await machine.pressDown();
			audio.play('button');
			haptics.vibrate(25);
			machine.pressUp();
			completePress(0.1);
		}
	});

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
		setMuteUI();
		track('sound_toggled', { on: store.data.soundOn });
	});

	// ---- share the luck
	const shareBtn = document.getElementById('share-button');
	shareBtn?.addEventListener('click', async () => {
		const shareData = {
			title: 'Make Me Lucky',
			text: 'Feeling unlucky? Press the button. It genuinely might help.',
			url: 'https://makemelucky.com/'
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

boot();
