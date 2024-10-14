import Velocity from "velocity-animate";
import { screenText } from "./screen";
import { luckyVariables } from "./luckyVariables";
import { fireEvent } from "./events";
import { awardLuckyCharm, createCharmsArrays } from "./charms";
import { sound } from "./effects";

function resizeWindow() {
  console.log("Resize");

  const mainArea = document.getElementById("mainArea");
  mainArea.style.height = `${window.innerHeight}px`;

  const luckBox = document.querySelector(".luckBox");
  const adStripHeight = document.getElementById("adStrip").offsetHeight;

  if (luckBox.offsetHeight < window.innerHeight - adStripHeight) {
    // Center Luck Box vertically
    const topPosition =
      (window.innerHeight - luckBox.offsetHeight - adStripHeight) / 2 +
      adStripHeight;
    luckBox.style.top = `${topPosition}px`;
    document.querySelector(".luckyAreaContainer").style.width = "100%";
    document.getElementById("screen").style.fontSize = "1em";
  } else if (luckBox.offsetHeight * 0.75 < window.innerHeight - adStripHeight) {
    // Make Luck Box Smaller to fit on screen
    luckBox.style.top = `${adStripHeight - 5}px`;
    const newWidth = Math.round((window.innerHeight - adStripHeight) / 1.2);
    document.querySelector(".luckyAreaContainer").style.width = `${newWidth}px`;
    document.getElementById("screen").style.fontSize = `${Math.round(
      newWidth / 600
    )}em`;
  } else {
    // Reset to standard CSS sizes
    luckBox.style.top = `${adStripHeight - 5}px`;
    document.querySelector(".luckyAreaContainer").style.width = "100%";
    document.getElementById("screen").style.fontSize = "1em";
  }
}

window.makeMeLucky = function () {
  if (!luckyVariables?.luckStore?.specialCharms?.hacker) {
    luckyVariables.luckStore.specialCharms.hacker = true;
    awardLuckyCharm(luckyCharms.social.hacker);
    storeTheLuck();
  }
  return "You are now LUCKY!";
};

resizeWindow();

function hideLoadingScreen() {
  window.scrollTo(0, 0);
  const loadingSpinner = document.getElementById("loadingSpinner");
  const loading = document.getElementById("loading");

  Velocity(
    loadingSpinner,
    { opacity: 0, scaleX: 2, scaleY: 2 },
    { display: "none", duration: 1000, easing: "easeInCubic" }
  );
  Velocity(
    loading,
    { opacity: 0 },
    {
      display: "none",
      duration: 1000,
      easing: "easeInCubic",
      complete: function () {
        setTimeout(screenText.welcome, 100);
      },
    }
  );
}

window.addEventListener("resize", () => setTimeout(resizeWindow, 10));

const imageList = [
  // Array of image names
  "loading_ring_back.png",
  "loading_ring_front.png",
  "clouds.png",
  "rim_top.png",
  "rim_right.png",
  // Add the rest of the image names
];

function preLoadImages(
  imageArray,
  callBack = () => console.log("All images loaded."),
  path = ""
) {
  let loadedImages = 0;
  const preLoadedImages = imageArray.map((imageName) => {
    const img = new Image();
    img.onload = () => {
      loadedImages++;
      if (loadedImages === imageArray.length) {
        callBack();
      }
    };
    img.src = `${path}${imageName}`;
    return img;
  });
}

function pageLoaded() {
  createCharmsArrays();
  resizeWindow();

  document
    .querySelectorAll("#screenText3 .line1, #screenText3 .line2")
    .forEach((element) => {
      element.innerHTML = "";
    });

  if (!luckyVariables.luckStore.soundOn) {
    sound.mute();
    sound.volume(0);
    document.getElementById("muteIcon").style.backgroundPosition = "100% 50%";
  }

  fireEvent("Page Loaded", `Visits: ${luckyVariables.luckStore.visits}`);
  console.log("Welcome to Make Me Lucky! Version: ", luckyVariables.ver);
  document.body.style.overflow = "auto";
  document.documentElement.style.height = "auto";
  setTimeout(hideLoadingScreen, 300);
}

document.body.style.overflow = "hidden";
document.documentElement.style.height = "100%";

preLoadImages(imageList, pageLoaded, "img/");

const scrolledItems = { pageUp: false };

window.addEventListener("scroll", () => {
  const topOfWindow = window.scrollY;
  const bottomOfWindow = topOfWindow + window.innerHeight;
  const pageDownTarget = document.getElementById("pageDownTarget");

  document
    .querySelectorAll(".card, #footer, #smallprint")
    .forEach((element) => {
      const cardPos = element.getBoundingClientRect().top + topOfWindow;
      if (cardPos < topOfWindow + 50 && !scrolledItems[element.id]) {
        scrolledItems[element.id] = true;
        fireEvent("Scroll Point", element.id);
      }
    });

  const pageDownTargetHeight = pageDownTarget ? pageDownTarget.offsetHeight : 0;

  if (topOfWindow > pageDownTargetHeight) {
    if (!scrolledItems.pageUp) {
      Velocity(
        document.getElementById("pageUp"),
        { opacity: 1, translateY: [0, 90] },
        { duration: 300 }
      );
      scrolledItems.pageUp = true;
    }
  } else if (scrolledItems.pageUp) {
    Velocity(
      document.getElementById("pageUp"),
      { opacity: 0, translateY: [90, 0] },
      { duration: 300 }
    );
    scrolledItems.pageUp = false;
  }
});
