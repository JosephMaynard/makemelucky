import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createEnvironmentScene, type EnvironmentName } from '../gfx/environment';
import { tween, tweensActive, updateTweens } from './anim';

// Effects hold "full" frame rate — but full means this, not the display's
// native rate. A 120Hz phone or ProMotion laptop rendering bloom at 120fps
// is twice the GPU work of 60fps for no visible gain on this content, and
// it is the single biggest reason a device warms up during a long effect.
const EFFECT_FPS_CAP = 60;

// Geometry anti-aliasing. Every frame goes through the EffectComposer, whose
// buffers carry no multisampling, so until now the whole site rendered with
// NO edge anti-aliasing at all — every rim and clamp crawled. The samples go
// on the ONE buffer the scene is drawn into (see the constructor); everything
// after that is a full-screen quad, which has no edges to smooth. The
// quality governor drops this to 0 on a struggling GPU before it touches bloom.
const MSAA_SAMPLES = 4;

// The grade — gentle vignette + animated film grain — folded INTO the output
// pass: tone mapping, sRGB encoding and the grade in ONE full-screen pass
// instead of two. Every full-screen pass re-touches every pixel on the
// display, so on a phone this is a whole frame of fill-rate saved per frame,
// and the image is identical (the grade still runs on the encoded image,
// exactly as the separate pass did). uVignette is driven up by dimLights so
// dark effects feel graded rather than merely dim.
interface GradeUniforms {
	uTime: THREE.IUniform<number>;
	uVignette: THREE.IUniform<number>;
	uGrain: THREE.IUniform<number>;
	// the colour the vignette darkens towards — black reproduces the classic
	// grade exactly; effects may tint it (and must restore it)
	uVigTint: THREE.IUniform<THREE.Color>;
}

// OutputShader's fragment, verbatim, with the grade appended after the colour
// space conversion. (RawShaderMaterial, so precision + includes are explicit.)
const GRADED_OUTPUT_FRAG = /* glsl */ `
	precision highp float;

	uniform sampler2D tDiffuse;
	uniform float uTime;
	uniform float uVignette;
	uniform float uGrain;
	uniform vec3 uVigTint;

	#include <tonemapping_pars_fragment>
	#include <colorspace_pars_fragment>

	varying vec2 vUv;

	float hash(vec2 p) {
		return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
	}

	void main() {
		gl_FragColor = texture2D( tDiffuse, vUv );

		// tone mapping
		#ifdef LINEAR_TONE_MAPPING
			gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );
		#elif defined( REINHARD_TONE_MAPPING )
			gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );
		#elif defined( CINEON_TONE_MAPPING )
			gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );
		#elif defined( ACES_FILMIC_TONE_MAPPING )
			gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );
		#elif defined( AGX_TONE_MAPPING )
			gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );
		#elif defined( NEUTRAL_TONE_MAPPING )
			gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );
		#elif defined( CUSTOM_TONE_MAPPING )
			gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );
		#endif

		// color space
		#ifdef SRGB_TRANSFER
			gl_FragColor = sRGBTransferOETF( gl_FragColor );
		#endif

		// the grade, on the display-referred image
		vec2 p = vUv - 0.5;
		float fall = 1.0 - uVignette * smoothstep(0.35, 1.0, length(p) * 1.55);
		float grain = (hash(vUv * (137.0 + mod(uTime, 61.0))) - 0.5) * uGrain;
		// grain fades in the highlights so it reads as film, not dirt
		float lum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
		gl_FragColor.rgb = gl_FragColor.rgb * fall + uVigTint * (1.0 - fall) + grain * (1.0 - lum * 0.75);
	}`;

class GradedOutputPass extends OutputPass {
	declare uniforms: OutputPass['uniforms'] & GradeUniforms;

