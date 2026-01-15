"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X } from "lucide-react";
import { Transcript as TranscriptType, getUtterances, UtteranceParagraph } from "@/lib/types";

export interface SelectedText {
  text: string;
  paragraph: UtteranceParagraph;
  speaker: string | null;
}

export interface SavedAnnotation {
  id: string;
  text: string;
  note: string;
  speaker: string | null;
  startMs: number;
}

interface TranscriptProps {
  transcript: TranscriptType;
  currentTime: number; // in seconds
  onSeek: (timeMs: number) => void;
  annotations: SavedAnnotation[];
  onSaveAnnotation: (text: string, note: string, speaker: string | null, startMs: number) => void;
  onEditAnnotation: (id: string, note: string) => void;
  onDeleteAnnotation: (id: string) => void;
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

// Pastel color palette for speaker distinction
const SPEAKER_COLORS = [
  "bg-blue-100",
  "bg-amber-100",
  "bg-emerald-100",
  "bg-rose-100",
  "bg-violet-100",
  "bg-cyan-100",
  "bg-orange-100",
  "bg-teal-100",
];

// Get consistent color for a speaker name
function getSpeakerColor(speakerName: string | null, speakerMap: Map<string, string>): string {
  if (!speakerName) return "bg-gray-100";

  if (!speakerMap.has(speakerName)) {
    const colorIndex = speakerMap.size % SPEAKER_COLORS.length;
    speakerMap.set(speakerName, SPEAKER_COLORS[colorIndex]);
  }

  return speakerMap.get(speakerName)!;
}

interface MarginNoteProps {
  annotation: SavedAnnotation;
  onEdit: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onSeek: (timeMs: number) => void;
}

function MarginNote({ annotation, onEdit, onDelete, onSeek }: MarginNoteProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(annotation.note);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editText.trim() && editText.trim() !== annotation.note) {
      onEdit(annotation.id, editText.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleSave();
    } else if (e.key === "Escape") {
      setEditText(annotation.note);
      setIsEditing(false);
    }
  };

  const handleNoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  return (
    <div
      onClick={() => onSeek(annotation.startMs)}
      className="bg-amber-50 rounded p-3 text-sm cursor-pointer hover:bg-amber-100 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-gray-600 italic line-clamp-2 text-xs font-serif">
          "{annotation.text}"
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(annotation.id);
          }}
          className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        >
          <X size={12} />
        </button>
      </div>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          onClick={(e) => e.stopPropagation()}
          className="w-full mt-1 p-1 text-sm text-gray-800 border border-gray-300 rounded resize-none focus:outline-none focus:border-gray-400 bg-white"
          rows={2}
        />
      ) : (
        <p
          onClick={handleNoteClick}
          className="text-gray-800 mt-1 hover:bg-amber-200/50 rounded px-1 -mx-1 cursor-text"
        >
          {annotation.note}
        </p>
      )}
    </div>
  );
}

interface InlineAnnotationInputProps {
  selectedText: SelectedText;
  onSave: (note: string) => void;
  onCancel: () => void;
}

function InlineAnnotationInput({ selectedText, onSave, onCancel }: InlineAnnotationInputProps) {
  const [noteText, setNoteText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(noteText.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      <p className="text-xs text-gray-600 italic mb-2 font-serif line-clamp-2">
        "{selectedText.text}"
      </p>
      <textarea
        ref={textareaRef}
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a note..."
        className="w-full h-16 p-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-gray-400"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          onClick={onCancel}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!noteText.trim()}
          className="px-2 py-1 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}

export default function Transcript({
  transcript,
  currentTime,
  onSeek,
  annotations,
  onSaveAnnotation,
  onEditAnnotation,
  onDeleteAnnotation,
}: TranscriptProps) {
  const [selectedText, setSelectedText] = useState<SelectedText | null>(null);

  const utterances = getUtterances(transcript.words, transcript.paragraphs);
  const currentTimeMs = currentTime * 1000;

  // Build speaker color map based on unique speaker names
  const speakerColorMap = useMemo(() => {
    const map = new Map<string, string>();
    utterances.forEach((u) => {
      if (u.speaker) getSpeakerColor(u.speaker, map);
    });
    return map;
  }, [utterances]);

  const handleMouseUp = (para: UtteranceParagraph, speaker: string | null) => {
    const selection = window.getSelection()?.toString().trim() || "";
    if (selection.length > 0) {
      // User highlighted text - show inline annotation input
      setSelectedText({ text: selection, paragraph: para, speaker });
      // Clear the browser selection
      window.getSelection()?.removeAllRanges();
    } else {
      // Plain click - seek audio
      onSeek(para.start);
    }
  };

  const handleSaveNote = (note: string) => {
    if (selectedText) {
      onSaveAnnotation(
        selectedText.text,
        note,
        selectedText.speaker,
        selectedText.paragraph.start
      );
      setSelectedText(null);
    }
  };

  const handleCancelNote = () => {
    setSelectedText(null);
  };

  // Get annotations for a specific paragraph
  const getAnnotationsForParagraph = (startMs: number) => {
    return annotations.filter((a) => a.startMs === startMs);
  };

  const skippedIntro = transcript.content_start_ms > 0;
  const skippedOutro =
    transcript.content_end_ms !== null &&
    transcript.content_end_ms < transcript.audio_duration;

  return (
    <div>
      {/* Skipped intro indicator */}
      {skippedIntro && (
        <p className="text-sm text-gray-400 italic mb-4">
          {formatDuration(transcript.content_start_ms)} of intro skipped
        </p>
      )}

      {utterances.map((utterance, index) => (
        <div key={index} className="space-y-1">
          <div className={`flex items-baseline gap-3 ${index === 0 ? "mt-0" : "mt-5"}`}>
            <span className={`text-sm font-medium text-gray-900 px-2 py-0.5 rounded ${getSpeakerColor(utterance.speaker, speakerColorMap)}`}>
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

            const paragraphAnnotations = getAnnotationsForParagraph(para.start);
            const isSelecting = selectedText?.paragraph.start === para.start;

            return (
              <div key={i} className="flex gap-4">
                {/* Transcript text */}
                <div
                  onMouseUp={() => handleMouseUp(para, utterance.speaker)}
                  data-active={isActive ? "true" : undefined}
                  className={`flex-1 cursor-pointer select-text transition-colors rounded -mx-3 px-3 py-1 ${
                    isActive ? "bg-amber-50" : "hover:bg-gray-50"
                  }`}
                >
                  <p className="text-base text-gray-700 leading-7 font-serif">
                    {para.text}
                  </p>
                </div>

                {/* Margin notes column */}
                <div className="w-48 flex-shrink-0 space-y-2">
                  {/* Existing annotations */}
                  {paragraphAnnotations.map((annotation) => (
                    <MarginNote
                      key={annotation.id}
                      annotation={annotation}
                      onEdit={onEditAnnotation}
                      onDelete={onDeleteAnnotation}
                      onSeek={onSeek}
                    />
                  ))}

                  {/* Inline input when selecting text in this paragraph */}
                  {isSelecting && selectedText && (
                    <InlineAnnotationInput
                      selectedText={selectedText}
                      onSave={handleSaveNote}
                      onCancel={handleCancelNote}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {/* Skipped outro indicator */}
      {skippedOutro && (
        <p className="text-sm text-gray-400 italic mt-6">
          {formatDuration(
            transcript.audio_duration - transcript.content_end_ms!
          )}{" "}
          of outro skipped
        </p>
      )}
    </div>
  );
}
