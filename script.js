const canvas = document.getElementById("starfield");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
let reduceMotion = reduceMotionQuery.matches;
let coarsePointer = coarsePointerQuery.matches;
const ctx = canvas ? canvas.getContext("2d") : null;
const stars = [];
let width = 0;
let height = 0;
let dpr = 1;
let pendingResize = false;
let pointerX = 0;
let pointerY = 0;
let animationFrameId = 0;
let isAnimating = false;
let resizeRaf = 0;
let lastTime = 0;
let scrollTimeout = 0;
let isScrolling = false;

function getViewportSize() {
  if (window.visualViewport) {
    return {
      width: Math.round(window.visualViewport.width),
      height: Math.round(window.visualViewport.height)
    };
  }
  return { width: window.innerWidth, height: window.innerHeight };
}

function resizeCanvas() {
  if (!canvas || !ctx) return;
  if (isScrolling) {
    pendingResize = true;
    return;
  }
  dpr = window.devicePixelRatio || 1;
  const { width: nextWidth, height: nextHeight } = getViewportSize();
  if (!nextWidth || !nextHeight) return;
  if (nextWidth === width && nextHeight === height) return;
  canvas.width = Math.floor(nextWidth * dpr);
  canvas.height = Math.floor(nextHeight * dpr);
  canvas.style.width = `${nextWidth}px`;
  canvas.style.height = `${nextHeight}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  width = nextWidth;
  height = nextHeight;
  if (!stars.length) {
    buildStars();
  } else {
    stars.forEach((star) => {
      if (star.x < 0) star.x = 0;
      if (star.x > width) star.x = width;
      if (star.y < 0) star.y = 0;
      if (star.y > height) star.y = height;
    });
    const targetCount = Math.floor((width * height) / 4800);
    if (targetCount > stars.length) {
      appendStars(targetCount - stars.length);
    } else if (targetCount < stars.length) {
      stars.length = targetCount;
    }
  }
  lastTime = 0;
  drawStars(performance.now());
}

function appendStars(count) {
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.15,
      speed: Math.random() * 0.35 + 0.04,
      twinkle: Math.random() * Math.PI * 2
    });
  }
}

function buildStars() {
  stars.length = 0;
  appendStars(Math.floor((width * height) / 4800));
}

function drawStars(time) {
  if (!canvas || !ctx) return;
  const delta = lastTime ? Math.min((time - lastTime) / 16.67, 2) : 1;
  lastTime = time;
  ctx.clearRect(0, 0, width, height);
  const motionScale = reduceMotion ? 0.25 : coarsePointer ? 0.4 : 1;
  const twinkleScale = reduceMotion ? 0.6 : 1;

  for (const star of stars) {
    const driftX = pointerX * star.speed * 14 * motionScale;
    const driftY = pointerY * star.speed * 14 * motionScale;
    star.y += star.speed * motionScale * delta;

    if (star.y > height + 2) {
      star.y = -2;
      star.x = Math.random() * width;
    }

    const alpha = 0.5 + 0.5 * Math.sin(time * 0.002 * twinkleScale + star.twinkle);
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.arc(star.x + driftX, star.y + driftY, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function animate(time) {
  if (!isAnimating) return;
  drawStars(time);
  animationFrameId = requestAnimationFrame(animate);
}

function startAnimation() {
  if (!canvas || !ctx || isAnimating) return;
  isAnimating = true;
  lastTime = 0;
  animationFrameId = requestAnimationFrame(animate);
}

function stopAnimation() {
  if (!isAnimating) return;
  isAnimating = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAnimation();
    return;
  }

  startAnimation();
}

function handleReducedMotionChange(event) {
  reduceMotion = event.matches;
  if (document.hidden) return;
  if (!isAnimating) startAnimation();
}

function handleCoarsePointerChange(event) {
  coarsePointer = event.matches;
}

function handleScroll() {
  if (!isScrolling) {
    isScrolling = true;
    stopAnimation();
  }
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    isScrolling = false;
    if (pendingResize) {
      pendingResize = false;
      resizeCanvas();
    }
    if (!document.hidden) startAnimation();
  }, 140);
}

function scheduleResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = 0;
    resizeCanvas();
  });
}

if (canvas && ctx) {
  window.addEventListener("resize", scheduleResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleResize);
  }

  window.addEventListener("mousemove", (event) => {
    if (!width || !height) return;
    pointerX = (event.clientX / width - 0.5) * 0.6;
    pointerY = (event.clientY / height - 0.5) * 0.6;
  }, { passive: true });

  window.addEventListener("scroll", handleScroll, { passive: true });

  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else if (typeof reduceMotionQuery.addListener === "function") {
    reduceMotionQuery.addListener(handleReducedMotionChange);
  }

  if (typeof coarsePointerQuery.addEventListener === "function") {
    coarsePointerQuery.addEventListener("change", handleCoarsePointerChange);
  } else if (typeof coarsePointerQuery.addListener === "function") {
    coarsePointerQuery.addListener(handleCoarsePointerChange);
  }

  resizeCanvas();
  handleVisibilityChange();
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

function observeAnimatedElements(elements) {
  if (!elements) return;
  if (elements instanceof Element) {
    observer.observe(elements);
    return;
  }

  elements.forEach((element) => {
    observer.observe(element);
  });
}

observeAnimatedElements(document.querySelectorAll("[data-animate]"));

const navLinks = Array.from(document.querySelectorAll(".nav a"));

function setActiveNavLink(match) {
  if (!navLinks.length) return;
  navLinks.forEach((link) => {
    const href = link.getAttribute("href") || "";
    const isActive = match ? href.includes(match) : false;
    link.classList.toggle("is-active", isActive);
  });
}

function updateActiveNav() {
  if (!navLinks.length) return;
  const pathName = window.location.pathname.split("/").pop() || "index.html";
  const isIndex = pathName === "index.html" || pathName === "";

  if (!isIndex) {
    setActiveNavLink(pathName);
    return;
  }

  const targets = [];
  const home = document.getElementById("home");
  const platforms = document.getElementById("plattformen");
  if (home) targets.push(home);
  if (platforms) targets.push(platforms);
  if (!targets.length) return;

  const offset = 140;
  let current = targets[0];
  let closestDistance = Number.POSITIVE_INFINITY;
  targets.forEach((section) => {
    const sectionTop = section.getBoundingClientRect().top;
    const distance = Math.abs(sectionTop - offset);
    if (distance < closestDistance) {
      closestDistance = distance;
      current = section;
    }
  });

  setActiveNavLink(`#${current.id}`);
}

