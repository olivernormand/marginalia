"""Cloudflare R2 storage utilities for caching podcast audio files."""

import os
from urllib.parse import urlparse

import boto3
import httpx

# R2 configuration from environment
R2_ACCESS_KEY_ID = os.environ.get("CLOUDFLARE_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("CLOUDFLARE_SECRET_ACCESS_KEY")
R2_ENDPOINT = os.environ.get("CLOUDFLARE_ENDPOINT")
R2_BUCKET_NAME = os.environ.get("CLOUDFLARE_BUCKET_NAME", "podcasts")
R2_PUBLIC_URL = os.environ.get("CLOUDFLARE_R2_PUBLIC_URL")  # e.g. https://pub-xxx.r2.dev


def get_r2_client():
    """Get a boto3 S3 client configured for Cloudflare R2."""
    if not all([R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT]):
        raise ValueError("R2 credentials not configured. Check environment variables.")

    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=R2_ENDPOINT,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 3},
        ),
    )


def get_file_extension(url: str, content_type: str | None = None) -> str:
    """Determine file extension from URL or content type."""
    # Try to get from URL path
    path = urlparse(url).path
    if "." in path:
        ext = path.rsplit(".", 1)[-1].lower()
        if ext in ("mp3", "m4a", "wav", "ogg", "aac"):
            return ext

    # Fall back to content type
    if content_type:
        type_map = {
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/mp4": "m4a",
            "audio/x-m4a": "m4a",
            "audio/wav": "wav",
            "audio/ogg": "ogg",
            "audio/aac": "aac",
        }
        return type_map.get(content_type, "mp3")

    return "mp3"  # Default to mp3


async def download_and_upload_audio(
    audio_url: str,
    podcast_id: int,
    episode_guid: str,
) -> str:
    """Download audio from URL and upload to R2.

    Args:
        audio_url: Original podcast audio URL
        podcast_id: Podcast ID for folder structure
        episode_guid: Episode GUID for filename

    Returns:
        Public URL of the cached audio file in R2
    """
    # Download the audio file
    async with httpx.AsyncClient(follow_redirects=True, timeout=300.0) as client:
        response = await client.get(audio_url)
        response.raise_for_status()

        content_type = response.headers.get("content-type")
        audio_data = response.content

    # Determine file extension
    ext = get_file_extension(audio_url, content_type)

    # Clean episode_guid for use in filename (remove special chars)
    safe_guid = "".join(c if c.isalnum() or c in "-_" else "_" for c in episode_guid)

    # Build R2 key: {podcast_id}/{episode_guid}.{ext}
    r2_key = f"{podcast_id}/{safe_guid}.{ext}"

    # Upload to R2
    r2_client = get_r2_client()
    r2_client.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=r2_key,
        Body=audio_data,
        ContentType=content_type or "audio/mpeg",
    )

    # Build public URL using the R2.dev public URL
    if not R2_PUBLIC_URL:
        raise ValueError("CLOUDFLARE_R2_PUBLIC_URL not configured")

    public_url = f"{R2_PUBLIC_URL.rstrip('/')}/{r2_key}"

    return public_url


def get_cached_audio_url(podcast_id: int, episode_guid: str, ext: str = "mp3") -> str:
    """Construct the R2 URL for a cached audio file (without checking if it exists)."""
    safe_guid = "".join(c if c.isalnum() or c in "-_" else "_" for c in episode_guid)
    r2_key = f"{podcast_id}/{safe_guid}.{ext}"
    return f"{R2_PUBLIC_URL.rstrip('/')}/{r2_key}"
