import { ChevronRight } from "lucide-react";
import { PodcastSearchResult } from "@/lib/types";

interface PodcastCardProps {
  podcast: PodcastSearchResult;
  onClick?: () => void;
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PodcastCard({ podcast, onClick }: PodcastCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex gap-6 p-6 hover:bg-gray-50 transition-colors rounded-lg text-left group"
    >
      {(podcast.artwork_url_100 || podcast.artwork_url_60) && (
        <img
          src={podcast.artwork_url_100 ?? podcast.artwork_url_60 ?? undefined}
          alt={podcast.collection_name}
          className="w-24 h-24 rounded-lg object-cover flex-shrink-0 shadow-sm"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-2xl font-serif text-gray-900 group-hover:text-gray-700">
            {podcast.collection_name}
          </h3>
          <ChevronRight
            className="text-gray-300 group-hover:text-gray-500 flex-shrink-0"
            size={24}
          />
        </div>
        <p className="text-sm text-gray-500 mb-3">{podcast.artist_name}</p>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span>{podcast.track_count} episodes</span>
          <span>·</span>
          <span className="px-2 py-1 bg-gray-100 rounded">
            {podcast.primary_genre_name}
          </span>
          <span>·</span>
          <span>Updated {formatDate(podcast.release_date)}</span>
        </div>
      </div>
    </button>
  );
}