function setupNavHighlight() {
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      updateActiveNav();
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  window.addEventListener("hashchange", () => {
    const hash = window.location.hash;
    if (hash) setActiveNavLink(hash);
    requestAnimationFrame(updateActiveNav);
  });
  window.addEventListener("load", () => {
    requestAnimationFrame(updateActiveNav);
  });
  updateActiveNav();
  requestAnimationFrame(updateActiveNav);
}

setupNavHighlight();

const HEADER_AUDIO_TRACKS = [
  {
    label: "Track 1",
    m4a: "assets/audio/audio-first.m4a",
    mp3: "assets/audio/audio-first.mp3"
  },
  {
    label: "Track 2",
    m4a: "assets/audio/audio-second.m4a",
    mp3: "assets/audio/audio-second.mp3"
  }
];
const AUDIO_PLAY_ICON_PATH = "assets/icons/play.svg";
const AUDIO_PAUSE_ICON_PATH = "assets/icons/pause.svg";

function initHeaderAudioPlayer() {
  const container = document.querySelector("[data-audio-player]");
  if (!container) return;

  const audio = container.querySelector("#site-audio");
  const playButton = container.querySelector("[data-audio-play]");
  const playIcon = container.querySelector("[data-audio-play-icon]");
  const trackName = container.querySelector("[data-audio-track-name]");
  const trackButtons = Array.from(container.querySelectorAll("[data-audio-track]"));

  if (!audio || !playButton || !playIcon || !trackButtons.length) return;

  const AUDIO_STATE_KEY = "iamb_header_audio_state_v1";
  const canPlayM4A = audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "";
  let currentTrackIndex = 0;
  let pendingResumeOnGesture = null;

  const getSourceForTrack = (track) => (canPlayM4A ? track.m4a : track.mp3);

  const readStoredState = () => {
    try {
      const raw = sessionStorage.getItem(AUDIO_STATE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        trackIndex: Number(parsed.trackIndex),
        currentTime: Number(parsed.currentTime),
        isPlaying: Boolean(parsed.isPlaying)
      };
    } catch (error) {
      return null;
    }
  };

  const writeStoredState = () => {
    try {
      sessionStorage.setItem(
        AUDIO_STATE_KEY,
        JSON.stringify({
          trackIndex: currentTrackIndex,
          currentTime: Number(audio.currentTime || 0),
          isPlaying: !audio.paused && !audio.ended
        })
      );
    } catch (error) {
      // Ignore storage errors.
    }
  };

  const clearPendingResumeGesture = () => {
    if (!pendingResumeOnGesture) return;
    window.removeEventListener("pointerdown", pendingResumeOnGesture);
    window.removeEventListener("keydown", pendingResumeOnGesture);
    pendingResumeOnGesture = null;
  };

  const queueResumeOnGesture = () => {
    if (pendingResumeOnGesture) return;
    pendingResumeOnGesture = async () => {
      clearPendingResumeGesture();
      try {
        await audio.play();
      } catch (error) {
        setPlayingState(false);
      }
    };
    window.addEventListener("pointerdown", pendingResumeOnGesture, { once: true });
    window.addEventListener("keydown", pendingResumeOnGesture, { once: true });
  };

  const tryMutedResume = async () => {
    const previousMuted = audio.muted;
    const previousVolume = audio.volume;
    try {
      audio.muted = true;
      await audio.play();
      audio.volume = previousVolume;
      audio.muted = previousMuted;
      return true;
    } catch (error) {
      audio.volume = previousVolume;
      audio.muted = previousMuted;
      return false;
    }
  };

  const tryResumePlayback = async () => {
    clearPendingResumeGesture();
    try {
      await audio.play();
      return true;
    } catch (error) {
      const mutedStarted = await tryMutedResume();
      if (mutedStarted) {
        return true;
      }
      queueResumeOnGesture();
      return false;
    }
  };

  const setPlayingState = (isPlaying) => {
    playIcon.src = isPlaying ? AUDIO_PAUSE_ICON_PATH : AUDIO_PLAY_ICON_PATH;
    playButton.classList.toggle("is-playing", isPlaying);
    playButton.setAttribute(
      "aria-label",
      isPlaying ? "Pause background music" : "Play background music"
    );
    playButton.setAttribute("aria-pressed", isPlaying ? "true" : "false");
    document.body.classList.toggle("music-live", isPlaying);
    document.dispatchEvent(new CustomEvent("iamb-audio-state", {
      detail: {
        isPlaying,
        trackIndex: currentTrackIndex
      }
    }));
  };

  const setActiveTrackButton = (activeIndex) => {
    trackButtons.forEach((button) => {
      const trackIndex = Number(button.dataset.audioTrack);
      const isActive = trackIndex === activeIndex;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
  };

  const loadTrack = async (nextTrackIndex, keepPlayback = true) => {
    const track = HEADER_AUDIO_TRACKS[nextTrackIndex];
    if (!track) return;
    const shouldResume = keepPlayback && !audio.paused && !audio.ended;
    currentTrackIndex = nextTrackIndex;
    if (trackName) {
      trackName.textContent = track.label;
    }
    audio.src = getSourceForTrack(track);
    audio.loop = true;
    audio.volume = 0.18;
    audio.load();
    setActiveTrackButton(currentTrackIndex);
    if (shouldResume) {
      try {
        await audio.play();
      } catch (error) {
        setPlayingState(false);
      }
    }
    writeStoredState();
  };

  playButton.addEventListener("click", async () => {
    if (audio.paused || audio.ended) {
      clearPendingResumeGesture();
      try {
        await audio.play();
      } catch (error) {
        setPlayingState(false);
      }
      return;
    }
    audio.pause();
  });

  trackButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const trackIndex = Number(button.dataset.audioTrack);
      if (Number.isNaN(trackIndex) || trackIndex === currentTrackIndex) return;
      await loadTrack(trackIndex, true);
      writeStoredState();
    });
  });

  audio.addEventListener("play", () => {
    setPlayingState(true);
    clearPendingResumeGesture();
    writeStoredState();
  });
  audio.addEventListener("pause", () => {
    setPlayingState(false);
    writeStoredState();
  });
  audio.addEventListener("ended", () => {
    setPlayingState(false);
    writeStoredState();
  });
  audio.addEventListener("timeupdate", writeStoredState);
  window.addEventListener("pagehide", () => writeStoredState());
  window.addEventListener("beforeunload", () => writeStoredState());

  const savedState = readStoredState();
  const startIndex =
    savedState &&
    Number.isInteger(savedState.trackIndex) &&
    savedState.trackIndex >= 0 &&
    savedState.trackIndex < HEADER_AUDIO_TRACKS.length
      ? savedState.trackIndex
      : 0;

  loadTrack(startIndex, false);
  setPlayingState(Boolean(savedState?.isPlaying));

  if (savedState && Number.isFinite(savedState.currentTime) && savedState.currentTime > 0) {
    const seekToSavedTime = () => {
      const safeTime = Math.max(0, savedState.currentTime);
      try {
        audio.currentTime = safeTime;
      } catch (error) {
        // Ignore seek errors.
      }
    };
    if (audio.readyState >= 1) {
      seekToSavedTime();
    } else {
      audio.addEventListener("loadedmetadata", seekToSavedTime, { once: true });
    }
  }

  if (savedState?.isPlaying) {
    const attemptResume = () => {
      tryResumePlayback().then((resumed) => {
        if (!resumed && audio.readyState < 2) {
          audio.addEventListener("canplay", () => {
            tryResumePlayback();
          }, { once: true });
        }
      });
    };

    if (audio.readyState >= 2) {
      attemptResume();
    } else {
      audio.addEventListener("loadedmetadata", attemptResume, { once: true });
    }
  }
}

