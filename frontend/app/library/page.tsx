"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { SavedEpisode } from "@/lib/types";
import { savedEpisodeToCard } from "@/lib/mappers";
import { useAuth } from "@/context/AuthContext";
import EpisodeCard from "@/components/EpisodeCard";
import { EpisodeListSkeleton } from "@/components/Skeleton";
import * as api from "@/lib/api";

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
          <EpisodeListSkeleton />
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
            {savedEpisodes.map((episode, index) => (
              <EpisodeCard
                key={episode.id}
                episode={savedEpisodeToCard(episode)}
                index={index}
                subtitle={episode.podcast_title}
                showChevron
                onEpisodeClick={() => handleEpisodeClick(episode)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
