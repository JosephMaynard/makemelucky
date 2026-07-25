// Effect — K-POP LUCK: the machine headlines its own arena stage. A neon
// pink-and-cyan laser grid boots up under the rap intro, a golden fortune
// dome of woven light draws itself closed around the machine through the
// build-up, and on the drop the whole venue goes off: a synchronized ocean
// of glowing lightsticks, sweeping lasers, confetti cannons, traditional
// buchaechum fans orbiting in formation, and the hangul 복 (bok — luck,
// fortune, blessing, the character stamped on Korean lucky pouches) blazing
// in gold above the stage. Everything pulses in time at 142bpm.
//
// Sound: /soundfx/kpop-luck.mp3 (21.9s, 142bpm). Rap 0–3.5s, riser 3.5–7.5s,
// chorus drops at 7.5s ("Lucky lucky light it up..."), finale to 21.9s.
// The choreography is beat-locked: BEAT and BAR below are the master clock.
//
// For the maker's daughter. Traditional Korean symbolism given the full
// Make Me Lucky treatment; an affectionate nod to a certain film's energy
// without borrowing anything that belongs to it.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim';
import { dimLights, flashPulse, shockwave, disposeObject } from './helpers';
import { luckyWord } from './luckyWord';
import type { EffectContext } from '../types';

export const sound = 'kpopLuck';
export const duration = 25400;

const BEAT = 60 / 142; // 0.4225s
const BAR = BEAT * 4;
const PINK = 0xff5fd0;
const CYAN = 0x40e8ff;
const GOLD = 0xffd27a;

