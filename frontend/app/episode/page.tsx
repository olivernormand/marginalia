"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PodcastEpisode, PodcastFeed, PodcastInfo } from "@/lib/types";
import { API_BASE } from "@/lib/config";
import AudioPlayer from "@/components/AudioPlayer";

function EpisodeContent() {
  const searchParams = useSearchParams();

  // Get episode by podcast ID + guid
  const podcastId = searchParams.get("id");
  const guid = searchParams.get("guid");

  const [podcastInfo, setPodcastInfo] = useState<PodcastInfo | null>(null);
  const [episode, setEpisode] = useState<PodcastEpisode | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        {/* Episode description - full, not truncated */}
        {episode.description && (
          <div className="border-t border-gray-100 pt-6 mb-8">
            <h2 className="text-lg font-serif mb-4 text-gray-900">
              About this episode
            </h2>
            <div
              className="prose prose-gray max-w-none text-gray-600"
              dangerouslySetInnerHTML={{
                __html: episode.description,
              }}
            />
          </div>
        )}

        {/* Transcript placeholder */}
        <div className="border-t border-gray-100 pt-6">
          <h2 className="text-lg font-serif mb-4 text-gray-900">Transcript</h2>
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500 mb-4">
              Transcript not yet available for this episode.
            </p>
            <button
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              disabled
            >
              Request Transcription
            </button>
            <p className="text-xs text-gray-400 mt-2">
              Coming soon in Phase 2
            </p>
          </div>
        </div>
      </div>

      {/* Audio player */}
      {episode.audio_url && (
        <AudioPlayer
          audioUrl={episode.audio_url}
          episodeTitle={episode.title}
          podcastTitle={podcastTitle || undefined}
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
