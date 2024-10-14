export const particles = {
  generated: {},
  init: function (name, className, container, amount) {
    if (typeof this.generated[name] === "undefined") {
      this.generated[name] = [];
      const containerEl = document.getElementById(container);
      for (let i = 0; i < amount; i++) {
        const div = document.createElement("div");
        div.className = className;
        this.generated[name][i] = div;
        containerEl.appendChild(div);
      }
    } else {
      console.error("There is already a particle array with this name.");
    }
  },
  randomPos: function (distance) {
    return Math.round((Math.random() - 0.5) * 2 * distance);
  },
  randomUp: function (distance) {
    return 0 - Math.round(Math.random() * distance);
  },
  randomTime: function (baseTime) {
    return Math.round(Math.random() * baseTime);
  },
  randomDistance: function (distance) {
    return (
      Math.round(Math.random() * (distance * 0.75)) + Math.round(distance * 2.5)
    );
  },
  explosion: function () {
    const particleDistance =
      (window.innerWidth -
        document.getElementById("luckyButtonContainer").offsetWidth) /
        2 +
      (window.innerHeight -
        document.getElementById("luckyButtonContainer").offsetHeight) /
        2 /
        2;

    for (let i = 0; i < this.generated.particles.length; i++) {
      const particle = this.generated.particles[i];

      Velocity(
        particle,
        {
          translateX: this.randomPos(particleDistance),
          translateY: this.randomPos(particleDistance),
          translateZ: this.randomPos(150),
          scaleX: 0.5,
          scaleY: 0.5,
          opacity: 1,
        },
        {
          duration: this.randomTime(1000) + 500,
          easing: "easeOutQuint",
          display: "block",
          delay: this.randomTime(100),
        }
      );

      Velocity(
        particle,
        {
          translateX: `+=${this.randomPos(particleDistance / 2)}`,
          translateY: `+=${this.randomUp(particleDistance / 2)}`,
          translateZ: `+=${this.randomPos(100)}`,
          scaleX: 0.2,
          scaleY: 0.2,
        },
        {
          duration: this.randomTime(800),
          easing: "easeInOutCirc",
        }
      );

      Velocity(
        particle,
        {
          translateX: `+=${this.randomPos(particleDistance / 4)}`,
          translateY: `+=${this.randomUp(particleDistance / 4)}`,
          translateZ: `+=${this.randomPos(50)}`,
          scaleX: 0,
          scaleY: 0,
          opacity: 0,
        },
        {
          duration: this.randomTime(400),
          easing: "easeInQuart",
        }
      );

      Velocity(
        particle,
        {
          translateX: 0,
          translateY: 0,
          translateZ: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0,
        },
        { duration: 0, display: "none" }
      );
    }
  },
  shootingStars: function (time) {
    document.querySelector(".effects").style.display = "block";
    const delayTime = (time / this.generated.shootingStars.length) * 2;
    const particleDistance =
      (window.innerWidth -
        document.getElementById("luckyButtonContainer").offsetWidth) /
        2 +
      (window.innerHeight -
        document.getElementById("luckyButtonContainer").offsetHeight) /
        2 /
        4;

    for (let i = 0; i < this.generated.shootingStars.length; i++) {
      const angle = this.randomPos(180);
      const star = this.generated.shootingStars[i];

      Velocity(
        star,
        {
          rotateZ: [angle + 90, angle + 90],
          translateX: Math.round(
            Math.cos((angle * Math.PI) / 180) * particleDistance
          ),
          translateY: Math.round(
            Math.sin((angle * Math.PI) / 180) * particleDistance
          ),
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
          opacity: [1, 0],
        },
        {
          duration: 500,
          display: "block",
          delay: i * delayTime + this.randomTime(delayTime),
          easing: "easeInQuart",
        }
      );

      Velocity(
        star,
        {
          translateX: `+=${Math.round(
            Math.cos((angle * Math.PI) / 180) * particleDistance
          )}`,
          translateY: `+=${Math.round(
            Math.sin((angle * Math.PI) / 180) * particleDistance
          )}`,
          scaleX: 1.5,
          scaleY: 1.5,
          opacity: 0,
        },
        {
          duration: 500,
          display: "none",
          easing: "easeOutQuart",
        }
      );

      Velocity(
        star,
        {
          rotateZ: 0,
          translateX: 0,
          translateY: 0,
          scaleX: 0.1,
          scaleY: 0.1,
          opacity: 0,
        },
        { duration: 0, display: "none" }
      );
    }
  },
  starSpiral: function (time) {
    document.querySelector(".effects").style.display = "block";
    const delayTime = time / this.generated.shootingStars.length;
    const angleIncrement = Math.ceil(360 / this.generated.shootingStars.length);
    const particleDistance =
      (window.innerWidth -
        document.getElementById("luckyButtonContainer").offsetWidth) /
        2 +
      (window.innerHeight -
        document.getElementById("luckyButtonContainer").offsetHeight) /
        2 /
        4;

    for (let i = 0; i < this.generated.shootingStars.length; i++) {
      const star = this.generated.shootingStars[i];

      Velocity(
        star,
        {
          rotateZ: [i * angleIncrement, i * angleIncrement],
          translateY: -particleDistance * 0.25,
          scaleX: [1, 0.1],
          scaleY: [1, 0.1],
          opacity: [1, 0],
        },
        {
          duration: 500,
          display: "block",
          delay: i * delayTime,
          easing: "easeInQuart",
        }
      );

      Velocity(
        star,
        {
          translateY: `+=${-particleDistance * 0.75}`,
          scaleX: 1.5,
          scaleY: 1.5,
          opacity: 0,
        },
        {
          duration: 500,
          display: "none",
          easing: "easeOutQuart",
        }
      );

      Velocity(
        star,
        {
          rotateZ: 0,
          translateY: 0,
          scaleX: 0.1,
          scaleY: 0.1,
          opacity: 0,
        },
        { duration: 0, display: "none" }
      );
    }
  },
  awardStars: function () {
    const particleDistance =
      document.getElementById("screenInner").offsetWidth * 2;
    for (let i = 0; i < this.generated.awardCharmStars.length; i++) {
      const star = this.generated.awardCharmStars[i];

      Velocity(
        star,
        {
          translateX: [this.randomPos(particleDistance), 0],
          translateY: [this.randomPos(particleDistance / 3), 0],
          scaleX: [0.4, 0.04],
          scaleY: [0.4, 0.04],
          opacity: [0, 1],
        },
        {
          duration: 1000,
          display: "block",
          easing: "easeOutQuart",
        }
      );

      Velocity(
        star,
        {
          translateX: 0,
          translateY: 0,
          scaleX: 0.1,
          scaleY: 0.1,
          opacity: 1,
        },
        { duration: 0, display: "none" }
      );
    }
  },
};

// Initialize particle groups
particles.init("particles", "particle", "particles", 24);
particles.init("shootingStars", "shootingStar", "shootingStars", 24);
particles.init("awardCharmStars", "particle", "screenInner", 24);