// ---- neon stage backdrop: a synthwave floor grid rushing toward the crowd
// plus a glowing horizon. Rows scroll exactly one line per beat.
const GRID_FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uOpacity;
	uniform float uBeat;
	uniform vec3 uPink;
	uniform vec3 uCyan;
	varying vec2 vUv;
	void main() {
		float horizon = 0.42;
		vec3 col = vec3(0.0);
		if (vUv.y < horizon) {
			// perspective floor: divide by depth below the horizon
			float depth = horizon - vUv.y + 0.02;
			float px = (vUv.x - 0.5) / depth;
			float rows = abs(fract(0.12 / depth - uTime) - 0.5);
			float cols = abs(fract(px * 1.4) - 0.5);
			float line = smoothstep(0.06, 0.0, rows) + smoothstep(0.05, 0.0, cols);
			// lines fade with distance and swell on the beat
			col += mix(uPink, uCyan, clamp(px * 0.5 + 0.5, 0.0, 1.0))
				* line * (0.5 + 0.5 * uBeat) * smoothstep(0.0, 0.14, depth);
		}
		// horizon glow, brightest at the drop of every beat
		float h = smoothstep(0.1, 0.0, abs(vUv.y - horizon));
		col += mix(uCyan, uPink, vUv.x) * h * (0.5 + 0.45 * uBeat);
		gl_FragColor = vec4(col, uOpacity);
	}`;

// ---- the golden fortune dome: a woven lattice of light that draws itself
// closed from the stage floor upward, then shimmers in time with the song.
const DOME_FRAG = /* glsl */ `
	uniform float uTime;
	uniform float uReveal;
	uniform float uBeat;
	uniform float uOpacity;
	uniform vec3 uGold;
	varying vec2 vUv;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		// grow upward: vUv.y runs 1 (top) -> 0 (equator) on this hemisphere
		if (1.0 - vUv.y > uReveal) discard;
		// woven lattice: latitude bands + longitude ribs + a diagonal weave
		float lat = pow(abs(sin(vUv.y * 28.0)), 24.0);
		float lon = pow(abs(sin(vUv.x * 44.0 + sin(uTime * 0.4))), 30.0);
		float weave = pow(abs(sin((vUv.x * 30.0 + vUv.y * 22.0) + uTime * 0.25)), 40.0) * 0.6;
		float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.0);
		// the growing edge burns brighter
		float edge = smoothstep(0.06, 0.0, abs((1.0 - vUv.y) - uReveal + 0.02));
		float glow = (lat + lon + weave) * 0.5 + fresnel * (0.55 + 0.3 * uBeat) + edge * 1.4;
		gl_FragColor = vec4(uGold * glow * (0.75 + 0.25 * uBeat), glow * uOpacity);
	}`;

const DOME_VERT = /* glsl */ `
	varying vec2 vUv;
	varying vec3 vNormal;
	varying vec3 vView;
	void main() {
		vUv = uv;
		vNormal = normalMatrix * normal;
		vec4 mv = modelViewMatrix * vec4(position, 1.0);
		vView = -mv.xyz;
		gl_Position = projectionMatrix * mv;
	}`;

/** A buchaechum fan: pleated sector with a rosy gradient, gold rim and ribs,
 *  pivoted at the handle so it can flutter. */
function fanTexture() {
	const cv = document.createElement('canvas');
	cv.width = 256;
	cv.height = 256;
	const ctx = cv.getContext('2d')!;
	const grad = ctx.createRadialGradient(128, 240, 20, 128, 240, 220);
	grad.addColorStop(0, '#fff0f6');
	grad.addColorStop(0.45, '#ff9ad2');
	grad.addColorStop(0.85, '#f0489e');
	grad.addColorStop(1, '#d93288');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 256, 256);
	// ribs radiating from the handle
	ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.lineWidth = 3;
	for (let i = 0; i <= 8; i++) {
		const a = Math.PI * (0.16 + (i / 8) * 0.68);
		ctx.beginPath();
		ctx.moveTo(128, 240);
		ctx.lineTo(128 - Math.cos(a) * 230, 240 - Math.sin(a) * 230);
		ctx.stroke();
	}
	// gold rim arc
	ctx.strokeStyle = '#ffd98a';
	ctx.lineWidth = 10;
	ctx.beginPath();
	ctx.arc(128, 240, 212, Math.PI * 1.16, Math.PI * 1.84);
	ctx.stroke();
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace;
	return tex;
}

export async function play(ctx: EffectContext): Promise<void> {
	const { scene, machine, particles, sprites, audio, haptics } = ctx;

	const frameHalfW = (z: number) =>
		Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2)) * scene.camera.aspect * (5.35 - z);

	// ---- house lights down, neon up
	const restore = dimLights(scene, 0.32, 600);
	scene.crossfadeEnvironment('neon', 700);
	scene.fxLight.color.set(PINK);
	scene.fxLight.position.set(-1.2, 1.4, 1.7);
	tween(700, 'inOutQuad', (v) => (scene.fxLight.intensity = v * 1.9));

	// backdrop grid
	const gridMat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uOpacity: { value: 0 },
			uBeat: { value: 0 },
			uPink: { value: new THREE.Color(PINK) },
			uCyan: { value: new THREE.Color(CYAN) }
		},
		fragmentShader: GRID_FRAG,
		vertexShader: /* glsl */ `
			varying vec2 vUv;
			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending
	});
	const grid = new THREE.Mesh(new THREE.PlaneGeometry(11, 7), gridMat);
	grid.position.set(0, -0.2, -0.68);
	scene.scene.add(grid);
	tween(1200, 'inOutQuad', (v) => (gridMat.uniforms.uOpacity.value = v * 0.85));

	// stage lasers: two fans of six blades hung from the top corners. During
	// the rap they sweep the whole stage twice in formation; after the drop
	// they settle into a beat-locked groove.
	const laserGroup = new THREE.Group();
	const lasers: { mesh: THREE.Mesh; phase: number; speed: number; base: number; fan: number }[] = [];
	const laserGeo = new THREE.PlaneGeometry(0.035, 7);
	laserGeo.translate(0, -3.5, 0); // pivot at the emitter end
	const hwTop = frameHalfW(-0.4);
	for (let i = 0; i < 12; i++) {
		const side = i < 6 ? -1 : 1;
		const j = i % 6;
		const mat = new THREE.MeshBasicMaterial({
			color: j % 2 ? CYAN : PINK,
			transparent: true,
			opacity: 0,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			side: THREE.DoubleSide
		});
		const beam = new THREE.Mesh(laserGeo, mat);
		beam.position.set(side * (hwTop * 0.92), 1.75, -0.4);
		laserGroup.add(beam);
		lasers.push({
			mesh: beam,
			phase: j * 0.28, // stagger inside the fan
			speed: 0.5 + (j % 3) * 0.22,
			base: side * 0.5,
			fan: (j - 2.5) * 0.075 * side // spread the blades into a cone
		});
	}
	// bright emitter dots so the beams visibly come FROM somewhere
	const emitterMat = new THREE.SpriteMaterial({
		map: sprites.softDot,
		color: 0xffffff,
		transparent: true,
		opacity: 0,
		blending: THREE.AdditiveBlending,
		depthWrite: false
	});
	for (const side of [-1, 1]) {
		const dot = new THREE.Sprite(emitterMat);
		dot.scale.setScalar(0.3);
		dot.position.set(side * (hwTop * 0.92), 1.75, -0.4);
		laserGroup.add(dot);
	}
	scene.scene.add(laserGroup);
	tween(700, 'inOutQuad', (v) => {
		emitterMat.opacity = v * 0.85;
		for (const l of lasers) (l.mesh.material as THREE.MeshBasicMaterial).opacity = v * 0.5;
	});

	// the fortune dome, waiting to be drawn in
	const domeMat = new THREE.ShaderMaterial({
		uniforms: {
			uTime: { value: 0 },
			uReveal: { value: 0 },
			uBeat: { value: 0 },
			uOpacity: { value: 0.85 },
			uGold: { value: new THREE.Color(GOLD) }
		},
		vertexShader: DOME_VERT,
		fragmentShader: DOME_FRAG,
		transparent: true,
		depthWrite: false,
		blending: THREE.AdditiveBlending,
		side: THREE.DoubleSide
	});
	// seated low so the closed dome's bright rim lands at the crowd line,
	// not across the machine's face
	const dome = new THREE.Mesh(
		new THREE.SphereGeometry(2.6, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
		domeMat
	);
	dome.position.set(0, -1.35, 0);
	scene.scene.add(dome);

	// the crowd: a double row of lightsticks along the bottom of the frame,
	// waving in a travelling wave like every arena crowd ever
	const crowd = new THREE.Group();
	const stickHandleMat = new THREE.MeshBasicMaterial({ color: 0x201828 });
	const headMats = [
		new THREE.MeshBasicMaterial({ color: PINK }),
		new THREE.MeshBasicMaterial({ color: CYAN })
	];
	const glowMats = [
		new THREE.SpriteMaterial({ map: sprites.softDot, color: PINK, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
		new THREE.SpriteMaterial({ map: sprites.softDot, color: CYAN, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
	];
	const handleGeo = new THREE.CylinderGeometry(0.016, 0.02, 0.17, 6);
	const headGeo = new THREE.CapsuleGeometry(0.035, 0.1, 4, 10);
	const sticks: THREE.Group[] = [];
	const hwCrowd = frameHalfW(0.95);
	const rows: [number, number, number][] = [
		[-1.42, 0.85, 0], // y, z, colour offset
		[-1.56, 1.1, 1]
	];
	for (const [ry, rz, ci] of rows) {
		const count = Math.max(7, Math.floor((hwCrowd * 2) / 0.3));
		for (let i = 0; i < count; i++) {
			const stick = new THREE.Group();
			const which = (i + ci) % 2;
			const handle = new THREE.Mesh(handleGeo, stickHandleMat);
			handle.position.y = 0.085;
			const head = new THREE.Mesh(headGeo, headMats[which]);
			head.position.y = 0.27;
			const glow = new THREE.Sprite(glowMats[which]);
			glow.scale.setScalar(0.3);
			glow.position.y = 0.28;
			stick.add(handle, head, glow);
			stick.position.set(-hwCrowd + (i + 0.5) * ((hwCrowd * 2) / count) + rand(-0.03, 0.03), ry - 0.75, rz);
			stick.userData = { homeY: ry, wavePhase: stick.position.x * 0.9 + rz };
			crowd.add(stick);
			sticks.push(stick);
		}
	}
	scene.scene.add(crowd);
	// the crowd files in during the intro, sticks at half glow
	for (const stick of sticks) {
		tween(rand(700, 1400), 'outCubic', (v) => {
			stick.position.y = stick.userData.homeY - 0.75 * (1 - v);
		});
	}

	// buchaechum fans, waiting in the wings
	const fanTex = fanTexture();
	const fanGeo = new THREE.CircleGeometry(0.55, 28, Math.PI * 0.16, Math.PI * 0.68);
	fanGeo.translate(0, 0.06, 0); // pivot just below the sector
	const fanMat = new THREE.MeshBasicMaterial({
		map: fanTex,
		transparent: true,
		opacity: 0.96,
		side: THREE.DoubleSide,
		depthWrite: false
	});
	const fans: THREE.Group[] = [];
	const fanRing = new THREE.Group();
	fanRing.position.set(0, -0.15, 0.25);
	const fanRx = Math.min(1.85, frameHalfW(0.3) - 0.2);
	for (let i = 0; i < 8; i++) {
		const holder = new THREE.Group();
		const fan = new THREE.Mesh(fanGeo, fanMat);
		fan.rotation.z = Math.PI; // sector opens outward from the ring
		holder.add(fan);
		holder.scale.setScalar(0.001);
		holder.userData = { angle: (i / 8) * Math.PI * 2, flutter: rand(0, Math.PI * 2) };
		fanRing.add(holder);
		fans.push(holder);
	}
	scene.scene.add(fanRing);

	// ---- the beat-locked stage sim: one clock drives every light in the house
	const baseY = machine.group.position.y;
	let songT = 0;
	let intensity = 0.45; // pre-drop the house is at half power
	let danceOn = true;
	const stopSim = scene.addUpdatable((dt, t) => {
		songT += dt;
		const beatPhase = (songT % BEAT) / BEAT;
		const pulse = Math.pow(1 - beatPhase, 2.2); // sharp hit, smooth decay
		const bar = Math.floor(songT / BAR);
		const smooth = 0.5 + 0.5 * Math.sin(songT * Math.PI * 2 / BEAT); // gentle sine for glows

		gridMat.uniforms.uTime.value = songT / BEAT; // one row per beat
		gridMat.uniforms.uBeat.value = pulse * intensity;
		domeMat.uniforms.uTime.value = songT;
		domeMat.uniforms.uBeat.value = pulse * intensity;

		if (songT < 7.4) {
			// showtime sweep: both fans traverse the whole stage together,
			// twice across before the dome closes (period ≈ 3.5s)
			for (const l of lasers) {
				l.mesh.rotation.z = l.fan + Math.sin(songT * 1.8 + l.phase * 0.4) * 0.9;
				(l.mesh.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.2 * pulse;
			}
		} else {
			for (const l of lasers) {
				l.mesh.rotation.z = l.base * 0.6 + l.fan * 2 + Math.sin(songT * l.speed + l.phase) * 0.55;
				(l.mesh.material as THREE.MeshBasicMaterial).opacity =
					intensity * (0.3 + 0.45 * pulse);
			}
		}
		emitterMat.opacity = 0.5 + 0.4 * pulse;

		// crowd wave: travels along the rows at half-time
		for (const stick of sticks) {
			stick.rotation.z = Math.sin((songT * Math.PI) / BEAT / 2 + stick.userData.wavePhase) * 0.42 * intensity;
		}
		glowMats[0].opacity = 0.35 + 0.45 * pulse * intensity;
		glowMats[1].opacity = 0.35 + 0.45 * (1 - pulse) * intensity;

		// fan formation: orbit, breathe on the downbeat, flutter always.
		// The whole ring stays IN FRONT of the machine (z ≥ 0.54 world) so
		// the fans never slice through the rings and clamps.
		for (const holder of fans) {
			const u = holder.userData;
			if (u.leaving) continue; // finale: the exit tween owns it now
			const a = u.angle + songT * 0.55;
			const r = fanRx * (1 + pulse * 0.05);
			holder.position.set(Math.cos(a) * r, Math.sin(a) * r * 0.62, 0.47 + Math.sin(a) * 0.18);
			holder.rotation.z = a + Math.PI / 2; // fans face outward along the ring
			const fan = holder.children[0];
			fan.rotation.z = Math.PI + Math.sin(songT * 3.1 + u.flutter) * 0.16;
		}

		// the idol works the stage: bob on the beat, lean side to side per bar
		if (danceOn) {
			machine.group.position.y = baseY - pulse * 0.022 * intensity;
			const lean = (bar % 2 === 0 ? 1 : -1) * 0.03 * intensity;
			machine.group.rotation.z += (lean - machine.group.rotation.z) * Math.min(1, dt * 3);
			machine.faceSpin.rotation.z += dt * 0.12 * intensity;
		}

		// fx light ping-pongs pink/cyan every bar
		scene.fxLight.color.set(bar % 2 ? CYAN : PINK);
		scene.fxLight.intensity = 1.4 + smooth * 0.7 * intensity;
	});

	// ---- verse (0–3.5s): the stage boots up around the rap
	machine.mechSpeed = 2.5;
	machine.setInnerGlow(0.18, PINK);
	haptics.vibrate([15, 30, 15]);
	await delay(3500);

	// ---- riser (3.5–7.5s): the fortune dome draws itself closed while
	// golden light streams into the button
	const domeDraw = tween(3900, 'inQuad', (v) => (domeMat.uniforms.uReveal.value = v));
	const btnPos = machine.buttonWorldPosition();
	const inrush = particles.emitter({
		texture: sprites.spark,
		count: 160,
		emitRate: 70,
		origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.4),
		originSpread: 2.3,
		speed: [0.05, 0.25],
		gravity: new THREE.Vector3(0, 0, 0),
		drag: 1,
		life: [0.7, 1.2],
		size: [0.03, 0.08],
		colors: [GOLD, 0xfff0c8, PINK, CYAN],
		field: (x: number, y: number, z: number) =>
			[(btnPos.x - x) * 4.5, (btnPos.y - y) * 4.5, (0.45 - z) * 3]
	});
	// the house holds its breath: sticks slow, glow tightens
	tween(3800, 'inQuad', (v) => (intensity = 0.45 + v * 0.15));
	await domeDraw;
	inrush.stop();

	// ---- THE DROP (7.5s): lights up — the song IS the hit, no gong needed
	intensity = 1;
	haptics.vibrate([40, 30, 90, 30, 40]);
	scene.shake(0.3);
	flashPulse(machine, 0.7, 80, 650, GOLD);
	shockwave(scene.scene, new THREE.Vector3(0, -0.15, 0.5), {
		color: GOLD,
		maxScale: 5.5,
		duration: 750,
		z: 0.5
	});
	machine.mechSpeed = 5;
	machine.setInnerGlow(0.3, PINK);
	// confetti cannons from both bottom corners
	const confettiCannon = (x: number) =>
		particles.burst({
			texture: sprites.star4,
			count: 80,
			origin: new THREE.Vector3(x, -1.5, 0.7),
			direction: new THREE.Vector3(-Math.sign(x) * 0.45, 1, 0.1),
			cone: 0.45,
			speed: [3, 6],
			gravity: new THREE.Vector3(0, -1.9, 0),
			life: [1.2, 2.4],
			size: [0.045, 0.11],
			colors: [PINK, CYAN, GOLD, 0xffffff],
			spin: [-7, 7]
		});
	confettiCannon(-frameHalfW(0.7) * 0.8);
	confettiCannon(frameHalfW(0.7) * 0.8);
	// the fans take the stage
	for (let i = 0; i < fans.length; i++) {
		tween(420, 'outBack', (v) => fans[i].scale.setScalar(Math.max(0.001, v)));
		await delay(55);
	}
	// gentle confetti rain for the whole chorus
	const rain = particles.emitter({
		texture: sprites.star4,
		count: 90,
		emitRate: 16,
		origin: new THREE.Vector3(0, 2.3, 0.6),
		originSpread: 2.4,
		direction: new THREE.Vector3(0, -1, 0),
		cone: 0.25,
		speed: [0.35, 0.8],
		gravity: new THREE.Vector3(0, -0.35, 0),
		life: [2.6, 4],
		size: [0.035, 0.08],
		colors: [PINK, CYAN, GOLD, 0xffffff],
		spin: [-5, 5]
	});

	// "LUCKY LUCKY LIGHT IT UP" in lights, naturally
	await luckyWord(ctx, {
		text: 'LUCKY',
		color: 0xff9ae0,
		colorB: 0x8ff0ff,
		gather: 900,
		hold: 1500,
		scatter: 700,
		silent: true
	});

	// second hook: the character for luck itself, in gold above the stage
	await delay(BAR * 2 * 1000 - 800);
	await luckyWord(ctx, {
		text: '복',
		color: GOLD,
		colorB: 0xfff0c8,
		width: 1.55,
		y: 0.92,
		gather: 1100,
		hold: 1500,
		scatter: 800,
		strip: false,
		silent: true
	});

	// ---- finale: the button pops forward like a stage door and the fans
	// fly home into the bore behind it, one by one
	const btnPop = machine.buttonGroup.position.clone();
	await tween(260, 'outBack', (v) => {
		machine.buttonGroup.position.z = btnPop.z + v * 0.5;
	});
	// where the bore sits, in fanRing space
	const fanHome = new THREE.Vector3(
		btnPos.x - fanRing.position.x,
		btnPos.y - fanRing.position.y,
		0.08 - fanRing.position.z
	);
	for (const holder of fans) {
		holder.userData.leaving = true;
		const from = holder.position.clone();
		const startRot = holder.rotation.z;
		tween(650, 'inQuad', (v) => {
			holder.position.lerpVectors(from, fanHome, v);
			holder.scale.setScalar(Math.max(0.001, 1 - v));
			holder.rotation.z = startRot + v * 5; // pirouette down the hole
		}).then(() =>
			particles.burst({
				texture: sprites.star4,
				count: 8,
				origin: new THREE.Vector3(btnPos.x, btnPos.y, 0.55),
				speed: [0.6, 1.6],
				life: [0.3, 0.7],
				size: [0.03, 0.07],
				colors: [0xff9ad2, GOLD, 0xfff0f6]
			})
		);
		await delay(110);
	}
	await delay(680);
	// the door shuts behind them
	await tween(240, 'outBack', (v) => {
		machine.buttonGroup.position.z = btnPop.z + 0.5 * (1 - v);
	});

	// the last hit lands with the song's final chord, lights only
	await delay(1250);
	haptics.vibrate([60, 40, 140]);
	scene.shake(0.45);
	flashPulse(machine, 0.85, 90, 800, GOLD);
	shockwave(scene.scene, new THREE.Vector3(0, -0.15, 0.55), {
		color: 0xfff0c8,
		maxScale: 6.5,
		duration: 900,
		z: 0.55
	});
	confettiCannon(-frameHalfW(0.7) * 0.7);
	confettiCannon(frameHalfW(0.7) * 0.7);
	confettiCannon(0);
	// the crowd raises every stick straight up
	for (const stick of sticks) {
		tween(500, 'outBack', (v) => {
			stick.rotation.z *= 1 - v;
			stick.position.y = stick.userData.homeY + v * 0.12;
		});
	}
	danceOn = false;
	tween(600, 'outQuad', (v) => {
		machine.group.rotation.z *= 1 - v;
		machine.group.position.y = baseY;
	});
	// the music finishes... then, into the silence, three DONGs rising
	await delay(1100);
	audio.sfx('gong', { pitch: 0.8, gain: 0.8 });
	await delay(380);
	audio.sfx('gong', { pitch: 1.0, gain: 0.8 });
	await delay(380);
	audio.sfx('gong', { pitch: 1.25, gain: 0.85 });
	await delay(600);

	// ---- house lights (song ends ≈21.9s): everything bows out
	rain.stop();
	machine.mechSpeed = 1;
	tween(1300, 'inOutQuad', (v) => {
		const w = 1 - v;
		gridMat.uniforms.uOpacity.value = 0.85 * w;
		domeMat.uniforms.uOpacity.value = 0.85 * w;
		machine.setInnerGlow(0.3 * w, PINK);
		scene.fxLight.intensity = 1.9 * w;
		for (const l of lasers) {
			(l.mesh.material as THREE.MeshBasicMaterial).opacity = 0.4 * w;
		}
		glowMats[0].opacity = 0.5 * w;
		glowMats[1].opacity = 0.5 * w;
	});
	for (const stick of sticks) {
		tween(rand(600, 1100), 'inQuad', (v) => {
			stick.position.y = stick.userData.homeY + 0.12 - v * 0.95;
		});
	}
	await delay(1400);

	// ---- teardown
	stopSim();
	machine.group.position.y = baseY;
	machine.group.rotation.z = 0;
	scene.fxLight.intensity = 0;
	machine.setInnerGlow(0);
	scene.scene.remove(grid, laserGroup, dome, crowd, fanRing);
	grid.geometry.dispose();
	gridMat.dispose();
	laserGeo.dispose();
	for (const l of lasers) (l.mesh.material as THREE.Material).dispose();
	dome.geometry.dispose();
	domeMat.dispose();
	disposeObject(crowd);
	disposeObject(fanRing);
	fanTex.dispose();
	scene.crossfadeEnvironment('lounge');
	await restore(900);
}
