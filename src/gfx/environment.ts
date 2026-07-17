// Procedural reflection environments — no HDRI download needed. The default is
// a dim green lounge with a big overhead softbox, warm gold and cool blue side
// strips and a few bright card lights: structured reflections that make the
// metalwork pop. Alternate palettes let effects re-light the world (reflections
// included) instead of always mirroring the lounge from deep space.

import * as THREE from 'three';

export type EnvironmentName = 'lounge' | 'nightSky' | 'gold' | 'neon';

// One named colour per panel role; geometry is identical across variants so
// reflections keep their structure and only the mood changes.
interface EnvPalette {
	background: THREE.ColorRepresentation;
	floor: THREE.ColorRepresentation;
	backWall: THREE.ColorRepresentation;
	frontWall: THREE.ColorRepresentation;
	softboxA: THREE.ColorRepresentation;
	softboxB: THREE.ColorRepresentation;
	lowBounce: THREE.ColorRepresentation;
	leftStripA: THREE.ColorRepresentation;
	leftStripB: THREE.ColorRepresentation;
	rightStripA: THREE.ColorRepresentation;
	rightStripB: THREE.ColorRepresentation;
	cardA: THREE.ColorRepresentation;
	cardB: THREE.ColorRepresentation;
	cardC: THREE.ColorRepresentation;
}

const PALETTES: Record<EnvironmentName, EnvPalette> = {
	lounge: {
		background: 0x16281a,
		floor: 0x4a6e4c,
		backWall: 0x3a5c3e,
		frontWall: 0x6f7d64,
		softboxA: 0xfff6e6,
		softboxB: 0xf2ecd8,
		lowBounce: 0xffe9b0,
		leftStripA: 0xffd9a0,
		leftStripB: 0xffc070,
		rightStripA: 0xbfd9ff,
		rightStripB: 0x88aadd,
		cardA: 0xffffff,
		cardB: 0xffffff,
		cardC: 0xfff3cf
	},
	nightSky: {
		background: 0x05091a,
		floor: 0x0e1830,
		backWall: 0x0a1226,
		frontWall: 0x141e38,
		softboxA: 0xcfe0ff, // moonlight
		softboxB: 0xa8c0ee,
		lowBounce: 0x8098d0,
		leftStripA: 0xaac4ff,
		leftStripB: 0x7f9fe8,
		rightStripA: 0x9fb8ff,
		rightStripB: 0x6688cc,
		cardA: 0xffffff, // star glints
		cardB: 0xeef4ff,
		cardC: 0xdde8ff
	},
	gold: {
		background: 0x2a1c08,
		floor: 0x6e5a2c,
		backWall: 0x5c4a22,
		frontWall: 0x7d6a3a,
		softboxA: 0xffefc8,
		softboxB: 0xffe6ae,
		lowBounce: 0xffdf98,
		leftStripA: 0xffd070,
		leftStripB: 0xffb040,
		rightStripA: 0xffe0a0,
		rightStripB: 0xf0b860,
		cardA: 0xffffff,
		cardB: 0xfff8e0,
		cardC: 0xffedc0
	},
	neon: {
		background: 0x120818,
		floor: 0x241035,
		backWall: 0x1c0c2c,
		frontWall: 0x301846,
		softboxA: 0xffd9f4,
		softboxB: 0xe8c8ff,
		lowBounce: 0xc890ff,
		leftStripA: 0xff5fd0,
		leftStripB: 0xe040a8,
		rightStripA: 0x40e8ff,
		rightStripB: 0x30b8e8,
		cardA: 0xffffff,
		cardB: 0xffe8ff,
		cardC: 0xe0ffff
	}
};

export function createEnvironmentScene(name: EnvironmentName = 'lounge') {
	const pal = PALETTES[name];
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(pal.background);

	const panel = (
		color: THREE.ColorRepresentation,
		w: number,
		h: number,
		x: number,
		y: number,
		z: number,
		ry = 0,
		rx = 0
	) => {
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry(w, h),
			new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
		);
		mesh.position.set(x, y, z);
		mesh.rotation.set(rx, ry, 0);
		scene.add(mesh);
		return mesh;
	};

	// room bounce (floor + walls) — bright enough to keep the golds golden
	panel(pal.floor, 40, 40, 0, -8, 0, 0, Math.PI / 2); // floor
	panel(pal.backWall, 40, 20, 0, 2, -12); // back wall
	panel(pal.frontWall, 40, 20, 0, 2, 16); // wall behind camera (broad front fill)

	// big soft key light overhead-front — the main broad highlight
	panel(pal.softboxA, 22, 9, 0, 9, 8, 0, Math.PI / 4);
	panel(pal.softboxB, 12, 6, -2, 7, 12, 0.2, Math.PI / 3.2);
	// warm low bounce to kiss the gold from the front
	panel(pal.lowBounce, 8, 2.5, 0, -6, 12, 0, -0.5);

	// tall strip, camera-left
	panel(pal.leftStripA, 1.6, 14, -10, 1, 4, Math.PI / 2.6);
	panel(pal.leftStripB, 0.7, 12, -12, 0, 2, Math.PI / 2.6);

	// tall strips, camera-right (gives silver its steel-blue edge)
	panel(pal.rightStripA, 1.4, 14, 10, 1, 4, -Math.PI / 2.6);
	panel(pal.rightStripB, 0.6, 12, 12, 0, 2, -Math.PI / 2.6);

	// a couple of small hot cards for sharp glints
	panel(pal.cardA, 1.2, 1.2, -4, 6, 9, 0.4, -0.4);
	panel(pal.cardB, 0.8, 0.8, 5, 5, 9, -0.4, -0.3);
	panel(pal.cardC, 0.9, 0.9, 3, -5, 9, -0.2, 0.5);

	return scene;
}
