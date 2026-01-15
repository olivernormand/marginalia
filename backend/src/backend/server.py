import hashlib
import os
import time
from pathlib import Path

import anthropic
import httpx
import uvicorn
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

# Load .env file from backend directory
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from backend import database as db
from backend import storage
from backend.auth import get_current_user, get_optional_user
from backend.models.schemas import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
    PodcastEpisodeResponse,
    PodcastFeedResponse,
    PodcastInfoResponse,
    PodcastSearchResult,
    TranscribeRequest,
    TranscriptAnalysis,
    TranscriptionJobResponse,
    TranscriptParagraph,
    TranscriptResponse,
    TranscriptWord,
    TrendingPodcast,
)
from backend.rss import parse_rss_feed

app = FastAPI(
    title="Marginalia API",
    description="Backend API for Marginalia podcast app",
    version="0.1.0",
)

# Simple in-memory cache for trending podcasts
_trending_cache: dict[str, tuple[float, list]] = {}
TRENDING_CACHE_TTL = 300  # 5 minutes in seconds

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Podcast Index API
PODCAST_INDEX_API_KEY = os.getenv("PODCAST_INDEX_API_KEY", "")
PODCAST_INDEX_API_SECRET = os.getenv("PODCAST_INDEX_API_SECRET", "")
PODCAST_INDEX_BASE_URL = "https://api.podcastindex.org/api/1.0"

# AssemblyAI API
ASSEMBLYAI_API_KEY = os.getenv("ASSEMBLYAI_API_KEY", "")
ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2"

# Anthropic API (for transcript analysis)
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")


def get_podcast_index_headers() -> dict[str, str]:
    """Generate authentication headers for Podcast Index API."""
    epoch_time = str(int(time.time()))
    data_to_hash = PODCAST_INDEX_API_KEY + PODCAST_INDEX_API_SECRET + epoch_time
    sha1_hash = hashlib.sha1(data_to_hash.encode("utf-8")).hexdigest()

    return {
        "X-Auth-Key": PODCAST_INDEX_API_KEY,
        "X-Auth-Date": epoch_time,
        "Authorization": sha1_hash,
        "User-Agent": "Marginalia/1.0",
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok"}


@app.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> dict:
    """Get the currently authenticated user's info."""
    return {
        "id": user.get("sub"),
        "email": user.get("email"),
        "role": user.get("role"),
    }


@app.get("/search")
async def search(q: str = Query(..., min_length=1)) -> list[PodcastSearchResult]:
    """Search for podcasts via Podcast Index API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PODCAST_INDEX_BASE_URL}/search/byterm",
            params={"q": q},
            headers=get_podcast_index_headers(),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch from Podcast Index API",
            )

        data = response.json()

    results = []
    for item in data.get("feeds", []):
        try:
            results.append(
                PodcastSearchResult(
                    id=item["id"],
                    title=item.get("title", ""),
                    url=item.get("url", ""),
                    artwork=item.get("artwork"),
                    author=item.get("author"),
                    description=item.get("description"),
                    itunes_id=item.get("itunesId"),
                    podcast_guid=item.get("podcastGuid"),
                    episode_count=item.get("episodeCount"),
                    language=item.get("language"),
                    explicit=item.get("explicit", False),
                    categories=item.get("categories"),
                )
            )
        except Exception:
            continue

    return results


@app.get("/podcast/{podcast_id}")
async def get_podcast(podcast_id: int) -> PodcastInfoResponse:
    """Get podcast info by Podcast Index ID."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PODCAST_INDEX_BASE_URL}/podcasts/byfeedid",
            params={"id": podcast_id},
            headers=get_podcast_index_headers(),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch from Podcast Index API",
            )

        data = response.json()

    feed = data.get("feed")
    if not feed:
        raise HTTPException(
            status_code=404,
            detail=f"Podcast with ID {podcast_id} not found",
        )

    return PodcastInfoResponse(
        id=feed["id"],
        title=feed.get("title", ""),
        url=feed.get("url", ""),
        artwork=feed.get("artwork"),
        author=feed.get("author"),
        description=feed.get("description"),
        itunes_id=feed.get("itunesId"),
        podcast_guid=feed.get("podcastGuid"),
        episode_count=feed.get("episodeCount"),
        language=feed.get("language"),
        explicit=feed.get("explicit", False),
        categories=feed.get("categories"),
        link=feed.get("link"),
    )


