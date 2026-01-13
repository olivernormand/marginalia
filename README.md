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

**Phase 1 is complete.** The app supports searching, browsing, and playing podcasts.

**Key implementation differences from spec:**
- Using **Podcast Index API** instead of Apple Podcasts API (open, free, better metadata)
- Using **uv** for Python dependency management instead of Docker
- No LRU caching except for trending podcasts (5min TTL) - kept simple for now
- URLs use query params (`/podcast?id=123`) rather than path params (`/podcast/[id]`)

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js + Tailwind CSS + shadcn/ui | Modern React framework with excellent DX. shadcn/ui provides accessible, customizable components. |
| Backend | FastAPI (Python) | Fast to develop, async support, automatic OpenAPI docs, Pydantic validation. |
| Database | Supabase (PostgreSQL) | Managed Postgres with easy setup. Auth, storage, and realtime built-in for future use. |
| Transcription | ElevenLabs Scribe v2 | ~£0.40/hr. Provides timestamps and speaker diarization out of the box. |
| Auth | Supabase Auth (Google OAuth) | Simple integration. Google-only login for simplicity. Implemented after core features. |
| Local Dev | Docker + docker-compose | Consistent dev environment, easy onboarding. |

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
│  │  - Search page (/)                                           │    │
│  │  - Search results (/search)                                  │    │
│  │  - Podcast detail (/podcast/[id])                           │    │
│  │  - Episode player (/episode/[id])                           │    │
│  └─────────────────────┬───────────────────────────────────────┘    │
│                        │                                             │
│         Audio streams directly from podcast CDN                      │
└────────────────────────┼─────────────────────────────────────────────┘
                         │ API calls
                         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend                                 │
│  - /search → proxies Apple Podcasts API                             │
│  - /podcasts/{id} → fetches + caches RSS feed                       │
│  - /episodes/{id}/transcribe → submits to ElevenLabs                │
│  - /transcription-jobs/{id} → polls job status                      │
│  - /notes → CRUD for user annotations                               │
└─────────────────────┬───────────────────┬───────────────────────────┘
                      │                   │
                      ▼                   ▼
┌─────────────────────────────┐   ┌─────────────────────────────┐
│        Supabase             │   │      ElevenLabs Scribe      │
│  (Phase 2+)                 │   │  - Submit audio URL         │
│  - transcripts              │   │  - Poll for completion      │
│  - transcript_words         │   │  - Returns timestamped      │
│  - notes                    │   │    diarized transcript      │
│  - transcription_jobs       │   │                             │
└─────────────────────────────┘   └─────────────────────────────┘

┌─────────────────────────────┐
│    In-Memory LRU Cache      │
│  - Podcast search results   │
│  - RSS feed responses       │
│  - TTL: 30 min              │
└─────────────────────────────┘
```

**Key data flows:**

1. **Search**: User searches → Frontend calls `/search` → Backend proxies to Apple Podcasts API (LRU cached) → Returns validated results via Pydantic
2. **Browse podcast**: User clicks podcast → Frontend calls `/podcasts/{id}` → Backend fetches RSS feed (LRU cached, 30min TTL) → Returns episodes
3. **Play episode**: User clicks play → Frontend streams audio directly from RSS `<enclosure>` URL. Podcast CDNs support HTTP range requests, enabling full seek/skip controls.
4. **Transcribe**: User clicks "Request transcription" → Backend submits audio URL to ElevenLabs → Creates job record in Supabase → Frontend polls `/transcription-jobs/{id}` → On completion, transcript stored in Supabase
5. **Take notes**: User highlights transcript text → Modal appears → User types note → Frontend calls `POST /notes` → Stored in Supabase

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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_guid TEXT NOT NULL,         -- RSS <guid> element (unique per episode)
  podcast_id TEXT NOT NULL,           -- Apple collection_id (for context)
  audio_url TEXT NOT NULL,            -- Stored for retry/reference
  elevenlabs_job_id TEXT,             -- ID from ElevenLabs API
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, processing, completed, failed
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_transcription_jobs_episode ON transcription_jobs(episode_guid);
CREATE INDEX idx_transcription_jobs_status ON transcription_jobs(status);
```

### `transcripts`

ElevenLabs Scribe returns word-level data. We store this granularly for precise highlighting and transcript display.

**ElevenLabs Response Model** (from their API):
```
SpeechToTextChunkResponseModel:
  language_code: string           # e.g. "eng"
  language_probability: float     # 0-1 confidence
  text: string                    # full raw transcription
  words: [SpeechToTextWordResponseModel]

SpeechToTextWordResponseModel:
  text: string                    # the word/sound transcribed
  start: float | null             # start time in seconds
  end: float | null               # end time in seconds
  type: "word" | "spacing" | "audio_event"
  speaker_id: string | null       # speaker identifier for diarization
```

