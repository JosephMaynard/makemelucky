import { Howl } from "howler";
import { luckyVariables } from "./luckyVariables";
import { particles } from "./particles";
import { fireEvent } from "./events";
import { screenText } from "./screen";

let clampsStatus = "closed";

export const sound = new Howl({
  src: ["soundfx/makemelucky.mp3"],
  sprite: {
    cloudsTunnel: [1000, 12013],
    spinningRim: [14030, 9670],
    luckySymbol: [24000, 4400],
    rimLight: [29000, 5800],
    powerStreams: [35000, 8500],
    buttonFall: [44000, 9620],
    button: [54000, 2500],
    charmAward: [57000, 3520],
    lucky: [61000, 4000],
  },
});

export function vibrate(value) {
  if (window.navigator.vibrate && luckyVariables.luckStore.vibrationOn) {
    navigator.vibrate(value);
  }
}

function clamps() {
  const clamps = document.getElementById("clamps");
  clamps.className = "clampsOpening";
  setTimeout(() => {
    clamps.className =
      clampsStatus === "closed" ? "clampsOpen" : "clampsClosed";
    clampsStatus = clampsStatus === "closed" ? "open" : "closed";
  }, 50);
}

function spinningRim() {
  if (luckyVariables.luckStore.soundOn) sound.play("spinningRim");
  document.querySelector(".effects").style.display = "block";
  clamps();
  setTimeout(() => {
    Velocity(
      document.getElementById("rimSpinning"),
      { rotateZ: "7200deg" },
      {
        duration: 5000,
        display: "block",
        complete: () => {
          Velocity(
            document.getElementById("rimSpinning"),
            { rotateZ: "0deg" },
            { duration: 0, display: "none" }
          );
          setTimeout(clamps, 500);
          setTimeout(() => {
            vibrate(200);
            Velocity(
              document.querySelectorAll("#midOverlay, #glowClosed"),
              { opacity: 1 },
              { duration: 200, display: "block" }
            );
            Velocity(
              document.querySelectorAll("#midOverlay, #glowClosed"),
              { opacity: 0 },
              {
                delay: 300,
                duration: 1000,
                display: "none",
                complete: () => {
                  document.querySelector(".effects").style.display = "none";
                  setTimeout(animationComplete, 500);
                },
              }
            );
          }, 600);
        },
      }
    );

    Velocity(
      document.querySelectorAll(".cog"),
      { rotateZ: "-14400deg" },
      {
        duration: 5000,
        complete: () =>
          Velocity(
            document.querySelectorAll(".cog"),
            { rotateZ: "0deg" },
            { duration: 0 }
          ),
      }
    );

    [...Array(4)].forEach((_, i) => {
      setTimeout(() => {
        const spark = document.getElementById(`spark${i + 1}`);
        Velocity(
          document.querySelectorAll("#topOverlay, #" + spark.id),
          { opacity: 1 },
          {
            duration: 50,
            display: "block",
            complete: () => vibrate(50),
          }
        );
        Velocity(
          document.querySelectorAll("#topOverlay, #" + spark.id),
          { opacity: 0 },
          { duration: 500, display: "none" }
        );
      }, 1000 * (i + 1));
    });
  }, 100);
}

function luckySymbol() {
  if (luckyVariables.luckStore.soundOn) sound.play("luckySymbol");
  document.querySelector(".effects").style.display = "block";
  Velocity(
    document.getElementById("glowClosed"),
    { opacity: 1 },
    { duration: 100, display: "block" }
  );
  Velocity(
    document.getElementById("glowClosed"),
    { opacity: 0 },
    { duration: 500, display: "none" }
  );
  Velocity(
    document.getElementById("topOverlay"),
    { opacity: 1 },
    { duration: 500, display: "block" }
  );
  Velocity(
    document.getElementById("topOverlay"),
    { opacity: 0 },
    { duration: 500, display: "none", delay: 500 }
  );
  Velocity(
    document.getElementById("luckySymbol"),
    { opacity: 1, translateZ: [0, -5000] },
    {
      duration: 1000,
      display: "block",
      easing: "ease-out",
      begin: () => particles.shootingStars(200),
    }
  );
  Velocity(
    document.getElementById("luckySymbol"),
    { opacity: 0, translateZ: 2000 },
    {
      duration: 500,
      display: "none",
      easing: "ease-in",
      complete: () => {
        document.querySelector(".effects").style.display = "none";
        setTimeout(animationComplete, 500);
      },
    }
  );
}

