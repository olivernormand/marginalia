"""SQLite database for storing transcription jobs and results."""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

# Database file location
DB_PATH = Path(__file__).parent.parent.parent / "data" / "marginalia.db"


def get_connection() -> sqlite3.Connection:
    """Get a database connection."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize the database schema."""
    conn = get_connection()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transcriptions (
            id TEXT PRIMARY KEY,
            episode_guid TEXT NOT NULL UNIQUE,
            podcast_id INTEGER NOT NULL,
            audio_url TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            audio_duration INTEGER,
            confidence REAL,
            words_json TEXT,
            paragraphs_json TEXT,
            content_start_ms INTEGER DEFAULT 0,
            content_end_ms INTEGER,
            speaker_labels_json TEXT,
            podcast_title TEXT,
            podcast_description TEXT,
            episode_title TEXT,
            episode_description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def get_transcription_by_episode(episode_guid: str) -> dict | None:
    """Get transcription by episode GUID."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM transcriptions WHERE episode_guid = ?",
        (episode_guid,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def get_transcription_by_id(job_id: str) -> dict | None:
    """Get transcription by job ID."""
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM transcriptions WHERE id = ?",
        (job_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def create_transcription(
    job_id: str,
    episode_guid: str,
    podcast_id: int,
    audio_url: str,
    status: str,
    podcast_title: str | None = None,
    podcast_description: str | None = None,
    episode_title: str | None = None,
    episode_description: str | None = None,
) -> None:
    """Create a new transcription job record."""
    conn = get_connection()
    conn.execute(
        """
        INSERT INTO transcriptions (
            id, episode_guid, podcast_id, audio_url, status,
            podcast_title, podcast_description, episode_title, episode_description
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            job_id, episode_guid, podcast_id, audio_url, status,
            podcast_title, podcast_description, episode_title, episode_description,
        ),
    )
    conn.commit()
    conn.close()


def update_transcription_status(
    job_id: str,
    status: str,
    error_message: str | None = None,
) -> None:
    """Update transcription job status."""
    conn = get_connection()
    conn.execute(
        """
        UPDATE transcriptions
        SET status = ?, error_message = ?
        WHERE id = ?
        """,
        (status, error_message, job_id),
    )
    conn.commit()
    conn.close()


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
    conn = get_connection()
    conn.execute(
        """
        UPDATE transcriptions
        SET status = 'completed',
            audio_duration = ?,
            confidence = ?,
            words_json = ?,
            paragraphs_json = ?,
            content_start_ms = ?,
            content_end_ms = ?,
            speaker_labels_json = ?,
            completed_at = ?
        WHERE id = ?
        """,
        (
            audio_duration,
            confidence,
            json.dumps(words),
            json.dumps(paragraphs) if paragraphs else None,
            content_start_ms,
            content_end_ms,
            json.dumps(speaker_labels) if speaker_labels else None,
            datetime.now(),
            job_id,
        ),
    )
    conn.commit()
    conn.close()


# Initialize database on module import
init_db()
