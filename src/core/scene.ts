import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { createEnvironmentScene, type EnvironmentName } from '../gfx/environment';
import { tween, updateTweens } from './anim';

// Final grade: gentle vignette + animated film grain over the tone-mapped
// image. uVignette is driven up by dimLights so dark effects feel graded
// rather than merely dim.
const FilmGradeShader = {
	uniforms: {
		tDiffuse: { value: null as THREE.Texture | null },
		uTime: { value: 0 },
		uVignette: { value: 0.22 },
		uGrain: { value: 0.045 }
	},
	vertexShader: /* glsl */ `
		varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}`,
	fragmentShader: /* glsl */ `
		uniform sampler2D tDiffuse;
		uniform float uTime;
		uniform float uVignette;
		uniform float uGrain;
		varying vec2 vUv;
		float hash(vec2 p) {
			return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
		}
		void main() {
			vec4 c = texture2D(tDiffuse, vUv);
			vec2 p = vUv - 0.5;
			float fall = 1.0 - uVignette * smoothstep(0.35, 1.0, length(p) * 1.55);
			float grain = (hash(vUv * (137.0 + mod(uTime, 61.0))) - 0.5) * uGrain;
			// grain fades in the highlights so it reads as film, not dirt
			float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
			gl_FragColor = vec4(c.rgb * fall + grain * (1.0 - lum * 0.75), c.a);
		}`
};

export class LuckyScene {
	canvas: HTMLCanvasElement;
	reducedMotion: boolean;
	renderer: THREE.WebGLRenderer;
	scene: THREE.Scene;
	camera: THREE.PerspectiveCamera;
	shaker: THREE.Group;
	rig: THREE.Group;
	keyLight: THREE.DirectionalLight;
	fillLight: THREE.DirectionalLight;
	fxLight: THREE.PointLight;
	rimLight: THREE.DirectionalLight;
	composer: EffectComposer;
	renderPass: RenderPass;
	bloomPass: UnrealBloomPass;
	outputPass: OutputPass;
	filmPass: ShaderPass;
	baseVignette: number;
	parallaxTarget: THREE.Vector2;
	parallax: THREE.Vector2;
	parallaxStrength: number;
	trauma: number;
	cameraRoll: number;
	qualityDPR: number;
	_baseDPR: number;
	_goodStreak: number;
	_fpsSamples: number[];
	_lastQualityCheck: number;
	_pmrem: THREE.PMREMGenerator;
	_envCache: Partial<Record<EnvironmentName, THREE.Texture>>;
	environmentName: EnvironmentName;
	updatables: Set<(dt: number, t: number) => void>;
	clock: THREE.Clock;
	elapsed: number;
	_onResize: () => void;

	constructor(canvas: HTMLCanvasElement) {
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

		// Environment reflections — procedural Art Deco lounge, no HDRI needed.
		// The generator stays alive so effects can bake alternate moods on demand.
		this._pmrem = new THREE.PMREMGenerator(this.renderer);
		this._envCache = {};
		this.environmentName = 'lounge';
		this.scene.environment = this.envTexture('lounge');
		this.scene.environmentIntensity = 1.35;

		// Lights
		this.keyLight = new THREE.DirectionalLight(0xfff4e0, 2.0);
		this.keyLight.position.set(2.5, 3.5, 4);
		this.fillLight = new THREE.DirectionalLight(0xb8d8ff, 0.55);
		this.fillLight.position.set(-3, -1, 3);
		// A roaming point light effects can grab for drama
		this.fxLight = new THREE.PointLight(0xffffff, 0, 18, 2);
		this.fxLight.position.set(0, 0, 1.4);
		// Backlight that fades up as dimLights fades down, keeping the machine's
		// silhouette readable during dark effects (driven from helpers.dimLights)
		this.rimLight = new THREE.DirectionalLight(0xffe6c0, 0);
		this.rimLight.position.set(-0.6, 2.2, -3.2);
		this.scene.add(this.keyLight, this.fillLight, this.fxLight, this.rimLight);

		// Post-processing
		this.composer = new EffectComposer(this.renderer);
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.8, 0.88);
		this.outputPass = new OutputPass();
		this.filmPass = new ShaderPass(FilmGradeShader);
		this.baseVignette = 0.22;
		this.composer.addPass(this.renderPass);
		this.composer.addPass(this.bloomPass);
		this.composer.addPass(this.outputPass);
		this.composer.addPass(this.filmPass); // grade the final tone-mapped image

