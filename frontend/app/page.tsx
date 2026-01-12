"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PodcastSearchResult } from "@/lib/types";
import Header from "@/components/Header";
import SearchBar from "@/components/SearchBar";
import PodcastCard from "@/components/PodcastCard";

const API_BASE = "http://localhost:8000";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PodcastSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

  const handlePodcastClick = (podcast: PodcastSearchResult) => {
    const params = new URLSearchParams({
      feedUrl: podcast.feed_url,
      name: podcast.collection_name,
      artwork: podcast.artwork_url_600 || podcast.artwork_url_100 || "",
    });
    router.push(`/podcast?${params.toString()}`);
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

        {isLoading && (
          <div className="text-center py-12 text-gray-500">Searching...</div>
        )}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No podcasts found for &quot;{query}&quot;
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="space-y-6">
            {results.map((podcast, index) => (
              <PodcastCard
                key={`${podcast.collection_id}-${index}`}
                podcast={podcast}
                onClick={() => handlePodcastClick(podcast)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
