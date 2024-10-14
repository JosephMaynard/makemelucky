import { luckyVariables } from "./luckyVariables";

if (luckyVariables.localStorageAvailable) {
  if (window.localStorage.getItem("luckStore")) {
    luckyVariables.luckStore = JSON.parse(localStorage.getItem("luckStore"));
    //Delete local storage on old versions
    if (luckyVariables.luckStore.version < 0.35) {
      localStorage.clear();
      createLuckStore();
    } else {
      //Update version
      if (luckyVariables.luckStore.version != luckyVariables.ver) {
        //Update function
        if (luckyVariables.luckStore.version < 0.41) {
          luckyVariables.luckStore.showModal = true;
          luckyVariables.luckStore.lastVisit = new Date().toISOString();
        }
        if (luckyVariables.luckStore.version < 0.42) {
          luckyVariables.lastVisit = new Date();
        }
        luckyVariables.luckStore.version = luckyVariables.ver;
      }

      //create array of names of chars already earned
      var charmsAlreadyEarned = [];

      for (var i = 0; i < luckyVariables.luckStore.charms.length; i++) {
        charmsAlreadyEarned.push(luckyVariables.luckStore.charms[i].title);
      }

      //luckyVariables.luckStore.firstUse = new Date(Date.parse(luckyVariables.luckStore.firstUse));
      luckyVariables.luckStore.lastVisit = new Date(
        Date.parse(luckyVariables.luckStore.lastVisit)
      );

      //Calculate Visits
      if (
        luckyVariables.currentTime - luckyVariables.luckStore.lastVisit >
        3600000
      ) {
        luckyVariables.luckStore.visits = luckyVariables.luckStore.visits + 1;
        for (var x in luckyCharms.visits) {
          if (luckyCharms.visits[x].amount == luckyVariables.luckStore.visits) {
            //Award Charm
            console.log(
              "You have earned the " +
                luckyCharms.visits[x].title +
                " Lucky Charm!"
            );
            awardLuckyCharm(luckyCharms.visits[x]);
          }
        }
      }

      //Calculate Days In Row Visited
      if (
        luckyVariables.currentTime - luckyVariables.luckStore.lastVisit <
          172800000 &&
        luckyVariables.currentTime.getDate() - 1 ==
          luckyVariables.luckStore.lastVisit.getDate()
      ) {
        luckyVariables.luckStore.daysInRow++;
        for (var x in luckyCharms.daysInRow) {
          if (
            luckyCharms.daysInRow[x].amount ==
              luckyVariables.luckStore.daysInRow &&
            charmsAlreadyEarned.indexOf(luckyCharms.daysInRow[x].title) === -1
          ) {
            //Award Charm
            console.log(
              "You have earned the " +
                luckyCharms.daysInRow[x].title +
                " Lucky Charm!"
            );
            awardLuckyCharm(luckyCharms.daysInRow[x]);
          }
        }
      } else {
        luckyVariables.luckStore.daysInRow = 1;
      }

      luckyVariables.luckStore.lastVisit = new Date().toISOString();

      //Add Charms to page
      if (luckyVariables.luckStore.charms.length > 0) {
        for (var i = 0; i < luckyVariables.luckStore.charms.length; i++) {
          appendCharm(luckyVariables.luckStore.charms[i]);
        }
      }

      storeTheLuck();
    }
  } else {
    createLuckStore();
  }
} else {
  $("#luckyCharms").hide();
}

function createLuckStore() {
  luckyVariables.luckStore = {
    luckyness: 0,
    visits: 1,
    longestPress: 0,
    daysInRow: 1,
    version: ver,
    charms: [],
    specialCharms: {},
    soundOn: true,
    vibrationOn: true,
    showModal: true,
    lastVisit: new Date().toISOString(),
    firstUse: new Date().toISOString(),
  };
  storeTheLuck();
}

export function storeTheLuck() {
  if (luckyVariables.localStorageAvailable) {
    var dataToStore = JSON.stringify(luckyVariables.luckStore);
    localStorage.setItem("luckStore", dataToStore);
  }
}
