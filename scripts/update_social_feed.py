import json
import os
import re
import sys
from pathlib import Path

import requests
try:
    import yt_dlp
except ImportError:  # optional dependency for TikTok scraping
    yt_dlp = None

INSTAGRAM_USER = os.environ.get("INSTAGRAM_USERNAME", "iamb.synthmusic")
INSTAGRAM_USER_ID = os.environ.get("INSTAGRAM_USER_ID")
TIKTOK_USER = os.environ.get("TIKTOK_USERNAME", "iamb.synthmusic")
MAX_ITEMS = int(os.environ.get("SOCIAL_FEED_LIMIT", "0"))
OUTPUT_PATH = Path("assets/social-feed.json")
IG_COVER_DIR = Path("assets/ig-covers")
TIKTOK_COVER_DIR = Path("assets/tiktok-covers")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
IG_APP_ID = "936619743392459"
REQUEST_TIMEOUT = int(os.environ.get("SOCIAL_FEED_TIMEOUT", "20"))
SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def is_limit_reached(items):
    return MAX_ITEMS > 0 and len(items) >= MAX_ITEMS


def limit_items(items):
    if MAX_ITEMS <= 0:
        return items
    return items[:MAX_ITEMS]


def fetch_json(url, headers=None, timeout=REQUEST_TIMEOUT):
    try:
        response = SESSION.get(url, headers=headers, timeout=timeout)
        if response.status_code != 200:
            return None
        return response.json()
    except requests.RequestException:
        return None
    except ValueError:
        return None


def download_image(url, dest_path, headers=None, timeout=REQUEST_TIMEOUT):
    request_headers = {"User-Agent": USER_AGENT}
    if headers:
        request_headers.update(headers)
    try:
        response = SESSION.get(
            url,
            headers=request_headers,
            timeout=timeout,
            stream=True,
        )
        if response.status_code != 200:
            return False
        content_type = response.headers.get("Content-Type", "")
        if "image" not in content_type:
            return False
        with dest_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=10240):
                if chunk:
                    handle.write(chunk)
        return True
    except requests.RequestException:
        return False


def truncate_text(text, max_length):
    if len(text) <= max_length:
        return text
    return text[:max_length].rstrip() + "..."


def fetch_instagram_items():
    user_id = INSTAGRAM_USER_ID or fetch_instagram_user_id()
    if not user_id:
        return None
    return fetch_instagram_items_paginated(user_id)


def fetch_instagram_user_id():
    api_url = (
        "https://www.instagram.com/api/v1/users/web_profile_info/"
        f"?username={INSTAGRAM_USER}"
    )
    headers = {
        "User-Agent": USER_AGENT,
        "X-IG-App-ID": IG_APP_ID,
        "Referer": f"https://www.instagram.com/{INSTAGRAM_USER}/",
    }
    data = fetch_json(api_url, headers=headers)
    if not isinstance(data, dict):
        return None
    return data.get("data", {}).get("user", {}).get("id")


def fetch_instagram_items_paginated(user_id):
    headers = {
        "User-Agent": USER_AGENT,
        "X-IG-App-ID": IG_APP_ID,
        "Referer": f"https://www.instagram.com/{INSTAGRAM_USER}/",
    }
    IG_COVER_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    seen = set()
    max_id = None
    while True:
        url = f"https://www.instagram.com/api/v1/feed/user/{user_id}/?count=50"
        if max_id:
            url = f"{url}&max_id={max_id}"
        data, error = fetch_instagram_page(url, headers)
        if error:
            return items if items else None
        for entry in data.get("items", []):
            normalized = normalize_instagram_item(entry)
            if not normalized:
                continue
            if normalized["url"] in seen:
                continue
            seen.add(normalized["url"])
            items.append(normalized)
            if is_limit_reached(items):
                break
        if is_limit_reached(items):
            break
        if not data.get("more_available"):
            break
        next_max_id = data.get("next_max_id")
        if not next_max_id:
            break
        max_id = next_max_id
    return items


def fetch_instagram_page(url, headers):
    try:
        response = SESSION.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    except requests.Timeout:
        return None, "timeout"
    except requests.RequestException:
        return None, "error"
    if response.status_code != 200:
        return None, f"status_{response.status_code}"
    try:
        return response.json(), None
    except ValueError:
        return None, "json"