initHeaderAudioPlayer();

function initCircularAudioVisualizer() {
  const canvas = document.getElementById("audio-visualizer");
  const audio = document.getElementById("site-audio");
  const logoElement = document.querySelector(".logo");
  if (!canvas || !audio) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const splitter = audioContext.createChannelSplitter(2);
  const analyserL = audioContext.createAnalyser();
  const analyserR = audioContext.createAnalyser();
  analyserL.fftSize = 8192;
  analyserR.fftSize = 8192;

  let sourceNode;
  try {
    sourceNode = audioContext.createMediaElementSource(audio);
  } catch (error) {
    return;
  }

  sourceNode.connect(splitter);
  splitter.connect(analyserL, 0, 0);
  splitter.connect(analyserR, 1, 0);
  sourceNode.connect(audioContext.destination);

  const bufferLengthL = analyserL.frequencyBinCount;
  const bufferLengthR = analyserR.frequencyBinCount;
  const audioDataArrayL = new Uint8Array(bufferLengthL);
  const audioDataArrayR = new Uint8Array(bufferLengthR);

  const angleExtra = 90;
  let centerX = 0;
  let centerY = 0;
  let radius = 0;
  let steps = 0;
  let interval = 0;
  let pCircle = 0;
  let renderWidth = 0;
  let renderHeight = 0;
  let pointsUp = [];
  let pointsDown = [];
  const baseUp = 1.1;
  const baseDown = 0.9;
  const upGain = 0.8;
  const downGain = 0.2;
  let amplitudeScale = 0.3;
  const idleUpAmp = 0.055;
  const idleDownAmp = 0.03;
  const idleLerp = 0.14;

  function setupCanvas() {
    const rect = canvas.getBoundingClientRect();
    renderWidth = Math.max(220, Math.round(rect.width));
    renderHeight = Math.max(150, Math.round(rect.height));

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(renderWidth * dpr);
    canvas.height = Math.floor(renderHeight * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    centerX = renderWidth / 2;
    centerY = renderHeight / 2;
    const logoRect = logoElement ? logoElement.getBoundingClientRect() : null;
    const logoDiameter = logoRect
      ? Math.min(logoRect.width, logoRect.height)
      : Math.min(renderWidth, renderHeight) * 0.78;
    const logoRadius = logoDiameter / 2;

    const targetRadius = window.innerWidth <= 425 ? 120 : 160;
    amplitudeScale = window.innerWidth <= 425 ? 0.34 : 0.3;
    const desiredBaseOuter = logoRadius + (window.innerWidth <= 425 ? 8 : 10);
    const maxDist = baseUp + upGain * amplitudeScale;
    const maxByCanvas = (Math.min(renderWidth, renderHeight) / 2 - 2) / maxDist;
    radius = Math.min(targetRadius, desiredBaseOuter / baseUp, maxByCanvas);
    steps = window.innerWidth <= 425 ? 60 : 120;
    interval = 360 / steps;
    pCircle = 2 * Math.PI * radius;

    pointsUp = [];
    pointsDown = [];
    for (let angle = 0; angle < 360; angle += interval) {
      const distUp = baseUp;
      const distDown = baseDown;

      pointsUp.push({
        angle: angle + angleExtra,
        x: centerX + radius * Math.cos((-angle + angleExtra) * Math.PI / 180) * distUp,
        y: centerY + radius * Math.sin((-angle + angleExtra) * Math.PI / 180) * distUp,
        dist: distUp
      });

      pointsDown.push({
        angle: angle + angleExtra + 5,
        x: centerX + radius * Math.cos((-angle + angleExtra + 5) * Math.PI / 180) * distDown,
        y: centerY + radius * Math.sin((-angle + angleExtra + 5) * Math.PI / 180) * distDown,
        dist: distDown
      });
    }
  }

  function drawLine(points, strokeColor, lineJoin = "round") {
    if (!points.length) return;
    const origin = points[0];
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineJoin = lineJoin;
    ctx.moveTo(origin.x, origin.y);
    for (let i = 0; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(origin.x, origin.y);
    ctx.stroke();
  }

  function connectPoints(pointsA, pointsB) {
    const count = Math.min(pointsA.length, pointsB.length);
    for (let i = 0; i < count; i += 1) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.moveTo(pointsA[i].x, pointsA[i].y);
      ctx.lineTo(pointsB[i].x, pointsB[i].y);
      ctx.stroke();
    }
  }

  function updatePoints() {
    analyserL.getByteFrequencyData(audioDataArrayL);
    analyserR.getByteFrequencyData(audioDataArrayR);

    for (let i = 0; i < pointsUp.length; i += 1) {
      let audioIndex = Math.ceil(pointsUp[i].angle * (bufferLengthL / (pCircle * 2))) | 0;
      audioIndex = Math.max(0, Math.min(bufferLengthL - 1, audioIndex));
      let audioValue = (audioDataArrayL[audioIndex] / 255) * amplitudeScale;

      pointsUp[i].dist = baseUp + audioValue * upGain;
      pointsUp[i].x = centerX + radius * Math.cos(-pointsUp[i].angle * Math.PI / 180) * pointsUp[i].dist;
      pointsUp[i].y = centerY + radius * Math.sin(-pointsUp[i].angle * Math.PI / 180) * pointsUp[i].dist;

      audioIndex = Math.ceil(pointsDown[i].angle * (bufferLengthR / (pCircle * 2))) | 0;
      audioIndex = Math.max(0, Math.min(bufferLengthR - 1, audioIndex));
      audioValue = (audioDataArrayR[audioIndex] / 255) * amplitudeScale;

      pointsDown[i].dist = baseDown + audioValue * downGain;
      pointsDown[i].x = centerX + radius * Math.cos(-pointsDown[i].angle * Math.PI / 180) * pointsDown[i].dist;
      pointsDown[i].y = centerY + radius * Math.sin(-pointsDown[i].angle * Math.PI / 180) * pointsDown[i].dist;
    }
  }

  function updateIdleWave(time) {
    const phase = (time * 0.032) % 360;
    const crestWidth = 14;
    const tailOffset = 22;
    const tailWidth = 18;
    for (let i = 0; i < pointsUp.length; i += 1) {
      const upDelta = ((((pointsUp[i].angle - phase) % 360) + 540) % 360) - 180;
      const downDelta = ((((pointsDown[i].angle - (phase + 8)) % 360) + 540) % 360) - 180;

      const upCrest = Math.max(0, 1 - Math.abs(upDelta) / crestWidth);
      const upTail = Math.max(0, 1 - Math.abs(upDelta + tailOffset) / tailWidth);
      const downCrest = Math.max(0, 1 - Math.abs(downDelta) / crestWidth);
      const downTail = Math.max(0, 1 - Math.abs(downDelta + tailOffset) / tailWidth);

      const upTarget = baseUp + upCrest * idleUpAmp - upTail * idleUpAmp * 0.42;
      const downTarget = baseDown + downCrest * idleDownAmp - downTail * idleDownAmp * 0.42;

      pointsUp[i].dist += (upTarget - pointsUp[i].dist) * idleLerp;
      pointsDown[i].dist += (downTarget - pointsDown[i].dist) * idleLerp;

      pointsUp[i].x = centerX + radius * Math.cos(-pointsUp[i].angle * Math.PI / 180) * pointsUp[i].dist;
      pointsUp[i].y = centerY + radius * Math.sin(-pointsUp[i].angle * Math.PI / 180) * pointsUp[i].dist;
      pointsDown[i].x = centerX + radius * Math.cos(-pointsDown[i].angle * Math.PI / 180) * pointsDown[i].dist;
      pointsDown[i].y = centerY + radius * Math.sin(-pointsDown[i].angle * Math.PI / 180) * pointsDown[i].dist;
    }
  }

  function render(time = 0) {
    requestAnimationFrame(render);

    const isPlaying = !audio.paused && !audio.ended;
    canvas.classList.toggle("is-active", isPlaying);
    if (isPlaying) {
      updatePoints();
    } else {
      updateIdleWave(time);
    }

    ctx.clearRect(0, 0, renderWidth, renderHeight);
    ctx.lineWidth = 1;
    const joinStyle = isPlaying ? "round" : "miter";

    drawLine(pointsUp, "rgba(255,255,255,0.1)", joinStyle);
    drawLine(pointsDown, "rgba(255,255,255,0.1)", joinStyle);
    connectPoints(pointsUp, pointsDown);
  }

  function resumeAudioContext() {
    if (audioContext.state === "running") return Promise.resolve();
    return audioContext.resume().catch(() => {});
  }

  audio.addEventListener("play", () => {
    resumeAudioContext();
  });

  document.addEventListener("iamb-audio-state", (event) => {
    if (event?.detail?.isPlaying) {
      resumeAudioContext();
    }
  });

  window.addEventListener("pointerdown", resumeAudioContext, { once: true });
  window.addEventListener("keydown", resumeAudioContext, { once: true });
  window.addEventListener("resize", setupCanvas, { passive: true });
  setupCanvas();
  if (!audio.paused && !audio.ended) {
    resumeAudioContext();
  }
  render();
}

initCircularAudioVisualizer();

const contactLinks = document.querySelectorAll(".contact-links a");
if (contactLinks.length) {
  contactLinks.forEach((link) => {
    if (!link.getAttribute("aria-label")) {
      link.setAttribute("aria-label", link.textContent.trim());
    }
  });
}

const latestVideoCard = document.getElementById("latest-video-card");
const youtubeGrid = document.getElementById("youtube-grid");
const youtubeStatus = document.getElementById("youtube-status");

const SOCIAL_FEED_PATH = "assets/social-feed.json";
const SOURCE_ICON_MAP = {
  youtube: "assets/icons/youtube.svg",
  instagram: "assets/icons/instagram.svg",
  tiktok: "assets/icons/tiktok.svg"
};
const TIKTOK_OFFICIAL_ICON_PATH = "assets/icons/tiktok-official.svg";
const SOURCE_LABELS = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok"
};
const INSTAGRAM_USERNAME = "iamb.synthmusic";
const INSTAGRAM_PROFILE_URL =
  `https://www.instagram.com/api/v1/users/web_profile_info/?username=${INSTAGRAM_USERNAME}`;
