// Procedural reflection environment — no HDRI download needed. A dim green
// lounge with a big overhead softbox, warm gold and cool blue side strips and
// a few bright card lights: structured reflections that make the metalwork pop.

import * as THREE from 'three';

export function createEnvironmentScene() {
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(0x16281a);

	const panel = (color, w, h, x, y, z, ry = 0, rx = 0) => {
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
		);
		mesh.position.set(x, y, z);
		mesh.rotation.set(rx, ry, 0);
		scene.add(mesh);
		return mesh;
	};

	// green room bounce (floor + walls) — bright enough to keep the golds golden
	panel(0x4a6e4c, 40, 40, 0, -8, 0, 0, Math.PI / 2); // floor
	panel(0x3a5c3e, 40, 20, 0, 2, -12); // back wall
	panel(0x6f7d64, 40, 20, 0, 2, 16); // wall behind camera (broad front fill)

	// big soft key light overhead-front — the main broad highlight
	panel(0xfff6e6, 22, 9, 0, 9, 8, 0, Math.PI / 4);
	panel(0xf2ecd8, 12, 6, -2, 7, 12, 0.2, Math.PI / 3.2);
	// warm low bounce to kiss the gold from the front
	panel(0xffe9b0, 8, 2.5, 0, -6, 12, 0, -0.5);

	// tall warm gold strip, camera-left
	panel(0xffd9a0, 1.6, 14, -10, 1, 4, Math.PI / 2.6);
	panel(0xffc070, 0.7, 12, -12, 0, 2, Math.PI / 2.6);

	// tall cool strips, camera-right (gives silver its steel-blue edge)
	panel(0xbfd9ff, 1.4, 14, 10, 1, 4, -Math.PI / 2.6);
	panel(0x88aadd, 0.6, 12, 12, 0, 2, -Math.PI / 2.6);

	// a couple of small hot cards for sharp glints
	panel(0xffffff, 1.2, 1.2, -4, 6, 9, 0.4, -0.4);
	panel(0xffffff, 0.8, 0.8, 5, 5, 9, -0.4, -0.3);
	panel(0xfff3cf, 0.9, 0.9, 3, -5, 9, -0.2, 0.5);

	return scene;
}
