export interface PodcastSearchResult {
  collection_id: number;
  track_id: number;
  artist_name: string;
  collection_name: string;
  feed_url: string;
  artwork_url_30: string | null;
  artwork_url_60: string | null;
  artwork_url_100: string | null;
  artwork_url_600: string | null;
  release_date: string;
  track_count: number;
  country: string;
  primary_genre_name: string;
  genres: string[];
  collection_view_url: string | null;
  content_advisory_rating: string | null;
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
