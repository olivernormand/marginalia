from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    """Pydantic model for Apple Podcasts API response."""

    model_config = ConfigDict(populate_by_name=True)

    collection_id: int = Field(alias="collectionId")
    track_id: int = Field(alias="trackId")
    artist_name: str = Field(alias="artistName")
    collection_name: str = Field(alias="collectionName")
    feed_url: str = Field(alias="feedUrl")
    artwork_url_30: str | None = Field(alias="artworkUrl30", default=None)
    artwork_url_60: str | None = Field(alias="artworkUrl60", default=None)
    artwork_url_100: str | None = Field(alias="artworkUrl100", default=None)
    artwork_url_600: str | None = Field(alias="artworkUrl600", default=None)
    release_date: datetime = Field(alias="releaseDate")
    track_count: int = Field(alias="trackCount")
    country: str
    primary_genre_name: str = Field(alias="primaryGenreName")
    genres: list[str]
    collection_view_url: str | None = Field(alias="collectionViewUrl", default=None)
    content_advisory_rating: str | None = Field(
        alias="contentAdvisoryRating", default=None
    )


class PodcastLookupResponse(BaseModel):
    """Pydantic model for iTunes lookup API response."""

    collection_id: int
    collection_name: str
    artist_name: str
    feed_url: str
    artwork_url: str | None = None