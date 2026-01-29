"""Background worker for polling AssemblyAI transcription jobs.

This module provides a TranscriptionWorker class that manages background polling
of AssemblyAI transcription jobs with:
- Concurrency control via semaphore (default: 3 concurrent jobs)
- Exponential backoff polling (5s → 30s)
- Timeout protection (6 hours max)
- Duplicate job prevention
"""

import asyncio
import logging
import time
from typing import Callable, Awaitable

import httpx

logger = logging.getLogger(__name__)

# Configuration
MAX_CONCURRENT_TRANSCRIPTIONS = 3
INITIAL_POLL_INTERVAL = 5  # seconds
MAX_POLL_INTERVAL = 30  # seconds
POLL_BACKOFF_FACTOR = 1.5
MAX_POLLING_DURATION = 6 * 60 * 60  # 6 hours in seconds

ASSEMBLYAI_BASE_URL = "https://api.assemblyai.com/v2"


class TranscriptionWorker:
    """Manages background transcription polling with concurrency control.

    Usage:
        worker = TranscriptionWorker(
            assemblyai_api_key="...",
            on_complete=handle_complete,
            on_error=handle_error,
        )
        await worker.start_polling(job_id, episode_guid, metadata)
    """

    def __init__(
        self,
        assemblyai_api_key: str,
        on_complete: Callable[[str, dict], Awaitable[None]],
        on_error: Callable[[str, str], Awaitable[None]],
        on_status_update: Callable[[str, str], Awaitable[None]] | None = None,
    ):
        """Initialize the worker.

        Args:
            assemblyai_api_key: API key for AssemblyAI
            on_complete: Async callback when transcription completes.
                         Called with (job_id, data) where data contains
                         'result', 'paragraphs', and 'metadata'.
            on_error: Async callback when transcription fails.
                      Called with (job_id, error_message).
            on_status_update: Optional async callback when status changes.
                              Called with (job_id, new_status) for intermediate
                              status updates (e.g., queued -> processing).
        """
        self.api_key = assemblyai_api_key
        self.on_complete = on_complete
        self.on_error = on_error
        self.on_status_update = on_status_update
        self._semaphore = asyncio.Semaphore(MAX_CONCURRENT_TRANSCRIPTIONS)
        self._active_jobs: set[str] = set()
        self._last_status: dict[str, str] = {}  # Track last known status per job
        self._lock = asyncio.Lock()

    async def start_polling(
        self,
        job_id: str,
        episode_guid: str,
        metadata: dict,
    ) -> bool:
        """Start polling for a transcription job.

        Args:
            job_id: AssemblyAI job ID
            episode_guid: Episode identifier
            metadata: Dict with podcast_title, episode_title, etc. for analysis

        Returns:
            True if polling started, False if job is already being polled.
        """
        async with self._lock:
            if job_id in self._active_jobs:
                logger.debug(f"Job {job_id} is already being polled")
                return False
            self._active_jobs.add(job_id)

        # Start polling in background (don't await)
        asyncio.create_task(self._poll_job(job_id, episode_guid, metadata))
        logger.info(f"Started polling job {job_id} for episode {episode_guid}")
        return True

    async def _poll_job(
        self,
        job_id: str,
        episode_guid: str,
        metadata: dict,
    ) -> None:
        """Poll a single transcription job until completion."""
        start_time = time.monotonic()
        poll_interval = INITIAL_POLL_INTERVAL

        async with self._semaphore:
            logger.info(f"Job {job_id} acquired semaphore, starting poll loop")

            try:
                while True:
                    # Check timeout
                    elapsed = time.monotonic() - start_time
                    if elapsed > MAX_POLLING_DURATION:
                        logger.warning(f"Job {job_id} timed out after {elapsed:.0f}s")
                        await self.on_error(job_id, "Transcription timed out after 6 hours")
                        break

                    # Check status
                    try:
                        status, result = await self._check_status(job_id)
                    except Exception as e:
                        logger.error(f"Job {job_id} status check failed: {e}")
                        # Retry with backoff instead of giving up
                        await asyncio.sleep(poll_interval)
                        poll_interval = min(poll_interval * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL)
                        continue

                    if status == "completed":
                        logger.info(f"Job {job_id} completed after {elapsed:.1f}s")
                        paragraphs = await self._fetch_paragraphs(job_id)
                        await self.on_complete(job_id, {
                            "result": result,
                            "paragraphs": paragraphs,
                            "metadata": metadata,
                        })
                        break
                    elif status == "error":
                        error_msg = result.get("error", "Unknown error from AssemblyAI")
                        logger.error(f"Job {job_id} failed: {error_msg}")
                        await self.on_error(job_id, error_msg)
                        break
                    else:
                        # Still processing (queued/processing)
                        # Update DB if status changed (e.g., queued -> processing)
                        if self.on_status_update and self._last_status.get(job_id) != status:
                            logger.info(f"Job {job_id} status changed to: {status}")
                            await self.on_status_update(job_id, status)
                            self._last_status[job_id] = status

                        logger.debug(f"Job {job_id} status: {status}, waiting {poll_interval:.1f}s")
                        await asyncio.sleep(poll_interval)
                        poll_interval = min(poll_interval * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL)

            finally:
                async with self._lock:
                    self._active_jobs.discard(job_id)
                    self._last_status.pop(job_id, None)  # Clean up status tracking
                logger.info(f"Job {job_id} removed from active jobs")

    async def _check_status(self, job_id: str) -> tuple[str, dict]:
        """Check transcription status from AssemblyAI.

        Returns:
            Tuple of (status, full_result_dict)

        Raises:
            Exception if API call fails after retries.
        """
        max_retries = 3
        last_error = None

        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(
                        f"{ASSEMBLYAI_BASE_URL}/transcript/{job_id}",
                        headers={"authorization": self.api_key},
                    )
                    if response.status_code != 200:
                        raise Exception(f"AssemblyAI returned {response.status_code}")
                    result = response.json()
                    return result["status"], result
            except Exception as e:
                last_error = e
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

        raise last_error or Exception("Unknown error checking status")

    async def _fetch_paragraphs(self, job_id: str) -> list[dict] | None:
        """Fetch paragraph data for completed transcript.

        Returns:
            List of paragraph dicts with start, end, text, or None if fetch fails.
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{ASSEMBLYAI_BASE_URL}/transcript/{job_id}/paragraphs",
                    headers={"authorization": self.api_key},
                )
                if response.status_code == 200:
                    para_data = response.json()
                    return [
                        {"start": p["start"], "end": p["end"], "text": p["text"]}
                        for p in para_data.get("paragraphs", [])
                    ]
        except Exception as e:
            logger.warning(f"Failed to fetch paragraphs for job {job_id}: {e}")
        return None

    def is_job_active(self, job_id: str) -> bool:
        """Check if a job is currently being polled."""
        return job_id in self._active_jobs

    @property
    def active_job_count(self) -> int:
        """Number of jobs currently being polled."""
        return len(self._active_jobs)
