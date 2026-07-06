import './styles/main.css';
import * as THREE from 'three';
import { LuckyScene } from './core/scene.js';
import { Machine } from './machine/machine.js';
import { Particles } from './gfx/particles.js';
import { Lightning } from './gfx/lightning.js';
import {
	createQuiltTextures,
	createMachineFaceTextures,
	createButtonTextures,
	createGlyphRingTexture,
	createParticleSprites,
	createSkyTexture,
	createCloudSprite
} from './gfx/textures.js';
import { Director } from './effects/director.js';
import { ScreenPanel } from './ui/screenPanel.js';
import { CharmsUI } from './ui/charmsUI.js';
import { LuckStore } from './luck/store.js';
import { AudioService } from './services/audio.js';
import { Haptics } from './services/haptics.js';
import { initAnalytics, track } from './services/analytics.js';

// rAF with a timeout fallback (headless/background tabs may not paint)
const nextFrame = () =>
	new Promise((r) => {
		requestAnimationFrame(() => r());
		setTimeout(r, 120);
	});

async function boot() {
	initAnalytics();

	const store = new LuckStore();
	const audio = new AudioService();
	const haptics = new Haptics();
	audio.setMuted(!store.data.soundOn);
	haptics.enabled = store.data.vibrationOn !== false;

	const screen = new ScreenPanel();
	const charmsUI = new CharmsUI(store);
	charmsUI.renderAll();

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
	const textures = {};
	textures.quilt = createQuiltTextures(512);
	await nextFrame();
	textures.face = createMachineFaceTextures(2048);
	await nextFrame();
	textures.button = createButtonTextures(1024);
	textures.sky = createSkyTexture(1024);
	await nextFrame();
	textures.cloudSprite = createCloudSprite(256);
	const sprites = createParticleSprites();
	const glyphTextures = [createGlyphRingTexture(1024, 3), createGlyphRingTexture(1024, 7), createGlyphRingTexture(1024, 13)];

	// ---- scene
	const canvas = document.getElementById('lucky-canvas');
	const scene = new LuckyScene(canvas);
	const machine = new Machine(scene.scene, textures, sprites);
	const particles = new Particles(scene.scene);
	const lightning = new Lightning(scene.scene);

	scene.addUpdatable((dt, t) => {
		machine.update(dt, t);
		particles.update(dt);
		lightning.update(dt);
		// slow travelling highlight — reflections glide across the metalwork
		scene.keyLight.position.x = 2.5 + Math.sin(t * 0.11) * 2.2;
		scene.keyLight.position.y = 3.5 + Math.cos(t * 0.07) * 1.1;
	});
	const syncParticleScale = () => particles.setScale(canvas.clientHeight || innerHeight);
	window.addEventListener('resize', syncParticleScale);

	const ctx = { scene, machine, particles, lightning, sprites, glyphTextures, textures, audio, haptics };
	const director = new Director(ctx);

	// debug hooks: ?fx=powerSurge forces an effect
	const params = new URLSearchParams(location.search);
	if (params.get('fx')) director.forced = params.get('fx');
	window.__mml = { scene, machine, director, particles, lightning, store, ctx, THREE };

	scene.start();
	syncParticleScale();
	await nextFrame();
	await nextFrame();

	// ---- reveal
	document.getElementById('loading').classList.add('done');
	track('page_loaded', { visits: store.data.visits, luckyness: store.data.luckyness });
	screen.welcome(store.data.visits > 1);

	// ---- button wiring
	const pressTarget = document.getElementById('press-target');
	let holdStart = 0;
	let pointerHeld = false;

	async function completePress(holdSeconds) {
		if (director.running) return;
		const awarded = [...store.registerPress(), ...store.registerHold(holdSeconds)];
		track('button_pressed', { count: store.data.luckyness });
		screen.blank();
		const fx = await director.play();
		track('effect_played', { effect: fx });
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
		charmsUI.updateProgress();
		screen.youAreNowLucky(store.data.luckyness, awarded.length > 0);
	}

	pressTarget.addEventListener('pointerdown', (e) => {
		if (director.running) return;
		e.preventDefault();
		pointerHeld = true;
		holdStart = performance.now();
		machine.pressDown();
		audio.play('button');
		haptics.vibrate(25);
	});
	const release = (e) => {
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
	// keyboard activation
	pressTarget.addEventListener('keydown', async (e) => {
		if ((e.key === 'Enter' || e.key === ' ') && !director.running && !e.repeat) {
			e.preventDefault();
			await machine.pressDown();
			audio.play('button');
			machine.pressUp();
			completePress(0.1);
		}
	});

	// ---- mute
	const muteBtn = document.getElementById('mute-button');
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
				shareBtn.textContent = '🍀 Link copied — luck attached!';
				shared = true;
			}
		} catch { /* user cancelled the share sheet */ }
		if (shared) {
			track('shared');
			for (const charm of store.registerShare()) {
				audio.play('charmAward');
				charmsUI.showToast(charm);
				charmsUI.addCharm(charm);
			}
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
		const awarded = store.registerInstall();
		for (const charm of awarded) {
			charmsUI.showToast(charm);
			charmsUI.addCharm(charm);
		}
		track('pwa_installed');
	});
}

boot();
