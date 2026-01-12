import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Query

from backend.models.schemas import PodcastSearchResult

app = FastAPI(
    title="Marginalia API",
    description="Backend API for Marginalia podcast app",
    version="0.1.0",
)

APPLE_PODCASTS_SEARCH_URL = "https://itunes.apple.com/search"


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/search")
async def search(q: str = Query(..., min_length=1)) -> list[PodcastSearchResult]:
    """Search for podcasts via Apple Podcasts API."""
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
    for item in data.get("results", []):
        try:
            results.append(PodcastSearchResult(**item))
        except Exception:
            # Skip items that don't match our schema (e.g., missing feedUrl)
            continue

    return results


def main() -> None:
    """Entry point for `uv run backend` command."""
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