		// Context loss: prevent default so the browser will restore us, then
		// rebuild sizes on restoration. Without this a GPU hiccup = black canvas.
		canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
		canvas.addEventListener('webglcontextrestored', () => {
			this.clock.getDelta(); // swallow the huge dead-time delta
			this.resize();
		});

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
		this._baseDPR = this.qualityDPR;
		this._goodStreak = 0;
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
		// fit the machine's width on any screen: solve the vertical FOV from a
		// fixed horizontal half-width (machine radius + margin) at camera depth
		const halfWidth = 1.5; // world units the frame must span horizontally
		const dist = 5.35;
		const vFov = THREE.MathUtils.radToDeg(2 * Math.atan(halfWidth / dist / this.camera.aspect));
		this.camera.fov = THREE.MathUtils.clamp(vFov, 40, 68);
		this.camera.updateProjectionMatrix();
		this.renderer.setPixelRatio(this.qualityDPR);
		this.renderer.setSize(w, h, false);
		this.composer.setPixelRatio(this.qualityDPR);
		this.composer.setSize(w, h);
	}

	addUpdatable(fn: (dt: number, t: number) => void): () => void {
		this.updatables.add(fn);
		return () => this.updatables.delete(fn);
	}

	/** 0..1 — adds decaying camera shake, capped. */
	shake(amount: number) {
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
		} else if (!this.reducedMotion) {
			// idle life: the camera breathes — a slow dolly bob so stills feel alive
			const t = this.elapsed;
			this.shaker.position.set(
				Math.sin(t * 0.31) * 0.012,
				Math.sin(t * 0.23 + 1.7) * 0.009,
				Math.sin(t * 0.17 + 0.6) * 0.028
			);
			this.shaker.rotation.z = Math.sin(t * 0.13 + 3.1) * 0.0015;
		} else {
			this.shaker.position.set(0, 0, 0);
			this.shaker.rotation.z = 0;
		}

		for (const fn of this.updatables) fn(dt, this.elapsed);

		(this.filmPass.uniforms as typeof FilmGradeShader.uniforms).uTime.value = this.elapsed;
		this.composer.render();
		this._monitorQuality(dt, now);
	}

	/** Lazily bake (and cache) a PMREM environment for the named palette. */
	envTexture(name: EnvironmentName): THREE.Texture {
		let tex = this._envCache[name];
		if (!tex) {
			tex = this._pmrem.fromScene(createEnvironmentScene(name), 0.03).texture;
			this._envCache[name] = tex;
		}
		return tex;
	}

	/** Swap the reflection environment with an intensity dip so it reads as a
	 *  lighting change, not a pop. Effects should restore 'lounge' on teardown. */
	async crossfadeEnvironment(name: EnvironmentName, duration = 700): Promise<void> {
		if (name === this.environmentName) return;
		const tex = this.envTexture(name); // bake before the dip so the swap is instant
		const from = this.scene.environmentIntensity;
		await tween(duration * 0.4, 'inOutQuad', (v) => {
			this.scene.environmentIntensity = from * (1 - v * 0.85);
		});
		this.scene.environment = tex;
		this.environmentName = name;
		await tween(duration * 0.6, 'inOutQuad', (v) => {
			this.scene.environmentIntensity = from * (0.15 + v * 0.85);
		});
	}

	/** Vignette strength, from the base grade (0) to full dark-effect grade (1). */
	setVignetteBoost(boost: number): void {
		(this.filmPass.uniforms as typeof FilmGradeShader.uniforms).uVignette.value =
			this.baseVignette + boost * 0.24;
	}

	_monitorQuality(dt: number, now: number) {
		this._fpsSamples.push(dt);
		if (now - this._lastQualityCheck < 3000) return;
		this._lastQualityCheck = now;
		const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
		this._fpsSamples.length = 0;
		const fps = 1 / avg;
		if (fps < 42 && this.qualityDPR > 1) {
			this._goodStreak = 0;
			this.qualityDPR = Math.max(1, this.qualityDPR - 0.5);
			this.resize();
		} else if (fps < 30 && this.qualityDPR <= 1 && this.bloomPass.enabled) {
			// last resort: drop bloom
			this._goodStreak = 0;
			this.bloomPass.enabled = false;
		} else if (fps > 55) {
			// recovery: a transient stutter (boot jank, a busy tab) must not
			// pin us at low quality forever. Two comfortable windows in a row
			// buys back one step, bloom first, then resolution.
			this._goodStreak += 1;
			if (this._goodStreak >= 2) {
				this._goodStreak = 0;
				if (!this.bloomPass.enabled) {
					this.bloomPass.enabled = true;
				} else if (this.qualityDPR < this._baseDPR) {
					this.qualityDPR = Math.min(this._baseDPR, this.qualityDPR + 0.5);
					this.resize();
				}
			}
		} else {
			this._goodStreak = 0;
		}
	}
}
