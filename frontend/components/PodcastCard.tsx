import { ChevronRight } from "lucide-react";
import { PodcastSearchResult } from "@/lib/types";

interface PodcastCardProps {
  podcast: PodcastSearchResult;
  onClick?: () => void;
}

export default function PodcastCard({ podcast, onClick }: PodcastCardProps) {
  // Get first category name if available
  const primaryGenre = podcast.categories
    ? Object.values(podcast.categories)[0]
    : null;

  return (
    <button
      onClick={onClick}
      className="w-full flex gap-6 p-6 hover:bg-gray-50 transition-colors rounded-lg text-left group"
    >
      {podcast.artwork && (
        <img
          src={podcast.artwork}
          alt={podcast.title}
          className="w-24 h-24 rounded-lg object-cover flex-shrink-0 shadow-sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-2xl font-serif text-gray-900 group-hover:text-gray-700">
            {podcast.title}
          </h3>
          <ChevronRight
            className="text-gray-300 group-hover:text-gray-500 flex-shrink-0"
            size={24}
          />
        </div>
        {podcast.author && (
          <p className="text-sm text-gray-500 mb-3">{podcast.author}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {podcast.episode_count && (
            <>
              <span>{podcast.episode_count} episodes</span>
              {primaryGenre && <span>·</span>}
            </>
          )}
          {primaryGenre && (
            <span className="px-2 py-1 bg-gray-100 rounded">{primaryGenre}</span>
          )}
        </div>
      </div>
    </button>
  );
}
