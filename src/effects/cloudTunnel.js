// Effect 5 — CLOUD TUNNEL: the camera dives INTO the button, whites out, and
// we're flying down a cloud tunnel — fog, drifting cloud banks, a sun at the
// end — before being spat back out at the machine.

import * as THREE from 'three';
import { tween, delay, rand } from '../core/anim.js';

export const sound = 'cloudsTunnel';
export const duration = 11500;

let tunnel = null;

function buildTunnel(ctx) {
	const { sprites } = ctx;
	const group = new THREE.Group();

	const skyTex = ctx.textures.sky.clone();
	skyTex.wrapS = skyTex.wrapT = THREE.RepeatWrapping;
	skyTex.repeat.set(3, 26);
	skyTex.needsUpdate = true;
	const tube = new THREE.Mesh(
		new THREE.CylinderGeometry(3.2, 3.2, 140, 48, 1, true),
		new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: true })
	);
	tube.rotation.x = Math.PI / 2;
	group.add(tube);

	const wispTex = ctx.textures.sky.clone();
	wispTex.wrapS = wispTex.wrapT = THREE.RepeatWrapping;
	wispTex.repeat.set(2, 38);
	wispTex.needsUpdate = true;
	const wisps = new THREE.Mesh(
		new THREE.CylinderGeometry(2.4, 2.4, 140, 40, 1, true),
		new THREE.MeshBasicMaterial({
			map: wispTex,
			side: THREE.BackSide,
			transparent: true,
			opacity: 0.4,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		})
	);
	wisps.rotation.x = Math.PI / 2;
	group.add(wisps);

	// individual cloud banks flying past — this is what sells the speed
	const clouds = [];
	for (let i = 0; i < 34; i++) {
		const sp = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: ctx.textures.cloudSprite,
				color: 0xffffff,
				transparent: true,
				opacity: rand(0.3, 0.55),
				depthWrite: false,
				fog: true,
				rotation: rand(0, Math.PI * 2)
			})
		);
		const ang = rand(0, Math.PI * 2);
		const r = rand(1.7, 2.9);
		sp.position.set(Math.cos(ang) * r, Math.sin(ang) * r, rand(-62, 4));
		sp.scale.setScalar(rand(0.9, 2));
		sp.userData.speed = rand(11, 16);
		group.add(sp);
		clouds.push(sp);
	}

	// the light at the end — a soft halo, not a hard disc; fog hides the far
	// opening so no cap is needed
	const sun = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: sprites.softDot,
			color: 0xfffbe8,
			transparent: true,
			opacity: 0.75,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		})
	);
	sun.scale.setScalar(7);
	sun.position.z = -56;
	group.add(sun);
	const halo = new THREE.Sprite(
		new THREE.SpriteMaterial({
			map: sprites.softDot,
			color: 0xf4f8ff,
			transparent: true,
			opacity: 0.22,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		})
	);
	halo.scale.setScalar(24);
	halo.position.z = -56;
	group.add(halo);

	group.visible = false;
	return { group, tube, wisps, clouds, sun, halo, skyTex, wispTex };
}

