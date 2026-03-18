document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".button");
  const isHomePage = document.body.classList.contains("home-page");
  const introOverlay = document.querySelector("#intro-overlay");
  const introVideo = document.querySelector("#intro-video");
  const introMobileBreakpoint = window.matchMedia("(max-width: 767px)");
  const starCanvas = document.querySelector(".starfield-canvas");
  const soulsCanvas = document.querySelector(".souls-canvas");
  const sigils = Array.from(document.querySelectorAll(".sigil"));
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let introDismissed = false;

  // Fade out the intro overlay and fully remove it after the transition completes.
  function dismissIntroOverlay() {
    if (!introOverlay || introDismissed) {
      return;
    }

    introDismissed = true;
    introOverlay.classList.add("is-fading-out");

    window.setTimeout(() => {
      introOverlay.classList.add("is-hidden");
      document.body.classList.remove("intro-active");
    }, 920);
  }

  function skipIntroOverlay() {
    if (!introVideo) {
      dismissIntroOverlay();
      return;
    }

    introVideo.pause();
    introVideo.currentTime = 0;
    dismissIntroOverlay();
  }

  // Pick the intro asset once at startup so mobile uses the original portrait edit
  // and wider screens use the desktop-framed version.
  function configureIntroSource() {
    if (!introVideo) {
      return;
    }

    const mobileIntroSrc = introVideo.dataset.introMobileSrc;
    const desktopIntroSrc = introVideo.dataset.introDesktopSrc;
    const selectedIntroSrc = introMobileBreakpoint.matches ? mobileIntroSrc : desktopIntroSrc;

    if (!selectedIntroSrc) {
      return;
    }

    const resolvedIntroSrc = encodeURI(selectedIntroSrc);
    if (introVideo.getAttribute("src") === resolvedIntroSrc) {
      return;
    }

    introVideo.setAttribute("src", resolvedIntroSrc);
    introVideo.load();
  }

  // Start the intro automatically. If a browser blocks unmuted autoplay,
  // fall back to muted autoplay instead of waiting for a user action.
  function startIntroPlayback() {
    if (!introVideo) {
      return;
    }

    introVideo.muted = false;
    introVideo.defaultMuted = false;

    const playAttempt = introVideo.play();
    if (playAttempt && typeof playAttempt.catch === "function") {
      playAttempt
        .catch(() => {
          introVideo.muted = true;
          introVideo.defaultMuted = true;
          introVideo.play().catch(dismissIntroOverlay);
        });
    }
  }

  if (isHomePage && introOverlay && introVideo) {
    document.body.classList.add("intro-active");
    introVideo.addEventListener("ended", dismissIntroOverlay, { once: true });
    introVideo.addEventListener("error", dismissIntroOverlay, { once: true });
    introOverlay.addEventListener("click", skipIntroOverlay);
    configureIntroSource();
    startIntroPlayback();
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      button.classList.add("is-pressed");

      window.setTimeout(() => {
        button.classList.remove("is-pressed");
      }, 180);
    });
  });

  if (!starCanvas || !soulsCanvas) {
    return;
  }

  const starCtx = starCanvas.getContext("2d");
  const soulsCtx = soulsCanvas.getContext("2d");

  if (!starCtx || !soulsCtx) {
    return;
  }

  const config = {
    particleDensity: 1 / 8400,
    minParticles: 220,
    maxParticles: 360,
    streakStartDelay: 1800,
    streakMinInterval: 2200,
    streakMaxInterval: 5200,
    starLayers: [
      { ratio: 0.54, radius: [0.35, 1.1], speed: [0.9, 2.1], alpha: [0.08, 0.2], blur: [0, 4] },
      { ratio: 0.3, radius: [0.75, 1.9], speed: [1.8, 4], alpha: [0.14, 0.34], blur: [3, 10] },
      { ratio: 0.16, radius: [1.2, 2.8], speed: [3.1, 7.2], alpha: [0.2, 0.44], blur: [7, 16] },
    ],
    starColors: [
      [246, 247, 255],
      [229, 237, 255],
      [206, 225, 255],
      [192, 210, 255],
    ],
    soulPalettes: {
      cool: {
        trail: "rgba(132, 160, 255, 0.04)",
        core: "rgba(207, 225, 255, 0.2)",
        head: "rgba(244, 248, 255, 0.88)",
        glow: "rgba(164, 196, 255, 0.14)",
      },
      violet: {
        trail: "rgba(128, 90, 255, 0.04)",
        core: "rgba(216, 184, 255, 0.16)",
        head: "rgba(246, 241, 255, 0.84)",
        glow: "rgba(160, 122, 255, 0.12)",
      },
    },
  };

  let viewportWidth = 0;
  let viewportHeight = 0;
  let dpr = 1;
  let stars = [];
  let souls = [];
  let sigilStates = [];
  let lastTime = performance.now();
  let nextStreakAt = lastTime + config.streakStartDelay;
  let rafId = 0;

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  function resetSigils() {
    sigilStates.forEach((state) => {
      state.element.style.setProperty("--sigil-x", "0px");
      state.element.style.setProperty("--sigil-y", "0px");
      state.element.style.setProperty("--sigil-rotation", `${state.baseRotation}deg`);
      state.element.style.setProperty("--sigil-scale-live", `${state.baseScale}`);
    });
  }

  function setupSigils(now) {
    sigilStates = sigils.map((element, index) => {
      const styles = window.getComputedStyle(element);
      const baseRotation = Number.parseFloat(styles.getPropertyValue("--sigil-rotation")) || 0;
      const baseScale = Number.parseFloat(styles.getPropertyValue("--sigil-scale-live")) || 1;
      const state = {
        element,
        baseRotation,
        baseScale,
        angle: baseRotation,
        speed: rand(-7, 7),
        targetSpeed: rand(-18, 18),
        nextShiftAt: now + rand(1800, 5200),
        driftOffsetX: rand(0, Math.PI * 2),
        driftOffsetY: rand(0, Math.PI * 2),
        driftAmplitudeX: rand(8, 20) + index * 3,
        driftAmplitudeY: rand(10, 26) + index * 4,
        driftSpeedX: rand(0.08, 0.18),
        driftSpeedY: rand(0.06, 0.16),
        pulseOffset: rand(0, Math.PI * 2),
        pulseAmount: rand(0.018, 0.05),
      };

      if (Math.abs(state.speed) < 3) {
        state.speed = state.speed < 0 ? -3.4 : 3.4;
      }

      if (Math.abs(state.targetSpeed) < 5) {
        state.targetSpeed = state.targetSpeed < 0 ? -8 : 8;
      }

      return state;
    });

    resetSigils();
  }

  function updateSigils(deltaSeconds, elapsedSeconds, now) {
    sigilStates.forEach((state) => {
      if (now >= state.nextShiftAt) {
        state.targetSpeed = rand(-24, 24);

        if (Math.abs(state.targetSpeed) < 4.5) {
          state.targetSpeed = state.targetSpeed < 0 ? -7.5 : 7.5;
        }

        state.nextShiftAt = now + rand(1400, 5200);
      }

      const easing = Math.min(1, deltaSeconds * 0.8);
      state.speed += (state.targetSpeed - state.speed) * easing;
      state.angle += state.speed * deltaSeconds;

      const driftX = Math.sin(elapsedSeconds * state.driftSpeedX + state.driftOffsetX) * state.driftAmplitudeX;
      const driftY = Math.cos(elapsedSeconds * state.driftSpeedY + state.driftOffsetY) * state.driftAmplitudeY;
      const liveScale =
        state.baseScale +
        Math.sin(elapsedSeconds * 0.24 + state.pulseOffset) * state.pulseAmount;

      state.element.style.setProperty("--sigil-x", `${driftX.toFixed(2)}px`);
      state.element.style.setProperty("--sigil-y", `${driftY.toFixed(2)}px`);
      state.element.style.setProperty("--sigil-rotation", `${state.angle.toFixed(2)}deg`);
      state.element.style.setProperty("--sigil-scale-live", `${liveScale.toFixed(3)}`);
    });
  }

  function resizeCanvas(canvas, ctx) {
    canvas.width = Math.round(viewportWidth * dpr);
    canvas.height = Math.round(viewportHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resizeScene() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    resizeCanvas(starCanvas, starCtx);
    resizeCanvas(soulsCanvas, soulsCtx);
    buildStars();
  }

  function createStar(layerIndex) {
    const layer = config.starLayers[layerIndex];
    const color = pick(config.starColors);
    const speed = rand(layer.speed[0], layer.speed[1]);
    const angle = rand(-0.06, 0.06);

    return {
      x: rand(-viewportWidth * 0.08, viewportWidth * 1.08),
      y: rand(-viewportHeight * 0.08, viewportHeight * 1.08),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed + rand(-0.1, 0.1),
      radius: rand(layer.radius[0], layer.radius[1]),
      alpha: rand(layer.alpha[0], layer.alpha[1]),
      blur: rand(layer.blur[0], layer.blur[1]),
      twinkleSpeed: rand(0.4, 1.1),
      twinkleOffset: rand(0, Math.PI * 2),
      twinkleSpeedSecondary: rand(1.2, 3.8),
      twinkleOffsetSecondary: rand(0, Math.PI * 2),
      flashSpeed: rand(3.2, 7.4),
      flashOffset: rand(0, Math.PI * 2),
      flashThreshold: rand(0.72, 0.93),
      flickerDepth: rand(0.35, 0.72),
      driftAmplitude: rand(5, 16) * (layerIndex + 1),
      driftSpeed: rand(0.12, 0.32),
      color,
    };
  }

  function buildStars() {
    const targetCount = clamp(
      Math.round(viewportWidth * viewportHeight * config.particleDensity),
      config.minParticles,
      config.maxParticles
    );

    stars = [];

    config.starLayers.forEach((layer, layerIndex) => {
      const count = Math.round(targetCount * layer.ratio);
      for (let i = 0; i < count; i += 1) {
        stars.push(createStar(layerIndex));
      }
    });
  }

  function scheduleNextStreak(now) {
    nextStreakAt = now + rand(config.streakMinInterval, config.streakMaxInterval);
  }

  function spawnSoul(now) {
    const palette = Math.random() < 0.28 ? config.soulPalettes.violet : config.soulPalettes.cool;

    souls.push({
      x: rand(viewportWidth * 0.12, viewportWidth * 0.98),
      y: rand(viewportHeight * 0.1, viewportHeight * 0.76),
      vx: Math.cos(rand(Math.PI * 0.64, Math.PI * 0.8)) * rand(860, 1380),
      vy: Math.sin(rand(Math.PI * 0.64, Math.PI * 0.8)) * rand(860, 1380),
      length: rand(92, 180),
      width: rand(1.1, 2.4),
      life: rand(0.5, 0.9),
      maxLife: 1,
      palette,
    });

    if (souls.length > 7) {
      souls.shift();
    }

    scheduleNextStreak(now);
  }

  function updateStars(deltaSeconds, elapsedSeconds) {
    const marginX = viewportWidth * 0.14;
    const marginY = viewportHeight * 0.14;

    starCtx.clearRect(0, 0, viewportWidth, viewportHeight);

    stars.forEach((star) => {
      star.x += star.vx * deltaSeconds;
      star.y += star.vy * deltaSeconds;

      if (star.x > viewportWidth + marginX) {
        star.x = -marginX;
      } else if (star.x < -marginX) {
        star.x = viewportWidth + marginX;
      }

      if (star.y > viewportHeight + marginY) {
        star.y = -marginY;
      } else if (star.y < -marginY) {
        star.y = viewportHeight + marginY;
      }

      const primaryTwinkle = 0.5 + 0.5 * Math.sin(elapsedSeconds * star.twinkleSpeed + star.twinkleOffset);
      const secondaryTwinkle =
        0.5 + 0.5 * Math.sin(elapsedSeconds * star.twinkleSpeedSecondary + star.twinkleOffsetSecondary);
      const flashSignal = 0.5 + 0.5 * Math.sin(elapsedSeconds * star.flashSpeed + star.flashOffset);
      const flashBoost =
        flashSignal > star.flashThreshold
          ? ((flashSignal - star.flashThreshold) / (1 - star.flashThreshold)) * 0.95
          : 0;
      const twinkle = clamp(
        0.12 +
          primaryTwinkle * (0.38 + star.flickerDepth * 0.24) +
          secondaryTwinkle * (0.16 + star.flickerDepth * 0.2) +
          flashBoost,
        0.08,
        1.55
      );
      const driftX = Math.sin(elapsedSeconds * star.driftSpeed + star.twinkleOffset) * star.driftAmplitude;
      const driftY = Math.cos(elapsedSeconds * star.driftSpeed * 0.8 + star.twinkleOffset) * star.driftAmplitude * 0.28;
      const [r, g, b] = star.color;

      starCtx.beginPath();
      starCtx.fillStyle = `rgba(${r}, ${g}, ${b}, ${star.alpha * twinkle})`;
      starCtx.shadowBlur = star.blur;
      starCtx.shadowColor = `rgba(${r}, ${g}, ${b}, ${star.alpha * 1.8})`;
      starCtx.arc(star.x + driftX, star.y + driftY, star.radius * twinkle, 0, Math.PI * 2);
      starCtx.fill();
    });

    starCtx.shadowBlur = 0;
  }

  function updateSouls(deltaSeconds) {
    soulsCtx.clearRect(0, 0, viewportWidth, viewportHeight);
    souls = souls.filter((soul) => soul.life > 0);

    souls.forEach((soul) => {
      soul.x += soul.vx * deltaSeconds;
      soul.y += soul.vy * deltaSeconds;
      soul.life -= deltaSeconds;

      const lifeRatio = clamp(soul.life / soul.maxLife, 0, 1);
      const opacity = Math.sin(Math.PI * Math.min(1, 1 - lifeRatio));
      const norm = Math.hypot(soul.vx, soul.vy) || 1;
      const ux = soul.vx / norm;
      const uy = soul.vy / norm;
      const tailX = soul.x - ux * soul.length;
      const tailY = soul.y - uy * soul.length;
      const gradient = soulsCtx.createLinearGradient(tailX, tailY, soul.x, soul.y);

      gradient.addColorStop(0, soul.palette.trail);
      gradient.addColorStop(0.42, soul.palette.core);
      gradient.addColorStop(1, soul.palette.head);

      soulsCtx.save();
      soulsCtx.globalAlpha = opacity;
      soulsCtx.strokeStyle = gradient;
      soulsCtx.lineWidth = soul.width;
      soulsCtx.lineCap = "round";
      soulsCtx.shadowBlur = 22;
      soulsCtx.shadowColor = soul.palette.glow;
      soulsCtx.beginPath();
      soulsCtx.moveTo(tailX, tailY);
      soulsCtx.lineTo(soul.x, soul.y);
      soulsCtx.stroke();

      soulsCtx.fillStyle = soul.palette.head;
      soulsCtx.shadowBlur = 24;
      soulsCtx.beginPath();
      soulsCtx.arc(soul.x, soul.y, soul.width * 0.82, 0, Math.PI * 2);
      soulsCtx.fill();
      soulsCtx.restore();
    });

    soulsCtx.shadowBlur = 0;
  }

  function render(now) {
    const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
    const elapsedSeconds = now / 1000;
    lastTime = now;

    updateSigils(deltaSeconds, elapsedSeconds, now);
    updateStars(deltaSeconds, elapsedSeconds);

    if (now >= nextStreakAt) {
      spawnSoul(now);
    }

    updateSouls(deltaSeconds);
    rafId = window.requestAnimationFrame(render);
  }

  function renderStatic() {
    resetSigils();
    updateStars(0, performance.now() / 1000);
    soulsCtx.clearRect(0, 0, viewportWidth, viewportHeight);
  }

  function handleVisibility() {
    if (document.hidden) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
      return;
    }

    lastTime = performance.now();
    nextStreakAt = lastTime + rand(1600, 3200);

    if (!rafId) {
      rafId = window.requestAnimationFrame(render);
    }
  }

  window.addEventListener("resize", resizeScene);
  document.addEventListener("visibilitychange", handleVisibility);

  setupSigils(lastTime);
  resizeScene();

  if (prefersReducedMotion.matches) {
    renderStatic();
    return;
  }

  rafId = window.requestAnimationFrame(render);
});
