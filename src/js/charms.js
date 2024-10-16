import { luckyVariables } from "./luckyVariables";
import { fireEvent } from "./events";

export const luckyCharms = {
  presses: {
    beginnersLuck: {
      title: "Beginner's luck!",
      description: "Press the Make Me Lucky button for the first time.",
      id: "beginnersLuck",
      x: "0",
      y: "0",
      amount: 1,
    },
    magicNumber: {
      title: "The Magic Number!",
      description: "Press the Make Me Lucky button 3 times.",
      id: "magicNumber",
      x: "7",
      y: "0",
      amount: 3,
    },
    luckySeven: {
      title: "Lucky 7!",
      description: "Press the Make Me Lucky button 7 times.",
      id: "luckySeven",
      x: "14",
      y: "0",
      amount: 7,
    },
    suddenFortune: {
      title: "Sudden Fortune and Prosperity!",
      description: "Press the Make Me Lucky button 8 times.",
      id: "suddenFortune",
      x: "21",
      y: "0",
      amount: 8,
    },
    luckyLongTime: {
      title: "Lucky Long Time!",
      description: "Press the Make Me Lucky button 9 times.",
      id: "luckyLongTime",
      x: "28",
      y: "0",
      amount: 9,
    },
    unluckyorSome: {
      title: "Unlucky for some, but not for you!",
      description: "Press the Make Me Lucky button 13 times.",
      id: "unluckyorSome",
      x: "35",
      y: "0",
      amount: 13,
    },
    sweetLuck: {
      title: "Super Sweet Luck!",
      description: "Press the Make Me Lucky button 16 times.",
      id: "sweetLuck",
      x: "42",
      y: "0",
      amount: 13,
    },
    luckyUniverse: {
      title: "Luck of the Universe and Everything!",
      description: "Press the Make Me Lucky button 42 times.",
      id: "luckyUniverse",
      x: "48",
      y: "0",
      amount: 42,
    },
    halfCentury: {
      title: "Half Century of Luck!",
      description: "Press the Make Me Lucky button 50 times.",
      id: "halfCentury",
      x: "55",
      y: "0",
      amount: 50,
    },
    hotLuck: {
      title: "Hot Luck!",
      description: "Press the Make Me Lucky button 69 times.",
      id: "hotLuck",
      x: "62",
      y: "0",
      amount: 69,
    },
    wealthyx2: {
      title: "Wealthy Wealthy!",
      description:
        "Two times the prosperity, press the Make Me Lucky button 88 times.",
      id: "wealthyx2",
      x: "69",
      y: "0",
      amount: 88,
    },
    eternalLuck: {
      title: "Eternal Luckiness!",
      description: "Press the Make Me Lucky button 99 times.",
      id: "eternalLuck",
      x: "76",
      y: "0",
      amount: 99,
    },
    century: {
      title: "Century of Luck!",
      description: "Press the Make Me Lucky button 100 times.",
      id: "century",
      x: "83",
      y: "0",
      amount: 100,
    },
    maximumBreak: {
      title: "Maximum Break Luck!",
      description: "Press the Make Me Lucky button 147 times.",
      id: "maximumBreak",
      x: "90",
      y: "0",
      amount: 147,
    },
    fortuneAllTheWay: {
      title: "Great Fortune all the Way!",
      description: "Press the Make Me Lucky button 168 times.",
      id: "fortuneAllTheWay",
      x: "100",
      y: "0",
      amount: 168,
    },
    bargainLuck: {
      title: "Bargain Luckiness!",
      description: "Press the Make Me Lucky button 241 times.",
      id: "bargainLuck",
      x: "0",
      y: "7",
      amount: 241,
    },
    beastlyLuck: {
      title: "Beastly Luck!",
      description:
        "Press the Make Me Lucky button Six Hundred and Sixty Six times.",
      id: "beastlyLuck",
      x: "7",
      y: "7",
      amount: 666,
    },
    greatFortuneAllTheWay: {
      title: "Great Fortune all the Way!",
      description: "Press the Make Me Lucky button 768 times.",
      id: "greatFortuneAllTheWay",
      x: "14",
      y: "7",
      amount: 768,
    },
    wealthyx3: {
      title: "Wealthy Wealthy Wealthy!",
      description:
        "Three times the prosperity, press the Make Me Lucky button 888 times.",
      id: "wealthyx3",
      x: "21",
      y: "7",
      amount: 888,
    },
    millennium: {
      title: "The Millennium!",
      description: "Press the Make Me Lucky button One Thousand times.",
      id: "millennium",
      x: "28",
      y: 7,
      amount: 1000,
    },
  },
  visits: {
    backForMore: {
      title: "Back for More Luck!",
      description: "Return to Make Me Lucky.",
      id: "backForMore",
      x: "0",
      y: "69",
      amount: 2,
    },
    crowd: {
      title: "Crowded Luck!",
      description: "Visit Make Me Lucky 3 times.",
      id: "crowd",
      x: "7",
      y: "69",
      amount: 3,
    },
    magnificent: {
      title: "Magnificent Luck!",
      description: "Visit Make Me Lucky 7 times.",
      id: "magnificent",
      x: "14",
      y: "69",
      amount: 7,
    },
    xVisits: {
      title: "X Visits Luck!",
      description: "Visit Make Me Lucky 10 times.",
      id: "xVisits",
      x: "21",
      y: "69",
      amount: 10,
    },
  },
  daysInRow: {
    doveLuck: {
      title: "The Dove of Luck!",
      description: "Visit Make Me Lucky two days in a row.",
      id: "doveLuck",
      x: "0",
      y: "83",
      amount: 2,
    },
    frenchLuck: {
      title: "French Luck!",
      description:
        "Visit Make Me Lucky three days in a row. Oh là là, très bien!",
      id: "frenchLuck",
      x: "7",
      y: "83",
      amount: 3,
    },
    birdsLuck: {
      title: "The Birds Of Luck!",
      description: "Visit Make Me Lucky four days in a row.",
      id: "birdsLuck",
      x: "14",
      y: "83",
      amount: 4,
    },
    goldenRings: {
      title: "The Golden Rings Of Luck!",
      description: "Visit Make Me Lucky five days in a row.",
      id: "goldenRings",
      x: "21",
      y: "83",
      amount: 5,
    },
    geeseLuck: {
      title: " The Geese Of Luck!",
      description: "Visit Make Me Lucky six days in a row.",
      id: "geeseLuck",
      x: "28",
      y: "83",
      amount: 6,
    },
    swans: {
      title: "The Swans of Luck!!",
      description: "Visit Make Me Lucky every day for a week.",
      id: "swans",
      x: "35",
      y: "83",
      amount: 7,
    },
    milkMaidsLuck: {
      title: "Milk Maids Of Luck!",
      description: "Visit Make Me Lucky four days in a row.",
      id: "milkMaidsLuck",
      x: "42",
      y: "83",
      amount: 8,
    },
    dancingLadiesLuck: {
      title: "Luck Be A Lady Tonight!",
      description: "Visit Make Me Lucky nine days in a row.",
      id: "milkMaidsLuck",
      x: "49",
      y: "83",
      amount: 9,
    },
    lordsLuck: {
      title: "The Lords Of Luck!",
      description: "Visit Make Me Lucky ten days in a row.",
      id: "lordsLuck",
      x: "56",
      y: "83",
      amount: 10,
    },
    pipersLuck: {
      title: "Pipers At the Gates Of Luck!",
      description: "Visit Make Me Lucky eleven days in a row.",
      id: "pipersLuck",
      x: "63",
      y: "83",
      amount: 11,
    },
    drummersLuck: {
      title: "The Drummers Of Luck!",
      description: "Visit Make Me Lucky twelve days in a row.",
      id: "drummersLuck",
      x: "70",
      y: "83",
      amount: 12,
    },
    fortKnight: {
      title: "Fort Knight's Luck!",
      description: "Visit Make Me Lucky fourteen days in a row.",
      id: "drummersLuck",
      x: "77",
      y: "83",
      amount: 14,
    },
    lunaCycle: {
      title: "Luna Cycle Luck!",
      description: "Visit Make Me Lucky 28 days in a row.",
      id: "lunaCycle",
      x: "84",
      y: "83",
      amount: 28,
    },
    monthOfLuck: {
      title: "Month Of Luck!",
      description: "Visit Make Me Lucky 31 days in a row.",
      id: "monthOfLuck",
      x: "84",
      y: "83",
      amount: 31,
    },
    yearOfLuck: {
      title: "Month Of Luck!",
      description: "Visit Make Me Lucky 365 days in a row. Luckiest Year Ever!",
      id: "yearOfLuck",
      x: "91",
      y: "83",
      amount: 365,
    },
  },
  social: {
    facebook: {
      title: "Share the Luck!",
      description: "Like Make Me Lucky on Facebook.",
      id: "facebook",
      x: "0",
      y: "100",
    },
    twitter: {
      title: "Tweets of Luck!",
      description: "A little bird told us you Tweet ed Make Me Lucky.",
      id: "twitter",
      x: "7",
      y: "100",
    },
    pinterest: {
      title: "Lucky Pins!",
      description: "Pin Make Me Lucky on Pinterest.",
      id: "pinterest",
      x: "14",
      y: "100",
    },
    whatsapp: {
      title: "Whats Luck?",
      description: "Share Make Me Lucky on WhatsApp.",
      id: "whatsapp",
      x: "21",
      y: "100",
    },
    reddit: {
      title: "Alien Luck!",
      description: "Submit or upvote Make Me Lucky on Reddit.",
      id: "reddit",
      x: "28",
      y: "100",
    },
    email: {
      title: "Post Some Luck!",
      description: "Email some luck with Make Me Lucky.",
      id: "email",
      x: "35",
      y: "100",
    },
    googleplus: {
      title: "Elusive Luck Plus!",
      description:
        "Share Make Me Lucky on Google Plus (we didn't think anyone would ever that!).",
      id: "googleplus",
      x: "42",
      y: "100",
    },
    linkedin: {
      title: "Career Luck!",
      description: "Share Make Me Lucky on LinkedIn.",
      id: "linkedin",
      x: "49",
      y: "100",
    },
    buffer: {
      title: "Lucky Buffer!",
      description: "Queue Make Me Lucky on Buffer.",
      id: "buffer",
      x: "56",
      y: "100",
    },
    stumbleupon: {
      title: "Stumbling Luck!",
      description: "Share Make Me Lucky on StumbleUpon.",
      id: "stumbleupon",
      x: "63",
      y: "100",
    },
    hacker: {
      title: "Hacker's Luck!",
      description: "Discover functional Luck!",
      id: "hacker",
      x: "70",
      y: "100",
    },
    impossible: {
      title: "Impossible Luck!",
      description: "Achieve The Impossible! You must be VERY lucky indeed!",
      id: "impossible",
      x: "77",
      y: "100",
    },
  },
};

