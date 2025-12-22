const canvas = document.getElementById("starfield");
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
let reduceMotion = reduceMotionQuery.matches;
const ctx = canvas ? canvas.getContext("2d") : null;
const stars = [];
let width = 0;
let height = 0;
let dpr = 1;
let pointerX = 0;
let pointerY = 0;
let animationFrameId = 0;
let isAnimating = false;
let resizeRaf = 0;

function resizeCanvas() {
  if (!canvas || !ctx) return;
  dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  buildStars();
  drawStars(performance.now());
}

function buildStars() {
  stars.length = 0;
  const count = Math.floor((width * height) / 4800);
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

function drawStars(time) {
  if (!canvas || !ctx) return;
  ctx.clearRect(0, 0, width, height);
  const motionScale = reduceMotion ? 0.25 : 1;
  const twinkleScale = reduceMotion ? 0.6 : 1;

  for (const star of stars) {
    const driftX = pointerX * star.speed * 14 * motionScale;
    const driftY = pointerY * star.speed * 14 * motionScale;
    star.y += star.speed * motionScale;

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

if (canvas && ctx) {
  window.addEventListener("resize", () => {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      resizeCanvas();
    });
  });

  window.addEventListener("mousemove", (event) => {
    if (!width || !height) return;
    pointerX = (event.clientX / width - 0.5) * 0.6;
    pointerY = (event.clientY / height - 0.5) * 0.6;
  }, { passive: true });

  document.addEventListener("visibilitychange", handleVisibilityChange);

  if (typeof reduceMotionQuery.addEventListener === "function") {
    reduceMotionQuery.addEventListener("change", handleReducedMotionChange);
  } else if (typeof reduceMotionQuery.addListener === "function") {
    reduceMotionQuery.addListener(handleReducedMotionChange);
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

document.querySelectorAll(".contact-links a").forEach((link) => {
  if (!link.getAttribute("aria-label")) {
    link.setAttribute("aria-label", link.textContent.trim());
  }
});

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

function formatVideoTitle(title) {
  const cleaned = normalizeText(title);
  return cleaned.replace(/^iamb\s*synthmusic\s*[-–—:]\s*/i, "");
}

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
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

    return {
      title,
      url: url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : "#"),
      description,
      thumbnail
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
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
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
  const latestCard = document.getElementById("latest-video-card");
  if (!latestCard) return;
  latestCard.classList.add("is-loading");
  latestCard.innerHTML = `
    <div class="skeleton-block skeleton-cover"></div>
    <div class="latest-video-body">
      <div class="skeleton-block skeleton-title"></div>
      <div class="skeleton-block skeleton-line"></div>
      <div class="skeleton-block skeleton-line short"></div>
      <div class="latest-video-actions">
        <div class="skeleton-block skeleton-button"></div>
      </div>
    </div>
  `;
}

function renderGridSkeleton(count = 6) {
  const grid = document.getElementById("youtube-grid");
  const status = document.getElementById("youtube-status");
  if (!grid) return;

  grid.innerHTML = "";
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
  grid.appendChild(fragment);

  if (status) {
    status.textContent = "Videos werden geladen.";
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
  const latestCard = document.getElementById("latest-video-card");
  const status = document.getElementById("youtube-status");

  if (latestCard) {
    latestCard.classList.remove("is-loading");
    latestCard.innerHTML = `
      <div class="feed-error">
        <p class="feed-status">${message}</p>
        <button class="btn ghost js-retry" type="button">Erneut versuchen</button>
      </div>
    `;
    attachRetry(latestCard);
  }

  if (status) {
    status.innerHTML = `
      <span>${message}</span>
      <button class="btn ghost js-retry" type="button">Erneut versuchen</button>
    `;
    attachRetry(status);
  }
}

function renderLatestVideo(video) {
  const latestCard = document.getElementById("latest-video-card");
  if (!latestCard || !video) return;

  latestCard.classList.remove("is-loading");
  latestCard.innerHTML = "";

  const cover = document.createElement("img");
  cover.className = "latest-video-cover";
  cover.src = video.thumbnail;
  cover.alt = `${video.title} Cover`;
  cover.loading = "lazy";

  const body = document.createElement("div");
  body.className = "latest-video-body";

  const heading = document.createElement("h3");
  heading.textContent = formatVideoTitle(video.title);

  const desc = document.createElement("p");
  const descText = video.description || "Keine Beschreibung verfügbar.";
  desc.textContent = truncateText(descText, 220);

  const actions = document.createElement("div");
  actions.className = "latest-video-actions";

  const button = document.createElement("a");
  button.className = "btn ghost";
  button.href = video.url;
  button.target = "_blank";
  button.rel = "noopener";
  button.textContent = "Auf YouTube ansehen";

  actions.appendChild(button);
  body.appendChild(heading);
  body.appendChild(desc);
  body.appendChild(actions);

  latestCard.appendChild(cover);
  latestCard.appendChild(body);
}

function renderVideoGrid(videos) {
  const grid = document.getElementById("youtube-grid");
  const status = document.getElementById("youtube-status");
  if (!grid) return;

  grid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  videos.forEach((video) => {
    const card = document.createElement("a");
    card.className = "release-card";
    card.href = video.url;
    card.target = "_blank";
    card.rel = "noopener";
    card.setAttribute("data-animate", "");

    const cover = document.createElement("img");
    cover.className = "release-cover";
    cover.src = video.thumbnail;
    cover.alt = `${video.title} Cover`;
    cover.loading = "lazy";

    const body = document.createElement("div");
    body.className = "release-body";

    const title = document.createElement("h3");
    title.textContent = formatVideoTitle(video.title);

    const desc = document.createElement("p");
    const descText = video.description || "YouTube Upload";
    desc.textContent = truncateText(descText, 120);

    body.appendChild(title);
    body.appendChild(desc);
    card.appendChild(cover);
    card.appendChild(body);
    fragment.appendChild(card);
  });
  grid.appendChild(fragment);

  observeAnimatedElements(grid.querySelectorAll("[data-animate]"));

  if (status) {
    status.remove();
  }
}

async function loadYouTubeContent({ forceRefresh = false } = {}) {
  if (youtubeLoading) return;
  youtubeLoading = true;
  const latestCard = document.getElementById("latest-video-card");
  const grid = document.getElementById("youtube-grid");
  const status = document.getElementById("youtube-status");

  if (!latestCard && !grid) {
    youtubeLoading = false;
    return;
  }

  const cachedFeed = forceRefresh ? null : loadCachedFeed();
  let cachedVideos = [];
  if (cachedFeed) {
    cachedVideos =
      cachedFeed.format === "jina"
        ? parseYouTubeFeedFromJina(cachedFeed.text)
        : parseYouTubeFeed(cachedFeed.text);
    if (cachedVideos.length) {
      renderLatestVideo(cachedVideos[0]);
      renderVideoGrid(cachedVideos);
    }
  }

  if (!cachedVideos.length) {
    renderLatestSkeleton();
    renderGridSkeleton();
  }

  const feed = await fetchYouTubeFeed();
  if (!feed) {
    if (!cachedVideos.length) {
      renderFeedError("Videos konnten nicht geladen werden.");
    }
    youtubeLoading = false;
    return;
  }

  saveCachedFeed(feed);

  const videos =
    feed.format === "jina"
      ? parseYouTubeFeedFromJina(feed.text)
      : parseYouTubeFeed(feed.text);
  if (!videos.length) {
    if (!cachedVideos.length) {
      renderFeedError("Noch keine Videos verfügbar.");
    }
    youtubeLoading = false;
    return;
  }

  renderLatestVideo(videos[0]);
  renderVideoGrid(videos);
  youtubeLoading = false;
}

loadYouTubeContent();
