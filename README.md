# Marginalia

Listen to and engage with podcasts while recording your key insights.

Marginalia lets you capture all the messy thoughts that get scribbled in the margins—starting with podcasts. The core problem:

1. When listening to podcasts, interesting ideas come up but there's no good way to capture them. They get lost.
2. If you could record insights in the moment, linked to the exact context, you'd retain far more value from the audio content you consume.

Marginalia builds towards a seamless experience for listening to podcasts and capturing salient information as you go.

**Note capture modes:**
- **Text-based** (MVP): Record a text note associated with a highlighted segment of the transcript, linked back to the original podcast and timestamp.
- **Voice-based** (Future): Record an audio note, transcribed via STT, associated with the transcript segment. Deferred for simplicity.

---

## Current Status

**Phases 1–6 are complete.** The app supports:
- Searching, browsing, and playing podcasts
- Transcription with speaker diarization and paragraph segmentation
- LLM-powered content detection (skip intro/outro music, identify speakers)
- Inline margin notes with click-to-seek and editing
- Audio caching via Cloudflare R2 (ensures transcript-audio alignment)
- User authentication via Supabase Auth
- Persistent annotations per-user with Row Level Security
- App shell with collapsible shadcn/ui sidebar navigation
- Podcast subscriptions and saved episodes library

**Next up:** Phase 7 (Queue/Worker + Google Auth) to enable auto-transcription and reduce sign-in friction.

**Key implementation differences from spec:**
- Using **Podcast Index API** instead of Apple Podcasts API (open, free, better metadata)
- Using **AssemblyAI** instead of ElevenLabs for transcription (better paragraph detection)
- Using **Claude Haiku** for transcript analysis (speaker identification, content bounds)
- Using **uv** for Python dependency management instead of Docker
- Using **Cloudflare R2** for audio caching (zero egress costs)
- Using **Supabase PostgreSQL** for production database with RLS
- URLs use query params (`/podcast?id=123`) rather than path params (`/podcast/[id]`)

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js + Tailwind CSS | Modern React framework with excellent DX. Lucide icons for UI elements. |
| Backend | FastAPI (Python) | Fast to develop, async support, automatic OpenAPI docs, Pydantic validation. |
| Database | Supabase PostgreSQL | Production database with Row Level Security for user data isolation. |
| Audio Cache | Cloudflare R2 | Zero egress costs for audio file storage and delivery. |
| Transcription | AssemblyAI | Speaker diarization, paragraph detection, word-level timestamps. |
| Transcript Analysis | Claude Haiku | Structured outputs for speaker identification and content bounds detection. |
| Auth | Supabase Auth | Email/password authentication with JWT tokens. |
| Hosting | Vercel + Fly.io | Vercel for Next.js frontend, Fly.io for FastAPI backend. Planned. |

**Deployment (Future):**
- Frontend: Vercel
- Backend: Fly.io or Railway
- Auth flow: Supabase issues JWT → Frontend sends in `Authorization` header → FastAPI validates against Supabase

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                           User Browser                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Next.js Frontend                          │    │
│  │  - Home + search (/)                                         │    │
│  │  - Podcast detail (/podcast?id=X)                            │    │
│  │  - Episode player (/episode?id=X&guid=Y)                     │    │
│  └─────────────────────┬───────────────────────────────────────┘    │
│                        │                                             │
│         Audio streams directly from podcast CDN                      │
└────────────────────────┼─────────────────────────────────────────────┘
                         │ API calls
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                                 │
│  - /search → proxies Podcast Index API                              │
│  - /podcast/{id} → podcast info from Podcast Index                  │
│  - /feed?url=X → fetches + parses RSS feed                          │
│  - /transcribe → submits to AssemblyAI                              │
│  - /transcript/{guid} → returns transcript with annotations         │
└─────────────────────┬───────────────────┬───────────────────────────┘
                      │                   │
                      ▼                   ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│     SQLite (local dev)      │   │        AssemblyAI           │
│  - transcripts              │   │  - Submit audio URL         │
│  - transcript words         │   │  - Speaker diarization      │
│  - paragraphs               │   │  - Paragraph detection      │
│  - transcription_jobs       │   │  - Word-level timestamps    │
│                             │   └─────────────────────────────┘
│  → Supabase (production)    │
└─────────────────────────────┘   ┌─────────────────────────────┐
                                  │       Claude Haiku          │
