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
    const response = await fetch(SOCIAL_FEED_PATH, { cache: "no-store" });
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
  latestVideoCard.innerHTML = `
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

function renderLatestVideo(video) {
  if (!latestVideoCard || !video) return;

  latestVideoCard.classList.remove("is-loading");
  latestVideoCard.innerHTML = "";

  const cover = document.createElement("img");
  cover.className = "latest-video-cover";
  cover.src = video.thumbnail;
  cover.loading = "lazy";

  const body = document.createElement("div");
  body.className = "latest-video-body";

  const heading = document.createElement("h3");
  const displayTitle = formatVideoTitle(video.title, video.source) || video.title;
  heading.textContent = displayTitle;
  cover.alt = `${displayTitle} Cover`;

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

  latestVideoCard.appendChild(cover);
  latestVideoCard.appendChild(body);
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

  const cachedFeed = forceRefresh ? null : loadCachedFeed();
  let cachedVideos = [];
  if (cachedFeed) {
    cachedVideos =
      cachedFeed.format === "jina"
        ? parseYouTubeFeedFromJina(cachedFeed.text)
        : parseYouTubeFeed(cachedFeed.text);
    if (cachedVideos.length && needsLatest) {
      renderLatestVideo(cachedVideos[0]);
    }
  }

  const cachedInstagram = forceRefresh ? null : loadCachedInstagramFeed();
  if (needsGrid) {
    const cachedCombined = mergeMediaItems(cachedVideos, cachedInstagram || []);
    if (cachedCombined.length) {
      renderVideoGrid(cachedCombined);
    }
  }

  if (!cachedVideos.length && (!cachedInstagram || !cachedInstagram.length)) {
    if (needsLatest) renderLatestSkeleton();
    if (needsGrid) renderGridSkeleton();
  }

  const fetchTasks = [
    fetchYouTubeFeed(),
    needsGrid ? fetchLocalSocialFeed() : Promise.resolve([]),
    needsGrid ? fetchInstagramFeed() : Promise.resolve(null)
  ];

  const [feed, localSocialItems, instagramItems] = await Promise.all(fetchTasks);

  let youtubeVideos = [];
  if (feed) {
    saveCachedFeed(feed);
    youtubeVideos =
      feed.format === "jina"
        ? parseYouTubeFeedFromJina(feed.text)
        : parseYouTubeFeed(feed.text);
  }

  if (!youtubeVideos.length) {
    youtubeVideos = cachedVideos;
  }

  let finalInstagramItems =
    instagramItems && instagramItems.length ? instagramItems : cachedInstagram || [];
  if (needsGrid) {
    finalInstagramItems = await hydrateInstagramItems(finalInstagramItems);
  }
  const combined = needsGrid
    ? mergeMediaItems(youtubeVideos, localSocialItems, finalInstagramItems)
    : [];

  if (needsLatest) {
    if (youtubeVideos.length) {
      renderLatestVideo(youtubeVideos[0]);
    } else if (!cachedVideos.length) {
      renderFeedError("Videos konnten nicht geladen werden.");
    }
  }

  if (needsGrid) {
    if (combined.length) {
      renderVideoGrid(combined);
    } else if (!cachedVideos.length && !cachedInstagram?.length) {
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