export async function play(ctx) {
	const { scene, machine, haptics } = ctx;
	if (!tunnel) tunnel = buildTunnel(ctx);

	// ---- dive INTO the button
	haptics.vibrate([20, 30, 40, 30, 60]);
	const rigZ0 = scene.rig.position.z;
	const fov0 = scene.camera.fov;
	const dive = tween(1050, 'inQuart', (v) => {
		scene.rig.position.z = rigZ0 - v * (rigZ0 - 1.25);
		scene.camera.fov = fov0 + v * 26;
		scene.camera.updateProjectionMatrix();
	});
	await delay(650);
	// white-out as we hit the button
	await tween(400, 'inQuad', (v) => machine.setOuterGlow(v, 0xffffff));
	await dive;

	// ---- swap worlds while blind
	machine.group.visible = false;
	scene.camera.add(tunnel.group);
	tunnel.group.position.set(0, 0, -2.5);
	tunnel.group.visible = true;
	const bg0 = scene.scene.background;
	scene.scene.background = new THREE.Color(0x9cc3ea);
	scene.scene.fog = new THREE.Fog(0xbcd8ee, 7, 52);
	haptics.vibrate(80);

	// the button comes along for the ride — freed from the machine, it barrel-
	// rolls and pirouettes through the clouds ahead of us
	const button = machine.buttonGroup;
	const buttonHome = button.parent;
	tunnel.group.add(button);
	button.position.set(0, -0.1, -2.8);
	button.scale.setScalar(0.85);
	// keep it lit against the bright sky
	scene.fxLight.color.set(0xffffff);
	scene.fxLight.intensity = 9;
	const fxFollow = scene.addUpdatable(() => {
		button.getWorldPosition(scene.fxLight.position);
		scene.fxLight.position.z += 1.2;
	});

	await tween(600, 'outQuad', (v) => machine.setOuterGlow(1 - v));

	// ---- fly
	const stopFly = scene.addUpdatable((dt, t) => {
		tunnel.skyTex.offset.y -= dt * 1.7;
		tunnel.wispTex.offset.y -= dt * 3.1;
		// spin around the tube's own axis (local Y after the X-rotation)
		tunnel.tube.rotation.y += dt * 0.16;
		tunnel.wisps.rotation.y -= dt * 0.24;
		for (const c of tunnel.clouds) {
			c.position.z += c.userData.speed * dt;
			if (c.position.z > 4) {
				const ang = rand(0, Math.PI * 2);
				const r = rand(1.7, 2.9);
				c.position.set(Math.cos(ang) * r, Math.sin(ang) * r, rand(-62, -40));
				c.material.rotation = rand(0, Math.PI * 2);
			}
		}
		tunnel.sun.material.opacity = 0.8 + Math.sin(t * 2.6) * 0.15;
		scene.cameraRoll = Math.sin(t * 0.55) * 0.05;
		// swooping loops + pirouettes that always come back to face us
		button.position.x = Math.sin(t * 0.85) * 0.95;
		button.position.y = Math.cos(t * 0.6) * 0.55 - 0.05;
		button.position.z = -2.8 + Math.sin(t * 0.42) * 0.9;
		button.rotation.y = Math.sin(t * 1.1) * 1.15; // twirls that keep the face in view
		button.rotation.z = Math.sin(t * 0.85) * -0.45; // banks into its turns
		button.rotation.x = Math.cos(t * 0.6) * 0.3;
	});

	await delay(6600);

	// ---- the light rushes up — teleport home. The world whites out via fog
	// closing in, NOT a giant sprite in the lens (that read as a hard disc).
	haptics.vibrate([40, 40, 160]);
	const fogC0 = scene.scene.fog.color.clone();
	const bgC = scene.scene.background;
	const white = new THREE.Color(0xffffff);
	await tween(1000, 'inCubic', (v) => {
		tunnel.sun.position.z = -56 + v * 40;
		tunnel.sun.scale.setScalar(7 + v * 8);
		tunnel.halo.position.z = -56 + v * 40;
		tunnel.halo.scale.setScalar(24 + v * 8);
		tunnel.halo.material.opacity = 0.22 + v * 0.2;
		scene.scene.fog.far = 52 - v * 46;
		scene.scene.fog.near = 7 - v * 6.2;
		scene.scene.fog.color.lerpColors(fogC0, white, v);
		bgC.lerpColors(new THREE.Color(0x9cc3ea), white, v);
	});
	await tween(280, 'inQuad', (v) => machine.setOuterGlow(v, 0xffffff));
	// reset the shared tunnel props for the next ride
	tunnel.sun.position.z = -56;
	tunnel.sun.scale.setScalar(7);
	tunnel.halo.position.z = -56;
	tunnel.halo.scale.setScalar(24);
	tunnel.halo.material.opacity = 0.22;

	stopFly();
	fxFollow();
	scene.fxLight.intensity = 0;
	scene.cameraRoll = 0;
	// the button clicks back into its housing
	buttonHome.add(button);
	button.position.set(0, 0, 0);
	button.rotation.set(0, 0, 0);
	button.scale.setScalar(1);
	scene.camera.remove(tunnel.group);
	tunnel.group.visible = false;
	scene.scene.fog = null;
	scene.scene.background = bg0;
	machine.group.visible = true;
	machine.setInnerGlow(0.9, 0xfff3cf);

	// pull back out to the framing shot
	tween(1150, 'outCubic', (v) => {
		scene.rig.position.z = 1.25 + v * (rigZ0 - 1.25);
		scene.camera.fov = fov0 + 26 * (1 - v);
		scene.camera.updateProjectionMatrix();
	});
	await tween(800, 'outQuad', (v) => machine.setOuterGlow(1 - v));
	await tween(700, 'outQuad', (v) => machine.setInnerGlow(0.9 * (1 - v)));
}