const INSTAGRAM_PROFILE_PROXY = `https://corsproxy.io/?${encodeURIComponent(INSTAGRAM_PROFILE_URL)}`;
const INSTAGRAM_CACHE_KEY = "iamb_instagram_feed_cache_v1";
const INSTAGRAM_CACHE_TTL = 1000 * 60 * 60 * 6;

const YOUTUBE_CHANNEL_ID = "UCVV-a7quRaRVbh6bfrUVx4A";
const YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
const YOUTUBE_FEED_PROXY = `https://api.allorigins.win/raw?url=${encodeURIComponent(YOUTUBE_FEED_URL)}`;
const YOUTUBE_FEED_CORS = `https://cors.isomorphic-git.org/${YOUTUBE_FEED_URL}`;
const YOUTUBE_FEED_CORS_PROXY = `https://corsproxy.io/?${encodeURIComponent(YOUTUBE_FEED_URL)}`;
const YOUTUBE_FEED_JINA = `https://r.jina.ai/http://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;
const YOUTUBE_CACHE_KEY = "iamb_youtube_feed_cache_v1";
const YOUTUBE_CACHE_TTL = 1000 * 60 * 60 * 6;
const YOUTUBE_FETCH_TIMEOUT = 4500;
let youtubeLoading = false;

function normalizeText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function formatVideoTitle(title, source) {
  const cleaned = normalizeText(title);
  if (source === "youtube") {
    return cleaned.replace(/^iamb\s*synthmusic\s*[---:]\s*/i, "");
  }
  return cleaned;
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

let currentMediaItems = [];
let activeMediaFilters = new Set();
let mediaFilterButtons = [];

function filterMediaItems(items, filters) {
  if (!filters || !filters.size) return [];
  return items.filter((item) => filters.has(item.source));
}

function getMediaFilterLabels(filters) {
  return Array.from(filters).map((filter) => SOURCE_LABELS[filter] || filter);
}

function updateMediaFilterButtons() {
  const buttons = mediaFilterButtons.length
    ? mediaFilterButtons
    : document.querySelectorAll("[data-media-filter]");
  if (!buttons.length) return;
  buttons.forEach((button) => {
    const filter = button.dataset.mediaFilter;
    const isActive = filter ? activeMediaFilters.has(filter) : false;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setActiveMediaFilters(filters) {
  activeMediaFilters = new Set(filters);
  updateMediaFilterButtons();
  if (!currentMediaItems.length) return;
  renderVideoGrid(currentMediaItems);
}

function toggleMediaFilter(filter) {
  if (!filter) return;
  if (activeMediaFilters.has(filter)) {
    activeMediaFilters.delete(filter);
  } else {
    activeMediaFilters.add(filter);
  }
  updateMediaFilterButtons();
  if (!currentMediaItems.length) return;
  renderVideoGrid(currentMediaItems);
}

function initMediaFilters() {
  const buttons = document.querySelectorAll("[data-media-filter]");
  if (!buttons.length) return;
  mediaFilterButtons = Array.from(buttons);
  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      toggleMediaFilter(button.dataset.mediaFilter);
    });
  });
  const activeFromMarkup = Array.from(buttons)
    .map((button) =>
      button.classList.contains("is-active") ? button.dataset.mediaFilter : null
    )
    .filter(Boolean);
  const allFilters = Array.from(buttons)
    .map((button) => button.dataset.mediaFilter)
    .filter(Boolean);
  const initialFilters = activeFromMarkup.length ? activeFromMarkup : allFilters;
  setActiveMediaFilters(initialFilters);
}

function parseTimestamp(value) {
  if (!value) return 0;
  if (typeof value === "number") {
    return value < 10000000000 ? value * 1000 : value;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeSocialItem(item, sourceFallback) {
  if (!item) return null;
  const url = item.url || item.link;
  const thumbnail = item.thumbnail || item.image;
  const source = (item.source || sourceFallback || "").toLowerCase();
  if (!url || !thumbnail) return null;
  const title = normalizeText(item.title || item.caption || "");
  const description = normalizeText(item.description || item.caption || "");
  const published = parseTimestamp(item.published || item.timestamp);
  return {
    title,
    description,
    url,
    thumbnail,
    source,
    published
  };
}

function mergeMediaItems(...lists) {
  const seen = new Set();
  const items = [];
  lists.flat().forEach((item) => {
    if (!item || !item.url) return;
    if (seen.has(item.url)) return;
    seen.add(item.url);
    items.push(item);
  });
  return items.sort((a, b) => (b.published || 0) - (a.published || 0));
}

function loadCachedInstagramFeed() {
  try {
    const cached = localStorage.getItem(INSTAGRAM_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (!data || !Array.isArray(data.items)) return null;
    if (Date.now() - data.timestamp > INSTAGRAM_CACHE_TTL) return null;
    return data.items;
  } catch (error) {
    return null;
  }
}

function saveCachedInstagramFeed(items) {
  try {
    localStorage.setItem(
      INSTAGRAM_CACHE_KEY,
      JSON.stringify({ items, timestamp: Date.now() })
    );
  } catch (error) {
    // Ignore cache errors
  }
}

function parseInstagramFeed(data) {
  const edges = data?.data?.user?.edge_owner_to_timeline_media?.edges;
  if (!Array.isArray(edges)) return [];

  return edges
    .map((edge) => {
      const node = edge?.node;
      if (!node) return null;
      const shortcode = node.shortcode;
      const url = shortcode ? `https://www.instagram.com/p/${shortcode}/` : null;
      const fallbackThumb = shortcode
        ? `https://www.instagram.com/p/${shortcode}/media/?size=l`
        : null;
      const thumbnail = fallbackThumb || node.thumbnail_src || node.display_url;
      if (!url || !thumbnail) return null;
      const captionEdge = node.edge_media_to_caption?.edges?.[0]?.node;
      const caption = captionEdge?.text || "";
      const normalizedCaption = normalizeText(caption);
      const title = normalizedCaption
        ? truncateText(normalizedCaption, 60)
        : "Instagram Post";
      return {
        title,
        description: normalizedCaption,
        url,
        thumbnail,
        source: "instagram",
        published: parseTimestamp(node.taken_at_timestamp)
      };
    })
    .filter(Boolean);
}