function openRim() {
  clamps();
  setTimeout(() => {
    document.getElementById("rimOpen").style.display = "block";
    document.getElementById("rim").style.display = "none";
    ["rimTop", "rimRight", "rimBottom", "rimLeft"].forEach((side) => {
      Velocity(
        document.getElementById(side),
        {
          [side.includes("Top") || side.includes("Bottom") ? "top" : "left"]:
            "-18%",
        },
        { duration: 2000 }
      );
    });
    Velocity(
      document.querySelectorAll(".cog"),
      { rotateZ: "360deg" },
      { duration: 2000 }
    );
  }, 100);
}

function closeRim() {
  ["rimTop", "rimRight", "rimBottom", "rimLeft"].forEach((side) => {
    Velocity(
      document.getElementById(side),
      {
        [side.includes("Top") || side.includes("Bottom") ? "top" : "left"]:
          "0%",
      },
      { duration: 2000 }
    );
  });
  Velocity(
    document.querySelectorAll(".cog"),
    { rotateZ: "0deg" },
    {
      duration: 2000,
      complete: () => {
        clamps();
        document.getElementById("rim").style.display = "block";
        document.getElementById("rimOpen").style.display = "none";
      },
    }
  );
}

function rimLight() {
  if (luckyVariables.luckStore.soundOn) sound.play("rimLight");
  document.querySelector(".effects").style.display = "block";
  Velocity(
    document.getElementById("rimLight"),
    { opacity: 1, rotateZ: "180deg" },
    { duration: 500, display: "block", easing: "linear" }
  );
  Velocity(
    document.getElementById("rimLight"),
    { rotateZ: "900deg" },
    {
      duration: 2000,
      easing: "linear",
      begin: () => outerLightSpin(45, 3),
      complete: () => {
        Velocity(
          document.querySelectorAll("#midOverlay, #glowClosed, .outerLight"),
          { opacity: 1 },
          { duration: 300, display: "block", delay: 250 }
        );
        Velocity(
          document.querySelectorAll("#midOverlay, #glowClosed, .outerLight"),
          { opacity: 0 },
          {
            duration: 600,
            display: "none",
            complete: () => {
              document.querySelector(".effects").style.display = "none";
              setTimeout(animationComplete, 500);
            },
          }
        );
      },
    }
  );
  Velocity(
    document.getElementById("rimLight"),
    { opacity: 0, rotateZ: "1080deg" },
    { duration: 500, display: "none", easing: "linear" }
  );
  Velocity(
    document.getElementById("rimLight"),
    { rotateZ: "0deg" },
    { duration: 1 }
  );
}