def normalize_instagram_item(entry):
    if not isinstance(entry, dict):
        return None
    shortcode = entry.get("code") or entry.get("shortcode")
    if not shortcode:
        return None
    url = f"https://www.instagram.com/p/{shortcode}/"
    caption_text = ""
    if isinstance(entry.get("caption"), dict):
        caption_text = entry["caption"].get("text") or ""
    caption_text = " ".join(caption_text.split())
    title_text = truncate_text(caption_text, 60) if caption_text else "Instagram Post"
    published = entry.get("taken_at") or entry.get("taken_at_timestamp") or 0

    cover_url = None
    if entry.get("media_type") == 8 and isinstance(entry.get("carousel_media"), list):
        first_media = entry["carousel_media"][0] if entry["carousel_media"] else {}
        cover_url = get_instagram_cover_url(first_media)
    if not cover_url:
        cover_url = get_instagram_cover_url(entry)
    if not cover_url:
        return None

    local_name = f"{shortcode}.jpg"
    local_path = IG_COVER_DIR / local_name
    thumbnail = f"assets/ig-covers/{local_name}"
    if not local_path.exists():
        downloaded = download_image(
            cover_url,
            local_path,
            headers={"Referer": "https://www.instagram.com/"},
        )
        if not downloaded and local_path.exists():
            local_path.unlink(missing_ok=True)
    if not local_path.exists():
        return None

    return {
        "source": "instagram",
        "url": url,
        "thumbnail": thumbnail,
        "title": title_text,
        "description": caption_text,
        "published": int(published) * 1000 if published else 0,
    }


def get_instagram_cover_url(entry):
    if not isinstance(entry, dict):
        return None
    image_versions = entry.get("image_versions2")
    if isinstance(image_versions, dict):
        candidates = image_versions.get("candidates") or []
        if candidates:
            return candidates[0].get("url")
    return entry.get("thumbnail_url")


def build_instagram_items_from_covers():
    if not IG_COVER_DIR.exists():
        return []
    items = []
    for cover in sorted(IG_COVER_DIR.glob("*.jpg")):
        shortcode = cover.stem
        if not shortcode:
            continue
        items.append(
            {
                "source": "instagram",
                "url": f"https://www.instagram.com/p/{shortcode}/",
                "thumbnail": f"assets/ig-covers/{cover.name}",
                "title": "Instagram Post",
                "description": "",
                "published": 0,
            }
        )
    return items


