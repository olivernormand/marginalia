"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronRight, Play, Clock } from "lucide-react";
import { SavedEpisode } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import * as api from "@/lib/api";

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins} min`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function LibraryPage() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [savedEpisodes, setSavedEpisodes] = useState<SavedEpisode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    const loadSavedEpisodes = async () => {
      try {
        const data = await api.getSavedEpisodes(session.access_token);
        setSavedEpisodes(data);
      } catch (err) {
        console.error("Failed to load saved episodes:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedEpisodes();
  }, [session?.access_token]);

  const handleEpisodeClick = (episode: SavedEpisode) => {
    router.push(`/episode?id=${episode.podcast_id}&guid=${encodeURIComponent(episode.episode_guid)}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <h1 className="text-3xl font-serif text-gray-900 mb-4">Library</h1>
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <BookOpen size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">Sign in to see your library</p>
            <p className="text-gray-500 text-sm">
              Your saved episodes will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-serif text-gray-900 mb-6">Library</h1>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex gap-4 p-4 animate-pulse">
                <div className="w-16 h-16 bg-gray-200 rounded-md" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : savedEpisodes.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <BookOpen size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">No saved episodes yet</p>
            <p className="text-gray-500 text-sm">
              Save episodes to listen to later
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {savedEpisodes.map((episode) => (
              <button
                key={episode.id}
                onClick={() => handleEpisodeClick(episode)}
                className="w-full flex gap-4 p-4 hover:bg-gray-50 transition-all duration-200 rounded-lg text-left group"
              >
                {episode.artwork_url ? (
                  <img
                    src={episode.artwork_url}
                    alt=""
                    className="w-16 h-16 rounded-md object-cover flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Play size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 group-hover:text-gray-700 line-clamp-1">
                    {episode.episode_title}
                  </h3>
                  {episode.podcast_title && (
                    <p className="text-sm text-gray-500 line-clamp-1">{episode.podcast_title}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    {episode.pub_date && (
                      <span>{formatDate(episode.pub_date)}</span>
                    )}
                    {episode.duration_seconds && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {formatDuration(episode.duration_seconds)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={20}
                  className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 self-center transition-colors duration-200"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