async function fetchInstagramFeed() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT);
  try {
    const response = await fetch(INSTAGRAM_PROFILE_PROXY, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    const items = parseInstagramFeed(data);
    if (items.length) {
      saveCachedInstagramFeed(items);
    }
    return items;
  } catch (error) {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextFromSources(sources) {
  const tryFetch = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const text = await response.text();
      return text || null;
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  if (typeof Promise.any === "function") {
    const tasks = sources.map((url) =>
      tryFetch(url).then((result) => {
        if (!result) throw new Error("empty");
        return result;
      })
    );
    try {
      return await Promise.any(tasks);
    } catch (error) {
      return null;
    }
  }

  for (const url of sources) {
    const result = await tryFetch(url);
    if (result) return result;
  }

  return null;
}

function getInstagramOembedSources(postUrl) {
  const embedUrl = `https://www.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}`;
  return [
    `https://corsproxy.io/?${encodeURIComponent(embedUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(embedUrl)}`,
    embedUrl
  ];
}

async function fetchInstagramOembed(postUrl) {
  const text = await fetchTextFromSources(getInstagramOembedSources(postUrl));
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function hydrateInstagramItems(items) {
  if (!items.length) return items;
  const hydrated = await Promise.all(
    items.map(async (item) => {
      if (item.source !== "instagram") return item;
      if (item.thumbnail) {
        return item;
      }
      const data = await fetchInstagramOembed(item.url);
      if (!data) return item;
      return {
        ...item,
        title: item.title || normalizeText(data.title || ""),
        thumbnail: data.thumbnail_url || item.thumbnail || ""
      };
    })
  );
  return hydrated.filter((item) => item.thumbnail);
}

function parseLocalSocialFeed(data) {
  if (!data) return [];
  const items = [];

  if (Array.isArray(data)) {
    data.forEach((item) => {
      const normalized = normalizeSocialItem(item);
      if (normalized) items.push(normalized);
    });
    return items;
  }

  if (Array.isArray(data.items)) {
    data.items.forEach((item) => {
      const normalized = normalizeSocialItem(item);
      if (normalized) items.push(normalized);
    });
  }

  if (Array.isArray(data.tiktok)) {
    data.tiktok.forEach((item) => {
      const normalized = normalizeSocialItem(item, "tiktok");
      if (normalized) items.push(normalized);
    });
  }

  if (Array.isArray(data.youtube)) {
    data.youtube.forEach((item) => {
      const normalized = normalizeSocialItem(item, "youtube");
      if (normalized) items.push(normalized);
    });
  }

  if (Array.isArray(data.instagram)) {
    data.instagram.forEach((item) => {
      const normalized = normalizeSocialItem(item, "instagram");
      if (normalized) items.push(normalized);
    });
  }

  return items;
}

async function fetchLocalSocialFeed() {
  try {
    const separator = SOCIAL_FEED_PATH.includes("?") ? "&" : "?";
    const url = `${SOCIAL_FEED_PATH}${separator}t=${Date.now()}`;
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];
    const data = await response.json();
    return parseLocalSocialFeed(data);
  } catch (error) {
    return [];
  }
}


async function fetchYouTubeFeed() {
  const sources = [
    YOUTUBE_FEED_PROXY,
    YOUTUBE_FEED_CORS,
    YOUTUBE_FEED_CORS_PROXY,
    YOUTUBE_FEED_JINA,
    YOUTUBE_FEED_URL
  ];

  const tryFetchFeed = async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), YOUTUBE_FETCH_TIMEOUT);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) return null;
      const text = await response.text();
      if (text.includes("<feed")) {
        return { text, format: "xml" };
      }
      if (text.includes("yt:video:")) {
        return { text, format: "jina" };
      }
      return null;
    } catch (error) {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  };

  if (typeof Promise.any === "function") {
    const tasks = sources.map((url) =>
      tryFetchFeed(url).then((result) => {
        if (!result) throw new Error("invalid feed");
        return result;
      })
    );

    try {
      return await Promise.any(tasks);
    } catch (error) {
      return null;
    }
  }

  for (const url of sources) {
    const result = await tryFetchFeed(url);
    if (result) return result;
  }

  return null;
}

