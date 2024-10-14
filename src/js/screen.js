import { luckyVariables } from "./luckyVariables";
import { particles } from "./particles";
import { sound } from "./effects";

export const screenText = {
  adverbs: [
    "MEGA",
    "SUPER",
    "EXTRA",
    "HIGHLY",
    "AWFULLY",
    "AMAZINGLY",
    "EMINENTLY",
    "EXTREMELY",
    "ENORMOUSLY",
    "FABULOUSLY",
    "INCREDIBLY",
    "ABNORMALLY",
    "REMARKABLY",
    "STRIKINGLY",
    "UNCOMMONLY",
    "STARTLINGLY",
    "WONDERFULLY",
    "BRILLIANTLY",
    "EXCEEDINGLY",
    "MARVELOUSLY",
    "MONUMENTALLY",
    "OUTRAGEOUSLY",
    "PRODIGIOUSLY",
    "TRIUMPHANTLY",
    "TREMENDOUSLY",
    "INORDINATELY",
    "EXTRAORDINARY",
    "FANTASTICALLY",
    "ASTONISHINGLY",
    "EXCEPTIONALLY",
    "OUTSTANDINGLY",
  ],

  adjectives: [
    "AMAZING",
    "AWESOME",
    "WONDERFUL",
    "PHENOMENAL",
    "REMARKABLE",
    "STUPENDOUS",
    "ASTOUNDING",
    "INCREDIBLE",
    "MARVELLOUS",
    "SENSATIONAL",
    "ASTONISHING",
    "SPECTACULAR",
  ],

  moreLuck: [
    ["LOOKING FOR", "MORE LUCK?"],
    ["NEED A BIT", "MORE LUCK?"],
    ["WANT SOME", "MORE LUCK?"],
    ["WANT EVEN", "MORE LUCK?"],
    ["NEED EXTRA", "GOOD LUCK?"],
    ["WANT TO BE", "MORE LUCKY?"],
  ],

  pressAgain: [
    ["PRESS THE", "BUTTON"],
    ["KEEP PRESSING", "THE BUTTON"],
    ["HAVE ANOTHER", "PRESS!"],
    ["PRESS", "AGAIN!"],
  ],

  welcome: "Welcome",
  welcomeBack: "Welcome Back",
  needLuck: "Need a bit of luck?",
  needMoreLuck: "Need a bit more luck?",
  press: "Press the button",
  urNow: "You are now ",

  setInterval: null,

  textQueue: function (textArray) {
    if (screenText.setInterval) {
      clearInterval(screenText.setInterval);
    }

    let textQueuePos = 0;
    const screenTextElement = document.getElementById("screenText");

    if (luckyVariables.charmAwarded) {
      luckyVariables.charmAwarded = false;
      screenTextElement.innerHTML =
        '<span></span><p class="charmAwarded">LUCKY CHARM!</p>';
      particles.awardStars();

      setTimeout(() => {
        screenTextElement.innerHTML = "";
        screenTextElement.innerHTML =
          "<span></span><p>" + textArray[0] + "</p>";
        if (textArray.length > 1) {
          screenText.setInterval = setInterval(nextText, 1500);
        }
      }, 1000);
    } else {
      screenTextElement.innerHTML = "<span></span><p>" + textArray[0] + "</p>";
      if (textArray.length > 1) {
        screenText.setInterval = setInterval(nextText, 1500);
      }
    }

    function nextText() {
      screenTextElement.innerHTML = "";
      textQueuePos++;
      screenTextElement.innerHTML =
        "<span></span><p>" +
        textArray[textQueuePos % textArray.length] +
        "</p>";
    }
  },

  giveAdverb: function () {
    return screenText.adverbs[Math.floor(Math.random() * this.adverbs.length)];
  },

  textSwirlElements: [],

  textSwirl: function (message) {
    // Clear the content of the #screenText1 container
    document.querySelector("#screenText1").innerHTML = "";

    // Split message into characters and create spans
    var textSwirlArray = message.split("");
    screenText.textSwirlElements = [];

    for (var i = 0; i < textSwirlArray.length; i++) {
      if (textSwirlArray[i] === " ") textSwirlArray[i] = "&nbsp";
      screenText.textSwirlElements[i] = document.createElement("span");
      screenText.textSwirlElements[i].innerHTML = textSwirlArray[i];
      document
        .querySelector("#screenText1")
        .appendChild(screenText.textSwirlElements[i]);
    }

    // Apply the Velocity animations for each character
    for (let i = 0; i < screenText.textSwirlElements.length; i++) {
      let rotation = particles.randomPos(360);

      // First animation: opacity, rotation, translation, and scaling
      Velocity(
        screenText.textSwirlElements[i],
        {
          opacity: [0.7, 0],
          rotateZ: [rotation / 2, rotation],
          translateX: [particles.randomPos(100), particles.randomPos(200)],
          translateY: [particles.randomPos(75), particles.randomPos(150)],
          scaleX: [0.5, 0.1],
          scaleY: [0.5, 0.2],
        },
        {
          duration: 800,
          easing: "easeInQuart",
          delay: i * 50,
        }
      );

      // Second animation: revert opacity, rotation, translation, and scaling
      Velocity(
        screenText.textSwirlElements[i],
        {
          opacity: 1,
          rotateZ: 0,
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
        },
        {
          duration: 400,
          easing: "easeOutQuart",
          delay: i * 50,
        }
      );

      // Third animation: fade out with final movement
      Velocity(
        screenText.textSwirlElements[i],
        {
          opacity: 0,
          translateX: particles.randomPos(200),
          translateY: particles.randomPos(50),
          scaleX: 4,
          scaleY: 5,
        },
        {
          duration: 500,
          delay: 1000,
        }
      );
    }
  },
  textZoomInElements: [],

  textZoomIn: function (line1, line2) {
    screenText.textZoomInElements = [];
    var textArrayLine1 = line1.split(" "),
      textArrayLine2 = line2.split(" "),
      totalWords = textArrayLine1.length + textArrayLine2.length;

    // Clear the content of the target elements
    document.querySelector("#screenText2 .line1").innerHTML = "";
    document.querySelector("#screenText2 .line2").innerHTML = "";

    // Process line1
    for (var i = 0; i < textArrayLine1.length; i++) {
      screenText.textZoomInElements[i] = document.createElement("span");
      screenText.textZoomInElements[i].innerHTML = textArrayLine1[i];
      document
        .querySelector("#screenText2 .line1")
        .appendChild(screenText.textZoomInElements[i]);
      if (i < textArrayLine1.length - 1) {
        var spaceSpan = document.createElement("span");
        spaceSpan.innerHTML = "&nbsp;";
        document.querySelector("#screenText2 .line1").appendChild(spaceSpan);
      }
    }

    // Process line2
    for (var i = textArrayLine1.length; i < totalWords; i++) {
      screenText.textZoomInElements[i] = document.createElement("span");
      screenText.textZoomInElements[i].innerHTML =
        textArrayLine2[i - textArrayLine1.length];
      document
        .querySelector("#screenText2 .line2")
        .appendChild(screenText.textZoomInElements[i]);
      if (i < totalWords - 1) {
        var spaceSpan = document.createElement("span");
        spaceSpan.innerHTML = "&nbsp;";
        document.querySelector("#screenText2 .line2").appendChild(spaceSpan);
      }
    }

    // Animate each element using Velocity
    for (i = 0; i < screenText.textZoomInElements.length; i++) {
      Velocity(
        screenText.textZoomInElements[i],
        {
          opacity: [1, 0],
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
          translateY: [0, 30],
          rotateX: [0, -120],
        },
        {
          duration: 800,
          delay: i * 300,
          easing: [400, 15],
        }
      );
    }

    // Trigger awardStars after animation
    setTimeout(
      particles.awardStars,
      screenText.textZoomInElements.length * 300 - 200
    );
  },

  textZoomIn2: function (presses) {
    var textZoomInElements2 = [],
      textQueueArray = ["LUCKY!"];

    if (presses == 2) {
      textQueueArray.push("VERY");
    } else if (presses > 2) {
      textQueueArray.push(screenText.giveAdverb());
    }
    if (presses > 5) {
      textQueueArray.push(screenText.giveAdverb());
    }
    if (presses > 8) {
      textQueueArray.push(screenText.giveAdverb());
    }

    var textArrayLine1 = "YOU ARE NOW".split(" "),
      textArrayLine2 = textQueueArray.pop().split(" "),
      totalWords = textArrayLine1.length + textArrayLine2.length;

    // Clear the content of the target elements
    document.querySelector("#screenText2 .line1").innerHTML = "";
    document.querySelector("#screenText2 .line2").innerHTML = "";

    // Process line1
    for (var i = 0; i < textArrayLine1.length; i++) {
      textZoomInElements2[i] = document.createElement("span");
      textZoomInElements2[i].innerHTML = textArrayLine1[i];
      document
        .querySelector("#screenText2 .line1")
        .appendChild(textZoomInElements2[i]);
      if (i < textArrayLine1.length - 1) {
        var spaceSpan = document.createElement("span");
        spaceSpan.innerHTML = "&nbsp;";
        document.querySelector("#screenText2 .line1").appendChild(spaceSpan);
      }
    }

    // Process line2
    for (var i = textArrayLine1.length; i < totalWords; i++) {
      textZoomInElements2[i] = document.createElement("span");
      textZoomInElements2[i].innerHTML =
        textArrayLine2[i - textArrayLine1.length];
      document
        .querySelector("#screenText2 .line2")
        .appendChild(textZoomInElements2[i]);
      if (i < totalWords - 1) {
        var spaceSpan = document.createElement("span");
        spaceSpan.innerHTML = "&nbsp;";
        document.querySelector("#screenText2 .line2").appendChild(spaceSpan);
      }
    }

    // Trigger awardStars after animation
    setTimeout(particles.awardStars, textZoomInElements2.length * 300 - 200);
  },

  textZoomInBounceOut: function (
    message,
    container,
    holdTime,
    delay,
    callback
  ) {
    const textZoomInBounceOutElements = this.splitWords(message, container),
      totalWords = textZoomInBounceOutElements.words.length,
      totalChars = textZoomInBounceOutElements.chars.length;

    let arrayCounterBegin = 0,
      arrayCounterComplete = 0;

    if (typeof delay !== "number") {
      delay = 0;
    }
    if (typeof holdTime !== "number") {
      holdTime = 1000;
    }

    // Animate words
    textZoomInBounceOutElements.words.forEach((word, i) => {
      Velocity(
        word,
        {
          opacity: [1, 0],
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
          translateY: [0, 30],
          rotateX: [0, -120],
        },
        {
          duration: 800,
          delay: delay + i * 300,
          easing: [400, 15],
        }
      );
    });

    // Animate characters
    textZoomInBounceOutElements.chars.forEach((char, i) => {
      Velocity(
        char,
        {
          opacity: 1,
          scaleX: 1,
          scaleY: 1,
        },
        {
          duration: 0,
        }
      );

      Velocity(
        char,
        {
          opacity: 0,
          translateX: (i - totalChars / 2) * 30,
          scaleX: 0.1,
          scaleY: 0.1,
        },
        {
          duration: 1200,
          easing: [400, 15],
          delay: 800 + totalWords * 300 + holdTime,
          begin: function () {
            arrayCounterBegin++;
            if (
              arrayCounterBegin === totalChars &&
              typeof callback === "function"
            ) {
              setTimeout(callback, 200);
            }
          },
          complete: function () {
            arrayCounterComplete++;
            if (arrayCounterComplete === totalChars) {
              textZoomInBounceOutElements.chars = [];
            }
          },
        }
      );
    });
  },

  textLineBounce: function (line1, line2, container, callback) {
    let textLineBounceElements1 = this.splitChars(line1, `${container} .line1`),
      textLineBounceElements2 = this.splitChars(line2, `${container} .line2`),
      arrayCounterBegin = 0,
      arrayCounterComplete = 0;

    textLineBounceElements1.forEach((element, i) => {
      // First phase for line1: appearing with bounce effect
      Velocity(
        element,
        {
          opacity: [1, 0],
          translateX: [0, (i - textLineBounceElements1.length / 2) * 30],
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
        },
        {
          duration: 1800,
          easing: [400, 15],
        }
      );

      // Second phase for line1: disappearing after some delay
      Velocity(
        element,
        {
          opacity: 0,
          translateX: (i - textLineBounceElements1.length / 2) * 30,
          scaleX: 0.1,
          scaleY: 0.1,
        },
        {
          duration: 1200,
          easing: [400, 15],
          delay: 1000,
        }
      );
    });

    textLineBounceElements2.forEach((element, i) => {
      // First phase for line2: appearing with a slight delay
      Velocity(
        element,
        {
          opacity: [1, 0],
          translateX: [0, (i - textLineBounceElements2.length / 2) * 30],
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
        },
        {
          duration: 1800,
          easing: [400, 15],
          delay: 500,
        }
      );

      // Second phase for line2: disappearing after some delay
      Velocity(
        element,
        {
          opacity: 0,
          translateX: (i - textLineBounceElements2.length / 2) * 30,
          scaleX: 0.1,
          scaleY: 0.1,
        },
        {
          duration: 1200,
          easing: [400, 15],
          delay: 700,
          begin: function () {
            arrayCounterBegin++;
            if (
              arrayCounterBegin === textLineBounceElements2.length &&
              typeof callback === "function"
            ) {
              setTimeout(callback, 200);
            }
          },
          complete: function () {
            arrayCounterComplete++;
            if (arrayCounterComplete === textLineBounceElements2.length) {
              textLineBounceElements1.length = 0;
              textLineBounceElements2.length = 0;
            }
          },
        }
      );
    });
  },

  textLineBounceLeft: function (message, container) {
    const textLineBounceLeftElements = this.splitChars(message, container),
      screenWidth = document.querySelector("#screen").offsetWidth;

    textLineBounceLeftElements.forEach((element, i) => {
      Velocity(
        element,
        {
          opacity: [1, 0],
          translateX: [0, screenWidth + i * 30],
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
        },
        {
          duration: 1800,
          easing: [400, 15],
        }
      );
    });
  },
  textLineBounceRight: function (message, container) {
    const textLineBounceRightElements = this.splitChars(message, container),
      screenWidth = document.querySelector("#screen").offsetWidth;

    textLineBounceRightElements.forEach((element, i) => {
      Velocity(
        element,
        {
          opacity: [1, 0],
          translateX: [0, 0 - screenWidth + i * 30],
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
        },
        {
          duration: 1800,
          easing: [400, 15],
        }
      );
    });
  },

  textWaveBounce: function (message, container, callback) {
    const textWaveBounceElements = this.splitChars(message, container),
      screenHeight = document.getElementById("screen").offsetHeight;

    let arrayCounterBegin = 0,
      arrayCounterComplete = 0;

    textWaveBounceElements.forEach((element, i) => {
      // First phase: move text element from top to center with initial opacity
      Velocity(
        element,
        {
          opacity: [0.6, 0],
          translateY: [0 - screenHeight / 5, screenHeight],
          scaleX: [0.4, 0.2],
          scaleY: [0.4, 0.2],
        },
        {
          duration: 400,
          easing: "easeOutQuad",
          delay: i * 50,
        }
      );

      // Second phase: adjust position and scaling
      Velocity(
        element,
        {
          opacity: 0.8,
          translateY: screenHeight / 6,
          scaleX: 0.6,
          scaleY: 0.6,
        },
        {
          duration: 400,
          easing: "easeInOutQuart",
        }
      );

      // Third phase: bring text to its final state (opacity full and scaling back to normal)
      Velocity(
        element,
        {
          opacity: 1,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
        },
        {
          duration: 800,
          easing: [400, 15],
        }
      );

      // Final phase: fade out and randomize translation (similar to an explosion)
      Velocity(
        element,
        {
          opacity: 0,
          translateX: particles.randomPos(200),
          translateY: particles.randomPos(50),
          scaleX: 4,
          scaleY: 5,
        },
        {
          duration: 500,
          delay: 1000 - i * 50,
          begin: function () {
            arrayCounterBegin++;
            if (arrayCounterBegin === textWaveBounceElements.length) {
              if (typeof callback === "function") {
                setTimeout(callback, 200);
              }
            }
          },
          complete: function () {
            arrayCounterComplete++;
            if (arrayCounterComplete === textWaveBounceElements.length) {
              textWaveBounceElements.length = 0; // Reset array once done
            }
          },
        }
      );
    });
  },

  splitChars: function (message, container) {
    var splitTextArray = message.split(""),
      elementArray = [];

    // Clear the content of the container
    document.querySelector(container).innerHTML = "";

    // Process each character
    for (var i = 0; i < splitTextArray.length; i++) {
      if (splitTextArray[i] === " ") splitTextArray[i] = "&nbsp";
      elementArray[i] = document.createElement("span");
      elementArray[i].innerHTML = splitTextArray[i];
      document.querySelector(container).appendChild(elementArray[i]);
    }
    return elementArray;
  },

  splitWords: function (message, container) {
    var splitWordsArray = message.split(" "),
      result = {
        words: [],
        chars: [],
      };

    // Clear the content of the container
    document.querySelector(container).innerHTML = "";

    // Process each word and character
    for (var i = 0; i < splitWordsArray.length; i++) {
      result.words[i] = document.createElement("span");
      var splitTextArray = splitWordsArray[i].split(""),
        target = result.chars.length + splitTextArray.length,
        arrayCounter = 0;

      for (var j = result.chars.length; j < target; j++) {
        result.chars[j] = document.createElement("span");
        result.chars[j].innerHTML = splitTextArray[arrayCounter];
        result.words[i].appendChild(result.chars[j]);
        arrayCounter++;
      }

      document.querySelector(container).appendChild(result.words[i]);

      if (i < splitWordsArray.length - 1) {
        var spaceSpan = document.createElement("span");
        spaceSpan.innerHTML = "&nbsp;";
        document.querySelector(container).appendChild(spaceSpan);
      }
    }
    return result;
  },

  textZigZagBounce: function (message, container, callback) {
    var textLineWobbleBounceElements = this.splitChars(message, container),
      arrayCounterBegin = 0,
      arrayCounterComplete = 0;

    // Iterate through each element and apply animations using Velocity
    for (var i = 0; i < textLineWobbleBounceElements.length; i++) {
      Velocity(
        textLineWobbleBounceElements[i],
        {
          opacity: [0.4, 0],
          translateX: [
            0 - (i - textLineWobbleBounceElements.length / 2) * 20,
            (i - textLineWobbleBounceElements.length / 2) * 30,
          ],
          translateY: [(((i + 1) % 2) - 0.5) * 50, ((i % 2) - 0.5) * 60],
          scaleX: [0.3, 0.1],
          scaleY: [0.3, 0.1],
        },
        {
          duration: 300,
          easing: "easeInOutQuint",
        }
      );

      Velocity(
        textLineWobbleBounceElements[i],
        {
          opacity: 0.8,
          translateX: (i - textLineWobbleBounceElements.length / 2) * 10,
          translateY: ((i % 2) - 0.5) * 40,
          scaleX: 0.6,
          scaleY: 0.6,
        },
        {
          duration: 600,
          easing: "easeInOutQuint",
        }
      );

      Velocity(
        textLineWobbleBounceElements[i],
        {
          opacity: 1,
          translateX: 0,
          translateY: 0,
          scaleX: 1,
          scaleY: 1,
        },
        {
          duration: 900,
          easing: [400, 15],
        }
      );

      Velocity(
        textLineWobbleBounceElements[i],
        {
          opacity: 0,
          translateX: (i - textLineWobbleBounceElements.length / 2) * 30,
          scaleX: 0.05,
          scaleY: 0.1,
        },
        {
          duration: 1200,
          easing: [400, 15],
          delay: 400,
          begin: function () {
            arrayCounterBegin++;
            if (arrayCounterBegin === textLineWobbleBounceElements.length) {
              if (typeof callback === "function") {
                setTimeout(callback, 200);
              }
            }
          },
          complete: function () {
            arrayCounterComplete++;
            if (arrayCounterComplete === textLineWobbleBounceElements.length) {
              textLineWobbleBounceElements = [];
            }
          },
        }
      );
    }
  },

  welcome: function () {
    screenText.textWaveBounce("WELCOME", "#screenText1", function () {
      if (luckyVariables.textRunning) {
        screenText.textLineBounce(
          "NEED A BIT",
          "OF LUCK?",
          "#screenText4",
          function () {
            if (luckyVariables.textRunning) {
              screenText.textLineBounceLeft("PRESS THE", "#screenText3 .line1");
              screenText.textLineBounceRight("BUTTON", "#screenText3 .line2");
            }
          }
        );
      }
    });
  },

  youAreNowLucky: function (presses) {
    function topLineText(topLineHoldTime) {
      screenText.textZoomInBounceOut(
        "YOU ARE NOW",
        "#screenText2 .line1",
        topLineHoldTime,
        0,
        function () {
          var random1 = Math.floor(Math.random() * screenText.moreLuck.length),
            random2 = Math.floor(Math.random() * screenText.pressAgain.length);
          screenText.textLineBounce(
            screenText.moreLuck[random1][0],
            screenText.moreLuck[random1][1],
            "#screenText4",
            function () {
              if (luckyVariables.textRunning) {
                screenText.textLineBounceLeft(
                  screenText.pressAgain[random2][0],
                  "#screenText3 .line1"
                );
                screenText.textLineBounceRight(
                  screenText.pressAgain[random2][1],
                  "#screenText3 .line2"
                );
              }
            }
          );
        }
      );
    }
    function bottomLineText(textQueue, delay, bottomLineHoldTime) {
      if (textQueue.length == 1) {
        var target = "#screenText2 .line2";
        bottomLineHoldTime = bottomLineHoldTime * 2;
        particles.awardStars();
        sound.play("lucky");
      } else {
        var target = "#screenText5";
      }
      screenText.textZoomInBounceOut(
        textQueue.pop(),
        target,
        bottomLineHoldTime,
        delay,
        function () {
          if (textQueue.length > 0 && luckyVariables.textRunning) {
            bottomLineText(textQueue, 0, bottomLineHoldTime);
          }
        }
      );
    }
    var textQueueArray = ["LUCKY!"],
      adverbHoldTime = 800;
    if (presses == 1) {
      if (!window.lucky) {
        window.lucky = true;
        console.log(
          "You are now LUCKY!\nIt's completely true, if you don't believe it check the value of lucky"
        );
      }
    }
    if (presses == 2) {
      textQueueArray.push("VERY");
    } else if (presses > 2) {
      textQueueArray.push(screenText.giveAdverb());
    }
    if (presses > 5) {
      textQueueArray.push(screenText.giveAdverb());
    }
    if (presses > 8) {
      textQueueArray.push(screenText.giveAdverb());
    }
    if (presses > 16) {
      textQueueArray.push(screenText.giveAdverb());
    }
    var topLineHold = textQueueArray.length * (adverbHoldTime + 1000) - 700;
    if (luckyVariables.charmAwarded) {
      sound.play("charmAward");
      screenText.textLineBounce(
        "LUCKY CHARM!",
        "(see all of your charms below)",
        "#screenText7",
        function () {
          luckyVariables.charmAwarded = false;
          if (luckyVariables.textRunning) {
            // screenText.textZoomIn('YOU ARE NOW', 'LUCKY!');
            topLineText(topLineHold);
            bottomLineText(textQueueArray, 1000, adverbHoldTime);
          }
        }
      );
    } else {
      screenText.textZigZagBounce(
        screenText.adjectives[
          Math.floor(Math.random() * screenText.adjectives.length)
        ] + "!",
        "#screenText6",
        function () {
          if (luckyVariables.textRunning) {
            // screenText.textZoomIn('YOU ARE NOW', 'LUCKY!');
            topLineText(topLineHold);
            bottomLineText(textQueueArray, 1000, adverbHoldTime);
          }
        }
      );
    }
  },
};
