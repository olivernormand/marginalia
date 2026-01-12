import { Play, Pause } from "lucide-react";
import { PodcastEpisode } from "@/lib/types";

interface EpisodeCardProps {
  episode: PodcastEpisode;
  index: number;
  isPlaying?: boolean;
  isCurrentEpisode?: boolean;
  onPlay?: (episode: PodcastEpisode) => void;
  podcastArtwork?: string | null;
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

export default function EpisodeCard({
  episode,
  index,
  isPlaying = false,
  isCurrentEpisode = false,
  onPlay,
  podcastArtwork,
}: EpisodeCardProps) {
  const handlePlayClick = () => {
    if (onPlay && episode.audio_url) {
      onPlay(episode);
    }
  };

  const artworkUrl = episode.artwork_url || podcastArtwork;

  return (
    <div
      className={`flex gap-4 p-4 hover:bg-gray-50 transition-colors rounded-lg group cursor-pointer ${
        isCurrentEpisode ? "bg-gray-50" : ""
      }`}
      onClick={handlePlayClick}
    >
      {artworkUrl ? (
        <img
          src={artworkUrl}
          alt=""
          className="flex-shrink-0 w-16 h-16 rounded-md object-cover"
        />
      ) : (
        <div className="flex-shrink-0 w-10 text-right text-gray-400 text-sm pt-1">
          {index + 1}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h3
          className={`text-lg font-serif mb-1 group-hover:text-gray-700 ${
            isCurrentEpisode ? "text-gray-900 font-medium" : "text-gray-900"
          }`}
        >
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
          className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            isCurrentEpisode && isPlaying
              ? "bg-gray-900 text-white"
              : "bg-gray-100 group-hover:bg-gray-200 text-gray-600"
          }`}
          title={isPlaying && isCurrentEpisode ? "Pause episode" : "Play episode"}
          onClick={(e) => {
            e.stopPropagation();
            handlePlayClick();
          }}
        >
          {isCurrentEpisode && isPlaying ? (
            <Pause size={16} />
          ) : (
            <Play size={16} className="ml-0.5" />
          )}
        </button>
      )}
    </div>
  );
}
