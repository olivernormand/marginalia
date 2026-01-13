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

export interface TrendingPodcast {
  id: number;
  title: string;
  description: string | null;
  author: string | null;
  artwork: string | null;
  trend_score: number | null;
  language: string | null;
  categories: Record<string, string> | null;
}

// --- Transcription types ---

export interface TranscriptionJob {
  id: string;
  episode_guid: string;
  status: "queued" | "processing" | "completed" | "error";
  error_message: string | null;
}

export interface TranscriptWord {
  text: string;
  start: number; // milliseconds
  end: number; // milliseconds
  confidence: number;
  speaker: string | null;
}

export interface TranscriptUtterance {
  speaker: string | null;
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  id: string;
  episode_guid: string;
  audio_url: string;
  audio_duration: number; // milliseconds
  confidence: number;
  words: TranscriptWord[];
  content_start_ms: number;
  content_end_ms: number | null;
  speaker_labels: Record<string, string> | null;
}

// Helper to group words into utterances
export function getUtterances(words: TranscriptWord[]): TranscriptUtterance[] {
  if (words.length === 0) return [];

  const result: TranscriptUtterance[] = [];
  let currentWords = [words[0]];
  let currentSpeaker = words[0].speaker;

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (word.speaker === currentSpeaker) {
      currentWords.push(word);
    } else {
      result.push({
        speaker: currentSpeaker,
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end,
        text: currentWords.map((w) => w.text).join(" "),
      });
      currentWords = [word];
      currentSpeaker = word.speaker;
    }
  }

  // Last utterance
  result.push({
    speaker: currentSpeaker,
    start: currentWords[0].start,
    end: currentWords[currentWords.length - 1].end,
    text: currentWords.map((w) => w.text).join(" "),
  });

  return result;
}
