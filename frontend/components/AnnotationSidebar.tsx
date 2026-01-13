"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { SavedAnnotation } from "./Transcript";

interface AnnotationSidebarProps {
  annotations: SavedAnnotation[];
  onClose: () => void;
  onSeek: (timeMs: number) => void;
  onEdit: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface SidebarNoteProps {
  annotation: SavedAnnotation;
  onSeek: (timeMs: number) => void;
  onEdit: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}

function SidebarNote({ annotation, onSeek, onEdit, onDelete }: SidebarNoteProps) {
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
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors group cursor-pointer"
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
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          onClick={(e) => e.stopPropagation()}
          className="w-full p-2 text-sm text-gray-800 border border-gray-300 rounded resize-none focus:outline-none focus:border-gray-400"
          rows={3}
        />
      ) : (
        <p
          onClick={handleNoteClick}
          className="text-sm text-gray-800 hover:bg-gray-100 rounded px-1 -mx-1 cursor-text"
        >
          {annotation.note}
        </p>
      )}
    </div>
  );
}

export default function AnnotationSidebar({
  annotations,
  onClose,
  onSeek,
  onEdit,
  onDelete,
}: AnnotationSidebarProps) {
  if (annotations.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-0 top-0 bottom-0 w-80 border-l border-gray-200 bg-gray-50 flex flex-col z-40">
      <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          All Notes ({annotations.length})
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {annotations.map((annotation) => (
          <SidebarNote
            key={annotation.id}
            annotation={annotation}
            onSeek={onSeek}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
}
