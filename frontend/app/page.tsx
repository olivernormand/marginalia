"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { PodcastSearchResult, TrendingPodcast } from "@/lib/types";
import { API_BASE } from "@/lib/config";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import PodcastCard from "@/components/PodcastCard";
import { PodcastCardSkeleton, TrendingPodcastSkeleton } from "@/components/Skeleton";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PodcastSearchResult[]>([]);
  const [trendingPodcasts, setTrendingPodcasts] = useState<TrendingPodcast[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isTrendingLoading, setIsTrendingLoading] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);

  // Fetch trending podcasts on mount
  useEffect(() => {
    const fetchTrending = async () => {
      try {
        const response = await fetch(`${API_BASE}/trending?max=5`);
        if (response.ok) {
          const data = await response.json();
          setTrendingPodcasts(data);
        }
      } catch (error) {
        console.error("Failed to fetch trending podcasts:", error);
      } finally {
        setIsTrendingLoading(false);
      }
    };
    fetchTrending();
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `${API_BASE}/search?q=${encodeURIComponent(query)}`
      );
      if (!response.ok) throw new Error("Search failed");
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePodcastClick = (podcast: PodcastSearchResult | TrendingPodcast) => {
    router.push(`/podcast?id=${podcast.id}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-8 py-12">
        <Header />
        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
        />

        {/* Search Results Loading */}
        {isLoading && (
          <div className="space-y-2 animate-in fade-in duration-300">
            {[...Array(3)].map((_, i) => (
              <PodcastCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* No Results */}
        {!isLoading && hasSearched && results.length === 0 && (
          <div className="text-center py-16 animate-in fade-in duration-300">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Search size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">No podcasts found</p>
            <p className="text-gray-500 text-sm">
              Try searching for something else
            </p>
          </div>
        )}

        {/* Search Results */}
        {!isLoading && results.length > 0 && (
          <div className="space-y-2 animate-in fade-in duration-300">
            {results.map((podcast, index) => (
              <PodcastCard
                key={`${podcast.id}-${index}`}
                podcast={podcast}
                onClick={() => handlePodcastClick(podcast)}
              />
            ))}
          </div>
        )}

        {/* Trending Podcasts - shown when not searching */}
        {!hasSearched && (
          <div className="mt-8 animate-in fade-in duration-500">
            <h2 className="text-xl font-serif text-gray-900 mb-4">
              Trending Podcasts
            </h2>
            <div className="space-y-1">
              {isTrendingLoading ? (
                [...Array(5)].map((_, i) => <TrendingPodcastSkeleton key={i} />)
              ) : (
                trendingPodcasts.map((podcast) => (
                  <button
                    key={podcast.id}
                    onClick={() => handlePodcastClick(podcast)}
                    className="w-full flex gap-4 p-4 hover:bg-gray-50 transition-all duration-200 rounded-lg text-left group"
                  >
                    {podcast.artwork && (
                      <img
                        src={podcast.artwork}
                        alt=""
                        className="w-16 h-16 rounded-md object-cover flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 group-hover:text-gray-700 line-clamp-1">
                        {podcast.title}
                      </h3>
                      {podcast.author && (
                        <p className="text-sm text-gray-500">{podcast.author}</p>
                      )}
                      {podcast.categories && (
                        <p className="text-xs text-gray-400 mt-1">
                          {Object.values(podcast.categories).slice(0, 2).join(" · ")}
                        </p>
                      )}
                    </div>
                    <ChevronRight
                      size={20}
                      className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 self-center transition-colors duration-200"
                    />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
