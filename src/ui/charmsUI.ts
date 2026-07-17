// Lucky Charms drawer (in the content section) + the award toast in the hero.

import type { Charm } from '../luck/charmsData';
import type { LuckStore } from '../luck/store';

const monthNames: string[] = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

function ordinal(day: number): string {
	if (day === 1 || day === 21 || day === 31) return 'st';
	if (day === 2 || day === 22) return 'nd';
	if (day === 3 || day === 23) return 'rd';
	return 'th';
}

// builds the "17th July 2026, 9:05" date fragment as real nodes (the <sup> is
// ours, not user data, but we still avoid innerHTML for consistency)
function formatDateFrag(iso: string): DocumentFragment {
	const frag = document.createDocumentFragment();
	const d = new Date(iso);
	if (isNaN(+d)) return frag;
	const mins = String(d.getMinutes()).padStart(2, '0');
	frag.append(String(d.getDate()));
	const sup = document.createElement('sup');
	sup.textContent = ordinal(d.getDate());
	frag.append(sup, ` ${monthNames[d.getMonth()]} ${d.getFullYear()}, ${d.getHours()}:${mins}`);
	return frag;
}

export class CharmsUI {
	store: LuckStore;
	container: HTMLElement;
	progress: HTMLElement;
	toast: HTMLElement;

	constructor(store: LuckStore) {
		this.store = store;
		this.container = document.getElementById('lucky-charms-container')!;
		this.progress = document.getElementById('charms-progress')!;
		this.toast = document.getElementById('charm-toast')!;
	}

	renderAll(): void {
		this.container.innerHTML = '';
		// store order is oldest-first; _append prepends, so walking oldest→newest
		// and prepending each leaves the newest charm on top (same as addCharm)
		for (const charm of this.store.data.charms) this._append(charm);
		this.updateProgress();
	}

	_append(charm: Charm): void {
		const el = document.createElement('div');
		el.className = 'charm';

		const icon = document.createElement('div');
		icon.className = 'charm-icon';
		if (String(charm.icon || '★').length > 2) icon.style.fontSize = '16px';
		icon.textContent = charm.icon || '★';
		el.appendChild(icon);

		const p = document.createElement('p');
		const title = document.createElement('span');
		title.className = 'charm-title';
		title.textContent = charm.title;
		p.appendChild(title);
		p.appendChild(document.createElement('br'));
		p.appendChild(document.createTextNode(charm.description));

		const dateSpan = document.createElement('span');
		dateSpan.className = 'charm-date';
		const b = document.createElement('b');
		b.textContent = 'Awarded:';
		dateSpan.appendChild(b);
		dateSpan.appendChild(document.createTextNode(' '));
		dateSpan.appendChild(formatDateFrag(charm.date!));
		p.appendChild(dateSpan);

		el.appendChild(p);
		this.container.prepend(el);
	}

	addCharm(charm: Charm): void {
		this._append(charm);
		this.updateProgress();
	}

	updateProgress(): void {
		const n = this.store.data.luckyness;
		const next = this.store.nextPressCharm();
		this.progress.textContent = next
			? `You've pressed the button ${n.toLocaleString()} ${n === 1 ? 'time' : 'times'}. ` +
				`Your next Lucky Charm arrives at ${next.amount!.toLocaleString()} ${next.amount === 1 ? 'press' : 'presses'}…`
			: `You've pressed the button ${n.toLocaleString()} times and earned every pressing charm we have. Astonishing luck.`;
	}

	showToast(charm: Charm): void {
		this.toast.hidden = false;
		this.toast.innerHTML = '';
		const kicker = document.createElement('span');
		kicker.className = 'toast-kicker';
		kicker.textContent = '✦ LUCKY CHARM EARNED ✦';
		const title = document.createElement('span');
		title.className = 'toast-title';
		title.textContent = `${charm.icon || '★'} ${charm.title}`;
		this.toast.append(kicker, title);
		this.toast.classList.remove('show');
		void this.toast.offsetWidth;
		this.toast.classList.add('show');
	}

	hideToast(): void {
		this.toast.classList.remove('show');
		this.toast.hidden = true;
	}
}
