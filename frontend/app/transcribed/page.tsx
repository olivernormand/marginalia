"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { TranscriptListItem } from "@/lib/types";
import { transcriptToCard } from "@/lib/mappers";
import EpisodeCard from "@/components/EpisodeCard";
import { EpisodeListSkeleton } from "@/components/Skeleton";
import * as api from "@/lib/api";

export default function TranscribedPage() {
  const router = useRouter();
  const [transcripts, setTranscripts] = useState<TranscriptListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTranscripts = async () => {
      try {
        const data = await api.getTranscripts();
        setTranscripts(data);
      } catch (err) {
        console.error("Failed to load transcripts:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadTranscripts();
  }, []);

  const handleEpisodeClick = (transcript: TranscriptListItem) => {
    router.push(`/episode?id=${transcript.podcast_id}&guid=${encodeURIComponent(transcript.episode_guid)}`);
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-serif text-gray-900 mb-2">Transcribed</h1>
        <p className="text-gray-500 mb-6">All episodes with transcripts</p>

        {isLoading ? (
          <EpisodeListSkeleton />
        ) : transcripts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <FileText size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">No transcripts yet</p>
            <p className="text-gray-500 text-sm">
              Transcribed episodes will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {transcripts.map((transcript, index) => (
              <EpisodeCard
                key={transcript.id}
                episode={transcriptToCard(transcript)}
                index={index}
                subtitle={transcript.podcast_title}
                showChevron
                onEpisodeClick={() => handleEpisodeClick(transcript)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
