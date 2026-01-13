from datetime import datetime

from pydantic import BaseModel


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
    """Pydantic model for Podcast Index search result."""

    id: int
    title: str
    url: str  # RSS feed URL
    artwork: str | None = None
    author: str | None = None
    description: str | None = None
    itunes_id: int | None = None
    podcast_guid: str | None = None
    episode_count: int | None = None
    language: str | None = None
    explicit: bool = False
    categories: dict[str, str] | None = None


class PodcastInfoResponse(BaseModel):
    """Pydantic model for Podcast Index podcast info (from /podcasts/byfeedid)."""

    id: int
    title: str
    url: str  # RSS feed URL
    artwork: str | None = None
    author: str | None = None
    description: str | None = None
    itunes_id: int | None = None
    podcast_guid: str | None = None
    episode_count: int | None = None
    language: str | None = None
    explicit: bool = False
    categories: dict[str, str] | None = None
    link: str | None = None  # Website URL


class TrendingPodcast(BaseModel):
    """Pydantic model for a trending podcast from Podcast Index."""

    id: int
    title: str
    description: str | None = None
    author: str | None = None
    artwork: str | None = None
    trend_score: int | None = None
    language: str | None = None
    categories: dict[str, str] | None = None


# --- Transcription models ---


class TranscribeRequest(BaseModel):
    """Request to start a transcription job."""

    episode_guid: str
    podcast_id: int
    audio_url: str
    # Optional metadata for better intro/outro detection and speaker identification
    podcast_title: str | None = None
    podcast_description: str | None = None
    episode_title: str | None = None
    episode_description: str | None = None


class TranscriptionJobResponse(BaseModel):
    """Response for transcription job status."""

    id: str
    episode_guid: str
    status: str  # queued, processing, completed, error
    error_message: str | None = None


class TranscriptWord(BaseModel):
    """A single word in a transcript."""

    text: str
    start: int  # milliseconds
    end: int  # milliseconds
    confidence: float
    speaker: str | None = None


class TranscriptParagraph(BaseModel):
    """A paragraph segment from AssemblyAI."""

    start: int  # milliseconds
    end: int  # milliseconds
    text: str


class TranscriptUtterance(BaseModel):
    """A contiguous sequence of paragraphs from the same speaker."""

    speaker: str | None
    start: int
    end: int
    paragraphs: list[str]  # Split by paragraph boundaries for better readability


class TranscriptAnalysis(BaseModel):
    """Structured output from LLM analysis of transcript."""

    content_start_ms: int
    content_end_ms: int | None = None
    speaker_labels: dict[str, str]  # e.g. {"A": "Joe Rogan", "B": "Elon Musk"}


class TranscriptResponse(BaseModel):
    """Full transcript response."""

    id: str
    episode_guid: str
    audio_url: str
    audio_duration: int  # milliseconds
    confidence: float
    words: list[TranscriptWord]
    paragraphs: list[TranscriptParagraph] | None = None
    content_start_ms: int = 0
    content_end_ms: int | None = None
    speaker_labels: dict[str, str] | None = None

    @property
    def text(self) -> str:
        return " ".join(w.text for w in self.words)

    def get_utterances(self) -> list[TranscriptUtterance]:
        """Group words by speaker, split by paragraph boundaries."""
        if not self.words:
            return []

        # Build paragraph boundaries for quick lookup
        para_boundaries: list[tuple[int, int, str]] = []
        if self.paragraphs:
            para_boundaries = [(p.start, p.end, p.text) for p in self.paragraphs]

        result = []
        current_words = [self.words[0]]
        current_speaker = self.words[0].speaker

        for word in self.words[1:]:
            if word.speaker == current_speaker:
                current_words.append(word)
            else:
                # Speaker changed - emit utterance
                result.append(self._build_utterance(current_words, para_boundaries))
                current_words = [word]
                current_speaker = word.speaker

        # Last utterance
        result.append(self._build_utterance(current_words, para_boundaries))

        return result

    def _build_utterance(
        self,
        words: list[TranscriptWord],
        para_boundaries: list[tuple[int, int, str]],
    ) -> TranscriptUtterance:
        """Build an utterance from words, splitting by paragraph boundaries."""
        start = words[0].start
        end = words[-1].end
        speaker = words[0].speaker

        # Find paragraphs that overlap with this word range
        overlapping_paras = [
            text
            for p_start, p_end, text in para_boundaries
            if p_start < end and p_end > start  # Overlaps
        ]

        if overlapping_paras:
            return TranscriptUtterance(
                speaker=speaker,
                start=start,
                end=end,
                paragraphs=overlapping_paras,
            )
        else:
            # Fallback: join words as single paragraph
            return TranscriptUtterance(
                speaker=speaker,
                start=start,
                end=end,
                paragraphs=[" ".join(w.text for w in words)],
            )
