import { luckyVariables } from "./luckyVariables";
import { fireEvent } from "./events";
import { sound, vibrate } from "./effects";
import { luckyEffects, effects } from "./effects";
import { storeTheLuck } from "./storage";
import { screenText } from "./screen";

// Replace button element based on platform
const button = document.getElementById("button");
if (luckyVariables.android) {
  button.replaceWith(document.createElement("div"));
} else {
  const newButton = document.createElement("div");
  newButton.id = "button";
  newButton.innerHTML = '<div id="glint"><div id="glintLine"></div></div>';
  button.replaceWith(newButton);
}

// Button Press Handlers
document
  .getElementById("button")
  .addEventListener("mousedown", buttonPressHandler);
document
  .getElementById("button")
  .addEventListener("touchstart", buttonPressHandler);

function buttonPressHandler(event) {
  fireEvent("Button Pressed", "Presses: " + (luckyVariables.luckyPresses + 1));
  fireEvent(
    "Total Presses",
    "Total Presses: " + (luckyVariables.luckStore.luckyness + 1)
  );
  event.preventDefault();

  if (luckyVariables.buttonReady) {
    luckyVariables.buttonReady = false;
    sound.play("button");
    vibrate(5);
    Velocity(
      document.getElementById("glint"),
      { opacity: 0 },
      { duration: 100, display: "none" }
    );
    Velocity(
      document.getElementById("button"),
      { scaleX: 0.98, scaleY: 0.98 },
      { duration: 100 }
    );

    clearInterval(screenText.setInterval);
    document
      .querySelectorAll(".screenText")
      .forEach((el) => el.classList.add("screenTextOut"));
    luckyVariables.textRunning = false;

    setTimeout(() => {
      document
        .querySelectorAll(".screenText > p, #screenText1, #screenText6")
        .forEach((el) => (el.innerHTML = ""));
      document
        .querySelectorAll(".screenText")
        .forEach((el) => el.classList.remove("screenTextOut"));
    }, 300);
  }
  return false;
}

document
  .getElementById("button")
  .addEventListener("mouseup", buttonReleaseHandler);
document
  .getElementById("button")
  .addEventListener("touchend", buttonReleaseHandler);

function buttonReleaseHandler(event) {
  event.preventDefault();

  if (!luckyVariables.buttonReleased) {
    luckyVariables.buttonReleased = true;
    document.getElementById("glint").style.display = "block";
    Velocity(
      document.getElementById("button"),
      { scaleX: 1, scaleY: 1 },
      {
        duration: 100,
        complete: function () {
          console.log(
            "______",
            luckyEffects[luckyVariables.luckyPresses % luckyEffects.length]
          );
          effects[
            luckyEffects[luckyVariables.luckyPresses % luckyEffects.length]
          ]();
          fireEvent(
            "Effect Started",
            luckyEffects[luckyVariables.luckyPresses % luckyEffects.length]
          );
          luckyVariables.luckyPresses++;
          luckyVariables.luckStore.luckyness++;

          if (
            luckyVariables.pressesArray.indexOf(
              luckyVariables.luckStore.luckyness
            ) !== -1
          ) {
            for (const charm of luckyCharms.presses) {
              if (charm.amount === luckyVariables.luckStore.luckyness) {
                awardLuckyCharm(charm);
              }
            }
          }
          storeTheLuck();
        },
      }
    );
  }
  return false;
}

// Disable right-click on the button
document.getElementById("button").addEventListener("contextmenu", function (e) {
  e.preventDefault();
  return false;
});

// Social Media Link Click Handlers
document.querySelectorAll(".socialMediaLink").forEach((el) => {
  el.addEventListener("click", function (e) {
    e.preventDefault();
    handleSocialMediaLink(this);
  });
});

function handleSocialMediaLink(el) {
  const id = el.id;
  const luckyStore = luckyVariables.luckStore.specialCharms;
  if (!luckyStore[id.toLowerCase()]) {
    luckyStore[id.toLowerCase()] = true;
    awardLuckyCharm(luckyCharms.social[id.toLowerCase()]);
    storeTheLuck();
  }

  fireEvent("Social Media Button", id);
  const href = el.getAttribute("href");

  if (window.location.protocol !== "file:") {
    setTimeout(() => {
      window.location.assign(href);
    }, 300);
  } else {
    console.log("Go to: " + href);
  }
}

// Page Down Button Click Handler
document
  .getElementById("pageDownOverlay")
  .addEventListener("click", function () {
    Velocity(document.getElementById("pageDownTarget"), "scroll", {
      duration: 1300,
      easing: [400, 15],
      offset: 0 + document.getElementById("pageDownTarget").offsetHeight * 0.2,
    });
    fireEvent("Page Down Button Click", "Page Down Button Click");
  });

// Page Up Button Click Handler
document.getElementById("pageUp").addEventListener("click", function () {
  Velocity(document.getElementById("adStrip"), "scroll", {
    duration: 800,
    easing: "easeOutCubic",
  });
  fireEvent("Page Up Button Click", "Page Up Button Click");
});

// Mute Button Click Handler
document.getElementById("muteOverlay").addEventListener("click", function () {
  console.log("Mute");
  if (luckyVariables.luckStore.soundOn) {
    luckyVariables.luckStore.soundOn = false;
    luckyVariables.luckStore.vibrationOn = false;
    sound.mute();
    sound.volume(0);
    document.getElementById("muteIcon").style.backgroundPosition = "100% 50%";
    fireEvent("Mute Button Click", "Mute");
  } else {
    luckyVariables.luckStore.soundOn = true;
    luckyVariables.luckStore.vibrationOn = true;
    sound.unmute();
    sound.volume(1);
    document.getElementById("muteIcon").style.backgroundPosition = "0% 50%";
    fireEvent("Mute Button Click", "Unmute");
  }
  storeTheLuck();
});
