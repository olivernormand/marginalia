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
  cached_audio_url: string | null; // R2 cached URL for reliable timestamp sync
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
  user_id: string;
  podcast_id: number;
  episode_guid: string;
  text: string;
  note: string;
  speaker: string | null;
  start_ms: number;
  synced_to_readwise: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnnotationCreate {
  podcast_id: number;
  episode_guid: string;
  text: string;
  note: string;
  speaker?: string | null;
  start_ms: number;
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

  // Build utterances from speaker groups
  // For each group, we need to find paragraphs and potentially split them at speaker boundaries
  const result: TranscriptUtterance[] = [];

  for (const group of speakerGroups) {
    const groupStart = group.words[0].start;
    const groupEnd = group.words[group.words.length - 1].end;

    // Build paragraph segments for this speaker using their actual words
    const groupParagraphs: UtteranceParagraph[] = [];

    if (paragraphs && paragraphs.length > 0) {
      // Find paragraphs that overlap with this speaker group
      const overlappingParas = paragraphs.filter(
        (p) => p.start < groupEnd && p.end > groupStart
      );

      for (const para of overlappingParas) {
        // Get the words from this speaker that fall within this paragraph's time range
        const paraWords = group.words.filter(
          (w) => w.start >= para.start && w.start < para.end
        );

        if (paraWords.length > 0) {
          groupParagraphs.push({
            text: paraWords.map((w) => w.text).join(" "),
            start: paraWords[0].start,
          });
        }
      }
    }

    // Fallback if no paragraphs matched: use all words as single paragraph
    if (groupParagraphs.length === 0) {
      groupParagraphs.push({
        text: group.words.map((w) => w.text).join(" "),
        start: groupStart,
      });
    }

    result.push({
      speaker: group.speaker,
      start: groupStart,
      end: groupEnd,
      paragraphs: groupParagraphs,
    });
  }

  return result;
}