@app.get("/trending")
async def get_trending_podcasts(
    max: int = Query(5, ge=1, le=20),
) -> list[TrendingPodcast]:
    """Get trending podcasts from Podcast Index (cached for 5 minutes)."""
    cache_key = f"trending_{max}"
    now = time.time()

    # Check cache
    if cache_key in _trending_cache:
        cached_time, cached_data = _trending_cache[cache_key]
        if now - cached_time < TRENDING_CACHE_TTL:
            return cached_data

    # Fetch fresh data
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{PODCAST_INDEX_BASE_URL}/podcasts/trending",
            params={"max": max},
            headers=get_podcast_index_headers(),
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to fetch from Podcast Index API",
            )

        data = response.json()

    podcasts = []
    for item in data.get("feeds", []):
        try:
            podcasts.append(
                TrendingPodcast(
                    id=item["id"],
                    title=item.get("title", ""),
                    description=item.get("description"),
                    author=item.get("author"),
                    artwork=item.get("artwork"),
                    trend_score=item.get("trendScore"),
                    language=item.get("language"),
                    categories=item.get("categories"),
                )
            )
        except Exception:
            continue

    # Store in cache
    _trending_cache[cache_key] = (now, podcasts)

    return podcasts


@app.get("/feed")
async def get_feed(url: str = Query(..., min_length=1)) -> PodcastFeedResponse:
    """Fetch and parse a podcast RSS feed.

    Args:
        url: The URL of the RSS feed to fetch.

    Returns:
        Parsed podcast feed with episodes.
    """
    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            response = await client.get(url)
        except httpx.RequestError as e:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to fetch RSS feed: {e}",
            ) from e

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail=f"RSS feed returned status {response.status_code}",
            )

        content = response.text

    try:
        feed = parse_rss_feed(content)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e),
        ) from e

    return PodcastFeedResponse(
        title=feed.title,
        description=feed.description,
        author=feed.author,
        artwork_url=feed.artwork_url,
        episodes=[
            PodcastEpisodeResponse(
                title=ep.title,
                description=ep.description,
                audio_url=ep.audio_url,
                guid=ep.guid,
                pub_date=ep.pub_date,
                duration_seconds=ep.duration_seconds,
                artwork_url=ep.artwork_url,
            )
            for ep in feed.episodes
        ],
    )


# --- Transcript analysis ---


