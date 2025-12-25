import json
import os
import sys
from pathlib import Path

import requests

INSTAGRAM_USER = os.environ.get("INSTAGRAM_USERNAME", "iamb.synthmusic")
MAX_ITEMS = int(os.environ.get("SOCIAL_FEED_LIMIT", "12"))
OUTPUT_PATH = Path("assets/social-feed.json")
IG_COVER_DIR = Path("assets/ig-covers")
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)


def fetch_json(url, headers=None, timeout=20):
    try:
        response = requests.get(url, headers=headers, timeout=timeout)
        if response.status_code != 200:
            return None
        return response.json()
    except requests.RequestException:
        return None
    except ValueError:
        return None


def download_image(url, dest_path):
    try:
        response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=20, stream=True)
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
    api_url = (
        "https://www.instagram.com/api/v1/users/web_profile_info/"
        f"?username={INSTAGRAM_USER}"
    )
    headers = {
        "User-Agent": USER_AGENT,
        "X-IG-App-ID": "936619743392459",
    }
    data = fetch_json(api_url, headers=headers)
    edges = (
        data.get("data", {})
        .get("user", {})
        .get("edge_owner_to_timeline_media", {})
        .get("edges", [])
        if isinstance(data, dict)
        else []
    )
    IG_COVER_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for edge in edges[:MAX_ITEMS]:
        node = edge.get("node", {})
        shortcode = node.get("shortcode")
        if not shortcode:
            continue
        url = f"https://www.instagram.com/p/{shortcode}/"
        cover_url = f"https://www.instagram.com/p/{shortcode}/media/?size=l"
        local_name = f"{shortcode}.jpg"
        local_path = IG_COVER_DIR / local_name
        thumbnail = f"assets/ig-covers/{local_name}"
        if not local_path.exists():
            downloaded = download_image(cover_url, local_path)
            if not downloaded:
                fallback_url = node.get("thumbnail_src") or node.get("display_url")
                if fallback_url:
                    downloaded = download_image(fallback_url, local_path)
            if not downloaded and local_path.exists():
                local_path.unlink(missing_ok=True)
        if not local_path.exists():
            continue
        caption_edges = node.get("edge_media_to_caption", {}).get("edges", [])
        caption_text = (
            caption_edges[0].get("node", {}).get("text", "") if caption_edges else ""
        )
        caption_text = " ".join(caption_text.split())
        title_text = truncate_text(caption_text, 60) if caption_text else "Instagram Post"
        published = node.get("taken_at_timestamp", 0)
        items.append(
            {
                "source": "instagram",
                "url": url,
                "thumbnail": thumbnail,
                "title": title_text,
                "description": caption_text,
                "published": published * 1000 if published else 0,
            }
        )
    return items


def load_existing_items(path):
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except ValueError:
        return []
    if isinstance(data, dict) and isinstance(data.get("items"), list):
        return data["items"]
    return []


def main():
    instagram_items = fetch_instagram_items()
    print(f"Instagram items: {len(instagram_items)}")
    manual_items = load_existing_items(OUTPUT_PATH)

    payload = {
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