┌─────────────────────────────┐   │  - Speaker identification   │
│    In-Memory LRU Cache      │   │  - Content bounds detection │
│  - Trending podcasts (5min) │   │  - Structured outputs       │
└─────────────────────────────┘   └─────────────────────────────┘
```

**Key data flows:**

1. **Search**: User searches → Frontend calls `/search` → Backend proxies to Podcast Index API → Returns validated results
2. **Browse podcast**: User clicks podcast → Frontend calls `/podcast/{id}` + `/feed?url=X` → Returns podcast info and episodes
3. **Play episode**: User clicks play → Frontend streams audio directly from RSS `<enclosure>` URL. Podcast CDNs support HTTP range requests.
4. **Transcribe**: User clicks "Request transcription" → Backend submits to AssemblyAI → Polls for completion → Fetches paragraphs → Claude Haiku analyzes for speaker names and content bounds → Stored in SQLite
5. **Take notes**: User highlights transcript text → Inline margin note input appears → Note stored in React state (backend persistence planned)

---

## Caching Strategy

**Phase 1**: In-memory LRU cache on the backend container.
- Cache podcast metadata and RSS feed responses
- TTL: 30 minutes
- Max entries: ~500 (adjustable)
- Implementation: Python `functools.lru_cache` or `cachetools.TTLCache`

**Later**: If needed, move to Redis or Supabase for persistence across deployments.

---

## Data Models

### Apple Podcasts API Response

Fields we extract from the Apple Podcasts Search API:

```python
class PodcastSearchResult(BaseModel):
    """Pydantic model for Apple Podcasts API response."""
    collection_id: int              # Primary identifier
    track_id: int                   # Same as collection_id for podcasts
    artist_name: str                # Publisher/network name
    collection_name: str            # Podcast title
    feed_url: str                   # RSS feed URL (critical)
    artwork_url_30: str | None
    artwork_url_60: str | None
    artwork_url_100: str | None
    artwork_url_600: str | None
    release_date: datetime          # Last episode release
    track_count: int                # Number of episodes
    country: str                    # e.g., "USA"
    primary_genre_name: str         # Main category
    genres: list[str]               # All categories
    collection_view_url: str | None # Link to Apple Podcasts page
    content_advisory_rating: str | None  # "Clean" or "Explicit"
```

**Raw API response example:**
```json
{
  "collectionId": 1050462261,
  "trackId": 1050462261,
  "artistName": "Ben Gilbert and David Rosenthal",
  "collectionName": "Acquired",
  "feedUrl": "https://feeds.transistor.fm/acquired",
  "artworkUrl30": "https://is1-ssl.mzstatic.com/.../30x30bb.jpg",
  "artworkUrl60": "https://is1-ssl.mzstatic.com/.../60x60bb.jpg",
  "artworkUrl100": "https://is1-ssl.mzstatic.com/.../100x100bb.jpg",
  "artworkUrl600": "https://is1-ssl.mzstatic.com/.../600x600bb.jpg",
  "releaseDate": "2025-12-15T04:19:00Z",
  "trackCount": 212,
  "country": "USA",
  "primaryGenreName": "Technology",
  "genres": ["Technology", "Podcasts", "Business", "Investing"],
  "collectionViewUrl": "https://podcasts.apple.com/us/podcast/acquired/id1050462261",
  "contentAdvisoryRating": "Clean"
}
```

### RSS Feed Episode Data

Podcast RSS feeds follow the [iTunes RSS spec](https://podcasters.apple.com/support/823-podcast-requirements). Fields extracted:

```python
class Episode(BaseModel):
    """Pydantic model for RSS feed episode."""
    # Core identifiers
    guid: str                       # <guid> - unique episode identifier
    title: str                      # <title>
    link: str | None                # <link> - episode webpage URL

    # Audio
    audio_url: str                  # <enclosure url="...">
    audio_length_bytes: int | None  # <enclosure length="...">
    audio_type: str | None          # <enclosure type="..."> e.g., "audio/mpeg"
    duration_seconds: int | None    # <itunes:duration>

    # Content
    description: str | None         # <description> - can be HTML, used for show notes

    # Metadata
    published_at: datetime | None   # <pubDate> - RFC 2822 format
    author: str | None              # <itunes:author>
    episode_number: int | None      # <itunes:episode>
    season_number: int | None       # <itunes:season>
    episode_type: str | None        # <itunes:episodeType> - "full", "trailer", "bonus"
    explicit: bool                  # <itunes:explicit> - "Yes"/"No" -> bool
    image_url: str | None           # <itunes:image href="..."> - episode-specific artwork
