from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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