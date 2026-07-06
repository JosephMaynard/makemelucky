import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironmentScene } from '../gfx/environment.js';
import { updateTweens } from './anim.js';

export class LuckyScene {
	constructor(canvas) {
		this.canvas = canvas;
		this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

		this.renderer = new THREE.WebGLRenderer({
			canvas,
			antialias: true,
			powerPreference: 'high-performance',
			stencil: false
		});
		this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		this.renderer.toneMappingExposure = 1.12;

		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x0b1c0c);

		// Camera rig: rig moves/parallaxes, shaker jitters, camera dollies.
		this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
		this.shaker = new THREE.Group();
		this.rig = new THREE.Group();
		this.shaker.add(this.camera);
		this.rig.add(this.shaker);
		this.rig.position.set(0, 0, 5.35);
		this.scene.add(this.rig);

		// Environment reflections — procedural Art Deco lounge, no HDRI needed
		const pmrem = new THREE.PMREMGenerator(this.renderer);
		this.scene.environment = pmrem.fromScene(createEnvironmentScene(), 0.03).texture;
		this.scene.environmentIntensity = 1.35;
		pmrem.dispose();

		// Lights
		this.keyLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
		this.keyLight.position.set(2.5, 3.5, 4);
		this.fillLight = new THREE.DirectionalLight(0xb8d8ff, 0.55);
		this.fillLight.position.set(-3, -1, 3);
		// A roaming point light effects can grab for drama
		this.fxLight = new THREE.PointLight(0xffffff, 0, 18, 2);
		this.fxLight.position.set(0, 0, 1.4);
		this.scene.add(this.keyLight, this.fillLight, this.fxLight);

		// Post-processing
		this.composer = new EffectComposer(this.renderer);
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.8, 0.88);
		this.outputPass = new OutputPass();
		this.composer.addPass(this.renderPass);
		this.composer.addPass(this.bloomPass);
		this.composer.addPass(this.outputPass);

		// Parallax input
		this.parallaxTarget = new THREE.Vector2();
		this.parallax = new THREE.Vector2();
		this.parallaxStrength = 1;
		window.addEventListener('pointermove', (e) => {
			this.parallaxTarget.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
		});
		window.addEventListener(
			'deviceorientation',
			(e) => {
				if (e.beta == null || e.gamma == null) return;
				this.parallaxTarget.set(
					Math.max(-1, Math.min(1, e.gamma / 28)),
					Math.max(-1, Math.min(1, (e.beta - 42) / 28))
				);
			},
			true
		);

		// Shake (trauma-based) + effect-driven camera roll
		this.trauma = 0;
		this.cameraRoll = 0;

		// Quality management
		this.qualityDPR = Math.min(window.devicePixelRatio || 1, 2);
		this._fpsSamples = [];
		this._lastQualityCheck = performance.now();

		this.updatables = new Set();
		this.clock = new THREE.Clock();
		this.elapsed = 0;

		this._onResize = () => this.resize();
		window.addEventListener('resize', this._onResize);
		this.resize();
	}

	resize() {
		const w = this.canvas.clientWidth || innerWidth;
		const h = this.canvas.clientHeight || innerHeight;
		this.camera.aspect = w / h;
		// keep the machine framed on narrow screens: widen FOV in portrait
		this.camera.fov = w < h ? 50 : 40;
		this.camera.updateProjectionMatrix();
		this.renderer.setPixelRatio(this.qualityDPR);
		this.renderer.setSize(w, h, false);
		this.composer.setPixelRatio(this.qualityDPR);
		this.composer.setSize(w, h);
	}

	addUpdatable(fn) {
		this.updatables.add(fn);
		return () => this.updatables.delete(fn);
	}

	/** 0..1 — adds decaying camera shake, capped. */
	shake(amount) {
		if (this.reducedMotion) return;
		this.trauma = Math.min(1, this.trauma + amount);
	}

	start() {
		this.renderer.setAnimationLoop(() => this.tick());
	}

	tick() {
		const dt = Math.min(this.clock.getDelta(), 0.066);
		this.elapsed += dt;
		const now = performance.now();

		updateTweens(now);

		// parallax easing
		const pStrength = this.reducedMotion ? 0.15 : this.parallaxStrength;
		this.parallax.lerp(this.parallaxTarget, 1 - Math.pow(0.001, dt));
		this.rig.position.x = this.parallax.x * 0.22 * pStrength;
		this.rig.position.y = -this.parallax.y * 0.16 * pStrength;
		this.camera.lookAt(0, -0.15, 0);
		if (this.cameraRoll) this.camera.rotateZ(this.cameraRoll);

		// camera shake
		if (this.trauma > 0) {
			this.trauma = Math.max(0, this.trauma - dt * 1.6);
			const s = this.trauma * this.trauma;
			this.shaker.position.set(
				(Math.random() - 0.5) * 0.12 * s,
				(Math.random() - 0.5) * 0.12 * s,
				0
			);
			this.shaker.rotation.z = (Math.random() - 0.5) * 0.02 * s;
		} else {
			this.shaker.position.set(0, 0, 0);
			this.shaker.rotation.z = 0;
		}

		for (const fn of this.updatables) fn(dt, this.elapsed);

		this.composer.render();
		this._monitorQuality(dt, now);
	}

	_monitorQuality(dt, now) {
		this._fpsSamples.push(dt);
		if (now - this._lastQualityCheck < 3000) return;
		this._lastQualityCheck = now;
		const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
		this._fpsSamples.length = 0;
		const fps = 1 / avg;
		if (fps < 42 && this.qualityDPR > 1) {
			this.qualityDPR = Math.max(1, this.qualityDPR - 0.5);
			this.resize();
		} else if (fps < 30 && this.qualityDPR <= 1 && this.bloomPass.enabled) {
			// last resort: drop bloom
			this.bloomPass.enabled = false;
		}
	}
}
