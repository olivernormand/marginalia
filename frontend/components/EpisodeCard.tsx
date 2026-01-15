import { Play, Pause, Bookmark, ChevronRight } from "lucide-react";
import { PodcastEpisode } from "@/lib/types";
import { formatDuration, formatDate, stripHtml } from "@/lib/formatters";

interface EpisodeCardProps {
  episode: PodcastEpisode;
  index: number;
  isPlaying?: boolean;
  isCurrentEpisode?: boolean;
  onPlay?: (episode: PodcastEpisode) => void;
  onEpisodeClick?: (episode: PodcastEpisode) => void;
  podcastArtwork?: string | null;
  isSaved?: boolean;
  onSaveToggle?: (episode: PodcastEpisode) => void;
  // Additional props for library/transcribed page compatibility
  subtitle?: string | null; // e.g., podcast name
  showChevron?: boolean; // Show navigation chevron instead of play/save buttons
}

export default function EpisodeCard({
  episode,
  index,
  isPlaying = false,
  isCurrentEpisode = false,
  onPlay,
  onEpisodeClick,
  podcastArtwork,
  isSaved = false,
  onSaveToggle,
  subtitle,
  showChevron = false,
}: EpisodeCardProps) {
  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlay && episode.audio_url) {
      onPlay(episode);
    }
  };

  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSaveToggle) {
      onSaveToggle(episode);
    }
  };

  const handleCardClick = () => {
    if (onEpisodeClick) {
      onEpisodeClick(episode);
    }
  };

  const artworkUrl = episode.artwork_url || podcastArtwork;

  return (
    <div
      className={`flex gap-4 p-4 hover:bg-gray-50 transition-colors rounded-lg group cursor-pointer ${
        isCurrentEpisode ? "bg-gray-50" : ""
      }`}
      onClick={handleCardClick}
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
          className={`text-lg font-serif mb-1 group-hover:text-gray-700 line-clamp-1 ${
            isCurrentEpisode ? "text-gray-900 font-medium" : "text-gray-900"
          }`}
        >
          {episode.title}
        </h3>
        {subtitle && (
          <p className="text-sm text-gray-500 line-clamp-1">{subtitle}</p>
        )}
        {episode.description && (
          <p className="text-sm text-gray-500 mb-2 line-clamp-3">
            {stripHtml(episode.description)}
          </p>
        )}
        <div className={`flex items-center gap-4 text-xs text-gray-400 ${subtitle ? "mt-1" : ""}`}>
          {episode.pub_date && <span>{formatDate(episode.pub_date)}</span>}
          {episode.duration_seconds && (
            <>
              <span>·</span>
              <span>{formatDuration(episode.duration_seconds)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {showChevron ? (
          <ChevronRight
            size={20}
            className="text-gray-300 group-hover:text-gray-500 transition-colors"
          />
        ) : (
          <>
            {onSaveToggle && (
              <button
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isSaved
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 group-hover:bg-gray-200 text-gray-600"
                }`}
                title={isSaved ? "Remove from library" : "Save to library"}
                onClick={handleSaveClick}
              >
                <Bookmark size={16} className={isSaved ? "fill-current" : ""} />
              </button>
            )}
            {episode.audio_url && (
              <button
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                  isCurrentEpisode && isPlaying
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 group-hover:bg-gray-200 text-gray-600"
                }`}
                title={isPlaying && isCurrentEpisode ? "Pause episode" : "Play episode"}
                onClick={handlePlayClick}
              >
                {isCurrentEpisode && isPlaying ? (
                  <Pause size={16} />
                ) : (
                  <Play size={16} className="ml-0.5" />
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
