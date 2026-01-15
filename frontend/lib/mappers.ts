/**
 * Data mapping utilities for converting between different types.
 */

import { PodcastEpisode, SavedEpisode, TranscriptListItem } from "./types";

/**
 * Convert SavedEpisode to PodcastEpisode for EpisodeCard compatibility
 */
export function savedEpisodeToCard(saved: SavedEpisode): PodcastEpisode {
  return {
    title: saved.episode_title,
    description: null,
    audio_url: saved.audio_url,
    guid: saved.episode_guid,
    pub_date: saved.pub_date,
    duration_seconds: saved.duration_seconds,
    artwork_url: saved.artwork_url,
  };
}

/**
 * Convert TranscriptListItem to PodcastEpisode for EpisodeCard compatibility
 */
export function transcriptToCard(transcript: TranscriptListItem): PodcastEpisode {
  return {
    title: transcript.episode_title || "Untitled episode",
    description: null,
    audio_url: null,
    guid: transcript.episode_guid,
    pub_date: transcript.completed_at,
    duration_seconds:
      transcript.episode_duration_seconds ||
      (transcript.audio_duration ? Math.floor(transcript.audio_duration / 1000) : null),
    artwork_url: transcript.artwork_url,
  };
}
