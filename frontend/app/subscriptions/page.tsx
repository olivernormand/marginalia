"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Rss, ChevronRight } from "lucide-react";
import { Subscription } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { EpisodeListSkeleton } from "@/components/Skeleton";
import * as api from "@/lib/api";

export default function SubscriptionsPage() {
  const router = useRouter();
  const { session, user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    const loadSubscriptions = async () => {
      try {
        const data = await api.getSubscriptions(session.access_token);
        setSubscriptions(data);
      } catch (err) {
        console.error("Failed to load subscriptions:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSubscriptions();
  }, [session?.access_token]);

  const handlePodcastClick = (subscription: Subscription) => {
    router.push(`/podcast?id=${subscription.podcast_id}`);
  };

  if (!user) {
    return (
      <div className="min-h-screen">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <h1 className="text-3xl font-serif text-gray-900 mb-4">Subscriptions</h1>
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Rss size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">Sign in to see your subscriptions</p>
            <p className="text-gray-500 text-sm">
              Your subscribed podcasts will appear here
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-8 py-8">
        <h1 className="text-3xl font-serif text-gray-900 mb-6">Subscriptions</h1>

        {isLoading ? (
          <EpisodeListSkeleton />
        ) : subscriptions.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Rss size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-900 font-medium mb-1">No subscriptions yet</p>
            <p className="text-gray-500 text-sm">
              Subscribe to podcasts to see them here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {subscriptions.map((subscription) => (
              <button
                key={subscription.id}
                onClick={() => handlePodcastClick(subscription)}
                className="w-full flex gap-4 p-4 hover:bg-gray-50 transition-all duration-200 rounded-lg text-left group"
              >
                {subscription.artwork_url ? (
                  <img
                    src={subscription.artwork_url}
                    alt=""
                    className="w-16 h-16 rounded-md object-cover flex-shrink-0 shadow-sm group-hover:shadow-md transition-shadow duration-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Rss size={24} className="text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 group-hover:text-gray-700 line-clamp-1">
                    {subscription.podcast_title}
                  </h3>
                  {subscription.podcast_author && (
                    <p className="text-sm text-gray-500">{subscription.podcast_author}</p>
                  )}
                </div>
                <ChevronRight
                  size={20}
                  className="text-gray-300 group-hover:text-gray-500 flex-shrink-0 self-center transition-colors duration-200"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