def parse_tiktok_state(state):
    modules = []

    def collect_modules(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("ItemModule", "itemModule") and isinstance(value, dict):
                    modules.append(value)
                else:
                    collect_modules(value)
        elif isinstance(node, list):
            for entry in node:
                collect_modules(entry)

    collect_modules(state)
    items = []
    for module in modules:
        items.extend(list(module.values()))
    return items


def normalize_tiktok_item(item):
    if not isinstance(item, dict):
        return None
    data = item.get("itemStruct") if isinstance(item.get("itemStruct"), dict) else item
    if not isinstance(data, dict):
        return None
    author_unique = data.get("authorUniqueId") or data.get("authorName")
    if not author_unique and isinstance(data.get("author"), dict):
        author_unique = data["author"].get("uniqueId")
    if author_unique and author_unique.lower() != TIKTOK_USER.lower():
        return None
    item_id = data.get("id") or data.get("itemId")
    desc = data.get("desc") or ""
    video = data.get("video") if isinstance(data.get("video"), dict) else {}
    cover_url = (
        video.get("cover")
        or video.get("originCover")
        or video.get("dynamicCover")
    )
    if cover_url and cover_url.startswith("//"):
        cover_url = f"https:{cover_url}"
    url = data.get("shareUrl")
    if not url and item_id:
        url = f"https://www.tiktok.com/@{author_unique or TIKTOK_USER}/video/{item_id}"
    if not url or not cover_url:
        return None
    return {
        "id": str(item_id) if item_id else None,
        "desc": desc,
        "cover_url": cover_url,
        "url": url,
        "published": data.get("createTime") or 0,
    }


def extract_tiktok_items(html):
    if not html:
        return []
    patterns = [
        r'<script[^>]+id="SIGI_STATE"[^>]*>(.*?)</script>',
        r'<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>',
    ]
    items = []
    for pattern in patterns:
        match = re.search(pattern, html, re.DOTALL)
        if not match:
            continue
        payload = match.group(1).strip()
        try:
            data = json.loads(payload)
        except ValueError:
            continue
        for entry in parse_tiktok_state(data):
            normalized = normalize_tiktok_item(entry)
            if normalized:
                items.append(normalized)
    return items


def fetch_tiktok_items():
    items = fetch_tiktok_items_ytdlp()
    if items:
        return items

    profile_url = f"https://www.tiktok.com/@{TIKTOK_USER}"
    headers = {
        "User-Agent": USER_AGENT,
        "Referer": "https://www.tiktok.com/",
    }
    try:
        response = requests.get(profile_url, headers=headers, timeout=20)
        if response.status_code != 200:
            return []
        html = response.text
    except requests.RequestException:
        return []
    raw_items = extract_tiktok_items(html)
    if not raw_items:
        return []
    TIKTOK_COVER_DIR.mkdir(parents=True, exist_ok=True)
    seen = set()
    items = []
    for raw in limit_items(raw_items):
        url = raw.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        cover_url = raw.get("cover_url")
        item_id = raw.get("id") or str(len(seen))
        local_name = f"{item_id}.jpg"
        local_path = TIKTOK_COVER_DIR / local_name
        thumbnail = f"assets/tiktok-covers/{local_name}"
        if not local_path.exists():
            downloaded = download_image(
                cover_url,
                local_path,
                headers={"Referer": profile_url},
            )
            if not downloaded and local_path.exists():
                local_path.unlink(missing_ok=True)
        if not local_path.exists():
            continue
        desc = " ".join((raw.get("desc") or "").split())
        title_text = truncate_text(desc, 60) if desc else "TikTok Video"
        try:
            published_seconds = int(raw.get("published") or 0)
        except (TypeError, ValueError):
            published_seconds = 0
        items.append(
            {
                "source": "tiktok",
                "url": url,
                "thumbnail": thumbnail,
                "title": title_text,
                "description": desc,
                "published": published_seconds * 1000 if published_seconds else 0,
            }
        )
    return items


def pick_tiktok_thumbnail(entry):
    if not isinstance(entry, dict):
        return None
    if entry.get("thumbnail"):
        return entry.get("thumbnail")
    thumbnails = entry.get("thumbnails") or []
    if isinstance(thumbnails, list):
        for thumb_id in ("originCover", "cover", "dynamicCover"):
            for thumb in thumbnails:
                if thumb.get("id") == thumb_id and thumb.get("url"):
                    return thumb.get("url")
        for thumb in thumbnails:
            if thumb.get("url"):
                return thumb.get("url")
    return None


def fetch_tiktok_items_ytdlp():
    if yt_dlp is None:
        return []
    profile_url = f"https://www.tiktok.com/@{TIKTOK_USER}"
    options = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "extract_flat": True,
    }
    if MAX_ITEMS > 0:
        options["playlistend"] = MAX_ITEMS
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            info = ydl.extract_info(profile_url, download=False)
    except Exception:
        return []
    entries = list(info.get("entries") or [])
    if not entries:
        return []
    TIKTOK_COVER_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    seen = set()
    for entry in entries:
        url = entry.get("url") or entry.get("webpage_url")
        if not url or url in seen:
            continue
        seen.add(url)
        cover_url = pick_tiktok_thumbnail(entry)
        if not cover_url:
            continue
        item_id = entry.get("id") or str(len(seen))
        local_name = f"{item_id}.jpg"
        local_path = TIKTOK_COVER_DIR / local_name
        thumbnail = f"assets/tiktok-covers/{local_name}"
        if not local_path.exists():
            downloaded = download_image(
                cover_url,
                local_path,
                headers={"Referer": profile_url},
            )
            if not downloaded and local_path.exists():
                local_path.unlink(missing_ok=True)
        if not local_path.exists():
            continue
        desc = " ".join((entry.get("description") or "").split())
        title_text = truncate_text(desc or entry.get("title") or "", 60) or "TikTok Video"
        published = entry.get("timestamp") or 0
        try:
            published_seconds = int(published or 0)
        except (TypeError, ValueError):
            published_seconds = 0
        items.append(
            {
                "source": "tiktok",
                "url": url,
                "thumbnail": thumbnail,
                "title": title_text,
                "description": desc,
                "published": published_seconds * 1000 if published_seconds else 0,
            }
        )
    return items


def load_existing_payload(path):
    if not path.exists():
        return {"items": [], "tiktok": [], "instagram": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return {"items": [], "tiktok": [], "instagram": []}
    if not isinstance(data, dict):
        return {"items": [], "tiktok": [], "instagram": []}
    items = data.get("items") if isinstance(data.get("items"), list) else []
    tiktok = data.get("tiktok") if isinstance(data.get("tiktok"), list) else []
    instagram = data.get("instagram") if isinstance(data.get("instagram"), list) else []
    return {"items": items, "tiktok": tiktok, "instagram": instagram}


def merge_items(primary, secondary):
    seen = set()
    merged = []
    for item in (primary or []) + (secondary or []):
        if not isinstance(item, dict):
            continue
        url = item.get("url")
        if not url or url in seen:
            continue
        seen.add(url)
        merged.append(item)
    return merged


def main():
    existing_payload = load_existing_payload(OUTPUT_PATH)
    manual_items = existing_payload["items"]
    manual_tiktok = existing_payload["tiktok"]
    manual_instagram = existing_payload["instagram"]
    instagram_items = fetch_instagram_items()
    if instagram_items is None:
        instagram_items = manual_instagram or build_instagram_items_from_covers()
        print("Instagram items: fetch failed, using cached entries.")
    else:
        print(f"Instagram items: {len(instagram_items)}")
    tiktok_items = fetch_tiktok_items()
    print(f"TikTok items: {len(tiktok_items)}")

    payload = {
        "tiktok": merge_items(tiktok_items, manual_tiktok),
        "instagram": instagram_items,
        "items": manual_items,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