**Our storage schema:**
```sql
CREATE TABLE transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_guid TEXT NOT NULL UNIQUE,  -- RSS <guid> element
  podcast_id TEXT NOT NULL,           -- Apple collection_id (for context)
  language_code TEXT,
  language_probability FLOAT,
  raw_text TEXT,                      -- full transcript text for quick access
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE transcript_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID REFERENCES transcripts(id),
  word_index INTEGER NOT NULL,      -- ordering
  text TEXT NOT NULL,
  start_time FLOAT,                 -- seconds (null for spacing)
  end_time FLOAT,                   -- seconds (null for spacing)
  word_type TEXT NOT NULL,          -- "word", "spacing", "audio_event"
  speaker_id TEXT                   -- "speaker_0", "speaker_1", etc.
);

CREATE INDEX idx_transcript_words_transcript_id ON transcript_words(transcript_id);
CREATE INDEX idx_transcript_words_time ON transcript_words(transcript_id, start_time);
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
- **Diarization** separates speakers ("Speaker 1", "Speaker 2") without knowing who they are
- **Identification** would know the actual person ("Joe Rogan", "Guest Name")
- ElevenLabs Scribe provides diarization. Identification would require additional work (voice fingerprinting, manual labeling). Out of scope for now.

---

## API Endpoints

### Search & Browse

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/search?q={term}` | Proxy to Apple Podcasts API. Returns validated podcast list. |
| `GET` | `/podcasts/{id}` | Fetch podcast details + episode list from RSS feed. Caches in Supabase. |
| `GET` | `/episodes/{id}` | Fetch single episode details. |

### Transcription

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/episodes/{id}/transcribe` | Start transcription job. Submits audio URL to ElevenLabs. Returns job ID. |
| `GET` | `/transcription-jobs/{id}` | Poll job status. Returns `{status, progress?, error?}`. |
| `GET` | `/episodes/{id}/transcript` | Get completed transcript with segments. 404 if not yet transcribed. |

### Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/notes` | Create a note. Body includes episode metadata for denormalization (see schema below). |
| `GET` | `/notes?episode_guid={guid}` | Get all notes for an episode. |
| `GET` | `/notes` | Get all notes (paginated). |
| `PUT` | `/notes/{id}` | Update note text only. |
| `DELETE` | `/notes/{id}` | Delete a note. |

**Create note request body:**
```json
{
  "episode_guid": "abc123",
  "podcast_id": "1050462261",
  "episode_title": "Episode 42: The Story",
  "podcast_name": "Acquired",
  "podcast_author": "Ben Gilbert and David Rosenthal",
  "artwork_url": "https://...",
  "audio_url": "https://...",
  "highlighted_text": "The text the user highlighted",
  "note_text": "User's annotation (optional)",
  "timestamp_start": 1234.5,
  "timestamp_end": 1245.2,
  "start_word_index": 500,
  "end_word_index": 520
}
```

### Export (Phase 5)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/export/readwise` | Export notes to Readwise. Body: `{note_ids?: string[], readwise_token: string}`. Transforms notes to Readwise highlight format and sends to their API. |

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

**No Supabase, no ElevenLabs—pure search/browse/play.**

### Phase 2: Transcription Pipeline
**Goal:** Enable transcript generation and display.

- [ ] Set up Supabase project and tables
- [ ] Implement podcast/episode caching in Supabase
- [ ] Integrate ElevenLabs Scribe v2 API
- [ ] Implement `POST /episodes/{id}/transcribe` (submit job)
- [ ] Implement `GET /transcription-jobs/{id}` (poll status)
- [ ] Implement `GET /episodes/{id}/transcript` (fetch result)
- [ ] Build transcript display component
- [ ] Implement auto-scroll sync with audio playback
- [ ] Implement click-to-seek on transcript segments
- [ ] Handle transcription states in UI (pending, processing, complete, failed)

### Phase 3: Notes System
**Goal:** Enable capturing and reviewing notes.

- [ ] Implement notes table and API endpoints
- [ ] Build text selection → note creation flow
- [ ] Build note creation modal
- [ ] Build notes sidebar/panel on episode page
- [ ] Click note to seek to timestamp
- [ ] Edit/delete notes

### Phase 4: Authentication
**Goal:** Add user accounts so notes persist per-user.

- [ ] Set up Supabase Auth with Google OAuth
- [ ] Add login/logout UI
- [ ] Add `user_id` foreign key to notes table
- [ ] Protect note endpoints with JWT validation in FastAPI
- [ ] Handle unauthenticated state gracefully in UI

### Phase 5: Polish & Future Features
**Goal:** Refinements and optional integrations.

- [ ] Readwise integration (export notes)
- [ ] Recently played / listening history
- [ ] Podcast subscriptions / following
- [ ] Mobile responsiveness improvements
- [ ] Voice note capture (STT)
- [ ] Speaker identification / labeling

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

**Planned (Phase 2+):**
```
├── backend/
│   ├── services/
│   │   ├── elevenlabs.py       # ElevenLabs Scribe client
│   │   └── supabase.py         # Supabase client
├── frontend/
│   ├── components/
│   │   ├── Transcript.tsx
│   │   ├── NoteModal.tsx
│   │   └── NotesSidebar.tsx
└── supabase/
    └── migrations/             # SQL migration files
```
