"""Supabase database for storing transcription jobs and annotations."""

import os
from datetime import datetime, timezone
from supabase import create_client, Client

# Supabase client (uses private/service key for backend operations)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_PRIVATE_KEY = os.environ.get("SUPABASE_PRIVATE_KEY", "")

_supabase: Client | None = None


def get_supabase() -> Client:
    """Get the Supabase client (singleton)."""
    global _supabase
    if _supabase is None:
        if not SUPABASE_URL or not SUPABASE_PRIVATE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_PRIVATE_KEY must be set in environment"
            )
        _supabase = create_client(SUPABASE_URL, SUPABASE_PRIVATE_KEY)
    return _supabase


# ============================================
# TRANSCRIPTION FUNCTIONS
# ============================================


def get_transcription_by_episode(episode_guid: str) -> dict | None:
    """Get transcription by episode GUID."""
    supabase = get_supabase()
    result = (
        supabase.table("transcriptions")
        .select("*")
        .eq("episode_guid", episode_guid)
        .limit(1)
        .execute()
    )
    if result and result.data:
        return result.data[0]
    return None


def get_transcription_by_id(job_id: str) -> dict | None:
    """Get transcription by job ID."""
    supabase = get_supabase()
    result = (
        supabase.table("transcriptions")
        .select("*")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    if result and result.data:
        return result.data[0]
    return None


def create_transcription(
    job_id: str,
    episode_guid: str,
    podcast_id: int,
    audio_url: str,
    status: str,
    cached_audio_url: str | None = None,
    podcast_title: str | None = None,
    podcast_description: str | None = None,
    episode_title: str | None = None,
    episode_description: str | None = None,
    artwork_url: str | None = None,
    episode_duration_seconds: int | None = None,
) -> None:
    """Create a new transcription job record."""
    supabase = get_supabase()
    supabase.table("transcriptions").insert(
        {
            "id": job_id,
            "episode_guid": episode_guid,
            "podcast_id": podcast_id,
            "audio_url": audio_url,
            "cached_audio_url": cached_audio_url,
            "status": status,
            "podcast_title": podcast_title,
            "podcast_description": podcast_description,
            "episode_title": episode_title,
            "episode_description": episode_description,
            "artwork_url": artwork_url,
            "episode_duration_seconds": episode_duration_seconds,
        }
    ).execute()


def update_transcription_status(
    job_id: str,
    status: str,
    error_message: str | None = None,
) -> None:
    """Update transcription job status."""
    supabase = get_supabase()
    supabase.table("transcriptions").update(
        {
            "status": status,
            "error_message": error_message,
        }
    ).eq("id", job_id).execute()


def complete_transcription(
    job_id: str,
    audio_duration: int,
    confidence: float,
    words: list[dict],
    paragraphs: list[dict] | None = None,
    content_start_ms: int = 0,
    content_end_ms: int | None = None,
    speaker_labels: dict[str, str] | None = None,
) -> None:
    """Mark transcription as completed and store results."""
    supabase = get_supabase()
    supabase.table("transcriptions").update(
        {
            "status": "completed",
            "audio_duration": audio_duration,
            "confidence": confidence,
            "words_json": words,  # Supabase handles JSONB natively
            "paragraphs_json": paragraphs,
            "content_start_ms": content_start_ms,
            "content_end_ms": content_end_ms,
            "speaker_labels_json": speaker_labels,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
    ).eq("id", job_id).execute()


# ============================================
# ANNOTATION FUNCTIONS
# ============================================


def get_annotations_for_episode(user_id: str, episode_guid: str) -> list[dict]:
    """Get all annotations for a user on an episode."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .select("*")
        .eq("user_id", user_id)
        .eq("episode_guid", episode_guid)
        .order("start_ms")
        .execute()
    )
    return result.data or []


def get_annotations_for_podcast(user_id: str, podcast_id: int) -> list[dict]:
    """Get all annotations for a user on a podcast."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .select("*")
        .eq("user_id", user_id)
        .eq("podcast_id", podcast_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_all_annotations_for_user(user_id: str) -> list[dict]:
    """Get all annotations for a user."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def create_annotation(
    user_id: str,
    podcast_id: int,
    episode_guid: str,
    text: str,
    note: str,
    start_ms: int,
    speaker: str | None = None,
) -> dict:
    """Create a new annotation."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .insert(
            {
                "user_id": user_id,
                "podcast_id": podcast_id,
                "episode_guid": episode_guid,
                "text": text,
                "note": note,
                "speaker": speaker,
                "start_ms": start_ms,
            }
        )
        .execute()
    )
    return result.data[0] if result.data else {}


def update_annotation(
    annotation_id: str,
    user_id: str,
    note: str,
) -> dict | None:
    """Update an annotation's note (user_id for safety check)."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .update({"note": note})
        .eq("id", annotation_id)
        .eq("user_id", user_id)  # Ensures user owns this annotation
        .execute()
    )
    return result.data[0] if result.data else None


def delete_annotation(annotation_id: str, user_id: str) -> bool:
    """Delete an annotation (user_id for safety check)."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .delete()
        .eq("id", annotation_id)
        .eq("user_id", user_id)  # Ensures user owns this annotation
        .execute()
    )
    return len(result.data) > 0 if result.data else False


