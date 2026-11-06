// The Collection drawer (in the content section): one card per effect the
// visitor has seen through, newest first, each with a "Show next" button that
// books that effect for the next press.

import { COLLECTION, COLLECTION_SIZE } from '../luck/collectionData';
import type { CollectedEffect, LuckStore } from '../luck/store';

export class CollectionUI {
	store: LuckStore;
	container: HTMLElement;
	progress: HTMLElement;
	/** Books `name` for the next press. Unset (the machine never started)
	 *  means the buttons stay hidden: there is nothing to replay with. */
	onReplay: ((name: string) => void) | null;
	queued: string | null;

	constructor(store: LuckStore) {
		this.store = store;
		this.container = document.getElementById('collection-grid')!;
		this.progress = document.getElementById('collection-progress')!;
		this.onReplay = null;
		this.queued = null;
		// one listener for every card, present and future
		this.container.addEventListener('click', (e) => {
			const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.fx-replay');
			const name = btn?.closest<HTMLElement>('.fx-card')?.dataset.fx;
			if (!btn || !name || !this.onReplay) return;
			this.onReplay(name);
		});
	}

	renderAll(): void {
		this.container.innerHTML = '';
		// store order is oldest-first; prepending each leaves the newest on top
		for (const entry of this.store.data.collected) this._card(entry);
		this.updateProgress();
	}

	/** Replays are possible from here on: show the buttons. */
	enableReplay(fn: (name: string) => void): void {
		this.onReplay = fn;
		for (const btn of this.container.querySelectorAll<HTMLButtonElement>('.fx-replay')) btn.hidden = false;
	}

	_cardFor(name: string): HTMLElement | null {
		for (const child of this.container.children) {
			if ((child as HTMLElement).dataset?.fx === name) return child as HTMLElement;
		}
		return null;
	}

	_card(entry: CollectedEffect): HTMLElement | null {
		const card = COLLECTION[entry.name];
		if (!card) return null;
		const existing = this._cardFor(entry.name);
		if (existing) {
			const meta = existing.querySelector('.fx-meta');
			if (meta) meta.textContent = seenLine(entry.count);
			return existing;
		}

		const el = document.createElement('div');
		el.className = 'fx-card';
		el.dataset.fx = entry.name;

		const icon = document.createElement('div');
		icon.className = 'fx-icon';
		icon.textContent = card.icon;
		icon.setAttribute('aria-hidden', 'true');

		const body = document.createElement('div');
		body.className = 'fx-body';
		const title = document.createElement('h3');
		title.className = 'fx-title';
		title.textContent = card.title;
		const luck = document.createElement('p');
		luck.className = 'fx-luck';
		luck.textContent = card.luck;
		const meta = document.createElement('p');
		meta.className = 'fx-meta';
		meta.textContent = seenLine(entry.count);
		body.append(title, luck, meta);

		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'fx-replay';
		btn.textContent = 'Show next';
		btn.setAttribute('aria-label', `Show ${card.title} on the next press`);
		btn.setAttribute('aria-pressed', 'false');
		btn.hidden = !this.onReplay;

		el.append(icon, body, btn);
		this.container.prepend(el);
		return el;
	}

	/** A sighting: a new card on top, or a higher count on an old one. */
	upsert(entry: CollectedEffect): void {
		this._card(entry);
		this.updateProgress();
	}

	/** Mark which card (if any) is booked for the next press. */
	setQueued(name: string | null): void {
		this.queued = name;
		for (const card of this.container.children) {
			const el = card as HTMLElement;
			const on = el.dataset.fx === name;
			el.classList.toggle('queued', on);
			const btn = el.querySelector<HTMLButtonElement>('.fx-replay');
			if (btn) {
				btn.textContent = on ? 'Up next ✓' : 'Show next';
				btn.setAttribute('aria-pressed', String(on));
			}
		}
	}

	updateProgress(): void {
		const n = this.store.data.collected.length;
		this.progress.textContent =
			n === 0
				? 'Nothing collected yet. Press the button upstairs and the first one files itself.'
				: n >= COLLECTION_SIZE
					? `All ${COLLECTION_SIZE} collected. The machine has nothing left to surprise you with, which is itself a kind of luck.`
					: `${n} of ${COLLECTION_SIZE} collected. The rest are still in the machine, waiting for a press.`;
	}
}

function seenLine(count: number): string {
	return count === 1 ? 'Seen once' : count === 2 ? 'Seen twice' : `Seen ${count} times`;
}