function parseYouTubeFeed(xmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const entries = Array.from(doc.getElementsByTagName("entry"));

  const videos = entries.map((entry) => {
    const titleNode = entry.getElementsByTagName("title")[0];
    const title = titleNode ? normalizeText(titleNode.textContent) : "Neues Video";
    const videoIdNode = entry.getElementsByTagName("yt:videoId")[0];
    const videoId = videoIdNode ? videoIdNode.textContent : null;
    const linkNode = Array.from(entry.getElementsByTagName("link")).find(
      (link) => link.getAttribute("rel") === "alternate"
    );
    const url = linkNode ? linkNode.getAttribute("href") : null;
    const descriptionNode = entry.getElementsByTagName("media:description")[0];
    const description = descriptionNode ? normalizeText(descriptionNode.textContent) : "";
    const thumbnailNode = entry.getElementsByTagName("media:thumbnail")[0];
    const thumbnail = thumbnailNode
      ? thumbnailNode.getAttribute("url")
      : videoId
        ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
        : "";
    const publishedNode =
      entry.getElementsByTagName("published")[0] || entry.getElementsByTagName("updated")[0];
    const publishedValue = publishedNode ? Date.parse(publishedNode.textContent) : 0;
    const published = Number.isNaN(publishedValue) ? 0 : publishedValue;

    return {
      title,
      url: url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "#"),
      description,
      thumbnail,
      source: "youtube",
      published
    };
  });

  const seen = new Set();
  return videos.filter((video) => {
    const key = video.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseYouTubeFeedFromJina(text) {
  const pattern = /yt:video:([A-Za-z0-9_-]{11})\s+[A-Za-z0-9_-]{11}\s+UC[\w-]{22}\s+([^\n]+)/g;
  const results = [];
  const seen = new Set();
  let match = pattern.exec(text);

  while (match) {
    const videoId = match[1];
    const title = normalizeText(match[2].replace(/"/g, ""));
    if (!seen.has(videoId)) {
      seen.add(videoId);
      results.push({
        title,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        description: "",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        source: "youtube",
        published: 0
      });
    }
    match = pattern.exec(text);
  }

  return results;
}

function loadCachedFeed() {
  try {
    const cached = localStorage.getItem(YOUTUBE_CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (!data || !data.text || !data.format) return null;
    if (Date.now() - data.timestamp > YOUTUBE_CACHE_TTL) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function saveCachedFeed(feed) {
  try {
    localStorage.setItem(
      YOUTUBE_CACHE_KEY,
      JSON.stringify({ ...feed, timestamp: Date.now() })
    );
  } catch (error) {
    // Ignore cache errors
  }
}


function renderLatestSkeleton() {
  if (!latestVideoCard) return;
  latestVideoCard.classList.add("is-loading");
  const skeletonCards = Array.from({ length: 4 }, () => `
    <article class="latest-video-item latest-video-item-skeleton">
      <div class="skeleton-block skeleton-cover"></div>
      <div class="latest-video-body">
        <div class="skeleton-block skeleton-title"></div>
        <div class="skeleton-block skeleton-line"></div>
        <div class="skeleton-block skeleton-line short"></div>
        <div class="latest-video-actions">
          <div class="skeleton-block skeleton-button"></div>
        </div>
      </div>
    </article>
  `).join("");
  latestVideoCard.innerHTML = skeletonCards;
}

function renderGridSkeleton(count = 6) {
  if (!youtubeGrid) return;

  youtubeGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    const card = document.createElement("div");
    card.className = "release-card is-loading";
    card.innerHTML = `
      <div class="skeleton-block release-cover"></div>
      <div class="release-body">
        <div class="skeleton-block skeleton-line"></div>
        <div class="skeleton-block skeleton-line short"></div>
      </div>
    `;
    fragment.appendChild(card);
  }
  youtubeGrid.appendChild(fragment);

  if (youtubeStatus) {
    youtubeStatus.textContent = "Videos werden geladen.";
  }
}

function attachRetry(container) {
  const button = container.querySelector(".js-retry");
  if (!button) return;
  button.addEventListener("click", () => {
    loadYouTubeContent({ forceRefresh: true });
  });
}

function renderFeedError(message) {
  const status = youtubeStatus;

  if (latestVideoCard) {
    latestVideoCard.classList.remove("is-loading");
    latestVideoCard.innerHTML = `
      <div class="feed-error">
        <p class="feed-status">${message}</p>
        <button class="btn ghost js-retry" type="button">Erneut versuchen</button>
      </div>
    `;
    attachRetry(latestVideoCard);
  }

  if (status) {
    status.innerHTML = `
      <span>${message}</span>
      <button class="btn ghost js-retry" type="button">Erneut versuchen</button>
    `;
    attachRetry(status);
  }
}

function createPlatformWatchButton(video) {
  const sourceLabel = SOURCE_LABELS[video.source] || "Plattform";
  const button = document.createElement("a");
  button.className = "btn ghost latest-platform-btn";
  button.href = video.url;
  button.target = "_blank";
  button.rel = "noopener";
  button.setAttribute("aria-label", `Auf ${sourceLabel} ansehen`);

  const beforeText = document.createElement("span");
  beforeText.textContent = "Auf";

  const iconPath =
    video.source === "tiktok"
      ? TIKTOK_OFFICIAL_ICON_PATH
      : SOURCE_ICON_MAP[video.source];
  if (iconPath) {
    const icon = document.createElement("img");
    icon.src = iconPath;
    icon.alt = "";
    icon.setAttribute("aria-hidden", "true");
    button.appendChild(beforeText);
    button.appendChild(icon);
  } else {
    button.appendChild(beforeText);
  }

  const afterText = document.createElement("span");
  afterText.textContent = "ansehen";
  button.appendChild(afterText);

  return button;
}

function createLatestVideoItem(video) {
  const sourceLabel = SOURCE_LABELS[video.source] || "Social";
  const card = document.createElement("article");
  card.className = "latest-video-item";
  if (video.source) {
    card.dataset.source = video.source;
  }

  const media = document.createElement("div");
  media.className = "latest-video-media";

  const cover = document.createElement("img");
  cover.className = "latest-video-cover";
  cover.src = video.thumbnail;
  cover.loading = "lazy";
  if (video.source === "instagram") {
    cover.referrerPolicy = "no-referrer";
  }

  const displayTitle =
    formatVideoTitle(video.title, video.source) ||
    `${sourceLabel} Upload`;
  cover.alt = `${displayTitle} Cover`;

  media.appendChild(cover);

  const body = document.createElement("div");
  body.className = "latest-video-body";

  const heading = document.createElement("h3");
  heading.textContent = displayTitle;

  const desc = document.createElement("p");
  const descriptionText = video.description || `${sourceLabel} Upload`;
  desc.textContent = truncateText(descriptionText, 110);

  const actions = document.createElement("div");
  actions.className = "latest-video-actions";
  actions.appendChild(createPlatformWatchButton(video));

  body.appendChild(heading);
  body.appendChild(desc);
  body.appendChild(actions);

  card.appendChild(media);
  card.appendChild(body);
  return card;
}

function renderLatestVideos(videos) {
  if (!latestVideoCard) return;
  const latestVideos = videos
    .filter((item) => item && item.url && item.thumbnail)
    .slice(0, 4);

  if (!latestVideos.length) {
    renderFeedError("Videos konnten nicht geladen werden.");
    return;
  }

  latestVideoCard.classList.remove("is-loading");
  latestVideoCard.innerHTML = "";

  const fragment = document.createDocumentFragment();
  latestVideos.forEach((video) => {
    fragment.appendChild(createLatestVideoItem(video));
  });
  latestVideoCard.appendChild(fragment);
}

function renderVideoGrid(videos) {
  const grid = youtubeGrid;
  const status = youtubeStatus;
  if (!grid) return;

  currentMediaItems = videos;
  const filteredVideos = filterMediaItems(videos, activeMediaFilters);

  grid.innerHTML = "";
  if (!filteredVideos.length) {
    if (status) {
      if (!activeMediaFilters.size) {
        status.textContent = "Keine Filter ausgewählt.";
      } else if (!videos.length) {
        status.textContent = "Keine Inhalte gefunden.";
      } else {
        const labelList = getMediaFilterLabels(activeMediaFilters).join(", ");
        status.textContent = `Keine Inhalte für ${labelList}.`;
      }
      status.style.display = "flex";
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  filteredVideos.forEach((video) => {
    const card = document.createElement("a");
    card.className = "release-card";
    card.href = video.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.setAttribute("data-animate", "");
    if (video.source) {
      card.dataset.source = video.source;
    }

    const cover = document.createElement("img");
    cover.className = "release-cover";
    cover.src = video.thumbnail;
    cover.loading = "lazy";
    if (video.source === "instagram") {
      cover.referrerPolicy = "no-referrer";
    }

    const body = document.createElement("div");
    body.className = "release-body";

    const title = document.createElement("h3");
    const fallbackLabel =
      video.source === "youtube"
        ? "YouTube Upload"
        : SOURCE_LABELS[video.source]
          ? `${SOURCE_LABELS[video.source]} Post`
          : "Social Post";
    const displayTitle = formatVideoTitle(video.title, video.source) || fallbackLabel;
    title.textContent = displayTitle;

    const desc = document.createElement("p");
    const descText = video.description || fallbackLabel;
    desc.textContent = truncateText(descText, 120);

    body.appendChild(title);
    body.appendChild(desc);
    cover.alt = `${displayTitle} Cover`;
    card.appendChild(cover);
    if (video.source && SOURCE_ICON_MAP[video.source]) {
      const badge = document.createElement("span");
      badge.className = `source-badge source-${video.source}`;
      const icon = document.createElement("img");
      icon.src = SOURCE_ICON_MAP[video.source];
      icon.alt = SOURCE_LABELS[video.source] || video.source;
      badge.appendChild(icon);
      card.appendChild(badge);
    }
    card.appendChild(body);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);

  observeAnimatedElements(grid.querySelectorAll("[data-animate]"));

  if (status) {
    status.style.display = "none";
  }
}

async function loadYouTubeContent({ forceRefresh = false } = {}) {
  if (youtubeLoading) return;
  youtubeLoading = true;
  const needsLatest = Boolean(latestVideoCard);
  const needsGrid = Boolean(youtubeGrid);

  if (!needsLatest && !needsGrid) {
    youtubeLoading = false;
    return;
  }

  if (needsLatest) renderLatestSkeleton();
  if (needsGrid) renderGridSkeleton();

  const combined = mergeMediaItems(await fetchLocalSocialFeed());

  if (needsLatest) {
    if (combined.length) {
      renderLatestVideos(combined);
    } else {
      renderFeedError("Videos konnten nicht geladen werden.");
    }
  }

  if (needsGrid) {
    if (combined.length) {
      renderVideoGrid(combined);
    } else {
      renderFeedError("Videos konnten nicht geladen werden.");
    }
  }

  if (youtubeStatus && needsGrid && combined.length) {
    youtubeStatus.style.display = "none";
  }

  youtubeLoading = false;
}

initMediaFilters();
loadYouTubeContent();
