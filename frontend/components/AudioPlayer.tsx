"use client";

import { useRef, useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  episodeTitle: string;
  podcastTitle?: string;
  onClose?: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AudioPlayer({
  audioUrl,
  episodeTitle,
  podcastTitle,
  onClose,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("loadedmetadata", handleDurationChange);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadedmetadata", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Auto-play when a new episode is selected
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state for new episode
    setCurrentTime(0);
    setIsPlaying(false);

    const startPlayback = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        // Auto-play might be blocked by browser policy
        console.log("Auto-play blocked, user must click play");
      }
    };

    // Start playback once audio is ready
    if (audio.readyState >= 2) {
      startPlayback();
    } else {
      audio.addEventListener("canplay", startPlayback, { once: true });
    }

    return () => {
      audio.removeEventListener("canplay", startPlayback);
    };
  }, [audioUrl]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      await audio.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const skip = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.currentTime + seconds, duration));
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

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
              {episodeTitle}
            </p>
            {podcastTitle && (
              <p className="text-xs text-gray-500 truncate">{podcastTitle}</p>
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
              {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
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
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>

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
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close player"
              aria-label="Close player"
            >
              <span className="text-lg">&times;</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
