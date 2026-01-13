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

export interface TranscriptParagraph {
  start: number; // milliseconds
  end: number; // milliseconds
  text: string;
}

export interface UtteranceParagraph {
  text: string;
  start: number; // milliseconds - for seeking
}

export interface TranscriptUtterance {
  speaker: string | null;
  start: number;
  end: number;
  paragraphs: UtteranceParagraph[];
}

export interface Transcript {
  id: string;
  episode_guid: string;
  audio_url: string;
  audio_duration: number; // milliseconds
  confidence: number;
  words: TranscriptWord[];
  paragraphs: TranscriptParagraph[] | null;
  content_start_ms: number;
  content_end_ms: number | null;
  speaker_labels: Record<string, string> | null;
}

// --- Annotation types ---

export interface Annotation {
  id: string;
  episode_guid: string;
  paragraph_start_ms: number;
  char_start: number;
  char_end: number;
  selected_text: string;
  note: string | null;
  color: string;
  created_at: string;
}

// Helper to group words into utterances, split by paragraph boundaries
export function getUtterances(
  words: TranscriptWord[],
  paragraphs?: TranscriptParagraph[] | null
): TranscriptUtterance[] {
  if (words.length === 0) return [];

  // Group words by speaker first
  const speakerGroups: { speaker: string | null; words: TranscriptWord[] }[] =
    [];
  let currentWords = [words[0]];
  let currentSpeaker = words[0].speaker;

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (word.speaker === currentSpeaker) {
      currentWords.push(word);
    } else {
      speakerGroups.push({ speaker: currentSpeaker, words: currentWords });
      currentWords = [word];
      currentSpeaker = word.speaker;
    }
  }
  speakerGroups.push({ speaker: currentSpeaker, words: currentWords });

  // Build utterances from speaker groups, using paragraph boundaries
  const result: TranscriptUtterance[] = [];

  for (const group of speakerGroups) {
    const start = group.words[0].start;
    const end = group.words[group.words.length - 1].end;

    // Find paragraphs that overlap with this speaker group
    const overlappingParas = paragraphs
      ? paragraphs.filter((p) => p.start < end && p.end > start)
      : [];

    if (overlappingParas.length > 0) {
      result.push({
        speaker: group.speaker,
        start,
        end,
        paragraphs: overlappingParas.map((p) => ({ text: p.text, start: p.start })),
      });
    } else {
      // Fallback: join words as single paragraph
      result.push({
        speaker: group.speaker,
        start,
        end,
        paragraphs: [{ text: group.words.map((w) => w.text).join(" "), start }],
      });
    }
  }

  return result;
}
