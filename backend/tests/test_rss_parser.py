"""Tests for RSS feed parsing functionality."""

import pytest
from backend.rss import parse_rss_feed, PodcastEpisode


SAMPLE_RSS_FEED = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Test Podcast</title>
    <description>A test podcast for unit testing</description>
    <link>https://example.com/podcast</link>
    <language>en-us</language>
    <itunes:author>Test Author</itunes:author>
    <itunes:image href="https://example.com/artwork.jpg"/>
    <item>
      <title>Episode 1: Introduction</title>
      <description>This is the first episode of our test podcast.</description>
      <pubDate>Mon, 01 Jan 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/episode1.mp3" type="audio/mpeg" length="12345678"/>
      <itunes:duration>45:30</itunes:duration>
      <guid>episode-1-guid</guid>
    </item>
    <item>
      <title>Episode 2: Deep Dive</title>
      <description>In this episode, we dive deep into the topic.</description>
      <pubDate>Mon, 08 Jan 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/episode2.mp3" type="audio/mpeg" length="23456789"/>
      <itunes:duration>1:02:15</itunes:duration>
      <guid>episode-2-guid</guid>
    </item>
    <item>
      <title>Episode 3: Conclusion</title>
      <description>The final episode wrapping things up.</description>
      <pubDate>Mon, 15 Jan 2024 12:00:00 GMT</pubDate>
      <enclosure url="https://example.com/episode3.mp3" type="audio/mpeg" length="34567890"/>
      <itunes:duration>30:00</itunes:duration>
      <guid>episode-3-guid</guid>
    </item>
  </channel>
</rss>
"""


class TestParseRssFeed:
    """Tests for the parse_rss_feed function."""

    def test_parses_podcast_metadata(self):
        """Should extract podcast title, description, and author."""
        result = parse_rss_feed(SAMPLE_RSS_FEED)

        assert result.title == "Test Podcast"
        assert result.description == "A test podcast for unit testing"
        assert result.author == "Test Author"
        assert result.artwork_url == "https://example.com/artwork.jpg"

    def test_parses_episodes(self):
        """Should extract all episodes from the feed."""
        result = parse_rss_feed(SAMPLE_RSS_FEED)

        assert len(result.episodes) == 3

    def test_parses_episode_details(self):
        """Should extract episode title, description, and audio URL."""
        result = parse_rss_feed(SAMPLE_RSS_FEED)

        episode = result.episodes[0]
        assert episode.title == "Episode 1: Introduction"
        assert episode.description == "This is the first episode of our test podcast."
        assert episode.audio_url == "https://example.com/episode1.mp3"
        assert episode.guid == "episode-1-guid"

    def test_parses_episode_duration(self):
        """Should parse duration in various formats."""
        result = parse_rss_feed(SAMPLE_RSS_FEED)

        # 45:30 = 45 minutes 30 seconds
        assert result.episodes[0].duration_seconds == 45 * 60 + 30
        # 1:02:15 = 1 hour 2 minutes 15 seconds
        assert result.episodes[1].duration_seconds == 1 * 3600 + 2 * 60 + 15
        # 30:00 = 30 minutes
        assert result.episodes[2].duration_seconds == 30 * 60

    def test_parses_publication_date(self):
        """Should parse episode publication dates."""
        result = parse_rss_feed(SAMPLE_RSS_FEED)

        episode = result.episodes[0]
        assert episode.pub_date is not None
        assert episode.pub_date.year == 2024
        assert episode.pub_date.month == 1
        assert episode.pub_date.day == 1

    def test_handles_missing_optional_fields(self):
        """Should handle missing optional fields gracefully."""
        minimal_rss = """<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Minimal Podcast</title>
            <item>
              <title>Episode 1</title>
            </item>
          </channel>
        </rss>
        """
        result = parse_rss_feed(minimal_rss)

        assert result.title == "Minimal Podcast"
        assert result.description is None
        assert len(result.episodes) == 1
        assert result.episodes[0].title == "Episode 1"
        assert result.episodes[0].audio_url is None

    def test_handles_invalid_xml(self):
        """Should raise an error for invalid XML."""
        with pytest.raises(ValueError, match="Invalid RSS feed"):
            parse_rss_feed("not valid xml <><>")

    def test_handles_empty_feed(self):
        """Should handle a feed with no episodes."""
        empty_rss = """<?xml version="1.0"?>
        <rss version="2.0">
          <channel>
            <title>Empty Podcast</title>
          </channel>
        </rss>
        """
        result = parse_rss_feed(empty_rss)

        assert result.title == "Empty Podcast"
        assert len(result.episodes) == 0
