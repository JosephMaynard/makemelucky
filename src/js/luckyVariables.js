export const ver = 0.42;

function testLocalStorage() {
  var test = "test";
  try {
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
}

export const luckyVariables = {
  ver,
  luckyPresses: 0,
  currentTime: new Date(),
  localStorageAvailable: testLocalStorage(),
  buttonReady: true,
  buttonReleased: false,
  android: navigator.userAgent.match(/Android/i),
  textRunning: true,
  luckStore: {
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
  },
  charmAwarded: false,
};