def get_unsynced_annotations(user_id: str) -> list[dict]:
    """Get annotations not yet synced to Readwise."""
    supabase = get_supabase()
    result = (
        supabase.table("annotations")
        .select("*")
        .eq("user_id", user_id)
        .eq("synced_to_readwise", False)
        .order("created_at")
        .execute()
    )
    return result.data or []


def mark_annotations_synced(annotation_ids: list[str]) -> None:
    """Mark annotations as synced to Readwise."""
    if not annotation_ids:
        return
    supabase = get_supabase()
    supabase.table("annotations").update(
        {
            "synced_to_readwise": True,
            "last_synced_at": datetime.now(timezone.utc).isoformat(),
        }
    ).in_("id", annotation_ids).execute()


# ============================================
# SUBSCRIPTION FUNCTIONS
# ============================================


def get_subscriptions(user_id: str) -> list[dict]:
    """Get all subscriptions for a user."""
    supabase = get_supabase()
    result = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_subscription(user_id: str, podcast_id: int) -> dict | None:
    """Check if user is subscribed to a podcast."""
    supabase = get_supabase()
    result = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .eq("podcast_id", podcast_id)
        .limit(1)
        .execute()
    )
    if result and result.data:
        return result.data[0]
    return None


def upsert_subscription(
    user_id: str,
    podcast_id: int,
    podcast_title: str,
    feed_url: str,
    podcast_author: str | None = None,
    artwork_url: str | None = None,
) -> dict:
    """Subscribe to a podcast (upsert - insert or return existing)."""
    supabase = get_supabase()
    result = (
        supabase.table("subscriptions")
        .upsert(
            {
                "user_id": user_id,
                "podcast_id": podcast_id,
                "podcast_title": podcast_title,
                "podcast_author": podcast_author,
                "artwork_url": artwork_url,
                "feed_url": feed_url,
            },
            on_conflict="user_id,podcast_id",
        )
        .execute()
    )
    return result.data[0] if result.data else {}


def delete_subscription(user_id: str, podcast_id: int) -> bool:
    """Unsubscribe from a podcast."""
    supabase = get_supabase()
    result = (
        supabase.table("subscriptions")
        .delete()
        .eq("user_id", user_id)
        .eq("podcast_id", podcast_id)
        .execute()
    )
    return len(result.data) > 0 if result.data else False


# ============================================
# SAVED EPISODES FUNCTIONS
# ============================================


def get_saved_episodes(user_id: str) -> list[dict]:
    """Get all saved episodes for a user."""
    supabase = get_supabase()
    result = (
        supabase.table("saved_episodes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


def get_saved_episode(user_id: str, episode_guid: str) -> dict | None:
    """Check if user has saved an episode."""
    supabase = get_supabase()
    result = (
        supabase.table("saved_episodes")
        .select("*")
        .eq("user_id", user_id)
        .eq("episode_guid", episode_guid)
        .limit(1)
        .execute()
    )
    if result and result.data:
        return result.data[0]
    return None


def upsert_saved_episode(
    user_id: str,
    podcast_id: int,
    episode_guid: str,
    episode_title: str,
    podcast_title: str | None = None,
    artwork_url: str | None = None,
    audio_url: str | None = None,
    pub_date: str | None = None,
    duration_seconds: int | None = None,
) -> dict:
    """Save an episode (upsert - insert or return existing)."""
    supabase = get_supabase()
    result = (
        supabase.table("saved_episodes")
        .upsert(
            {
                "user_id": user_id,
                "podcast_id": podcast_id,
                "episode_guid": episode_guid,
                "episode_title": episode_title,
                "podcast_title": podcast_title,
                "artwork_url": artwork_url,
                "audio_url": audio_url,
                "pub_date": pub_date,
                "duration_seconds": duration_seconds,
            },
            on_conflict="user_id,episode_guid",
        )
        .execute()
    )
    return result.data[0] if result.data else {}


def delete_saved_episode(user_id: str, episode_guid: str) -> bool:
    """Remove a saved episode."""
    supabase = get_supabase()
    result = (
        supabase.table("saved_episodes")
        .delete()
        .eq("user_id", user_id)
        .eq("episode_guid", episode_guid)
        .execute()
    )
    return len(result.data) > 0 if result.data else False


# ============================================
# TRANSCRIPTION LIST FUNCTIONS
# ============================================


def get_all_transcripts() -> list[dict]:
    """Get all completed transcripts in the system."""
    supabase = get_supabase()
    result = (
        supabase.table("transcriptions")
        .select("id, episode_guid, podcast_id, podcast_title, episode_title, audio_duration, episode_duration_seconds, completed_at, artwork_url")
        .eq("status", "completed")
        .order("completed_at", desc=True)
        .execute()
    )
    return result.data or []