```

**Example RSS `<item>` element:**
```xml
<item>
  <title>Coca-Cola</title>
  <guid isPermaLink="false">4537f61d-0ec1-4837-92e0-9270d140e6d2</guid>
  <link>https://www.acquired.fm/episodes/coca-cola</link>
  <description><![CDATA[<p>Coca-Cola is… sugar water...</p>]]></description>
  <pubDate>Sun, 23 Nov 2025 19:00:17 -0800</pubDate>
  <enclosure url="https://media.transistor.fm/.../68ea94eb.mp3"
             length="234752287" type="audio/mpeg"/>
  <itunes:duration>14668</itunes:duration>
  <itunes:season>18</itunes:season>
  <itunes:episode>3</itunes:episode>
  <itunes:episodeType>full</itunes:episodeType>
  <itunes:author>Ben Gilbert and David Rosenthal</itunes:author>
  <itunes:image href="https://img.transistorcdn.com/.../image.jpg"/>
  <itunes:explicit>No</itunes:explicit>
</item>
```

### RSS Feed Podcast (Channel) Data

The RSS `<channel>` element contains podcast-level metadata:

```python
class PodcastFromFeed(BaseModel):
    """Podcast metadata from RSS feed (supplements Apple API data)."""
    title: str                      # <title>
    description: str | None         # <description>
    link: str | None                # <link> - podcast website
    author: str | None              # <itunes:author>
    image_url: str | None           # <itunes:image href="...">
    language: str | None            # <language> - e.g., "en-us"
    categories: list[str]           # <itunes:category text="...">
    explicit: bool                  # <itunes:explicit>
    last_build_date: datetime | None  # <lastBuildDate>
```

### Parsing Notes

- Use `BeautifulSoup` with `lxml` parser for XML parsing
- `<pubDate>` is RFC 2822 format - use `email.utils.parsedate_to_datetime()`
- `<itunes:duration>` can be seconds (`"14668"`) or time string (`"4:04:28"`) - normalize to int seconds
- `<itunes:explicit>` is `"Yes"`/`"No"` string - convert to bool
- `<description>` contains HTML - strip tags for plain text preview, keep HTML for full view
- iTunes namespace elements: `soup.find('itunes:duration')` works directly with BeautifulSoup

```python
from email.utils import parsedate_to_datetime

def parse_duration(val: str) -> int:
    """Handles both '14668' and '4:04:28' formats."""
    if ':' in val:
        parts = list(map(int, val.split(':')))
        return sum(p * 60**i for i, p in enumerate(reversed(parts)))
    return int(val)

def parse_explicit(val: str) -> bool:
    return val.lower() in ('yes', 'true', 'explicit')

def parse_pub_date(val: str) -> datetime:
    return parsedate_to_datetime(val)