	constructor() {
		super();
		// the material was built around this.uniforms (same object), so adding
		// to it is adding to the material; OutputPass.render keeps managing the
		// tone-mapping defines and exposure exactly as before
		Object.assign(this.uniforms, {
			uTime: { value: 0 },
			uVignette: { value: 0.22 },
			uGrain: { value: 0.045 },
			uVigTint: { value: new THREE.Color(0x000000) }
		} satisfies GradeUniforms);
		this.material.fragmentShader = GRADED_OUTPUT_FRAG;
		this.material.needsUpdate = true;
		// this is always the last pass and always renders to screen, so the
		// buffer swap Pass requests by default would only shuffle which buffer
		// the NEXT frame's scene lands in — and only one of them is multisampled
		this.needsSwap = false;
	}
}

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
	/** The composer buffer the scene is rendered into — the multisampled one. */
	msaaTarget: THREE.WebGLRenderTarget;
	renderPass: RenderPass;
	bloomPass: UnrealBloomPass;
	/** Tone mapping + sRGB + the film grade, as one pass. */
	filmPass: GradedOutputPass;
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
	/** Extra full-rate demand the scene can't see itself (the director sets this). */
	busyCheck: (() => boolean) | null;
	_focused: boolean;
	_canvasVisible: boolean;
	_lastRender: number;
	/** Measured display refresh interval (ms) — tick() runs every rAF whether
	 *  or not it renders, so the gap between calls is the vsync cadence. */
	_vsync: number;
	_lastTick: number;
	_rafIndex: number;
	/** Whether the parallax target was last set by the pointer (worth chasing
	 *  at full rate) or by the gyro (which never settles — a phone in a hand
	 *  is always moving, and treating that as "busy" defeats the governor). */
	_parallaxByPointer: boolean;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		// live, not a one-off read: switching the OS setting used to need a
		// reload before the machine took any notice of it
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		this.reducedMotion = motionQuery.matches;
		motionQuery.addEventListener('change', (e) => {
			this.reducedMotion = e.matches;
			if (e.matches) this.trauma = 0; // drop any shake already in flight
		});

		this.renderer = new THREE.WebGLRenderer({
			canvas,
			// Everything renders through the EffectComposer's (non-MSAA) targets,
			// so canvas MSAA never touches visible geometry — it only multisamples
			// the final full-screen blit, a pure per-frame resolve cost.
			antialias: false,
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
		// RenderPass draws the scene into the composer's READ buffer (renderTarget2)
		// and none of our passes swaps, so that is the only buffer that needs
		// samples; renderTarget1 never even gets allocated. Multisampling both
		// would double a large half-float allocation and add a resolve per frame
		// for zero edges. tick() re-asserts the pairing so it can never drift.
		this.msaaTarget = this.composer.renderTarget2;
		this.msaaTarget.samples = Math.min(MSAA_SAMPLES, this.renderer.capabilities.maxSamples);
		// nothing reads the depth back, so don't pay to resolve it every frame
		this.msaaTarget.resolveDepthBuffer = false;
		this.renderPass = new RenderPass(this.scene, this.camera);
		this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.8, 0.88);
		this.filmPass = new GradedOutputPass();
		this.baseVignette = 0.22;
		this.composer.addPass(this.renderPass);
		this.composer.addPass(this.bloomPass);
		this.composer.addPass(this.filmPass); // tone map, encode and grade in one go

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
		this._parallaxByPointer = false;
		window.addEventListener('pointermove', (e) => {
			this._parallaxByPointer = true;
			this.parallaxTarget.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
		});
		window.addEventListener(
			'deviceorientation',
			(e) => {
				if (e.beta == null || e.gamma == null) return;
				this._parallaxByPointer = false;
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

		// Power governor inputs: full frame rate is reserved for moments that
		// earn it (effects, shake, tweens, parallax chasing the pointer). The
		// idle scene breathes slowly enough that 30fps is indistinguishable,
		// and on ProMotion displays that's a 4x cut in GPU work.
		this.busyCheck = null;
		this._focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
		this._canvasVisible = true;
		this._lastRender = 0;
		this._vsync = 1000 / 60;
		this._lastTick = 0;
		this._rafIndex = 0;
		window.addEventListener('focus', () => { this._focused = true; });
		window.addEventListener('blur', () => { this._focused = false; });
		if ('IntersectionObserver' in window) {
			new IntersectionObserver(
				([entry]) => {
					this._canvasVisible = entry.isIntersecting;
				},
				// the #content anchor scroll parks the canvas exactly edge-to-edge
				// with the viewport, which still counts as intersecting (ratio 0)
				// and fires no further events — shrink the root so it doesn't
				{ rootMargin: '-1px' }
			).observe(canvas);
		}

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
		const now = performance.now();
		this._rafIndex += 1;
		// learn the display's refresh cadence from the rAF spacing itself
		// (ignoring pauses — a hidden tab, a stalled main thread)
		const gap = now - this._lastTick;
		this._lastTick = now;
		if (gap > 0 && gap < 100) this._vsync += (gap - this._vsync) * 0.1;

		// ---- power governor: decide whether this rAF callback earns a frame.
		// Anything that visibly moves fast holds full rate (capped, see
		// EFFECT_FPS_CAP); the idle scene (slow camera breathe, light drift,
		// grain) renders at 30fps; blurred windows tick over gently; an
		// off-screen canvas renders nothing.
		const busy =
			this.trauma > 0 ||
			tweensActive() ||
			(this.busyCheck ? this.busyCheck() : false) ||
			(this._parallaxByPointer && this.parallax.distanceToSquared(this.parallaxTarget) > 4e-6);
		let interval: number; // ms between frames; 0 = full rate
		if (!this._canvasVisible) {
			// scrolled away: running choreography must keep advancing so its
			// promises resolve on time, but nothing needs drawing at idle
			interval = busy ? 1000 / 30 : Infinity;
		} else if (!this._focused) {
			interval = busy ? 1000 / 30 : 1000 / 12;
		} else {
			interval = busy ? 0 : 1000 / 30;
		}
		if (interval === 0) {
			// Full rate, capped by SKIPPING whole vsyncs rather than by a timer:
			// a timer at 16.7ms on a 120Hz display lands 60fps, but on a 90Hz
			// one it would land 45. Render every Nth refresh, N chosen so the
			// result stays at or above the cap where the display allows it
			// (120→60, 144→72, 90→90, 60→60).
			const every = Math.max(1, Math.floor(1000 / this._vsync / (EFFECT_FPS_CAP - 5)));
			if (every > 1 && this._rafIndex % every !== 0) return;
		} else if (now - this._lastRender < interval - 4) {
			// the 4ms grace stops a frame landing just under the bar and
			// stalling for a whole extra vsync
			return;
		}
		this._lastRender = now;

		const dt = Math.min(this.clock.getDelta(), 0.066);
		this.elapsed += dt;

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

		this.filmPass.uniforms.uTime.value = this.elapsed;
		if (this._canvasVisible) {
			// the scene must land in the multisampled buffer every frame
			this.composer.readBuffer = this.msaaTarget;
			this.composer.writeBuffer = this.composer.renderTarget1;
			this.composer.render();
		}
		if (interval === 0) {
			this._monitorQuality(dt, now);
		} else {
			// capped frames would read as "low fps" and wrongly degrade quality
			this._fpsSamples.length = 0;
			this._lastQualityCheck = now;
		}
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

	/** Change the scene buffer's sample count (0 = off). The framebuffer is
	 *  rebuilt on its next use, so this is safe to call between frames. */
	setMSAA(samples: number): void {
		const want = Math.min(samples, this.renderer.capabilities.maxSamples);
		if (this.msaaTarget.samples === want) return;
		this.msaaTarget.samples = want;
		this.msaaTarget.dispose();
	}

	/** Vignette strength, from the base grade (0) to full dark-effect grade (1). */
	setVignetteBoost(boost: number): void {
		this.filmPass.uniforms.uVignette.value = this.baseVignette + boost * 0.24;
	}

	/** Colour the vignette's edge falloff. Black (the default) is the classic
	 *  grade; effects that tint it must restore black on teardown. */
	setVignetteTint(color: THREE.ColorRepresentation): void {
		this.filmPass.uniforms.uVigTint.value.set(color);
	}

	_monitorQuality(dt: number, now: number) {
		this._fpsSamples.push(dt);
		if (now - this._lastQualityCheck < 3000) return;
		this._lastQualityCheck = now;
		const avg = this._fpsSamples.reduce((a, b) => a + b, 0) / this._fpsSamples.length;
		this._fpsSamples.length = 0;
		const fps = 1 / avg;
		// the ladder, walked down as the GPU struggles: resolution, then
		// multisampling, then (last resort) bloom — and back up in reverse
		if (fps < 42 && this.qualityDPR > 1) {
			this._goodStreak = 0;
			this.qualityDPR = Math.max(1, this.qualityDPR - 0.5);
			this.resize();
		} else if (fps < 42 && this.msaaTarget.samples > 0) {
			this._goodStreak = 0;
			this.setMSAA(0);
		} else if (fps < 30 && this.qualityDPR <= 1 && this.bloomPass.enabled) {
			// last resort: drop bloom
			this._goodStreak = 0;
			this.bloomPass.enabled = false;
		} else if (fps > 55) {
			// recovery: a transient stutter (boot jank, a busy tab) must not
			// pin us at low quality forever. Two comfortable windows in a row
			// buys back one step.
			this._goodStreak += 1;
			if (this._goodStreak >= 2) {
				this._goodStreak = 0;
				if (!this.bloomPass.enabled) {
					this.bloomPass.enabled = true;
				} else if (this.msaaTarget.samples < MSAA_SAMPLES) {
					this.setMSAA(MSAA_SAMPLES);
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
