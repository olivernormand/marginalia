import { Play } from "lucide-react";
import { PodcastEpisode } from "@/lib/types";

interface EpisodeCardProps {
  episode: PodcastEpisode;
  index: number;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stripHtml(html: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").slice(0, 200);
}

export default function EpisodeCard({ episode, index }: EpisodeCardProps) {
  return (
    <div className="flex gap-4 p-4 hover:bg-gray-50 transition-colors rounded-lg group">
      <div className="flex-shrink-0 w-10 text-right text-gray-400 text-sm pt-1">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-lg font-serif text-gray-900 mb-1 group-hover:text-gray-700">
          {episode.title}
        </h3>
        {episode.description && (
          <p className="text-sm text-gray-500 mb-2 line-clamp-2">
            {stripHtml(episode.description)}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {episode.pub_date && <span>{formatDate(episode.pub_date)}</span>}
          {episode.duration_seconds && (
            <>
              <span>·</span>
              <span>{formatDuration(episode.duration_seconds)}</span>
            </>
          )}
        </div>
      </div>
      {episode.audio_url && (
        <button
          className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center transition-colors"
          title="Play episode"
        >
          <Play className="text-gray-600" size={16} />
        </button>
      )}
    </div>
  );
}
