import { describe, it, expect, beforeEach, vi } from 'vitest';
import { COLLECTION, COLLECTION_SIZE, collectionCharm } from '../src/luck/collectionData';
import { Director, QUICK_OPENERS } from '../src/effects/director';
import { LuckStore } from '../src/luck/store';
import type { EffectContext } from '../src/types';

vi.mock('../src/effects/powerSurge', () => ({ sound: 'powerStreams', duration: 7000, play: vi.fn() }));
vi.mock('../src/effects/gentleGlow', () => ({ sound: 'lucky', duration: 4500, play: vi.fn() }));

const dummyCtx = {} as EffectContext;
const KEY = 'luckStore';
const readSaved = () => JSON.parse(localStorage.getItem(KEY) ?? 'null');

describe('COLLECTION (one card per effect)', () => {
	it('covers every effect in the bag plus gentleGlow, and nothing else', () => {
		const director = new Director(dummyCtx);
		const expected = [...director.names, 'gentleGlow'].sort();
		expect(Object.keys(COLLECTION).sort()).toEqual(expected);
		expect(COLLECTION_SIZE).toBe(expected.length);
	});

	it('cards have a title, an icon and a luck line in house style', () => {
		for (const [name, card] of Object.entries(COLLECTION)) {
			expect(card.title.length, name).toBeGreaterThan(2);
			expect(card.icon.length, name).toBeGreaterThan(0);
			expect(card.luck.length, name).toBeGreaterThan(30);
			expect(card.luck.length, name).toBeLessThan(150);
			expect(card.luck, name).not.toMatch(/—/); // no em-dashes in shipped copy
			expect(card.luck, name).not.toMatch(/guarantee[sd]? (that|you)/i);
		}
	});

	it('every card earns a distinct charm that mentions replaying', () => {
		const ids = new Set<string>();
		for (const name of Object.keys(COLLECTION)) {
			const charm = collectionCharm(name)!;
			expect(charm.id).toBe(`fx-${name}`);
			expect(charm.description).toMatch(/replay/);
			ids.add(charm.id);
		}
		expect(ids.size).toBe(COLLECTION_SIZE);
		expect(collectionCharm('notAnEffect')).toBeNull();
	});

	it('quick openers are all real, bag-drawn effects', () => {
		const director = new Director(dummyCtx);
		for (const name of QUICK_OPENERS) expect(director.names).toContain(name);
	});
});

describe('LuckStore collection', () => {
	beforeEach(() => localStorage.clear());

	it('first sighting files the effect, earns its charm and persists', () => {
		const store = new LuckStore();
		const first = store.registerCollected('powerSurge')!;
		expect(first.isNew).toBe(true);
		expect(first.entry.count).toBe(1);
		expect(first.charm?.id).toBe('fx-powerSurge');
		expect(store.hasCollected('powerSurge')).toBe(true);
		const saved = readSaved();
		expect(saved.collected).toHaveLength(1);
		expect(saved.charms.some((c: { id: string }) => c.id === 'fx-powerSurge')).toBe(true);
	});

	it('later sightings only raise the count', () => {
		const store = new LuckStore();
		store.registerCollected('powerSurge');
		const again = store.registerCollected('powerSurge')!;
		expect(again.isNew).toBe(false);
		expect(again.entry.count).toBe(2);
		expect(again.charm).toBeNull();
		expect(store.data.charms.filter((c) => c.id === 'fx-powerSurge')).toHaveLength(1);
	});

	it('ignores names that are not effects', () => {
		const store = new LuckStore();
		expect(store.registerCollected('nope')).toBeNull();
		expect(store.data.collected).toHaveLength(0);
	});

	it('survives a reload and repairs a damaged list', () => {
		const store = new LuckStore();
		store.registerCollected('powerSurge');
		store.registerCollected('gentleGlow');
		const reloaded = new LuckStore();
		expect(reloaded.data.collected.map((c) => c.name)).toEqual(['powerSurge', 'gentleGlow']);

		const raw = readSaved();
		raw.collected = [{ name: 'powerSurge', count: 'lots' }, { name: 'removedEffect', count: 3 }, 'junk', { name: 'powerSurge' }];
		localStorage.setItem(KEY, JSON.stringify(raw));
		const repaired = new LuckStore();
		expect(repaired.data.collected).toEqual([{ name: 'powerSurge', count: 1, date: expect.any(String) }]);
	});

	it('a record written before the collection existed loads with an empty one', () => {
		const store = new LuckStore();
		const raw = readSaved();
		delete raw.collected;
		localStorage.setItem(KEY, JSON.stringify(raw));
		expect(new LuckStore().data.collected).toEqual([]);
		expect(store.data.luckyness).toBe(0);
	});
});

describe('Director requests', () => {
	const stubCtx = () =>
		({
			scene: { reducedMotion: false, updatables: new Set(), keyLight: {}, fillLight: {}, rimLight: {}, scene: {}, setVignetteBoost() {}, envTexture: () => null },
			machine: { group: { position: { clone: () => ({}) }, rotation: { clone: () => ({}) } }, buttonGroup: { position: { clone: () => ({}) }, rotation: { clone: () => ({}) }, scale: { clone: () => ({}) } }, backdrop: {}, mechSpeed: 1, resetToIdle() {} },
			audio: { isReady: () => true, ready: async () => true, play() {}, preload() {}, stopAllLoops() {}, stopAllTracks() {} },
			particles: { clear() {} },
			lightning: { clear() {} }
		}) as unknown as EffectContext;

	it('openWith puts one of the openers in the next slot without disturbing the cycle', () => {
		const director = new Director(dummyCtx);
		const before = director.bag.slice();
		director.openWith(['powerSurge']);
		expect(director._peek()).toBe('powerSurge');
		expect(director.bag.slice().sort()).toEqual(before.slice().sort()); // a swap, not an insert
		director.openWith(['notAnEffect']); // ignored
		expect(director._peek()).toBe('powerSurge');
	});

	it('a queued effect plays next, once, and the bag resumes where it was', async () => {
		const director = new Director(stubCtx());
		director.bag = director.bag.filter((n) => n !== 'powerSurge'); // make sure the bag would not have drawn it
		const indexBefore = director.index;
		director.queued = 'powerSurge';
		expect(await director.play()).toBe('powerSurge');
		expect(director.queued).toBeNull();
		expect(director.index).toBe(indexBefore);
		expect(director.knows('powerSurge')).toBe(true);
		expect(director.knows('gentleGlow')).toBe(true);
		expect(director.knows('nope')).toBe(false);
	});

	it('reduced motion swaps a queued non-calm effect for a calm one', async () => {
		const ctx = stubCtx();
		(ctx.scene as { reducedMotion: boolean }).reducedMotion = true;
		const director = new Director(ctx);
		director.queued = 'powerSurge';
		// the calm pick is random; pin it to gentleGlow, the one calm module
		// mocked here (the others would pull real three.js into happy-dom)
		const random = vi.spyOn(Math, 'random').mockReturnValue(0);
		try {
			expect(await director.play()).toBe('gentleGlow');
		} finally {
			random.mockRestore();
		}
		expect(director.queued).toBeNull();
	});
});
