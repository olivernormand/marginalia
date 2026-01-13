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

export default function Transcript({
  transcript,
  currentTime,
  onSeek,
}: TranscriptProps) {
  const utterances = getUtterances(transcript.words, transcript.paragraphs);
  const currentTimeMs = currentTime * 1000;

  const skippedIntro = transcript.content_start_ms > 0;
  const skippedOutro =
    transcript.content_end_ms !== null &&
    transcript.content_end_ms < transcript.audio_duration;

  return (
    <div className="space-y-6">
      {/* Skipped intro indicator */}
      {skippedIntro && (
        <p className="text-sm text-gray-400 italic">
          {formatDuration(transcript.content_start_ms)} of intro skipped
        </p>
      )}

      {utterances.map((utterance, index) => (
        <div key={index} className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-medium text-gray-900">
              {utterance.speaker || "Speaker"}
            </span>
            <span className="text-xs text-gray-400">
              {formatTime(utterance.start)}
            </span>
          </div>
          {utterance.paragraphs.map((para, i) => {
            const isActive =
              currentTimeMs >= para.start &&
              (i + 1 < utterance.paragraphs.length
                ? currentTimeMs < utterance.paragraphs[i + 1].start
                : currentTimeMs <= utterance.end);

            return (
              <button
                key={i}
                onClick={() => onSeek(para.start)}
                className={`block w-full text-left transition-colors rounded -mx-3 px-3 py-1 ${
                  isActive
                    ? "bg-amber-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <p className="text-base text-gray-700 leading-7 font-serif">
                  {para.text}
                </p>
              </button>
            );
          })}
        </div>
      ))}

      {/* Skipped outro indicator */}
      {skippedOutro && (
        <p className="text-sm text-gray-400 italic">
          {formatDuration(
            transcript.audio_duration - transcript.content_end_ms!
          )}{" "}
          of outro skipped
        </p>
      )}
    </div>
  );
}
