"use client";

import { Transcript as TranscriptType, getUtterances } from "@/lib/types";

interface TranscriptProps {
  transcript: TranscriptType;
  currentTime: number; // in seconds
  onSeek: (timeMs: number) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

function getSpeakerColor(speaker: string | null): string {
  if (!speaker) return "bg-gray-100";
  const colors = [
    "bg-blue-50 border-l-blue-400",
    "bg-green-50 border-l-green-400",
    "bg-purple-50 border-l-purple-400",
    "bg-orange-50 border-l-orange-400",
    "bg-pink-50 border-l-pink-400",
  ];
  const index = speaker.charCodeAt(0) % colors.length;
  return colors[index];
}

export default function Transcript({
  transcript,
  currentTime,
  onSeek,
}: TranscriptProps) {
  const utterances = getUtterances(transcript.words);
  const currentTimeMs = currentTime * 1000;

  const skippedIntro = transcript.content_start_ms > 0;
  const skippedOutro =
    transcript.content_end_ms !== null &&
    transcript.content_end_ms < transcript.audio_duration;

  return (
    <div className="space-y-3">
      {/* Skipped intro indicator */}
      {skippedIntro && (
        <div className="text-xs text-gray-400 italic px-3 py-2 bg-gray-50 rounded-lg">
          Skipped {formatDuration(transcript.content_start_ms)} of intro
        </div>
      )}

      {utterances.map((utterance, index) => {
        const isActive =
          currentTimeMs >= utterance.start && currentTimeMs <= utterance.end;

        return (
          <button
            key={index}
            onClick={() => onSeek(utterance.start)}
            className={`w-full text-left p-3 rounded-lg border-l-4 transition-all ${getSpeakerColor(utterance.speaker)} ${
              isActive ? "ring-2 ring-gray-400" : "hover:brightness-95"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-gray-500">
                {utterance.speaker || "Speaker"}
              </span>
              <span className="text-xs text-gray-400">
                {formatTime(utterance.start)}
              </span>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed">
              {utterance.text}
            </p>
          </button>
        );
      })}

      {/* Skipped outro indicator */}
      {skippedOutro && (
        <div className="text-xs text-gray-400 italic px-3 py-2 bg-gray-50 rounded-lg">
          Skipped{" "}
          {formatDuration(
            transcript.audio_duration - transcript.content_end_ms!
          )}{" "}
          of outro
        </div>
      )}
    </div>
  );
}