function buttonFall() {
  if (luckyVariables.luckStore.soundOn) sound.play("buttonFall");
  openRim();
  document.querySelector(".effects").style.display = "block";
  Velocity(
    document.getElementById("button"),
    { scaleX: 0.001, scaleY: 0.001 },
    {
      duration: 3500,
      easing: "easeInQuart",
      complete: () => {
        Velocity(
          document.getElementById("cloudLight"),
          { opacity: 1 },
          { duration: 50, display: "block" }
        );
        Velocity(
          document.getElementById("cloudLight"),
          { opacity: 0 },
          { duration: 450, display: "none", delay: 500 }
        );
      },
    }
  );
  Velocity(
    document.getElementById("clouds"),
    { opacity: 1 },
    { duration: 1500, display: "block" }
  );
  Velocity(
    document.getElementById("button"),
    { scaleX: 1, scaleY: 1 },
    {
      duration: 1500,
      easing: [400, 10],
      delay: 1000,
      begin: () => setTimeout(particles.explosion, 200),
      complete: () => {
        closeRim();
        Velocity(
          document.getElementById("clouds"),
          { opacity: 0 },
          {
            duration: 2500,
            display: "none",
            complete: () => {
              document.querySelector(".effects").style.display = "none";
              setTimeout(animationComplete, 500);
            },
          }
        );
      },
    }
  );
}

function cloudsTunnelOpen() {
  if (luckyVariables.luckStore.soundOn) sound.play("cloudsTunnel");
  openRim();

  Velocity(
    document.getElementById("button"),
    { scaleX: 0.3, scaleY: 0.3 },
    {
      duration: 4000,
      delay: 1000,
      easing: "easeInQuart",
      begin: function () {
        Velocity(
          document.querySelectorAll("#magicSwirl3, #magicSwirl4"),
          {
            opacity: [1, 0],
            scaleX: [1, 0.5],
            scaleY: [1, 0.5],
          },
          {
            display: "block",
            delay: 1000,
            duration: 700,
          }
        );
      },
      complete: function () {
        Velocity(
          document.querySelectorAll("#magicSwirl3, #magicSwirl4"),
          {
            opacity: 0,
            scaleX: 0.5,
            scaleY: 0.5,
          },
          {
            display: "none",
            delay: 500,
            duration: 1000,
          }
        );
        particles.shootingStars(500);
      },
    }
  );

  Velocity(
    document.getElementById("cloudsTunnel"),
    { opacity: 1, rotateZ: 90 },
    {
      display: "block",
      duration: 4000,
      easing: "linear",
    }
  );

  Velocity(
    document.getElementById("cloudsTunnel"),
    { rotateZ: 180 },
    {
      display: "block",
      duration: 4000,
      easing: "linear",
    }
  );

  Velocity(
    document.getElementById("cloudsTunnel"),
    { opacity: 0, rotateZ: 270 },
    {
      display: "none",
      duration: 4000,
      easing: "linear",
    }
  );

  Velocity(
    document.getElementById("cloudsTunnel"),
    { rotateZ: 0 },
    { display: "none", duration: 10 }
  );

  Velocity(
    document.getElementById("button"),
    { scaleX: 1, scaleY: 1, rotateX: "0deg" },
    {
      duration: 1000,
      delay: 1000,
      easing: "easeInQuart",
      complete: function () {
        document.querySelector(".effects").style.display = "block";
        Velocity(
          document.querySelectorAll("#midOverlay, #glowOpen"),
          { opacity: 1 },
          {
            display: "block",
            duration: 300,
            begin: function () {
              setTimeout(() => vibrate(200), 200);
            },
          }
        );

        Velocity(
          document.querySelectorAll("#midOverlay, #glowOpen"),
          { opacity: 0 },
          {
            display: "none",
            delay: 500,
            duration: 600,
            complete: function () {
              document.querySelector(".effects").style.display = "none";
              closeRim();
              setTimeout(animationComplete, 2000);
            },
          }
        );
      },
    }
  );
}

