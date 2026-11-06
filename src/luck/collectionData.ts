// The Collection: one card per luck effect, filed the first time a visitor
// sees it through to the end. Keys must match the director's registry plus
// gentleGlow (the reduced-motion stand-in), and there is a test for that.
//
// House style for `luck`: the flavour of fortune each one "channels", in the
// register of a horoscope. Deniable, never a promise, never a guarantee, and
// never a description of what the effect looks like (that would spoil the
// show for whoever hasn't collected it yet).

export interface CollectionCard {
	title: string;
	icon: string;
	luck: string;
}

export const COLLECTION: Record<string, CollectionCard> = {
	powerSurge: {
		title: 'Power Surge',
		icon: '🔌',
		luck: 'A jolt of momentum for stalled projects and slow mornings. Best applied shortly before anything with a deadline.'
	},
	spinUp: {
		title: 'Spin Up',
		icon: '🌀',
		luck: 'Luck for things that need to get going: engines, careers, and conversations at parties.'
	},
	runeCircle: {
		title: 'Rune Circle',
		icon: '🔮',
		luck: 'Old luck, the sort carved into things. Suited to exams, interviews and finding the right words at the right time.'
	},
	portalDrop: {
		title: 'Portal Drop',
		icon: '🕳️',
		luck: 'Luck for arrivals and departures. Travel, house moves, and leaving a meeting at exactly the right moment.'
	},
	cloudTunnel: {
		title: 'Cloud Tunnel',
		icon: '☁️',
		luck: 'Fortune with a tailwind. Journeys, commutes, and the fast lane opening up when it matters.'
	},
	starBurst: {
		title: 'Star Burst',
		icon: '✨',
		luck: 'A scattering of small, bright luck. Lost keys found, lifts arriving, the good biscuit still in the tin.'
	},
	goldRush: {
		title: 'Gold Rush',
		icon: '💰',
		luck: 'Prosperity-flavoured luck. Does not guarantee money. Has been known to coincide with it.'
	},
	cloverVortex: {
		title: 'Clover Vortex',
		icon: '🍀',
		luck: 'The classic. General-purpose good fortune, concentrated, no further questions.'
	},
	aurora: {
		title: 'Aurora',
		icon: '🌌',
		luck: 'Quiet luck. Calm days, kind weather, and news that turns out to be fine after all.'
	},
	fireworks: {
		title: 'Fireworks',
		icon: '🎆',
		luck: 'Celebration luck. For launches, openings, results days and anything that deserves applause.'
	},
	clockworkOverdrive: {
		title: 'Clockwork Overdrive',
		icon: '⚙️',
		luck: 'Punctual fortune. Trains caught, timings aligned, the universe briefly running to schedule.'
	},
	fireflies: {
		title: 'Fireflies',
		icon: '💡',
		luck: 'Gentle, glowing luck for finding your way. Ideal before decisions, dates and dark car parks.'
	},
	rainbow: {
		title: 'Rainbow',
		icon: '🌈',
		luck: 'Luck for after the rain. Recoveries, second chances, and things ending better than they started.'
	},
	cosmicDrift: {
		title: 'Cosmic Drift',
		icon: '🪐',
		luck: 'Big-picture luck. Long plans, slow wins, and the sense that things are quietly lining up.'
	},
	diceStorm: {
		title: 'Dice Storm',
		icon: '🎲',
		luck: 'Luck for games of chance and anything decided by a roll, a draw or a coin. Results may vary. Results will, in fact, vary.'
	},
	discoFever: {
		title: 'Disco Fever',
		icon: '🪩',
		luck: 'Social luck. Parties, dance floors, and the confidence to be seen enjoying yourself.'
	},
	ufoAbduction: {
		title: 'UFO Abduction',
		icon: '🛸',
		luck: 'Luck of the unexpected kind. Surprises, plot twists, and being chosen for things.'
	},
	pinball: {
		title: 'Pinball',
		icon: '🕹️',
		luck: 'Bouncing luck: the kind that ricochets off a setback and lands somewhere better.'
	},
	cardCyclone: {
		title: 'Card Cyclone',
		icon: '🃏',
		luck: 'Luck for hands dealt and bluffs called. Card nights, negotiations, poker faces.'
	},
	horseshoeToss: {
		title: 'Horseshoe Toss',
		icon: '🐴',
		luck: 'Traditional luck, thrown with intent. Good for competitions, bets, and aiming at things.'
	},
	fortuneCookie: {
		title: 'Fortune Cookie',
		icon: '🥠',
		luck: 'Luck with a message attached. Decisions, dilemmas, and anything you were waiting for a sign about.'
	},
	makeItRain: {
		title: 'Make It Rain',
		icon: '💸',
		luck: 'Abundance-adjacent luck. Payday, refunds, and the note you find in an old coat.'
	},
	jollyRoger: {
		title: 'Jolly Roger',
		icon: '🏴‍☠️',
		luck: 'Luck for the adventurous. Bold moves, treasure hunts, and going after what you actually want.'
	},
	kpopLuck: {
		title: 'K-Pop Luck',
		icon: '🎤',
		luck: 'Spotlight luck. Auditions, performances, and being noticed on purpose.'
	},
	luckDragon: {
		title: 'Luck Dragon',
		icon: '🐉',
		luck: 'The heavy stuff. Prosperity, strength and protection, for the days that need all three.'
	},
	slotArm: {
		title: 'Slot Arm',
		icon: '🎰',
		luck: 'Jackpot luck. Prizes, draws, and the one in a million. Terms and conditions apply to the universe.'
	},
	solarEclipse: {
		title: 'Solar Eclipse',
		icon: '🌑',
		luck: 'Rare-alignment luck. For once-in-a-lifetime chances and moments of perfect timing.'
	},
	genieOfTheMachine: {
		title: 'Genie of the Machine',
		icon: '🧞',
		luck: 'Wish luck. Choose carefully, phrase precisely, and do not ask for more wishes.'
	},
	violetHour: {
		title: 'Violet Hour',
		icon: '🌆',
		luck: 'Evening luck. Dinners, dates, and plans that start late and end well.'
	},
	wishingWell: {
		title: 'Wishing Well',
		icon: '🪙',
		luck: 'Patient luck. Hopes that take their time, and then arrive all at once.'
	},
	senbazuru: {
		title: 'Senbazuru',
		icon: '🕊️',
		luck: 'A thousand cranes’ worth of luck for health, recovery and long-held wishes.'
	},
	badLuckGauntlet: {
		title: 'Bad Luck Gauntlet',
		icon: '🪞',
		luck: 'Protective luck. Ladders, mirrors, black cats and the thirteenth of anything: all survived, all cancelled out.'
	},
	manekiNeko: {
		title: 'Maneki Neko',
		icon: '🐱',
		luck: 'Beckoning luck. Customers, visitors, opportunities, and good things wandering in through the door.'
	},
	luckyTacos: {
		title: 'Lucky Tacos',
		icon: '🌮',
		luck: 'Luck for the hungry. Meals, meetings over food, and the last table at the good place.'
	},
	fairyKingdom: {
		title: 'Fairy Kingdom',
		icon: '🧚',
		luck: 'Enchanted luck. Small kindnesses, found things, and favours quietly returned by the universe.'
	},
	bhangraBaraat: {
		title: 'Bhangra Baraat',
		icon: '🥁',
		luck: 'Procession luck. Weddings, celebrations, and any occasion with a great many people dancing.'
	},
	gentleGlow: {
		title: 'Gentle Glow',
		icon: '🕯️',
		luck: 'Soft luck for quiet days. Nothing dramatic, everything slightly better.'
	}
};

export const COLLECTION_SIZE = Object.keys(COLLECTION).length;

/** The charm a visitor earns the first time they see an effect through. */
export function collectionCharm(name: string): { id: string; title: string; description: string; icon: string } | null {
	const card = COLLECTION[name];
	if (!card) return null;
	return {
		id: `fx-${name}`,
		title: `Collected: ${card.title}`,
		description: `You witnessed ${card.title} from start to finish. It is now in your collection, and the machine will replay it whenever you ask.`,
		icon: card.icon
	};
}