export function awardLuckyCharm(charm) {
  var date = new Date();
  luckyVariables.luckStore.charms.push({
    title: charm.title,
    description: charm.description,
    x: charm.x,
    y: charm.y,
    date: date.toISOString(),
  });
  appendCharm(
    luckyVariables.luckStore.charms[luckyVariables.luckStore.charms.length - 1]
  );
  luckyVariables.charmAwarded = true;
  //console.log(charm);
  fireEvent("Charm Awarded", charm.title);
  console.log("You earned a Luck Charm: " + charm.title);
}

export function appendCharm(charm) {
  const date = new Date(Date.parse(charm.date));
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  let minutes =
    date.getMinutes() < 10 ? `0${date.getMinutes()}` : date.getMinutes();
  let suffix = "th";

  // Determine the correct suffix for the day of the month
  const day = date.getDate();
  if (day === 1 || day === 21 || day === 31) {
    suffix = "st";
  } else if (day === 2 || day === 22) {
    suffix = "nd";
  } else if (day === 3 || day === 23) {
    suffix = "rd";
  }

  // Create the charm element
  const charmElement = document.createElement("div");
  charmElement.classList.add("charm");

  charmElement.innerHTML = `
    <div class="charmIcon" style="background-position: ${charm.x}% ${
    charm.y
  }%"></div>
    <p>
      <span>${charm.title}</span><br/>
      ${charm.description}<br/>
      <b>Awarded:</b> ${day}<sup>${suffix}</sup> ${
    monthNames[date.getMonth()]
  } ${date.getFullYear()} - ${date.getHours()}:${minutes}
    </p>
  `;

  // Append the new charm element to the container
  const charmsContainer = document.getElementById("luckyCharmsContainer");
  charmsContainer.appendChild(charmElement);
}

export function createCharmsArrays() {
  luckyVariables.pressesArray = [];
  for (var x in luckyCharms.presses) {
    if (luckyCharms.presses[x].amount > luckyVariables.luckStore.luckyness) {
      luckyVariables.pressesArray.push(luckyCharms.presses[x].amount);
    }
  }
}