function powerStreams() {
  if (luckyVariables.luckStore.soundOn) sound.play("powerStreams");

  Velocity(
    document.getElementById("whiteOverlay"),
    { opacity: 1 },
    {
      display: "block",
      duration: 100,
    }
  );

  Velocity(
    document.getElementById("whiteOverlay"),
    { opacity: 0 },
    {
      display: "none",
      duration: 100,
    }
  );

  Velocity(
    document.querySelectorAll(
      ".effects, #effectsButton, #powerStream1, #powerStream2, #powerStream3, #powerStream4"
    ),
    {
      opacity: 1,
    },
    {
      display: "block",
      duration: 100,
    }
  );

  Velocity(
    document.querySelectorAll(
      "#rimGlow, #midOverlay, #magicSwirl1, #magicSwirl2"
    ),
    { opacity: 1 },
    {
      display: "block",
      duration: 200,
    }
  );

  setTimeout(function () {
    openRim();

    Velocity(
      document.querySelectorAll(
        "#powerStream1, #powerStream2, #powerStream3, #powerStream4"
      ),
      {
        opacity: 0,
      },
      {
        display: "none",
        duration: 300,
      }
    );

    // Animation for power rings
    [1, 2, 3].forEach((ringNum, index) => {
      setTimeout(() => {
        Velocity(
          document.getElementById(`powerRing${ringNum}`),
          {
            scaleX: [3, 0.5],
            scaleY: [3, 0.5],
            opacity: [1, 0],
            rotateZ: [particles.randomPos(50), particles.randomPos(50)],
          },
          {
            display: "block",
            duration: 600,
            easing: "easeInSine",
            begin: function () {
              if (ringNum === 1) {
                Velocity(
                  document.getElementById("glowOpen"),
                  { opacity: 1 },
                  {
                    display: "block",
                    duration: 200,
                    easing: "easeOutCubic",
                    complete: function () {
                      vibrate(50);
                    },
                  }
                );
                Velocity(
                  document.getElementById("glowOpen"),
                  { opacity: 0 },
                  {
                    display: "none",
                    duration: 200,
                    easing: "easeOutCubic",
                  }
                );
              }
            },
          }
        );
        Velocity(
          document.getElementById(`powerRing${ringNum}`),
          { scaleX: 8, scaleY: 8, opacity: 0 },
          {
            display: "none",
            duration: 300,
            easing: "easeOutSine",
          }
        );
      }, 1600 + index * 400);
    });

    Velocity(
      document.querySelectorAll(
        "#rimGlow, #midOverlay, #magicSwirl1, #magicSwirl2"
      ),
      {
        opacity: 0,
      },
      {
        display: "none",
        delay: 1000,
        duration: 2000,
        complete: function () {
          document
            .querySelectorAll(".effects, #effectsButton")
            .forEach((el) => (el.style.display = "none"));
          closeRim();
          setTimeout(animationComplete, 2000);
        },
      }
    );
  }, 2000);
}

function outerLightSpin(delay, loops) {
  olLoops = loops;

  Velocity(
    document.getElementById(`ol${olCount}`),
    { opacity: 1 },
    {
      display: "block",
      duration: 100,
    }
  );

  Velocity(
    document.getElementById(`ol${olCount}`),
    { opacity: 0 },
    {
      display: "none",
      duration: 500,
    }
  );

  olCount++;

  if (olCount === 13 && olLoops === 1) {
    olCount = 1;
  } else if (olCount === 13) {
    olCount = 1;
    olLoops--;
    setTimeout(() => outerLightSpin(delay, olLoops), delay);
  } else {
    setTimeout(() => outerLightSpin(delay, olLoops), delay);
  }
}

function animationComplete() {
  luckyVariables.buttonReady = true;
  luckyVariables.buttonReleased = false;
  luckyVariables.textRunning = true;
  fireEvent("Animation Complete", "Animation Complete");
  screenText.youAreNowLucky(luckyVariables.luckyPresses);
}

// Define the luckyEffects array and shuffle function
export let luckyEffects = [
  "buttonFall",
  "cloudsTunnelOpen",
  "luckySymbol",
  "powerStreams",
  "rimLight",
  "spinningRim",
];

function shuffle(array) {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // Swap with the current element
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

shuffle(luckyEffects);

export const effects = {
  buttonFall,
  cloudsTunnelOpen,
  luckySymbol,
  powerStreams,
  rimLight,
  spinningRim,
};
