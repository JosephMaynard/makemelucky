// Lucky Charm definitions. Titles are kept from V2 so migrated charms match up.

export interface Charm {
	id: string;
	title: string;
	description: string;
	icon: string;
	amount?: number; // present on threshold charms (press/visit/streak), absent on specials
	date?: string; // stamped when the charm is awarded and stored
}

export const PRESS_CHARMS: Charm[] = [
	{ id: 'beginnersLuck', amount: 1, icon: '🍀', title: "Beginner's luck!", description: 'Press the Make Me Lucky button for the first time.' },
	{ id: 'magicNumber', amount: 3, icon: '3', title: 'The Magic Number!', description: 'Press the Make Me Lucky button 3 times.' },
	{ id: 'luckySeven', amount: 7, icon: '7', title: 'Lucky 7!', description: 'Press the Make Me Lucky button 7 times.' },
	{ id: 'suddenFortune', amount: 8, icon: '8', title: 'Sudden Fortune and Prosperity!', description: 'Press the Make Me Lucky button 8 times.' },
	{ id: 'luckyLongTime', amount: 9, icon: '9', title: 'Lucky Long Time!', description: 'Press the Make Me Lucky button 9 times.' },
	{ id: 'unluckyForSome', amount: 13, icon: '13', title: 'Unlucky for some, but not for you!', description: 'Press the Make Me Lucky button 13 times.' },
	{ id: 'sweetLuck', amount: 16, icon: '16', title: 'Super Sweet Luck!', description: 'Press the Make Me Lucky button 16 times.' },
	{ id: 'luckyUniverse', amount: 42, icon: '42', title: 'Luck of the Universe and Everything!', description: 'Press the Make Me Lucky button 42 times.' },
	{ id: 'halfCentury', amount: 50, icon: '50', title: 'Half Century of Luck!', description: 'Press the Make Me Lucky button 50 times.' },
	{ id: 'sixSeven', amount: 67, icon: '67', title: 'SIX SEVEN!', description: 'Press the Make Me Lucky button 67 times, then say it out loud while doing the hands. You have to. In memory of the stupidest meme of 2025.' },
	{ id: 'hotLuck', amount: 69, icon: '69', title: 'Hot Luck!', description: 'Press the Make Me Lucky button 69 times.' },
	{ id: 'wealthyx2', amount: 88, icon: '88', title: 'Wealthy Wealthy!', description: 'Two times the prosperity. Press the Make Me Lucky button 88 times.' },
	{ id: 'eternalLuck', amount: 99, icon: '99', title: 'Eternal Luckyness!', description: 'Press the Make Me Lucky button 99 times.' },
	{ id: 'century', amount: 100, icon: '💯', title: 'Century of Luck!', description: 'Press the Make Me Lucky button 100 times.' },
	{ id: 'maximumBreak', amount: 147, icon: '🎱', title: 'Maximum Break Luck!', description: 'Press the Make Me Lucky button 147 times.' },
	{ id: 'fortuneAllTheWay', amount: 168, icon: '168', title: 'Fortune all the Way!', description: 'Press the Make Me Lucky button 168 times.' },
	{ id: 'bargainLuck', amount: 241, icon: '241', title: 'Bargain Luckyness!', description: 'Press the Make Me Lucky button 241 times.' },
	{ id: 'beastlyLuck', amount: 666, icon: '😈', title: 'Beastly Luck!', description: 'Press the Make Me Lucky button Six Hundred and Sixty Six times.' },
	{ id: 'greatFortune', amount: 768, icon: '768', title: 'Great Fortune all the Way!', description: 'Press the Make Me Lucky button 768 times.' },
	{ id: 'wealthyx3', amount: 888, icon: '888', title: 'Wealthy Wealthy Wealthy!', description: 'Three times the prosperity. Press the Make Me Lucky button 888 times.' },
	{ id: 'millennium', amount: 1000, icon: '1K', title: 'The Millennium!', description: 'Press the Make Me Lucky button one thousand times.' }
];

export const VISIT_CHARMS: Charm[] = [
	{ id: 'backForMore', amount: 2, icon: '↩', title: 'Back for More Luck!', description: 'Return to Make Me Lucky.' },
	{ id: 'crowd', amount: 3, icon: '3×', title: 'Crowded Luck!', description: 'Visit Make Me Lucky 3 times.' },
	{ id: 'regular', amount: 10, icon: '☕', title: 'Regular Dose of Fortune!', description: 'Visit Make Me Lucky 10 times.' }
];

export const STREAK_CHARMS: Charm[] = [
	{ id: 'streak3', amount: 3, icon: '🔥', title: 'Three-Day Flame!', description: 'Visit Make Me Lucky 3 days in a row. Officially a habit.' },
	{ id: 'week', amount: 7, icon: '📅', title: 'The Week of Luck!', description: 'Visit Make Me Lucky every day for a week.' },
	{ id: 'streak30', amount: 30, icon: '🌙', title: 'The Lucky Month!', description: 'Visit Make Me Lucky every day for thirty days. A full lunation of fortune.' },
	{ id: 'streak88', amount: 88, icon: '8️⃣', title: 'Double Infinity!', description: '88 days in a row. The luckiest number, standing on its own shoulders.' },
	{ id: 'streak365', amount: 365, icon: '🏆', title: 'A Year of Fortune!', description: 'Every single day for a year. At this point the luck visits YOU.' }
];

export const SPECIAL_CHARMS: Charm[] = [
	{ id: 'share', icon: '⭐', title: 'Share the Luck!', description: 'Share Make Me Lucky with your friends and make them lucky too.' },
	{ id: 'steadyHand', icon: '🤚', title: 'Steady Hand of Fortune!', description: 'Hold the Make Me Lucky button down for a full 8 seconds.' },
	{ id: 'installed', icon: '📌', title: 'Luck in your Pocket!', description: 'Install Make Me Lucky as an app. Luck works offline too.' }
];

export const ALL_CHARMS: Charm[] = [...PRESS_CHARMS, ...VISIT_CHARMS, ...STREAK_CHARMS, ...SPECIAL_CHARMS];
export const byTitle: Map<string, Charm> = new Map(ALL_CHARMS.map((c) => [c.title, c]));
export const byId: Map<string, Charm> = new Map(ALL_CHARMS.map((c) => [c.id, c]));
