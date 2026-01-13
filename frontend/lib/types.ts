export interface PodcastSearchResult {
  id: number;
  title: string;
  url: string; // RSS feed URL
  artwork: string | null;
  author: string | null;
  description: string | null;
  itunes_id: number | null;
  podcast_guid: string | null;
  episode_count: number | null;
  language: string | null;
  explicit: boolean;
  categories: Record<string, string> | null;
}

export interface PodcastInfo {
  id: number;
  title: string;
  url: string; // RSS feed URL
  artwork: string | null;
  author: string | null;
  description: string | null;
  itunes_id: number | null;
  podcast_guid: string | null;
  episode_count: number | null;
  language: string | null;
  explicit: boolean;
  categories: Record<string, string> | null;
  link: string | null; // Website URL
}

export interface PodcastEpisode {
  title: string;
  description: string | null;
  audio_url: string | null;
  guid: string | null;
  pub_date: string | null;
  duration_seconds: number | null;
  artwork_url: string | null;
}

export interface PodcastFeed {
  title: string;
  description: string | null;
  author: string | null;
  artwork_url: string | null;
  episodes: PodcastEpisode[];
}
