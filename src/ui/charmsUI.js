// Lucky Charms drawer (in the content section) + the award toast in the hero.

const monthNames = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December'
];

function ordinal(day) {
	if (day === 1 || day === 21 || day === 31) return 'st';
	if (day === 2 || day === 22) return 'nd';
	if (day === 3 || day === 23) return 'rd';
	return 'th';
}

function formatDate(iso) {
	const d = new Date(iso);
	if (isNaN(d)) return '';
	const mins = String(d.getMinutes()).padStart(2, '0');
	return `${d.getDate()}<sup>${ordinal(d.getDate())}</sup> ${monthNames[d.getMonth()]} ${d.getFullYear()} — ${d.getHours()}:${mins}`;
}

export class CharmsUI {
	constructor(store) {
		this.store = store;
		this.container = document.getElementById('lucky-charms-container');
		this.progress = document.getElementById('charms-progress');
		this.toast = document.getElementById('charm-toast');
	}

	renderAll() {
		this.container.innerHTML = '';
		const charms = this.store.data.charms.slice().reverse(); // newest first
		for (const charm of charms) this._append(charm);
		this.updateProgress();
	}

	_append(charm) {
		const el = document.createElement('div');
		el.className = 'charm';
		const iconSize = String(charm.icon || '★').length > 2 ? 'font-size:16px' : '';
		el.innerHTML =
			`<div class="charm-icon" style="${iconSize}">${charm.icon || '★'}</div>` +
			`<p><span class="charm-title">${charm.title}</span><br/>${charm.description}` +
			`<span class="charm-date"><b>Awarded:</b> ${formatDate(charm.date)}</span></p>`;
		this.container.prepend(el);
	}

	addCharm(charm) {
		this._append(charm);
		this.updateProgress();
	}

	updateProgress() {
		const n = this.store.data.luckyness;
		const next = this.store.nextPressCharm();
		this.progress.textContent = next
			? `You've pressed the button ${n.toLocaleString()} ${n === 1 ? 'time' : 'times'}. ` +
				`Your next Lucky Charm arrives at ${next.amount.toLocaleString()} ${next.amount === 1 ? 'press' : 'presses'}…`
			: `You've pressed the button ${n.toLocaleString()} times and earned every pressing charm we have. Astonishing luck.`;
	}

	showToast(charm) {
		this.toast.hidden = false;
		this.toast.innerHTML =
			`<span class="toast-kicker">✦ LUCKY CHARM EARNED ✦</span>` +
			`<span class="toast-title">${charm.icon || '★'} ${charm.title}</span>`;
		this.toast.classList.remove('show');
		void this.toast.offsetWidth;
		this.toast.classList.add('show');
	}
}
