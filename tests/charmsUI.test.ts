import { describe, it, expect, beforeEach } from 'vitest';
import { CharmsUI } from '../src/ui/charmsUI';
import type { Charm } from '../src/luck/charmsData';
import type { LuckStore } from '../src/luck/store';

// CharmsUI only touches store.data.charms/luckyness + store.nextPressCharm(),
// so a minimal stand-in is enough to drive it without booting the real store.
function fakeStore(charms: Charm[]): LuckStore {
	return {
		data: { charms, luckyness: charms.length },
		nextPressCharm: () => undefined
	} as unknown as LuckStore;
}

const HTML = `
	<div id="lucky-charms-container"></div>
	<p id="charms-progress"></p>
	<div id="charm-toast" hidden></div>`;

const charm = (id: string, title: string, description = 'desc', date = '2026-01-01T00:00:00.000Z'): Charm => ({
	id, title, description, icon: '★', date
});

beforeEach(() => {
	document.body.innerHTML = HTML;
});

describe('CharmsUI ordering', () => {
	it('renderAll renders newest-first (store is oldest-first)', () => {
		const charms = [charm('a', 'First'), charm('b', 'Second'), charm('c', 'Third')];
		const ui = new CharmsUI(fakeStore(charms));
		ui.renderAll();
		const titles = [...document.querySelectorAll('#lucky-charms-container .charm-title')].map((n) => n.textContent);
		expect(titles).toEqual(['Third', 'Second', 'First']);
	});

	it('addCharm prepends, keeping newest-first after renderAll', () => {
		const charms = [charm('a', 'First'), charm('b', 'Second')];
		const ui = new CharmsUI(fakeStore(charms));
		ui.renderAll();
		ui.addCharm(charm('c', 'Third'));
		const titles = [...document.querySelectorAll('#lucky-charms-container .charm-title')].map((n) => n.textContent);
		expect(titles).toEqual(['Third', 'Second', 'First']);
	});

	it('renderAll and addCharm produce the same DOM order for the same underlying data', () => {
		const charms = [charm('a', 'First'), charm('b', 'Second'), charm('c', 'Third')];

		const viaRenderAll = new CharmsUI(fakeStore(charms));
		viaRenderAll.renderAll();
		const renderAllOrder = [...document.querySelectorAll('#lucky-charms-container .charm-title')].map((n) => n.textContent);

		document.body.innerHTML = HTML;
		const viaAddCharm = new CharmsUI(fakeStore([]));
		for (const c of charms) viaAddCharm.addCharm(c);
		const addCharmOrder = [...document.querySelectorAll('#lucky-charms-container .charm-title')].map((n) => n.textContent);

		expect(renderAllOrder).toEqual(addCharmOrder);
	});
});

describe('CharmsUI DOM structure + XSS hardening', () => {
	it('renders charm markup via real nodes, not innerHTML injection', () => {
		const evil = charm('x', '<img src=x onerror="window.__pwned=true">', '<b>bold desc</b>');
		const ui = new CharmsUI(fakeStore([evil]));
		ui.renderAll();

		// the hostile strings must render as literal text...
		const titleEl = document.querySelector('#lucky-charms-container .charm-title')!;
		expect(titleEl.textContent).toBe('<img src=x onerror="window.__pwned=true">');
		const charmEl = document.querySelector('#lucky-charms-container .charm')!;
		expect(charmEl.textContent).toContain('<b>bold desc</b>');

		// ...never as actual elements/attacks
		expect(document.querySelector('#lucky-charms-container img')).toBeNull();
		expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
	});

	it('keeps the expected DOM structure/classes for a charm entry', () => {
		const ui = new CharmsUI(fakeStore([charm('a', 'Lucky', 'A description')]));
		ui.renderAll();

		const el = document.querySelector('#lucky-charms-container .charm')!;
		expect(el.querySelector(':scope > .charm-icon')).not.toBeNull();
		const p = el.querySelector(':scope > p')!;
		expect(p.querySelector('.charm-title')?.textContent).toBe('Lucky');
		expect(p.querySelector('br')).not.toBeNull();
		const dateSpan = p.querySelector('.charm-date')!;
		expect(dateSpan.querySelector('b')?.textContent).toBe('Awarded:');
		expect(dateSpan.querySelector('sup')).not.toBeNull(); // ordinal suffix on the day
	});

	it('showToast builds toast markup via real nodes, not innerHTML injection', () => {
		const evil = charm('x', '<script>window.__pwned2=true</script>');
		const ui = new CharmsUI(fakeStore([]));
		ui.showToast(evil);

		const titleEl = document.querySelector('#charm-toast .toast-title')!;
		expect(titleEl.textContent).toContain('<script>window.__pwned2=true</script>');
		expect(document.querySelector('#charm-toast script')).toBeNull();
		expect((window as unknown as { __pwned2?: boolean }).__pwned2).toBeUndefined();
	});
});
