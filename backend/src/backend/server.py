import hashlib
import os
import time
from pathlib import Path

import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Load .env file from backend directory
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from backend.models.schemas import (
    PodcastEpisodeResponse,
    PodcastFeedResponse,
    PodcastInfoResponse,
    PodcastSearchResult,
)
from backend.rss import parse_rss_feed

app = FastAPI(
    title="Marginalia API",
    description="Backend API for Marginalia podcast app",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Podcast Index API
PODCAST_INDEX_API_KEY = os.getenv("PODCAST_INDEX_API_KEY", "")
PODCAST_INDEX_API_SECRET = os.getenv("PODCAST_INDEX_API_SECRET", "")
PODCAST_INDEX_BASE_URL = "https://api.podcastindex.org/api/1.0"


def get_podcast_index_headers() -> dict[str, str]:
    """Generate authentication headers for Podcast Index API."""
    epoch_time = str(int(time.time()))
    data_to_hash = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + epoch_time
    sha1_hash = hashlib.sha1(data_to_hash.encode("utf-8")).hexdigest()

    return {
        "X-Auth-Key": PODCAST_INDEX_API_KEY,
        "X-Auth-Date": epoch_time,
        "Authorization": sha1_hash,
        "User-Agent": "Marginalia/1.0",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/search")
async def search(q: str = Query(..., min_length=1)) -> list[PodcastSearchResult]:
    """Search for podcasts via Podcast Index API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PODCAST_INDEX_BASE_URL}/search/byterm",
            params={"q": q},
            headers=get_podcast_index_headers(),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch from Podcast Index API",
            )

        data = response.json()

    results = []
    for item in data.get("feeds", []):
        try:
            results.append(
                PodcastSearchResult(
                    id=item["id"],
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    artwork=item.get("artwork"),
                    author=item.get("author"),
                    description=item.get("description"),
                    itunes_id=item.get("itunesId"),
                    podcast_guid=item.get("podcastGuid"),
                    episode_count=item.get("episodeCount"),
                    language=item.get("language"),
                    explicit=item.get("explicit", False),
                    categories=item.get("categories"),
                )
            )
        except Exception:
            continue

    return results


@app.get("/podcast/{podcast_id}")
async def get_podcast(podcast_id: int) -> PodcastInfoResponse:
    """Get podcast info by Podcast Index ID."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PODCAST_INDEX_BASE_URL}/podcasts/byfeedid",
            params={"id": podcast_id},
            headers=get_podcast_index_headers(),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch from Podcast Index API",
            )

        data = response.json()

    feed = data.get("feed")
    if not feed:
        raise HTTPException(
            status_code=404,
            detail=f"Podcast with ID {podcast_id} not found",
        )

    return PodcastInfoResponse(
        id=feed["id"],
        title=feed.get("title", ""),
        url=feed.get("url", ""),
        artwork=feed.get("artwork"),
        author=feed.get("author"),
        description=feed.get("description"),
        itunes_id=feed.get("itunesId"),
        podcast_guid=feed.get("podcastGuid"),
        episode_count=feed.get("episodeCount"),
        language=feed.get("language"),
        explicit=feed.get("explicit", False),
        categories=feed.get("categories"),
        link=feed.get("link"),
    )


@app.get("/feed")
async def get_feed(url: str = Query(..., min_length=1)) -> PodcastFeedResponse:
    """Fetch and parse a podcast RSS feed.

    Args:
        url: The URL of the RSS feed to fetch.

    Returns:
        Parsed podcast feed with episodes.
    """
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(url)
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch RSS feed: {e}",
            ) from e

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"RSS feed returned status {response.status_code}",
            )

        content = response.text

    try:
        feed = parse_rss_feed(content)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        ) from e

    return PodcastFeedResponse(
        title=feed.title,
        description=feed.description,
        author=feed.author,
        artwork_url=feed.artwork_url,
        episodes=[
            PodcastEpisodeResponse(
                title=ep.title,
                description=ep.description,
                audio_url=ep.audio_url,
                guid=ep.guid,
                pub_date=ep.pub_date,
                duration_seconds=ep.duration_seconds,
                artwork_url=ep.artwork_url,
            )
            for ep in feed.episodes
        ],
    )


def main() -> None:
    """Entry point for `uv run backend` command."""
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
