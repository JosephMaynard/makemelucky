// The console Easter egg. Anyone who opens DevTools gets the machine drawn back
// at them in blocks, plus the keys to the toy box.
//
// The art is stored as CLASS markers, not glyphs: each character names a
// material, and print time maps it to both a block glyph and a colour, so the
// roundel comes out gold-bezelled with a ruby cap instead of flat monochrome.
// Generated from the real geometry (a circle sampled on a 1:2 character cell),
// which is why the arcs actually read as arcs.

const ART = [
	'        #####:::::#####',
	'      ##:::::~~~~~:::::##',
	'    ##:::~~~~#####~~~~:::##',
	'   ##::~~~##@@@@@@@##~~~::##',
	'  ##::~~##@@@@@@@@@@@##~~::##',
	'  #::~~##@@@@@MAKE@@@@##~~::#',
	' ##::~~##@@@@@@ME@@@@@##~~::##',
	'  #::~~##@@@@LUCKY@@@@##~~::#',
	'  ##::~~##@@@@@@@@@@@##~~::##',
	'   ##::~~~##@@@@@@@##~~~::##',
	'    ##:::~~~~#####~~~~:::##',
	'      ##:::::~~~~~:::::##',
	'        #####:::::#####'
].join('\n');

// line-height:1 closes the gaps between rows of block characters — without it
// the console's default leading slices the roundel into venetian blinds
const BASE = 'line-height:1;font-family:ui-monospace,Menlo,Consolas,monospace;';
const MATERIALS: Record<string, { glyph: string; style: string }> = {
	'#': { glyph: '█', style: BASE + 'color:#d8a93f' }, // gold bezel + collar
	':': { glyph: '░', style: BASE + 'color:#a8b6c2' }, // pearl ring
	'~': { glyph: '▒', style: BASE + 'color:#4a72a8' }, // blue star band
	'@': { glyph: '█', style: BASE + 'color:#b32b39' }, // ruby cap
	' ': { glyph: ' ', style: BASE }
};
const LABEL = { glyph: '', style: BASE + 'color:#fdf6e6;font-weight:bold' };

/** Split the art into runs of one material so each gets its own %c colour. */
function paint(art: string): [string, string[]] {
	let format = '';
	const styles: string[] = [];
	let run = '';
	let runKey = '';
	const flush = () => {
		if (!run) return;
		format += '%c' + run;
		styles.push((MATERIALS[runKey] ?? LABEL).style);
		run = '';
	};
	for (const ch of art) {
		if (ch === '\n') {
			flush();
			format += '\n';
			runKey = '';
			continue;
		}
		const key = ch in MATERIALS ? ch : 'L'; // anything else is label text
		if (key !== runKey) {
			flush();
			runKey = key;
		}
		run += MATERIALS[key]?.glyph ?? ch; // label letters keep their own glyph
	}
	flush();
	return [format, styles];
}

const HEAD = 'font:600 13px ui-monospace,Menlo,Consolas,monospace;';

/** Effect names, three to a row, so the list reads as a menu not a wall. */
export function printEffectList(names: readonly string[]): void {
	const width = Math.max(...names.map((n) => n.length)) + 3;
	const rows: string[] = [];
	for (let i = 0; i < names.length; i += 3) {
		rows.push('  ' + names.slice(i, i + 3).map((n) => n.padEnd(width)).join('').trimEnd());
	}
	console.log(
		`%c${names.length} luck effects%c\n${rows.join('\n')}`,
		HEAD + 'color:#d8a93f',
		HEAD + 'color:#9fb0bd'
	);
}

/** Draw the machine in the console, once, on boot. */
export function printConsoleBanner(names: readonly string[]): void {
	try {
		const [format, styles] = paint(ART);
		console.log(format, ...styles);
		console.log(
			'%c☘ You found the back of the machine.%c\n' +
				`  %cshowEffect('${names[0] ?? 'rainbow'}')%c  play any of the ${names.length} luck effects\n` +
				'  %cshowEffect()%c              list every effect by name\n' +
				'%c  (press the big red button once first — browsers keep the sound\n' +
				'   asleep until you touch the page, and these effects have scores.)',
			HEAD + 'color:#d8a93f',
			HEAD + 'color:#9fb0bd',
			HEAD + 'color:#fdf6e6;font-weight:600',
			HEAD + 'color:#9fb0bd',
			HEAD + 'color:#fdf6e6;font-weight:600',
			HEAD + 'color:#9fb0bd',
			HEAD + 'color:#6f7d88;font-style:italic'
		);
	} catch {
		// a console that can't do %c is not a reason to break boot
	}
}
