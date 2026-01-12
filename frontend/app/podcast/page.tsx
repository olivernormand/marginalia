"use client";

import { Suspense, useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PodcastFeed, PodcastEpisode } from "@/lib/types";
import EpisodeCard from "@/components/EpisodeCard";
import AudioPlayer from "@/components/AudioPlayer";

const API_BASE = "http://localhost:8000";
const EPISODES_PER_BATCH = 20;

function PodcastContent() {
  const searchParams = useSearchParams();
  const feedUrl = searchParams.get("feedUrl");
  const podcastName = searchParams.get("name");
  const artworkUrl = searchParams.get("artwork");

  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState<PodcastEpisode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visibleCount, setVisibleCount] = useState(EPISODES_PER_BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!feedUrl) {
      setError("No feed URL provided");
      setIsLoading(false);
      return;
    }

    const fetchFeed = async () => {
      try {
        const response = await fetch(
          `${API_BASE}/feed?url=${encodeURIComponent(feedUrl)}`
        );
        if (!response.ok) {
          throw new Error("Failed to load podcast feed");
        }
        const data = await response.json();
        setFeed(data);
        setVisibleCount(EPISODES_PER_BATCH); // Reset for new feed
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, [feedUrl]);

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!feed || visibleCount >= feed.episodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + EPISODES_PER_BATCH, feed.episodes.length)
          );
        }
      },
      { rootMargin: "200px" } // Load more before reaching the very bottom
    );

    const sentinel = sentinelRef.current;
    if (sentinel) {
      observer.observe(sentinel);
    }

    return () => {
      if (sentinel) {
        observer.unobserve(sentinel);
      }
    };
  }, [feed, visibleCount]);

  const handleEpisodePlay = (episode: PodcastEpisode) => {
    if (currentEpisode?.guid === episode.guid && isPlaying) {
      setIsPlaying(false);
    } else {
      setCurrentEpisode(episode);
      setIsPlaying(true);
    }
  };

  const handlePlayerClose = () => {
    setCurrentEpisode(null);
    setIsPlaying(false);
  };

  return (
    <>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8"
      >
        <ArrowLeft size={20} />
        <span>Back to search</span>
      </Link>

      {isLoading && (
        <div className="text-center py-12 text-gray-500">
          Loading podcast...
        </div>
      )}

      {error && (
        <div className="text-center py-12 text-red-500">{error}</div>
      )}

      {!isLoading && feed && (
        <>
          <div className="flex gap-6 mb-8">
            {(feed.artwork_url || artworkUrl) && (
              <img
                src={feed.artwork_url || artworkUrl || undefined}
                alt={feed.title}
                className="w-32 h-32 rounded-lg object-cover flex-shrink-0 shadow-md"
              />
            )}
            <div className="flex-1">
              <h1 className="text-4xl font-serif mb-2 text-gray-900">
                {feed.title || podcastName}
              </h1>
              {feed.author && (
                <p className="text-gray-500 mb-3">{feed.author}</p>
              )}
              {feed.description && (
                <p className="text-sm text-gray-600 line-clamp-3">
                  {feed.description}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-xl font-serif mb-4 text-gray-900">
              Episodes ({feed.episodes.length})
            </h2>
            <div className={`space-y-2 ${currentEpisode ? "pb-24" : ""}`}>
              {feed.episodes.slice(0, visibleCount).map((episode, index) => (
                <EpisodeCard
                  key={episode.guid || index}
                  episode={episode}
                  index={index}
                  isPlaying={isPlaying}
                  isCurrentEpisode={currentEpisode?.guid === episode.guid}
                  onPlay={handleEpisodePlay}
                  podcastArtwork={feed.artwork_url || artworkUrl}
                />
              ))}
              {/* Sentinel for infinite scroll */}
              {visibleCount < feed.episodes.length && (
                <div
                  ref={sentinelRef}
                  className="py-4 text-center text-gray-400 text-sm"
                >
                  Loading more episodes...
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {currentEpisode && currentEpisode.audio_url && (
        <AudioPlayer
          audioUrl={currentEpisode.audio_url}
          episodeTitle={currentEpisode.title}
          podcastTitle={feed?.title}
          onClose={handlePlayerClose}
          onPlayingChange={setIsPlaying}
        />
      )}
    </>
  );
}

export default function PodcastPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <Suspense fallback={<div className="text-center py-12 text-gray-500">Loading...</div>}>
          <PodcastContent />
        </Suspense>
      </div>
    </div>
  );
}
