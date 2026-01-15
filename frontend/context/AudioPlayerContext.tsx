"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  ReactNode,
} from "react";

export interface NowPlaying {
  audioUrl: string;
  episodeTitle: string;
  podcastTitle?: string;
  episodeGuid?: string;
  podcastId?: number;
  artworkUrl?: string;
}

interface AudioPlayerContextType {
  // Current state
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;

  // Actions
  playEpisode: (episode: NowPlaying) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setPlaybackSpeed: (speed: number) => void;
  playbackSpeed: number;

  // For transcript sync - allows subscribing to time updates
  audioRef: React.RefObject<HTMLAudioElement | null>;

  // Transcript jump coordination - incremented when user clicks "jump to transcript"
  // Episode page watches this and scrolls when it changes
  transcriptJumpRequested: number;
  requestTranscriptJump: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}

// Optional hook that doesn't throw - useful for components that may render outside provider
export function useAudioPlayerOptional() {
  return useContext(AudioPlayerContext);
}

interface AudioPlayerProviderProps {
  children: ReactNode;
}

export function AudioPlayerProvider({ children }: AudioPlayerProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeedState] = useState(1);
  const [transcriptJumpRequested, setTranscriptJumpRequested] = useState(0);

  // Sync state with audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("loadedmetadata", handleDurationChange);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("loadedmetadata", handleDurationChange);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [nowPlaying]); // Re-attach when source changes

  const playEpisode = useCallback((episode: NowPlaying) => {
    const audio = audioRef.current;
    if (!audio) return;

    // If it's the same episode, just resume
    if (nowPlaying?.audioUrl === episode.audioUrl) {
      audio.play().catch(() => {});
      return;
    }

    // New episode - update source and play
    setNowPlaying(episode);
    setCurrentTime(0);
    setDuration(0);
    audio.src = episode.audioUrl;
    audio.load();
    audio.play().catch((err) => {
      console.log("Auto-play blocked:", err);
    });
  }, [nowPlaying?.audioUrl]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => {});
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
    }
    setNowPlaying(null);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setPlaybackSpeed = useCallback((speed: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.playbackRate = speed;
    }
    setPlaybackSpeedState(speed);
  }, []);

  const requestTranscriptJump = useCallback(() => {
    setTranscriptJumpRequested((prev) => prev + 1);
  }, []);

  return (
    <AudioPlayerContext.Provider
      value={{
        nowPlaying,
        isPlaying,
        currentTime,
        duration,
        playEpisode,
        pause,
        resume,
        stop,
        seekTo,
        setPlaybackSpeed,
        playbackSpeed,
        audioRef,
        transcriptJumpRequested,
        requestTranscriptJump,
      }}
    >
      {/* Hidden audio element - lives here so it persists across navigation */}
      <audio ref={audioRef} preload="auto" />
      {children}
    </AudioPlayerContext.Provider>
  );
}