async def analyze_transcript(
    words: list[dict],
    audio_duration_ms: int,
    podcast_title: str | None = None,
    podcast_description: str | None = None,
    episode_title: str | None = None,
    episode_description: str | None = None,
) -> TranscriptAnalysis:
    """Analyze transcript to find content bounds and identify speakers.

    Uses Claude to detect intro/outro music and identify speaker names.
    Returns default values (no filtering, no labels) if analysis fails.
    """
    if not words:
        return TranscriptAnalysis(
            content_start_ms=0,
            content_end_ms=None,
            speaker_labels={},
        )

    # Get first and last 5 minutes of content
    five_min_ms = 5 * 60 * 1000
    first_words = [w for w in words if w["start"] < five_min_ms]
    last_words = [w for w in words if w["start"] > audio_duration_ms - five_min_ms]

    def format_chunks(word_list: list[dict]) -> str:
        """Group words into speaker chunks for display."""
        if not word_list:
            return "(no content)"

        chunks = []
        current_chunk = {
            "speaker": word_list[0].get("speaker"),
            "start": word_list[0]["start"],
            "end": word_list[0]["end"],
            "words": [word_list[0]["text"]],
        }

        for word in word_list[1:]:
            gap = word["start"] - current_chunk["end"]
            if word.get("speaker") != current_chunk["speaker"] or gap > 2000:
                chunks.append(current_chunk)
                current_chunk = {
                    "speaker": word.get("speaker"),
                    "start": word["start"],
                    "end": word["end"],
                    "words": [word["text"]],
                }
            else:
                current_chunk["end"] = word["end"]
                current_chunk["words"].append(word["text"])

        chunks.append(current_chunk)

        return "\n".join(
            f"[{c['start'] / 1000:.1f}s] Speaker {c['speaker']}: {' '.join(c['words'])}"
            for c in chunks
        )

    # Build metadata section
    metadata_parts = []
    if podcast_title:
        metadata_parts.append(f"Podcast: {podcast_title}")
    if podcast_description:
        metadata_parts.append(f"Podcast description: {podcast_description[:500]}")
    if episode_title:
        metadata_parts.append(f"Episode: {episode_title}")
    if episode_description:
        metadata_parts.append(f"Episode description: {episode_description[:500]}")

    metadata_section = (
        "\n".join(metadata_parts) if metadata_parts else "No metadata available"
    )

    prompt = f"""Analyze this podcast transcript to identify:
1. Where the actual content begins (after any intro music, jingles, or produced intros)
2. Where the actual content ends (before any outro music, credits, or ad reads)
3. The real names of the speakers, if identifiable from context

## Podcast/Episode Info
{metadata_section}

## First 5 minutes of transcript
{format_chunks(first_words)}

## Last 5 minutes of transcript
{format_chunks(last_words)}

## Instructions
- For content_start_ms: Return the timestamp (in milliseconds) where hosts actually begin speaking substantive content. Skip intro music, jingles, and produced intros, but keep all host conversation and banter.
- For content_end_ms: Return the timestamp (in milliseconds) where the main content ends. Skip outro music, end credits, and trailing ad reads. Return null if content goes to the end.
- For speaker_labels: Map speaker IDs (like "A", "B") to real names if you can identify them from the podcast/episode info or from how they introduce themselves. Use empty dict if unknown.

Return 0 for content_start_ms if content starts immediately.
Return null for content_end_ms if content goes to the end."""

    try:
        client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        response = await client.beta.messages.parse(
            model="claude-haiku-4-5-20251001",
            max_tokens=1024,
            betas=["structured-outputs-2025-11-13"],
            messages=[{"role": "user", "content": prompt}],
            output_format=TranscriptAnalysis,
        )

        return response.parsed_output

    except Exception as e:
        # Log error but don't fail the transcription
        print(f"Transcript analysis failed: {e}")
        return TranscriptAnalysis(
            content_start_ms=0,
            content_end_ms=None,
            speaker_labels={},
        )


# --- Transcription endpoints ---


@app.post("/transcribe")
async def submit_transcription(request: TranscribeRequest) -> TranscriptionJobResponse:
    """Submit a transcription job for an episode.

    If the episode has already been transcribed or is in progress, returns existing job.
    """
    # Check if already exists
    existing = db.get_transcription_by_episode(request.episode_guid)
    if existing:
        return TranscriptionJobResponse(
            id=existing["id"],
            episode_guid=existing["episode_guid"],
            status=existing["status"],
            error_message=existing["error_message"],
        )

    # Step 1: Download audio and upload to R2 for caching
    # This ensures timestamps match between transcription and playback
    try:
        print(f"Downloading and caching audio for {request.episode_guid}...")
        cached_audio_url = await storage.download_and_upload_audio(
            audio_url=request.audio_url,
            podcast_id=request.podcast_id,
            episode_guid=request.episode_guid,
        )
        print(f"Audio cached at: {cached_audio_url}")
    except Exception as e:
        print(f"Failed to cache audio: {e}")
        # Fall back to original URL if caching fails
        cached_audio_url = None

    # Step 2: Submit to AssemblyAI (use cached URL if available)
    transcribe_url = cached_audio_url or request.audio_url

    headers = {
        "authorization": ASSEMBLYAI_API_KEY,
        "content-type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{ASSEMBLYAI_BASE_URL}/transcript",
            headers=headers,
            json={
                "audio_url": transcribe_url,
                "speaker_labels": True,
            },
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to submit transcription job to AssemblyAI",
            )

        job = response.json()

    # Store in database with metadata for later analysis
    db.create_transcription(
        job_id=job["id"],
        episode_guid=request.episode_guid,
        podcast_id=request.podcast_id,
        audio_url=request.audio_url,
        cached_audio_url=cached_audio_url,
        status=job["status"],
        podcast_title=request.podcast_title,
        podcast_description=request.podcast_description,
        episode_title=request.episode_title,
        episode_description=request.episode_description,
    )

    return TranscriptionJobResponse(
        id=job["id"],
        episode_guid=request.episode_guid,
        status=job["status"],
    )


