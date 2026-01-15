"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, FileText, AlertCircle } from "lucide-react";
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
import { EpisodeHeaderSkeleton, TranscriptSkeleton } from "@/components/Skeleton";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

const POLL_INTERVAL = 3000; // 3 seconds

function EpisodeContent() {
  const searchParams = useSearchParams();
  const { session } = useAuth();

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

  // Ref for scrolling to current transcript position
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Follow mode: auto-scroll transcript with audio until user manually scrolls
  const [isFollowMode, setIsFollowMode] = useState(false);
  const isScrollingProgrammatically = useRef(false);
  const lastActiveElement = useRef<Element | null>(null);

  // Load annotations from backend when transcript is available
  useEffect(() => {
    if (!guid || !session?.access_token || !transcript) return;

    const loadAnnotations = async () => {
      try {
        const backendAnnotations = await api.getAnnotations(
          session.access_token,
          guid
        );
        // Map backend format to frontend SavedAnnotation format
        setAnnotations(
          backendAnnotations.map((a) => ({
            id: a.id,
            text: a.text,
            note: a.note,
            speaker: a.speaker,
            startMs: a.start_ms,
          }))
        );
      } catch (err) {
        console.error("Failed to load annotations:", err);
      }
    };

    loadAnnotations();
  }, [guid, session?.access_token, transcript]);

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
    async (text: string, note: string, speaker: string | null, startMs: number) => {
      // Optimistically add to UI
      const tempId = crypto.randomUUID();
      const newAnnotation: SavedAnnotation = {
        id: tempId,
        text,
        note,
        speaker,
        startMs,
      };
      setAnnotations((prev) => [newAnnotation, ...prev]);

      // Persist to backend if logged in
      if (session?.access_token && podcastId && guid) {
        try {
          const saved = await api.createAnnotation(session.access_token, {
            podcast_id: parseInt(podcastId),
            episode_guid: guid,
            text,
            note,
            speaker,
            start_ms: startMs,
          });
          // Update with real ID from backend
          setAnnotations((prev) =>
            prev.map((a) =>
              a.id === tempId ? { ...a, id: saved.id } : a
            )
          );
        } catch (err) {
          console.error("Failed to save annotation:", err);
          // Could show a toast here, but annotation stays in UI
        }
      }
    },
    [session?.access_token, podcastId, guid]
  );

  const handleEditAnnotation = useCallback(
    async (id: string, note: string) => {
      // Optimistically update UI
      setAnnotations((prev) =>
        prev.map((a) => (a.id === id ? { ...a, note } : a))
      );

      // Persist to backend if logged in
      if (session?.access_token) {
        try {
          await api.updateAnnotation(session.access_token, id, note);
        } catch (err) {
          console.error("Failed to update annotation:", err);
        }
      }
    },
    [session?.access_token]
  );

  const handleDeleteAnnotation = useCallback(
    async (id: string) => {
      // Optimistically remove from UI
      setAnnotations((prev) => prev.filter((a) => a.id !== id));

      // Delete from backend if logged in
      if (session?.access_token) {
        try {
          await api.deleteAnnotation(session.access_token, id);
        } catch (err) {
          console.error("Failed to delete annotation:", err);
        }
      }
    },
    [session?.access_token]
  );

  const scrollToActive = useCallback((enableFollow = false) => {
    if (!transcriptRef.current) return;
    if (enableFollow) setIsFollowMode(true);

    const activeElement = transcriptRef.current.querySelector("[data-active='true']");
    if (activeElement) {
      isScrollingProgrammatically.current = true;
      lastActiveElement.current = activeElement;
      activeElement.scrollIntoView({ behavior: "smooth", block: "center" });
      // Reset flag after scroll animation completes
      setTimeout(() => {
        isScrollingProgrammatically.current = false;
      }, 1000);
    }
  }, []);

  const handleJumpToTranscript = useCallback(() => {
    scrollToActive(true);
  }, [scrollToActive]);

  // Auto-scroll when in follow mode and the active element changes
  useEffect(() => {
    if (!isFollowMode || !transcriptRef.current) return;

    const activeElement = transcriptRef.current.querySelector("[data-active='true']");
    // Only scroll if the active element has actually changed
    if (activeElement && activeElement !== lastActiveElement.current) {
      scrollToActive();
    }
  }, [isFollowMode, currentTime, scrollToActive]);

  // Detect manual scroll to disable follow mode
  useEffect(() => {
    if (!isFollowMode) return;

    const handleScroll = () => {
      if (!isScrollingProgrammatically.current) {
        setIsFollowMode(false);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isFollowMode]);

  if (isLoading) {
    return (
      <div className="animate-in fade-in duration-300">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-8" />
        <EpisodeHeaderSkeleton />
        <div className="border-t border-gray-100 pt-8 mt-8">
          <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-6" />
          <TranscriptSkeleton />
        </div>
      </div>
    );
  }

  if (error || !episode) {
    return (
      <div className="text-center py-16 animate-in fade-in duration-300">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <p className="text-gray-900 font-medium mb-1">
          {error || "Episode not found"}
        </p>
        <p className="text-gray-500 text-sm mb-4">
          We couldn&apos;t load this episode
        </p>
        <Link
          href="/"
          className="text-sm text-gray-900 underline hover:no-underline"
        >
          Go back home
        </Link>
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
            <div ref={transcriptRef} className="animate-in fade-in duration-300">
              <TranscriptView
                transcript={transcript}
                currentTime={currentTime}
                onSeek={handleSeek}
                annotations={annotations}
                onSaveAnnotation={handleSaveAnnotation}
                onEditAnnotation={handleEditAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            </div>
          ) : (
            <div className="py-16 text-center animate-in fade-in duration-300">
              {isTranscribing ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-600" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium mb-1">Transcribing episode...</p>
                    <p className="text-sm text-gray-500">
                      {transcriptionJob?.status === "queued" && "Waiting in queue"}
                      {transcriptionJob?.status === "processing" && "Processing audio"}
                      {!transcriptionJob?.status && "Starting transcription"}
                    </p>
                  </div>
                </div>
              ) : transcriptError ? (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle size={24} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium mb-1">Transcription failed</p>
                    <p className="text-sm text-gray-500 mb-4">{transcriptError}</p>
                    <button
                      onClick={handleRequestTranscription}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
                    <FileText size={24} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium mb-1">No transcript yet</p>
                    <p className="text-sm text-gray-500 mb-4">
                      Generate a transcript to read along as you listen
                    </p>
                    <button
                      onClick={handleRequestTranscription}
                      disabled={!episode.audio_url}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Generate transcript
                    </button>
                  </div>
                </div>
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
          onJumpToTranscript={transcript ? handleJumpToTranscript : undefined}
          isFollowingTranscript={isFollowMode}
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
            <div className="animate-in fade-in duration-300">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse mb-8" />
              <EpisodeHeaderSkeleton />
            </div>
          }
        >
          <EpisodeContent />
        </Suspense>
      </div>
    </div>
  );
}
