"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { SelectedText } from "./Transcript";

export interface SavedAnnotation {
  id: string;
  text: string;
  note: string;
  speaker: string | null;
  startMs: number;
}

interface AnnotationSidebarProps {
  selectedText: SelectedText | null;
  annotations: SavedAnnotation[];
  onSave: (note: string) => void;
  onCancel: () => void;
  onSeek: (timeMs: number) => void;
  onDelete: (id: string) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export default function AnnotationSidebar({
  selectedText,
  annotations,
  onSave,
  onCancel,
  onSeek,
  onDelete,
}: AnnotationSidebarProps) {
  const [noteText, setNoteText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when selection changes
  useEffect(() => {
    if (selectedText && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedText]);

  // Clear note text when selection is cleared
  useEffect(() => {
    if (!selectedText) {
      setNoteText("");
    }
  }, [selectedText]);

  const handleSave = () => {
    if (noteText.trim()) {
      onSave(noteText.trim());
      setNoteText("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.metaKey) {
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  const isEmpty = !selectedText && annotations.length === 0;

  if (isEmpty) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 border-l border-gray-200 bg-gray-50 flex flex-col z-40">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-medium text-gray-900">Notes</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* New annotation input */}
        {selectedText && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-gray-500 font-mono">
                {formatTime(selectedText.paragraph.start)}
                {selectedText.speaker && ` · ${selectedText.speaker}`}
              </span>
              <button
                onClick={onCancel}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-gray-700 italic mb-3 font-serif">
              "{selectedText.text}"
            </p>
            <textarea
              ref={textareaRef}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a note..."
              className="w-full h-20 p-2 text-sm border border-gray-200 rounded resize-none focus:outline-none focus:border-gray-400"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSave}
                disabled={!noteText.trim()}
                className="px-3 py-1 text-sm bg-gray-900 text-white rounded hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Saved annotations */}
        {annotations.map((annotation) => (
          <button
            key={annotation.id}
            onClick={() => onSeek(annotation.startMs)}
            className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors group"
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-xs text-gray-500 font-mono">
                {formatTime(annotation.startMs)}
                {annotation.speaker && ` · ${annotation.speaker}`}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(annotation.id);
                }}
                className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-gray-600 italic mb-2 font-serif line-clamp-2">
              "{annotation.text}"
            </p>
            <p className="text-sm text-gray-800">{annotation.note}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