@app.get("/transcribe/{job_id}")
async def poll_transcription(job_id: str) -> TranscriptionJobResponse:
    """Poll transcription job status.

    If completed, fetches and stores the full transcript.
    """
    # Check database first
    existing = db.get_transcription_by_id(job_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Transcription job not found")

    # If already completed or errored, return from DB
    if existing["status"] in ("completed", "error"):
        return TranscriptionJobResponse(
            id=existing["id"],
            episode_guid=existing["episode_guid"],
            status=existing["status"],
            error_message=existing["error_message"],
        )

    # Poll AssemblyAI
    headers = {"authorization": ASSEMBLYAI_API_KEY}

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{ASSEMBLYAI_BASE_URL}/transcript/{job_id}",
            headers=headers,
        )

        if response.status_code != 200:
            raise HTTPException(
                status_code=502,
                detail="Failed to poll AssemblyAI",
            )

        result = response.json()

    status = result["status"]

    # Update database based on status
    if status == "completed":
        # Fetch paragraphs from AssemblyAI
        paragraphs = None
        async with httpx.AsyncClient() as client:
            para_response = await client.get(
                f"{ASSEMBLYAI_BASE_URL}/transcript/{job_id}/paragraphs",
                headers=headers,
            )
            if para_response.status_code == 200:
                para_data = para_response.json()
                # Store just start, end, text for each paragraph
                paragraphs = [
                    {"start": p["start"], "end": p["end"], "text": p["text"]}
                    for p in para_data.get("paragraphs", [])
                ]

        # Analyze transcript to find content bounds and speaker names
        analysis = await analyze_transcript(
            words=result["words"],
            audio_duration_ms=result["audio_duration"],
            podcast_title=existing.get("podcast_title"),
            podcast_description=existing.get("podcast_description"),
            episode_title=existing.get("episode_title"),
            episode_description=existing.get("episode_description"),
        )

        db.complete_transcription(
            job_id=job_id,
            audio_duration=result["audio_duration"],
            confidence=result["confidence"],
            words=result["words"],
            paragraphs=paragraphs,
            content_start_ms=analysis.content_start_ms,
            content_end_ms=analysis.content_end_ms,
            speaker_labels=analysis.speaker_labels,
        )
    elif status == "error":
        db.update_transcription_status(
            job_id=job_id,
            status="error",
            error_message=result.get("error"),
        )
    else:
        db.update_transcription_status(job_id=job_id, status=status)

    return TranscriptionJobResponse(
        id=job_id,
        episode_guid=existing["episode_guid"],
        status=status,
        error_message=result.get("error"),
    )


