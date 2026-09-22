// Local-calendar day helpers. The ritual, the daily fortune and the dossier
// forecast all promise "changes at midnight" — YOUR midnight — so none of
// them may divide Date.now() by 86,400,000 (that is UTC midnight) or subtract
// 24 hours to find yesterday (that is wrong across a DST change).

/** 'YYYY-MM-DD' in the visitor's local calendar. */
export function dayKey(d: Date = new Date()): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

/** Whole days since 1970-01-01 for the LOCAL calendar date — a deterministic
 *  seed that ticks over at local midnight and is immune to DST. */
export function dayIndex(d: Date = new Date()): number {
	return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

/** The local calendar day `n` days away from `d` (default: yesterday). */
export function shiftDay(d: Date, n = -1): Date {
	const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12);
	return out;
}

/** True when `a` and `b` fall on the same local calendar day. */
export function sameDay(a: Date, b: Date): boolean {
	return dayKey(a) === dayKey(b);
}

/** Milliseconds until the next local midnight (at least 1s). */
export function msUntilMidnight(now: Date = new Date()): number {
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
	return Math.max(1000, +next - +now);
}