```

### Supabase Tables (Phase 2+)

Since podcasts/episodes are LRU-cached (not persisted), Supabase tables reference episodes by their RSS GUID.

### `transcription_jobs`
```sql
CREATE TABLE transcription_jobs (
  id TEXT PRIMARY KEY,                -- UUID
  episode_guid TEXT NOT NULL,         -- RSS <guid> element (unique per episode)
  podcast_id INTEGER NOT NULL,        -- Podcast Index ID
  audio_url TEXT NOT NULL,            -- Stored for retry/reference
  assemblyai_id TEXT,                 -- ID from AssemblyAI API
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `transcripts`

AssemblyAI returns word-level data with speaker diarization. We also fetch paragraph boundaries separately and run Claude Haiku for speaker identification and content bounds.

**AssemblyAI Response Model:**
```
TranscriptResponse:
  id: string                      # transcript ID
  status: string                  # "completed", "error", etc.
  text: string                    # full transcript text
  words: [Word]
  utterances: [Utterance]         # speaker-grouped segments

Word:
  text: string                    # the word transcribed
  start: int                      # start time in milliseconds
  end: int                        # end time in milliseconds
  confidence: float               # 0-1 confidence
  speaker: string | null          # "A", "B", etc.

Utterance:
  speaker: string                 # "A", "B", etc.
  text: string
  start: int
  end: int
  words: [Word]
```

**Claude Haiku Analysis (structured output):**
```python
class TranscriptAnalysis(BaseModel):
    content_start_ms: int              # Where actual content begins (skip intro music)
    content_end_ms: int | None         # Where content ends (skip outro)
    speaker_labels: dict[str, str]     # {"A": "Ben Gilbert", "B": "David Rosenthal"}
```

**Our storage schema (SQLite):**
```sql
CREATE TABLE transcripts (
  episode_guid TEXT PRIMARY KEY,
  podcast_id INTEGER NOT NULL,
  audio_duration INTEGER,             -- total duration in ms
  confidence REAL,
  words_json TEXT,                    -- JSON array of word objects
  paragraphs_json TEXT,               -- JSON array of paragraph objects
  content_start_ms INTEGER DEFAULT 0, -- where content begins (skip intro)
  content_end_ms INTEGER,             -- where content ends (skip outro)
  speaker_labels_json TEXT,           -- JSON: {"A": "Name", "B": "Name"}
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `notes`

Schema aligned with Readwise highlight format for trivial export later.

**Readwise Highlight Schema** (for reference):
```
text: string (required)           # highlighted text, max 8191 chars
title: string                     # source title, max 511 chars
author: string                    # source author, max 1024 chars
image_url: string                 # cover image URL, max 2047 chars
source_url: string                # article/podcast URL, max 2047 chars
source_type: string               # app identifier, max 64 chars (we'll use "marginalia")
category: string                  # "books" | "articles" | "tweets" | "podcasts"
note: string                      # user annotation, max 8191 chars
location: integer                 # position in source (seconds for time_offset)
location_type: string             # "time_offset" for podcasts
highlighted_at: string            # ISO 8601 datetime
highlight_url: string             # deep link to specific highlight, max 4095 chars
```

**Our storage schema:**
```sql
CREATE TABLE notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Episode reference (no FK since episodes aren't persisted)
  episode_guid TEXT NOT NULL,             -- RSS <guid> element
  podcast_id TEXT NOT NULL,               -- Apple collection_id

  -- Denormalized metadata (for Readwise export without re-fetching)
  episode_title TEXT NOT NULL,
  podcast_name TEXT NOT NULL,
  podcast_author TEXT,
  artwork_url TEXT,
  audio_url TEXT NOT NULL,

  -- Core content
  highlighted_text TEXT NOT NULL,         -- the transcript text user highlighted
  note_text TEXT,                         -- user's annotation (optional, can highlight without note)

  -- Timestamps (location for Readwise)
  timestamp_start FLOAT NOT NULL,         -- seconds into episode
  timestamp_end FLOAT NOT NULL,           -- seconds into episode

  -- Word-level reference (for precise re-highlighting)
  start_word_index INTEGER,               -- index into transcript_words
  end_word_index INTEGER,                 -- index into transcript_words

  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notes_episode ON notes(episode_guid);
CREATE INDEX idx_notes_podcast ON notes(podcast_id);
```

**Readwise export mapping:**
| Our field | Readwise field | Value |
|-----------|----------------|-------|
| `highlighted_text` | `text` | Direct |
| `episode_title` | `title` | Direct |
| `podcast_author` | `author` | Direct |
| `artwork_url` | `image_url` | Direct |
| `audio_url` | `source_url` | Direct |
| - | `source_type` | `"marginalia"` |
| - | `category` | `"podcasts"` |
| `note_text` | `note` | Direct |
| `timestamp_start` | `location` | Cast to integer seconds |
| - | `location_type` | `"time_offset"` |
| `created_at` | `highlighted_at` | ISO 8601 format |
| - | `highlight_url` | `{app_url}/episode/{guid}?t={timestamp}` |

**Note on diarization vs identification:**
- **Diarization** separates speakers ("A", "B") without knowing who they are
- **Identification** maps to actual names ("Ben Gilbert", "David Rosenthal")
- AssemblyAI provides diarization. We use Claude Haiku to identify speakers from context (podcast metadata + transcript content).

---

## API Endpoints

### Search & Browse

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q={term}` | Search podcasts via Podcast Index API. |
| `GET` | `/trending` | Get trending podcasts (cached 5min). |
| `GET` | `/podcast/{id}` | Get podcast info from Podcast Index. |
| `GET` | `/feed?url={rss_url}` | Fetch and parse RSS feed. Returns episodes. |

### Transcription

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/transcribe` | Start transcription job. Body: `{episode_guid, podcast_id, audio_url, ...metadata}`. |
| `GET` | `/transcribe/{job_id}` | Poll job status. Returns `{status, error_message?}`. |
| `GET` | `/transcript/{episode_guid}` | Get completed transcript with words, paragraphs, speaker labels. |

### Notes (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/annotations` | Create annotation. |
| `GET` | `/annotations?episode_guid={guid}` | Get annotations for an episode. |
| `GET` | `/annotations` | Get all user annotations (paginated). |
| `PUT` | `/annotations/{id}` | Update annotation. |
| `DELETE` | `/annotations/{id}` | Delete annotation. |

### Export (Planned)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/export/readwise` | Export annotations to Readwise. |

---

## Frontend Pages

### `/` - Landing Page
- Minimal, Google-style search box centered on page
- Logo/branding above search
- No auth required initially

### `/search?q={term}` - Search Results
- Grid/list of podcast results
- Each shows: artwork, title, author, genre
- Click navigates to `/podcast/{id}`

### `/podcast/{id}` - Podcast Detail
- Header: artwork, title, author, description
- Episode list below (paginated or infinite scroll)
- Each episode shows: title, date, duration, transcription status indicator
- Click episode navigates to `/episode/{id}`

### `/episode/{id}` - Episode Player
- **Audio player** (persistent at bottom or top)
  - Play/pause button
  - Seek bar (full scrubbing support - podcast CDNs support range requests)
  - Current time / total duration display
  - Skip backward/forward buttons (±15s or ±30s)
  - Playback speed selector (0.5x, 1x, 1.25x, 1.5x, 2x)
  - Volume control
  - Streams directly from RSS `<enclosure>` URL via HTML5 `<audio>` element
- **Transcript panel** (main content area)
  - Renders word-level transcript data, grouped by speaker turns
  - Current word highlighted based on audio playback time
  - **Auto-scroll**: Follows current playback position (toggleable)
  - **Click-to-seek**: Click any word to jump to that timestamp
  - **Highlighting**: Select text range to open note creation modal (captures word indices for precise reference)
- **Notes sidebar/panel**
  - Shows existing notes for this episode
  - Click note to jump to that timestamp
- **Transcription states**:
  - Not transcribed: Show "Request Transcription" button
  - Processing: Show progress indicator, audio still playable
  - Complete: Show transcript with full functionality
  - Failed: Show error message with retry option

---

## Roadmap

### Phase 1: Search + Browse + Play ✅
**Goal:** Replicate core podcast app functionality without persistence.

- [x] Set up Next.js frontend with Tailwind
- [x] Set up FastAPI backend with uv
- [x] Implement `/search` endpoint (via Podcast Index API)
- [x] Implement `/podcast/{id}` endpoint (podcast info from Podcast Index)
- [x] Implement `/feed` endpoint (RSS feed fetching + parsing)
- [x] Implement `/trending` endpoint (with 5min cache)
- [x] Build landing page with search + trending podcasts
- [x] Build podcast detail page with episode list + episode search
- [x] Build episode player page with full audio controls
- [x] Audio streaming, seeking, skip ±15s/30s, playback speed, volume
- [x] Infinite scroll for episode lists
- [x] Media key sync (play/pause)

### Phase 2: Transcription Pipeline ✅
**Goal:** Enable transcript generation and display.

- [x] Integrate AssemblyAI for transcription with speaker diarization
- [x] Implement `POST /transcribe` (submit job)
- [x] Implement `GET /transcribe/{id}` (poll status)
- [x] Implement `GET /transcript/{guid}` (fetch result)
- [x] Store transcripts in SQLite with word-level timestamps
- [x] Fetch paragraph boundaries from AssemblyAI
- [x] Build transcript display component with speaker labels
- [x] Click-to-seek at paragraph level
- [x] Handle transcription states in UI (pending, processing, complete, failed)
- [x] LLM analysis with Claude Haiku:
  - [x] Content bounds detection (skip intro/outro music)
  - [x] Speaker identification (map speaker IDs to names)
  - [x] Structured outputs via Anthropic beta API

### Phase 3: Annotations ✅
**Goal:** Enable capturing and reviewing notes inline with transcripts.

- [x] Text selection triggers annotation input (highlight text → add note)
- [x] Inline margin notes positioned next to source paragraphs
- [x] Click note to seek audio to that timestamp
- [x] Edit notes inline (click note text to edit)
- [x] Delete notes (hover to reveal delete button)
- [x] "View all notes" sidebar toggle
- [x] Notes stored in component state (backend persistence in Phase 5)

### Phase 4: Audio Caching ✅
**Goal:** Ensure audio-transcript timestamp alignment by caching audio files.

**The problem:** Many podcasts use dynamic ad insertion (DAI). The RSS `<enclosure>` URL doesn't serve a static file—it assembles audio on-the-fly with different ads each request. This means:
- Audio transcribed at time T₁ has different timestamps than audio played at T₂
- Click-to-seek breaks because the transcript timestamps don't match the current audio
- Annotations become misaligned with their source content

**The solution:** Cache the exact audio file at transcription time and serve that for playback.

- [x] Set up Cloudflare R2 bucket for audio files (public)
- [x] On transcription request: download MP3 → upload to R2 → transcribe that URL
- [x] Add `cached_audio_url` column to transcriptions table
- [x] Frontend: use `cached_audio_url` for playback when available

**Future alternative: Amplitude Envelope Sync**

The audio caching approach works but has costs (storage). An alternative that avoids storing audio entirely:

*The insight:* The actual podcast content (speech waveforms) is identical regardless of which ads are dynamically inserted. We don't need the full audio—just enough information to recognize "where are we in the content?"

*Amplitude envelope:* A compact representation of audio loudness over time. Speech has distinctive patterns—words, pauses, emphasis—that create a recognizable "shape." Store ~350KB per hour instead of ~100MB.

*Trade-off:* More engineering complexity than caching. Implement when storage costs justify it.

### Phase 5: Auth + User Management ✅
**Goal:** Add user accounts, persist data.

- [x] Set up Supabase project with PostgreSQL
- [x] Migrate SQLite schema to Supabase
- [x] Set up Supabase Auth (email/password)
- [x] Add login/logout UI with Supabase Auth UI
- [x] Create annotations table with `user_id` and RLS
- [x] Protect annotation endpoints with JWT validation
- [x] Frontend persists annotations to backend
- [x] Annotations include `synced_to_readwise` and `last_synced_at` for future Readwise integration
- [ ] Deploy frontend to Vercel
- [ ] Deploy backend to Fly.io

### Phase 6: Speaker Labels & App Navigation ✅
**Goal:** Allow users to edit speaker labels and add proper app-wide navigation.

**Debug Claude Speaker Identification:**
- [x] Debug why `analyze_transcript()` returns empty `speaker_labels`
- [x] Check Claude API response and structured output parsing
- [x] Verify prompt is receiving correct transcript data
- [x] Test with multiple podcasts to identify patterns

**App Navigation with shadcn/ui:**
- [x] Install shadcn/ui
- [x] Add shadcn/ui Sidebar component
- [x] Create persistent header with logo (click to go home)
- [x] Sidebar navigation: Home, Subscriptions, Library, Transcribed
- [x] Collapsible sidebar
- [x] User menu in header

**Speaker Label Editing (Deferred):**
Now that auto-labeling works, manual editing is less critical. Can add later if users request it.

### Phase 7: Queue/Worker + Google Auth
**Goal:** Production-ready infrastructure for background jobs and frictionless authentication.

**Queue/Worker Architecture:**

Current transcription is synchronous (API waits for AssemblyAI). Moving to a queue model:
1. API creates job in DB with `status=pending`, returns immediately
2. Worker picks up pending jobs, submits to AssemblyAI, polls for completion
3. Worker updates DB when done; frontend polls DB for status

Benefits: Fast API responses, automatic retries, scales horizontally, enables auto-transcription.

Implementation: PostgreSQL as queue using `FOR UPDATE SKIP LOCKED` pattern (no new infrastructure).

- [ ] Refactor `transcription_jobs` table for queue pattern
- [ ] Create worker script that polls for pending jobs
- [ ] Worker handles AssemblyAI submission + polling + DB updates
- [ ] API just creates jobs and reads status from DB
- [ ] Add worker health checks and error handling
- [ ] Deploy worker as separate process (Railway background worker or similar)

**Google Sign-In:**

Reduce friction with OAuth instead of email/password.

- [ ] Create Google OAuth credentials in Cloud Console
- [ ] Configure Google provider in Supabase Dashboard
- [ ] Update frontend login page with Google sign-in button
- [ ] Test auth flow end-to-end

### Phase 8: MCP Server
**Goal:** Expose transcripts and annotations via MCP for use in Claude Desktop and other tools.

The insight: rather than building a chat UI (which would duplicate Claude Desktop), expose the data where it's most useful. Users can query their podcast knowledge base from any MCP-enabled client.

- [ ] Create MCP server package
- [ ] `search_transcripts(query)` - full-text search across transcribed episodes
- [ ] `get_transcript(episode_guid)` - get full transcript for an episode
- [ ] `get_annotations(episode_guid?)` - retrieve user's notes with context
- [ ] `list_transcribed_episodes()` - see what's available
- [ ] Package for easy local installation
- [ ] Test with Claude Desktop

### Phase 9: Auto-Transcription + Freemium
**Goal:** Users subscribe to podcasts; new episodes auto-transcribe. Monetize via Stripe.

- [x] Podcast subscriptions (users can follow podcasts)
- [x] Saved episodes (library)
- [ ] Background job to poll RSS feeds for new episodes
- [ ] Queue transcription jobs for subscribed podcasts
- [ ] Prioritization (most-subscribed podcasts first)
- [ ] User notification when transcription completes

**Freemium Model:**
- **Free tier**: Access to community-transcribed episodes only (transcripts shared across all users)
- **Paid tier** ($X/month): 10 hours/month of on-demand transcription for any episode

**Stripe Integration:**
- [ ] Create Stripe product + pricing
- [ ] Link Stripe Customer to Supabase user
- [ ] Track transcription usage per user (minutes consumed)
- [ ] Gate transcription requests behind usage limits
- [ ] Stripe Checkout for subscription signup
- [ ] Webhook handling for subscription events

### Phase 10: Analytics + Observability
**Goal:** Understand how people use Marginalia.

Key events to track:
- [ ] Searches (what are people looking for?)
- [ ] Transcription requests (conversion to paid feature)
- [ ] Annotation creates/edits/deletes (engagement with core feature)
- [ ] Seek events from notes (are annotations useful for navigation?)
- [ ] MCP tool calls (how is the API being used?)
- [ ] Errors (failed transcriptions, API failures)

Implementation:
- [ ] Event logging to Supabase or dedicated analytics (PostHog, Mixpanel)
- [ ] Basic dashboard for usage metrics

### Future Ideas
- Readwise integration (export annotations)
- Listening history and resume position
- Voice note capture (STT for quick annotations)
- Mobile app / PWA
- Shared annotations (public highlights from a podcast)
- Podcast recommendations based on listening patterns
- Episode summaries generated from transcript

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.11+ with [uv](https://docs.astral.sh/uv/)
- Podcast Index API credentials (free at https://podcastindex.org/)

### Environment Variables

**Backend (`backend/.env`):**
```
PODCAST_INDEX_API_KEY=your_key_here
PODCAST_INDEX_API_SECRET=your_secret_here
```

### Running the App

```bash
# Terminal 1: Backend
cd backend
uv run backend

# Terminal 2: Frontend
cd frontend
npm install
npm run dev

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs
```

---

## Project Structure

**Current (Phase 1):**
```
marginalia/
├── README.md
├── backend/
│   ├── pyproject.toml
│   ├── .env                    # API credentials (not committed)
│   └── src/backend/
│       ├── server.py           # FastAPI app + endpoints
│       ├── rss.py              # RSS feed parsing
│       └── models/
│           └── schemas.py      # Pydantic models
└── frontend/
    ├── package.json
    ├── app/
    │   ├── page.tsx            # Home (search + trending)
    │   ├── podcast/page.tsx    # Podcast detail + episodes
    │   └── episode/page.tsx    # Episode player
    ├── components/
    │   ├── Header.tsx
    │   ├── SearchBar.tsx
    │   ├── PodcastCard.tsx
    │   ├── EpisodeCard.tsx
    │   └── AudioPlayer.tsx
    └── lib/
        ├── config.ts           # API base URL
        └── types.ts            # TypeScript interfaces
```

**Planned (Phase 5+):**
```
├── backend/
│   ├── services/
│   │   ├── assemblyai.py       # AssemblyAI client (if refactored)
│   │   └── supabase.py         # Supabase client
├── frontend/
│   ├── components/
│   │   ├── Transcript.tsx
│   │   ├── NoteModal.tsx
│   │   └── NotesSidebar.tsx
└── supabase/
    └── migrations/             # SQL migration files
```
