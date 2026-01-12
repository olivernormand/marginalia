import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from backend.cache import (
    get_cached_feed,
    get_cached_search,
    get_cache_stats,
    set_cached_feed,
    set_cached_search,
)
from backend.models.schemas import (
    PodcastEpisodeResponse,
    PodcastFeedResponse,
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

APPLE_PODCASTS_SEARCH_URL = "https://itunes.apple.com/search"


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/cache-stats")
async def cache_stats() -> dict:
    """Get cache statistics for debugging."""
    return get_cache_stats()


@app.get("/search", response_model_by_alias=False)
async def search(q: str = Query(..., min_length=1)) -> list[PodcastSearchResult]:
    """Search for podcasts via Apple Podcasts API (cached for 30 min)."""
    # Check cache first
    cached = get_cached_search(q)
    if cached is not None:
        return [PodcastSearchResult(**item) for item in cached]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            APPLE_PODCASTS_SEARCH_URL,
            params={"term": q, "media": "podcast"},
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch from Apple Podcasts API",
            )

        data = response.json()

    results = []
    raw_results = []
    for item in data.get("results", []):
        try:
            results.append(PodcastSearchResult(**item))
            raw_results.append(item)
        except Exception:
            continue

    # Cache the raw results
    set_cached_search(q, raw_results)

    return results


@app.get("/feed")
async def get_feed(url: str = Query(..., min_length=1)) -> PodcastFeedResponse:
    """Fetch and parse a podcast RSS feed (cached for 30 min).

    Args:
        url: The URL of the RSS feed to fetch.

    Returns:
        Parsed podcast feed with episodes.
    """
    # Check cache first
    cached = get_cached_feed(url)
    if cached is not None:
        return PodcastFeedResponse(**cached)

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

    feed_response = PodcastFeedResponse(
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

    # Cache the response as dict
    set_cached_feed(url, feed_response.model_dump(mode="json"))

    return feed_response


def main() -> None:
    """Entry point for `uv run backend` command."""
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
