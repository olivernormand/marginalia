"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  ListMusic,
  X,
} from "lucide-react";
import { useAudioPlayerOptional } from "@/context/AudioPlayerContext";
import { formatTimeSeconds } from "@/lib/formatters";

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export default function GlobalAudioPlayer() {
  const player = useAudioPlayerOptional();
  const pathname = usePathname();
  const router = useRouter();

  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Sync volume with audio element
  useEffect(() => {
    if (player?.audioRef.current) {
      player.audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted, player]);

  // Don't render if no player context or nothing playing
  if (!player || !player.nowPlaying) {
    return null;
  }

  const {
    nowPlaying,
    isPlaying,
    currentTime,
    duration,
    pause,
    resume,
    stop,
    seekTo,
    setPlaybackSpeed,
    playbackSpeed,
    audioRef,
    requestTranscriptJump,
  } = player;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Check if we're on the episode page for the currently playing episode
  const isOnCurrentEpisodePage =
    pathname === "/episode" &&
    nowPlaying.episodeGuid &&
    nowPlaying.podcastId;

  const togglePlay = () => {
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    seekTo(newTime);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = Math.max(0, Math.min(currentTime + seconds, duration));
    seekTo(newTime);
  };

  const cyclePlaybackSpeed = () => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const handleTranscriptClick = () => {
    if (isOnCurrentEpisodePage) {
      // On episode page - request scroll to current transcript position
      requestTranscriptJump();
    } else if (nowPlaying.podcastId && nowPlaying.episodeGuid) {
      // Not on episode page - navigate there
      router.push(
        `/episode?id=${nowPlaying.podcastId}&guid=${encodeURIComponent(nowPlaying.episodeGuid)}`
      );
    }
  };

  return (
    <div className="sticky bottom-0 bg-white border-t border-gray-200 shadow-lg z-40">
      {/* Progress bar */}
      <div className="w-full h-1 bg-gray-100 relative">
        <div
          className="absolute top-0 left-0 h-full bg-gray-900 transition-all"
          style={{ width: `${progress}%` }}
        />
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleSeek}
          className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
          aria-label="Seek"
        />
      </div>

      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Episode info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {nowPlaying.episodeTitle}
            </p>
            {nowPlaying.podcastTitle && (
              <p className="text-xs text-gray-500 truncate">
                {nowPlaying.podcastTitle}
              </p>
            )}
          </div>

          {/* Main controls */}
          <div className="flex items-center gap-2">
            {/* Skip back 15s */}
            <button
              onClick={() => skip(-15)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title="Skip back 15 seconds"
              aria-label="Skip back 15 seconds"
            >
              <RotateCcw size={20} />
            </button>

            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-3 bg-gray-900 text-white rounded-full hover:bg-gray-800 transition-colors"
              title={isPlaying ? "Pause" : "Play"}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={20} />
              ) : (
                <Play size={20} className="ml-0.5" />
              )}
            </button>

            {/* Skip forward 30s */}
            <button
              onClick={() => skip(30)}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title="Skip forward 30 seconds"
              aria-label="Skip forward 30 seconds"
            >
              <RotateCw size={20} />
            </button>
          </div>

          {/* Time display */}
          <div className="text-xs text-gray-500 tabular-nums w-24 text-center">
            {formatTimeSeconds(currentTime)} / {formatTimeSeconds(duration)}
          </div>

          {/* Jump to transcript / Go to episode */}
          {(nowPlaying.podcastId && nowPlaying.episodeGuid) && (
            <button
              onClick={handleTranscriptClick}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title={isOnCurrentEpisodePage ? "Jump to transcript" : "Go to episode"}
              aria-label={isOnCurrentEpisodePage ? "Jump to transcript" : "Go to episode"}
            >
              <ListMusic size={18} />
            </button>
          )}

          {/* Playback speed */}
          <button
            onClick={cyclePlaybackSpeed}
            className="px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded transition-colors min-w-[3rem]"
            title="Change playback speed"
            aria-label={`Playback speed ${playbackSpeed}x`}
          >
            {playbackSpeed}x
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleMute}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
              title={isMuted ? "Unmute" : "Mute"}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={18} />
              ) : (
                <Volume2 size={18} />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-gray-900"
              aria-label="Volume"
            />
          </div>

          {/* Close button */}
          <button
            onClick={stop}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close player"
            aria-label="Close player"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
