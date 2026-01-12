"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { PodcastFeed } from "@/lib/types";
import EpisodeCard from "@/components/EpisodeCard";

const API_BASE = "http://localhost:8000";

function PodcastContent() {
  const searchParams = useSearchParams();
  const feedUrl = searchParams.get("feedUrl");
  const podcastName = searchParams.get("name");
  const artworkUrl = searchParams.get("artwork");

  const [feed, setFeed] = useState<PodcastFeed | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, [feedUrl]);

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
            <div className="space-y-2">
              {feed.episodes.map((episode, index) => (
                <EpisodeCard
                  key={episode.guid || index}
                  episode={episode}
                  index={index}
                />
              ))}
            </div>
          </div>
        </>
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
