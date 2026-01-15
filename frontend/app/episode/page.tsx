"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  PodcastEpisode,
  PodcastFeed,
  PodcastInfo,
  Transcript,
  TranscriptionJob,
} from "@/lib/types";
import { API_BASE } from "@/lib/config";
import { BookmarkPlus } from "lucide-react";
import AudioPlayer from "@/components/AudioPlayer";
import TranscriptView, { SavedAnnotation } from "@/components/Transcript";
import AnnotationSidebar from "@/components/AnnotationSidebar";

const POLL_INTERVAL = 3000; // 3 seconds

function EpisodeContent() {
  const searchParams = useSearchParams();

  // Get episode by podcast ID + guid
  const podcastId = searchParams.get("id");
  const guid = searchParams.get("guid");

  const [podcastInfo, setPodcastInfo] = useState<PodcastInfo | null>(null);
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transcription state
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [transcriptionJob, setTranscriptionJob] =
    useState<TranscriptionJob | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  // Audio sync state
  const [currentTime, setCurrentTime] = useState(0);
  const [seekToTime, setSeekToTime] = useState<number | null>(null);

  // Annotation state
  const [annotations, setAnnotations] = useState<SavedAnnotation[]>([]);
  const [showAllNotes, setShowAllNotes] = useState(false);

  // Fetch episode data
  useEffect(() => {
    if (!podcastId || !guid) {
      setError("Missing podcast ID or episode ID");
      setIsLoading(false);
      return;
    }

    const fetchEpisode = async () => {
      try {
        // First fetch podcast info
        const infoResponse = await fetch(`${API_BASE}/podcast/${podcastId}`);
        if (!infoResponse.ok) {
          throw new Error("Failed to load podcast info");
        }
        const infoData: PodcastInfo = await infoResponse.json();
        setPodcastInfo(infoData);

        // Then fetch the feed
        const feedResponse = await fetch(
          `${API_BASE}/feed?url=${encodeURIComponent(infoData.url)}`
        );
        if (!feedResponse.ok) {
          throw new Error("Failed to load podcast feed");
        }
        const feed: PodcastFeed = await feedResponse.json();

        // Find episode by guid
        const foundEpisode = feed.episodes.find((ep) => ep.guid === guid);
        if (foundEpisode) {
          setEpisode(foundEpisode);
        } else {
          setError("Episode not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchEpisode();
  }, [podcastId, guid]);

  // Check for existing transcript on load
  useEffect(() => {
    if (!guid) return;

    const checkTranscript = async () => {
      try {
        const response = await fetch(`${API_BASE}/transcript/${encodeURIComponent(guid)}`);
        if (response.ok) {
          const data = await response.json();
          setTranscript(data);
        }
      } catch {
        // No transcript yet, that's fine
      }
    };

    checkTranscript();
  }, [guid]);

  // Poll for transcription status
  useEffect(() => {
    if (!transcriptionJob || transcriptionJob.status === "completed" || transcriptionJob.status === "error") {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/transcribe/${transcriptionJob.id}`);
        if (!response.ok) throw new Error("Failed to poll status");

        const job: TranscriptionJob = await response.json();
        setTranscriptionJob(job);

        if (job.status === "completed" && guid) {
          // Fetch the full transcript
          const transcriptResponse = await fetch(
            `${API_BASE}/transcript/${encodeURIComponent(guid)}`
          );
          if (transcriptResponse.ok) {
            const data = await transcriptResponse.json();
            setTranscript(data);
          }
          setIsTranscribing(false);
        } else if (job.status === "error") {
          setTranscriptError(job.error_message || "Transcription failed");
          setIsTranscribing(false);
        }
      } catch (err) {
        console.error("Poll error:", err);
      }
    };

    const interval = setInterval(pollStatus, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [transcriptionJob, guid]);

  const handleRequestTranscription = async () => {
    if (!guid || !podcastId || !episode?.audio_url) return;

    setIsTranscribing(true);
    setTranscriptError(null);

    // Strip HTML from descriptions for cleaner LLM input
    const stripHtml = (html: string | null | undefined) => {
      if (!html) return undefined;
      return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    };

    try {
      const response = await fetch(`${API_BASE}/transcribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episode_guid: guid,
          podcast_id: parseInt(podcastId),
          audio_url: episode.audio_url,
          podcast_title: podcastInfo?.title,
          podcast_description: stripHtml(podcastInfo?.description),
          episode_title: episode.title,
          episode_description: stripHtml(episode.description),
        }),
      });

      if (!response.ok) throw new Error("Failed to start transcription");

      const job: TranscriptionJob = await response.json();
      setTranscriptionJob(job);

      // If already completed (cached), fetch transcript
      if (job.status === "completed") {
        const transcriptResponse = await fetch(
          `${API_BASE}/transcript/${encodeURIComponent(guid)}`
        );
        if (transcriptResponse.ok) {
          const data = await transcriptResponse.json();
          setTranscript(data);
        }
        setIsTranscribing(false);
      }
    } catch (err) {
      setTranscriptError(
        err instanceof Error ? err.message : "Failed to start transcription"
      );
      setIsTranscribing(false);
    }
  };

  const handleSeek = useCallback((timeMs: number) => {
    setSeekToTime(timeMs / 1000); // Convert to seconds
    // Reset after a tick to allow re-seeking to same time
    setTimeout(() => setSeekToTime(null), 100);
  }, []);

  const handleSaveAnnotation = useCallback(
    (text: string, note: string, speaker: string | null, startMs: number) => {
      const newAnnotation: SavedAnnotation = {
        id: crypto.randomUUID(),
        text,
        note,
        speaker,
        startMs,
      };
      setAnnotations((prev) => [newAnnotation, ...prev]);
    },
    []
  );

  const handleEditAnnotation = useCallback((id: string, note: string) => {
    setAnnotations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, note } : a))
    );
  }, []);

  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500">
        Loading episode...
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="text-center py-12 text-gray-500">
        {error || "Episode not found"}
      </div>
    );
  }

  const artworkUrl = episode.artwork_url || podcastInfo?.artwork;
  const podcastTitle = podcastInfo?.title;

  // Build back link with podcast ID
  const backUrl = podcastId ? `/podcast?id=${podcastId}` : "/";

  return (
    <>
      <Link
        href={backUrl}
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8"
      >
        <ArrowLeft size={20} />
        <span>Back to {podcastTitle || "podcast"}</span>
      </Link>

      <div className={`${episode.audio_url ? "pb-24" : ""}`}>
        {/* Episode header */}
        <div className="flex gap-6 mb-8">
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt={episode.title}
              className="w-40 h-40 rounded-lg object-cover flex-shrink-0 shadow-md"
            />
          )}
          <div className="flex-1">
            {podcastTitle && (
              <p className="text-sm text-gray-500 mb-2">{podcastTitle}</p>
            )}
            <h1 className="text-3xl font-serif mb-3 text-gray-900">
              {episode.title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              {episode.pub_date && (
                <span>
                  {new Date(episode.pub_date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              {episode.duration_seconds && (
                <>
                  <span>-</span>
                  <span>
                    {Math.floor(episode.duration_seconds / 60)} minutes
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Episode description */}
        {episode.description && (
          <div className="border-t border-gray-100 pt-8 mb-12">
            <h2 className="text-xl font-serif mb-4 text-gray-900">
              About this episode
            </h2>
            <div
              className="prose prose-gray max-w-none text-gray-600 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: episode.description,
              }}
            />
          </div>
        )}

        {/* Transcript section */}
        <div className="border-t border-gray-100 pt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-serif text-gray-900">Transcript</h2>
            {annotations.length > 0 && (
              <button
                onClick={() => setShowAllNotes(!showAllNotes)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  showAllNotes
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <BookmarkPlus size={16} />
                <span>
                  {annotations.length} note{annotations.length !== 1 ? "s" : ""}
                </span>
              </button>
            )}
          </div>

          {transcript ? (
            <TranscriptView
              transcript={transcript}
              currentTime={currentTime}
              onSeek={handleSeek}
              annotations={annotations}
              onSaveAnnotation={handleSaveAnnotation}
              onEditAnnotation={handleEditAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
            />
          ) : (
            <div className="py-12 text-center">
              {isTranscribing ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 mb-1">Transcribing episode...</p>
                  <p className="text-sm text-gray-400">
                    {transcriptionJob?.status || "starting"}
                  </p>
                </>
              ) : transcriptError ? (
                <>
                  <p className="text-red-600 mb-4">{transcriptError}</p>
                  <button
                    onClick={handleRequestTranscription}
                    className="text-sm text-gray-900 underline hover:no-underline"
                  >
                    Try again
                  </button>
                </>
              ) : (
                <>
                  <p className="text-gray-500 mb-4">
                    No transcript available yet.
                  </p>
                  <button
                    onClick={handleRequestTranscription}
                    disabled={!episode.audio_url}
                    className="text-sm font-medium text-gray-900 underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    Request transcription
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* All notes sidebar */}
      {showAllNotes && (
        <AnnotationSidebar
          annotations={annotations}
          onClose={() => setShowAllNotes(false)}
          onSeek={handleSeek}
          onEdit={handleEditAnnotation}
          onDelete={handleDeleteAnnotation}
        />
      )}

      {/* Audio player */}
      {/* Use cached audio URL for transcribed episodes (ensures timestamp sync) */}
      {episode.audio_url && (
        <AudioPlayer
          audioUrl={transcript?.cached_audio_url || episode.audio_url}
          episodeTitle={episode.title}
          podcastTitle={podcastTitle || undefined}
          onTimeUpdate={setCurrentTime}
          seekTo={seekToTime}
        />
      )}
    </>
  );
}

export default function EpisodePage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <Suspense
          fallback={
            <div className="text-center py-12 text-gray-500">Loading...</div>
          }
        >
          <EpisodeContent />
        </Suspense>
      </div>
    </div>
  );
}
