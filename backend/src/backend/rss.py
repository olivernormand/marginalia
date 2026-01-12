"""RSS feed parsing utilities for podcast feeds."""

from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime

from bs4 import BeautifulSoup


@dataclass
class PodcastEpisode:
    """Represents a single podcast episode."""

    title: str
    description: str | None
    audio_url: str | None
    guid: str | None
    pub_date: datetime | None
    duration_seconds: int | None


@dataclass
class PodcastFeed:
    """Represents a parsed podcast RSS feed."""

    title: str
    description: str | None
    author: str | None
    artwork_url: str | None
    episodes: list[PodcastEpisode]


def parse_duration(duration_str: str | None) -> int | None:
    """Parse duration string (HH:MM:SS or MM:SS) to seconds."""
    if not duration_str:
        return None

    parts = duration_str.strip().split(":")
    try:
        if len(parts) == 3:
            # HH:MM:SS
            hours, minutes, seconds = map(int, parts)
            return hours * 3600 + minutes * 60 + seconds
        elif len(parts) == 2:
            # MM:SS
            minutes, seconds = map(int, parts)
            return minutes * 60 + seconds
        elif len(parts) == 1:
            # Just seconds
            return int(parts[0])
    except ValueError:
        return None

    return None


def parse_pub_date(date_str: str | None) -> datetime | None:
    """Parse RFC 2822 date string to datetime."""
    if not date_str:
        return None

    try:
        return parsedate_to_datetime(date_str)
    except (ValueError, TypeError):
        return None


def parse_rss_feed(xml_content: str) -> PodcastFeed:
    """Parse an RSS feed XML string into a PodcastFeed object.

    Args:
        xml_content: The RSS feed XML as a string.

    Returns:
        A PodcastFeed object containing the parsed data.

    Raises:
        ValueError: If the XML is invalid or not a valid RSS feed.
    """
    try:
        soup = BeautifulSoup(xml_content, "lxml-xml")
    except Exception as e:
        raise ValueError(f"Invalid RSS feed: {e}") from e

    channel = soup.find("channel")
    if not channel:
        raise ValueError("Invalid RSS feed: no channel element found")

    # Extract podcast metadata
    title_elem = channel.find("title", recursive=False)
    title = title_elem.get_text(strip=True) if title_elem else "Untitled"

    desc_elem = channel.find("description", recursive=False)
    description = desc_elem.get_text(strip=True) if desc_elem else None

    author_elem = channel.find("itunes:author")
    author = author_elem.get_text(strip=True) if author_elem else None

    image_elem = channel.find("itunes:image")
    artwork_url = image_elem.get("href") if image_elem else None

    # Parse episodes
    episodes = []
    for item in channel.find_all("item"):
        ep_title_elem = item.find("title")
        ep_title = ep_title_elem.get_text(strip=True) if ep_title_elem else "Untitled Episode"

        ep_desc_elem = item.find("description")
        ep_description = ep_desc_elem.get_text(strip=True) if ep_desc_elem else None

        enclosure = item.find("enclosure")
        audio_url = enclosure.get("url") if enclosure else None

        guid_elem = item.find("guid")
        guid = guid_elem.get_text(strip=True) if guid_elem else None

        pub_date_elem = item.find("pubDate")
        pub_date_str = pub_date_elem.get_text(strip=True) if pub_date_elem else None
        pub_date = parse_pub_date(pub_date_str)

        duration_elem = item.find("itunes:duration")
        duration_str = duration_elem.get_text(strip=True) if duration_elem else None
        duration_seconds = parse_duration(duration_str)

        episodes.append(
            PodcastEpisode(
                title=ep_title,
                description=ep_description,
                audio_url=audio_url,
                guid=guid,
                pub_date=pub_date,
                duration_seconds=duration_seconds,
            )
        )

    return PodcastFeed(
        title=title,
        description=description,
        author=author,
        artwork_url=artwork_url,
        episodes=episodes,
    )