@app.get("/transcript/{episode_guid}")
async def get_transcript(episode_guid: str) -> TranscriptResponse:
    """Get completed transcript for an episode."""
    existing = db.get_transcription_by_episode(episode_guid)
    if not existing:
        raise HTTPException(status_code=404, detail="Transcript not found")

    if existing["status"] != "completed":
        raise HTTPException(
            status_code=404,
            detail=f"Transcript not ready (status: {existing['status']})",
        )

    # Supabase returns JSONB as Python dicts/lists directly
    words_data = existing.get("words_json") or []
    paragraphs_data = existing.get("paragraphs_json")
    content_start_ms = existing.get("content_start_ms") or 0
    content_end_ms = existing.get("content_end_ms")
    speaker_labels = existing.get("speaker_labels_json")

    # Filter words to content bounds
    filtered_words = [
        w
        for w in words_data
        if w["start"] >= content_start_ms
        and (content_end_ms is None or w["end"] <= content_end_ms)
    ]

    # Filter paragraphs to content bounds
    filtered_paragraphs = None
    if paragraphs_data:
        filtered_paragraphs = [
            TranscriptParagraph(start=p["start"], end=p["end"], text=p["text"])
            for p in paragraphs_data
            if p["start"] >= content_start_ms
            and (content_end_ms is None or p["end"] <= content_end_ms)
        ]

    # Apply speaker labels if available
    def get_speaker_name(speaker_id: str | None) -> str | None:
        if speaker_id is None:
            return None
        if speaker_labels and speaker_id in speaker_labels:
            return speaker_labels[speaker_id]
        return speaker_id

    return TranscriptResponse(
        id=existing["id"],
        episode_guid=existing["episode_guid"],
        audio_url=existing["audio_url"],
        cached_audio_url=existing.get("cached_audio_url"),
        audio_duration=existing["audio_duration"],
        confidence=existing["confidence"],
        content_start_ms=content_start_ms,
        content_end_ms=content_end_ms,
        speaker_labels=speaker_labels,
        paragraphs=filtered_paragraphs,
        words=[
            TranscriptWord(
                text=w["text"],
                start=w["start"],
                end=w["end"],
                confidence=w["confidence"],
                speaker=get_speaker_name(w.get("speaker")),
            )
            for w in filtered_words
        ],
    )


# --- Annotation endpoints ---


@app.get("/annotations")
async def get_annotations(
    user: dict = Depends(get_current_user),
    episode_guid: str | None = Query(None),
    podcast_id: int | None = Query(None),
) -> list[AnnotationResponse]:
    """Get annotations for the current user.

    Can optionally filter by episode_guid or podcast_id.
    """
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    if episode_guid:
        data = db.get_annotations_for_episode(user_id, episode_guid)
    elif podcast_id:
        data = db.get_annotations_for_podcast(user_id, podcast_id)
    else:
        data = db.get_all_annotations_for_user(user_id)

    return [AnnotationResponse(**item) for item in data]


@app.post("/annotations", status_code=201)
async def create_annotation(
    request: AnnotationCreate,
    user: dict = Depends(get_current_user),
) -> AnnotationResponse:
    """Create a new annotation."""
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    data = db.create_annotation(
        user_id=user_id,
        podcast_id=request.podcast_id,
        episode_guid=request.episode_guid,
        text=request.text,
        note=request.note,
        speaker=request.speaker,
        start_ms=request.start_ms,
    )

    return AnnotationResponse(**data)


@app.patch("/annotations/{annotation_id}")
async def update_annotation(
    annotation_id: str,
    request: AnnotationUpdate,
    user: dict = Depends(get_current_user),
) -> AnnotationResponse:
    """Update an annotation's note."""
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    data = db.update_annotation(
        annotation_id=annotation_id,
        user_id=user_id,
        note=request.note,
    )

    if not data:
        raise HTTPException(status_code=404, detail="Annotation not found")

    return AnnotationResponse(**data)


@app.delete("/annotations/{annotation_id}", status_code=204)
async def delete_annotation(
    annotation_id: str,
    user: dict = Depends(get_current_user),
) -> None:
    """Delete an annotation."""
    user_id = user.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")

    deleted = db.delete_annotation(annotation_id=annotation_id, user_id=user_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Annotation not found")


def main() -> None:
    """Entry point for `uv run backend` command."""
    uvicorn.run(
        "backend.server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
