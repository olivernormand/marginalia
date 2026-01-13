from datetime import datetime

from pydantic import BaseModel


class PodcastEpisodeResponse(BaseModel):
    """Pydantic model for a podcast episode from RSS feed."""

    title: str
    description: str | None = None
    audio_url: str | None = None
    guid: str | None = None
    pub_date: datetime | None = None
    duration_seconds: int | None = None
    artwork_url: str | None = None


class PodcastFeedResponse(BaseModel):
    """Pydantic model for a parsed podcast RSS feed."""

    title: str
    description: str | None = None
    author: str | None = None
    artwork_url: str | None = None
    episodes: list[PodcastEpisodeResponse]


class PodcastSearchResult(BaseModel):
    """Pydantic model for Podcast Index search result."""

    id: int
    title: str
    url: str  # RSS feed URL
    artwork: str | None = None
    author: str | None = None
    description: str | None = None
    itunes_id: int | None = None
    podcast_guid: str | None = None
    episode_count: int | None = None
    language: str | None = None
    explicit: bool = False
    categories: dict[str, str] | None = None


class PodcastInfoResponse(BaseModel):
    """Pydantic model for Podcast Index podcast info (from /podcasts/byfeedid)."""

    id: int
    title: str
    url: str  # RSS feed URL
    artwork: str | None = None
    author: str | None = None
    description: str | None = None
    itunes_id: int | None = None
    podcast_guid: str | None = None
    episode_count: int | None = None
    language: str | None = None
    explicit: bool = False
    categories: dict[str, str] | None = None
    link: str | None = None  # Website URL
