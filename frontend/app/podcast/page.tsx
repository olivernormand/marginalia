"use client";

import { Suspense, useEffect, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Search, AlertCircle, Plus, Check } from "lucide-react";
import Link from "next/link";
import { PodcastFeed, PodcastEpisode, PodcastInfo } from "@/lib/types";
import { API_BASE } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import * as api from "@/lib/api";
import EpisodeCard from "@/components/EpisodeCard";
import { Skeleton, EpisodeCardSkeleton } from "@/components/Skeleton";
const EPISODES_PER_BATCH = 20;

function PodcastContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { session } = useAuth();
  const { nowPlaying, isPlaying, playEpisode, pause } = useAudioPlayer();
  const podcastId = searchParams.get("id");

  const [podcastInfo, setPodcastInfo] = useState<PodcastInfo | null>(null);
  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(EPISODES_PER_BATCH);
  const [episodeSearch, setEpisodeSearch] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Subscription state
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  // Saved episodes state - track guids of saved episodes
  const [savedEpisodeGuids, setSavedEpisodeGuids] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!podcastId) {
      setError("No podcast ID provided");
      setIsLoading(false);
      return;
    }

    const fetchPodcast = async () => {
      try {
        // First fetch podcast info from Podcast Index
        const infoResponse = await fetch(`${API_BASE}/podcast/${podcastId}`);
        if (!infoResponse.ok) {
          throw new Error("Failed to load podcast info");
        }
        const infoData: PodcastInfo = await infoResponse.json();
        setPodcastInfo(infoData);

        // Then fetch the feed using the feed URL
        const feedResponse = await fetch(
          `${API_BASE}/feed?url=${encodeURIComponent(infoData.url)}`
        );
        if (!feedResponse.ok) {
          throw new Error("Failed to load podcast feed");
        }
        const feedData = await feedResponse.json();
        setFeed(feedData);
        setVisibleCount(EPISODES_PER_BATCH);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPodcast();
  }, [podcastId]);

  // Check subscription status
  useEffect(() => {
    if (!session?.access_token || !podcastId) return;

    const checkSubscription = async () => {
      try {
        const sub = await api.getSubscription(session.access_token, parseInt(podcastId));
        setIsSubscribed(!!sub);
      } catch {
        setIsSubscribed(false);
      }
    };

    checkSubscription();
  }, [session?.access_token, podcastId]);

  // Load saved episodes for this user
  useEffect(() => {
    if (!session?.access_token) return;

    const loadSavedEpisodes = async () => {
      try {
        const saved = await api.getSavedEpisodes(session.access_token);
        setSavedEpisodeGuids(new Set(saved.map((ep) => ep.episode_guid)));
      } catch {
        // Silently fail - just won't show saved state
      }
    };

    loadSavedEpisodes();
  }, [session?.access_token]);

  const handleSubscribeToggle = async () => {
    if (!session?.access_token || !podcastId || !podcastInfo) return;

    setIsSubscribing(true);
    try {
      if (isSubscribed) {
        await api.deleteSubscription(session.access_token, parseInt(podcastId));
        setIsSubscribed(false);
      } else {
        await api.createSubscription(session.access_token, {
          podcast_id: parseInt(podcastId),
          podcast_title: feed?.title || podcastInfo.title,
          feed_url: podcastInfo.url,
          podcast_author: feed?.author || podcastInfo.author,
          artwork_url: feed?.artwork_url || podcastInfo.artwork,
        });
        setIsSubscribed(true);
      }
    } catch (err) {
      console.error("Failed to toggle subscription:", err);
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleSaveToggle = async (episode: PodcastEpisode) => {
    if (!session?.access_token || !podcastId || !episode.guid) return;

    const isSaved = savedEpisodeGuids.has(episode.guid);

    // Optimistically update UI
    setSavedEpisodeGuids((prev) => {
      const next = new Set(prev);
      if (isSaved) {
        next.delete(episode.guid!);
      } else {
        next.add(episode.guid!);
      }
      return next;
    });

    try {
      if (isSaved) {
        await api.deleteSavedEpisode(session.access_token, episode.guid);
      } else {
        await api.createSavedEpisode(session.access_token, {
          podcast_id: parseInt(podcastId),
          episode_guid: episode.guid,
          episode_title: episode.title,
          podcast_title: feed?.title || podcastInfo?.title,
          artwork_url: episode.artwork_url || feed?.artwork_url || podcastInfo?.artwork,
          audio_url: episode.audio_url,
          pub_date: episode.pub_date,
          duration_seconds: episode.duration_seconds,
        });
      }
    } catch (err) {
      // Revert on error
      console.error("Failed to toggle saved episode:", err);
      setSavedEpisodeGuids((prev) => {
        const next = new Set(prev);
        if (isSaved) {
          next.add(episode.guid!);
        } else {
          next.delete(episode.guid!);
        }
        return next;
      });
    }
  };

  // Filter episodes based on search
  const filteredEpisodes = feed
    ? episodeSearch
      ? feed.episodes.filter((ep) =>
          ep.title.toLowerCase().includes(episodeSearch.toLowerCase())
        )
      : feed.episodes
    : [];

  // Intersection Observer for infinite scroll
  useEffect(() => {
    if (!feed || visibleCount >= filteredEpisodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) =>
            Math.min(prev + EPISODES_PER_BATCH, filteredEpisodes.length)
          );
        }
      },
      { rootMargin: "200px" }
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
  }, [feed, visibleCount, filteredEpisodes.length]);

  const handleEpisodePlay = (episode: PodcastEpisode) => {
    const isCurrentEpisode = nowPlaying?.episodeGuid === episode.guid;

    if (isCurrentEpisode && isPlaying) {
      pause();
    } else {
      playEpisode({
        audioUrl: episode.audio_url || "",
        episodeTitle: episode.title,
        podcastTitle: feed?.title || podcastInfo?.title || undefined,
        episodeGuid: episode.guid || undefined,
        podcastId: podcastId ? parseInt(podcastId) : undefined,
        artworkUrl: episode.artwork_url || feed?.artwork_url || podcastInfo?.artwork || undefined,
      });
    }
  };

  const handleEpisodeClick = (episode: PodcastEpisode) => {
    router.push(`/episode?id=${podcastId}&guid=${encodeURIComponent(episode.guid || "")}`);
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
        <div className="animate-in fade-in duration-300">
          <div className="flex gap-6 mb-8">
            <Skeleton className="w-32 h-32 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-10 w-3/4" />
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="border-t border-gray-100 pt-6">
            <Skeleton className="h-7 w-32 mb-4" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <EpisodeCardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center py-16 animate-in fade-in duration-300">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
            <AlertCircle size={24} className="text-red-500" />
          </div>
          <p className="text-gray-900 font-medium mb-1">{error}</p>
          <p className="text-gray-500 text-sm mb-4">
            We couldn&apos;t load this podcast
          </p>
          <Link
            href="/"
            className="text-sm text-gray-900 underline hover:no-underline"
          >
            Go back home
          </Link>
        </div>
      )}

      {!isLoading && feed && podcastInfo && (
        <div className="animate-in fade-in duration-300">
          <div className="flex gap-6 mb-8">
            {(feed.artwork_url || podcastInfo.artwork) && (
              <img
                src={feed.artwork_url || podcastInfo.artwork || undefined}
                alt={feed.title}
                className="w-32 h-32 rounded-lg object-cover flex-shrink-0 shadow-md"
              />
            )}
            <div className="flex-1">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-4xl font-serif mb-2 text-gray-900">
                    {feed.title || podcastInfo.title}
                  </h1>
                  {feed.author && (
                    <p className="text-gray-500 mb-3">{feed.author}</p>
                  )}
                </div>
                {session && (
                  <button
                    onClick={handleSubscribeToggle}
                    disabled={isSubscribing}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
                      isSubscribed
                        ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        : "bg-gray-900 text-white hover:bg-gray-800"
                    } disabled:opacity-50`}
                  >
                    {isSubscribed ? (
                      <>
                        <Check size={16} />
                        Subscribed
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Subscribe
                      </>
                    )}
                  </button>
                )}
              </div>
              {feed.description && (
                <p className="text-sm text-gray-600 line-clamp-4">
                  {feed.description}
                </p>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-serif text-gray-900">
                Episodes ({feed.episodes.length})
              </h2>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search episodes..."
                  value={episodeSearch}
                  onChange={(e) => {
                    setEpisodeSearch(e.target.value);
                    setVisibleCount(EPISODES_PER_BATCH); // Reset pagination on search
                  }}
                  className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 w-64"
                />
              </div>
            </div>
            {filteredEpisodes.length === 0 && episodeSearch ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search size={20} className="text-gray-400" />
                </div>
                <p className="text-gray-900 font-medium mb-1">No episodes found</p>
                <p className="text-gray-500 text-sm">
                  No episodes match &quot;{episodeSearch}&quot;
                </p>
              </div>
            ) : (
              <div className={`space-y-2 ${nowPlaying ? "pb-24" : ""}`}>
                {filteredEpisodes.slice(0, visibleCount).map((episode, index) => (
                  <EpisodeCard
                    key={episode.guid || index}
                    episode={episode}
                    index={index}
                    isPlaying={isPlaying}
                    isCurrentEpisode={nowPlaying?.episodeGuid === episode.guid}
                    onPlay={handleEpisodePlay}
                    onEpisodeClick={handleEpisodeClick}
                    podcastArtwork={feed.artwork_url || podcastInfo.artwork}
                    isSaved={episode.guid ? savedEpisodeGuids.has(episode.guid) : false}
                    onSaveToggle={session ? handleSaveToggle : undefined}
                  />
                ))}
                {/* Sentinel for infinite scroll */}
                {visibleCount < filteredEpisodes.length && (
                  <div
                    ref={sentinelRef}
                    className="py-4 text-center text-gray-400 text-sm"
                  >
                    Loading more episodes...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function PodcastPageSkeleton() {
  return (
    <div className="animate-in fade-in duration-300">
      <Skeleton className="h-6 w-28 mb-8" />
      <div className="flex gap-6 mb-8">
        <Skeleton className="w-32 h-32 rounded-lg flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}

export default function PodcastPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <Suspense fallback={<PodcastPageSkeleton />}>
          <PodcastContent />
        </Suspense>
      </div>
    </div>
  );
}
