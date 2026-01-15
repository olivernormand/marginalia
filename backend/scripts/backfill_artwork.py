#!/usr/bin/env python3
"""
Backfill episode_duration_seconds for existing transcriptions using RSS feeds.
Run with: uv run python scripts/backfill_artwork.py
"""

import hashlib
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from supabase import create_client

# Add src to path so we can import the RSS parser
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from backend.rss import parse_rss_feed

# Load environment
load_dotenv(Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_PRIVATE_KEY = os.getenv("SUPABASE_PRIVATE_KEY", "")
PODCAST_INDEX_API_KEY = os.getenv("PODCAST_INDEX_API_KEY", "")
PODCAST_INDEX_API_SECRET = os.getenv("PODCAST_INDEX_API_SECRET", "")
PODCAST_INDEX_BASE_URL = "https://api.podcastindex.org/api/1.0"


def get_supabase():
    return create_client(SUPABASE_URL, SUPABASE_PRIVATE_KEY)


def get_podcast_headers():
    """Generate auth headers for Podcast Index API."""
    epoch_time = str(int(time.time()))
    data_to_hash = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + epoch_time
    sha1_hash = hashlib.sha1(data_to_hash.encode()).hexdigest()
    return {
        "X-Auth-Key": PODCAST_INDEX_API_KEY,
        "X-Auth-Date": epoch_time,
        "Authorization": sha1_hash,
        "User-Agent": "Marginalia/1.0",
    }


def get_transcriptions_missing_duration():
    """Get all transcriptions missing episode_duration_seconds."""
    supabase = get_supabase()
    result = (
        supabase.table("transcriptions")
        .select("id, episode_guid, podcast_id, podcast_title, episode_title, episode_duration_seconds")
        .eq("status", "completed")
        .is_("episode_duration_seconds", "null")
        .execute()
    )
    return result.data or []


def get_feed_url_for_podcast(podcast_id: int) -> str | None:
    """Get the RSS feed URL from Podcast Index API."""
    try:
        response = httpx.get(
            f"{PODCAST_INDEX_BASE_URL}/podcasts/byfeedid",
            params={"id": podcast_id},
            headers=get_podcast_headers(),
            timeout=10,
        )
        if response.status_code == 200:
            data = response.json()
            feed = data.get("feed", {})
            return feed.get("url")
    except Exception as e:
        print(f"  Error fetching podcast {podcast_id}: {e}")
    return None


def fetch_episode_durations_from_feed(feed_url: str) -> dict[str, int]:
    """Parse RSS feed and return guid -> duration_seconds mapping."""
    try:
        response = httpx.get(feed_url, timeout=30, follow_redirects=True)
        if response.status_code != 200:
            return {}

        feed = parse_rss_feed(response.text)
        durations = {}
        for ep in feed.episodes:
            if ep.guid and ep.duration_seconds:
                durations[ep.guid] = ep.duration_seconds
        return durations
    except Exception as e:
        print(f"  Error parsing feed: {e}")
        return {}


def update_episode_duration(transcription_id: str, duration_seconds: int):
    """Update a single transcription with duration."""
    supabase = get_supabase()
    supabase.table("transcriptions").update(
        {"episode_duration_seconds": duration_seconds}
    ).eq("id", transcription_id).execute()


def main():
    print("=" * 60)
    print("Backfill Episode Duration for Transcriptions")
    print("=" * 60)
    print()

    # Step 1: Get transcriptions missing duration
    print("Fetching transcriptions missing duration...")
    transcriptions = get_transcriptions_missing_duration()
    print(f"Found {len(transcriptions)} transcriptions without duration.\n")

    if not transcriptions:
        print("All transcriptions have duration set.")
        return

    # Group by podcast_id
    by_podcast: dict[int, list] = {}
    for t in transcriptions:
        pid = t["podcast_id"]
        if pid not in by_podcast:
            by_podcast[pid] = []
        by_podcast[pid].append(t)

    print(f"Spread across {len(by_podcast)} podcasts.\n")

    # Step 2: For each podcast, fetch RSS feed and match durations
    print("Fetching RSS feeds and matching episodes...")
    print("-" * 60)

    updates = []
    for podcast_id, episodes in by_podcast.items():
        title = episodes[0]["podcast_title"] or "Unknown"
        print(f"\n[{podcast_id}] {title}")

        # Get feed URL
        feed_url = get_feed_url_for_podcast(podcast_id)
        if not feed_url:
            print(f"  Could not get feed URL, skipping")
            continue

        print(f"  Feed: {feed_url[:60]}...")

        # Parse feed for durations
        durations = fetch_episode_durations_from_feed(feed_url)
        print(f"  Found {len(durations)} episodes with duration in feed")

        # Match transcriptions
        for ep in episodes:
            guid = ep["episode_guid"]
            ep_title = ep["episode_title"] or "Unknown"

            if guid in durations:
                duration = durations[guid]
                hrs = duration // 3600
                mins = (duration % 3600) // 60
                duration_str = f"{hrs}h {mins}m" if hrs > 0 else f"{mins} min"

                updates.append({
                    "id": ep["id"],
                    "title": ep_title,
                    "duration_seconds": duration,
                    "duration_str": duration_str,
                })
                print(f"  ✓ {ep_title[:40]}... → {duration_str}")
            else:
                print(f"  ✗ {ep_title[:40]}... → not found in feed")

    # Step 3: Show summary and confirm
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    if not updates:
        print("\nNo matching episodes found in feeds.")
        return

    print(f"\n{len(updates)} episodes will be updated:\n")
    for u in updates:
        print(f"  {u['title'][:50]}... → {u['duration_str']}")

    # Step 4: Confirm before writing
    print()
    confirm = input("Apply these updates? (yes/no): ").strip().lower()

    if confirm != "yes":
        print("\nAborted. No changes made.")
        return

    # Step 5: Apply updates
    print("\nApplying updates...")
    for u in updates:
        update_episode_duration(u["id"], u["duration_seconds"])
        print(f"  ✓ Updated: {u['title'][:50]}...")

    print("\nDone!")


if __name__ == "__main__":
    main()
