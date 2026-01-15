import { API_BASE } from "./config";
import {
  Annotation,
  AnnotationCreate,
  Subscription,
  SubscriptionCreate,
  SavedEpisode,
  SavedEpisodeCreate,
  TranscriptListItem,
} from "./types";

/**
 * Fetch with auth token from Supabase session
 */
async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return fetch(url, { ...options, headers });
}

// --- Annotation API ---

export async function getAnnotations(
  token: string,
  episodeGuid?: string,
  podcastId?: number
): Promise<Annotation[]> {
  const params = new URLSearchParams();
  if (episodeGuid) params.set("episode_guid", episodeGuid);
  if (podcastId) params.set("podcast_id", podcastId.toString());

  const url = `${API_BASE}/annotations${params.toString() ? `?${params}` : ""}`;
  const response = await fetchWithAuth(url, {}, token);

  if (!response.ok) {
    throw new Error("Failed to fetch annotations");
  }

  return response.json();
}

export async function createAnnotation(
  token: string,
  annotation: AnnotationCreate
): Promise<Annotation> {
  const response = await fetchWithAuth(
    `${API_BASE}/annotations`,
    {
      method: "POST",
      body: JSON.stringify(annotation),
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to create annotation");
  }

  return response.json();
}

export async function updateAnnotation(
  token: string,
  annotationId: string,
  note: string
): Promise<Annotation> {
  const response = await fetchWithAuth(
    `${API_BASE}/annotations/${annotationId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ note }),
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to update annotation");
  }

  return response.json();
}

export async function deleteAnnotation(
  token: string,
  annotationId: string
): Promise<void> {
  const response = await fetchWithAuth(
    `${API_BASE}/annotations/${annotationId}`,
    {
      method: "DELETE",
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to delete annotation");
  }
}

// --- Subscription API ---

export async function getSubscriptions(token: string): Promise<Subscription[]> {
  const response = await fetchWithAuth(`${API_BASE}/subscriptions`, {}, token);

  if (!response.ok) {
    throw new Error("Failed to fetch subscriptions");
  }

  return response.json();
}

export async function getSubscription(
  token: string,
  podcastId: number
): Promise<Subscription | null> {
  const response = await fetchWithAuth(
    `${API_BASE}/subscriptions/${podcastId}`,
    {},
    token
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to check subscription");
  }

  return response.json();
}

export async function createSubscription(
  token: string,
  subscription: SubscriptionCreate
): Promise<Subscription> {
  const response = await fetchWithAuth(
    `${API_BASE}/subscriptions`,
    {
      method: "POST",
      body: JSON.stringify(subscription),
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to subscribe");
  }

  return response.json();
}

export async function deleteSubscription(
  token: string,
  podcastId: number
): Promise<void> {
  const response = await fetchWithAuth(
    `${API_BASE}/subscriptions/${podcastId}`,
    {
      method: "DELETE",
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to unsubscribe");
  }
}

// --- Saved Episodes API ---

export async function getSavedEpisodes(token: string): Promise<SavedEpisode[]> {
  const response = await fetchWithAuth(`${API_BASE}/saved-episodes`, {}, token);

  if (!response.ok) {
    throw new Error("Failed to fetch saved episodes");
  }

  return response.json();
}

export async function getSavedEpisode(
  token: string,
  episodeGuid: string
): Promise<SavedEpisode | null> {
  const response = await fetchWithAuth(
    `${API_BASE}/saved-episodes/${encodeURIComponent(episodeGuid)}`,
    {},
    token
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to check saved episode");
  }

  return response.json();
}

export async function createSavedEpisode(
  token: string,
  episode: SavedEpisodeCreate
): Promise<SavedEpisode> {
  const response = await fetchWithAuth(
    `${API_BASE}/saved-episodes`,
    {
      method: "POST",
      body: JSON.stringify(episode),
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to save episode");
  }

  return response.json();
}

export async function deleteSavedEpisode(
  token: string,
  episodeGuid: string
): Promise<void> {
  const response = await fetchWithAuth(
    `${API_BASE}/saved-episodes/${encodeURIComponent(episodeGuid)}`,
    {
      method: "DELETE",
    },
    token
  );

  if (!response.ok) {
    throw new Error("Failed to unsave episode");
  }
}

// --- Transcripts List API ---

export async function getTranscripts(): Promise<TranscriptListItem[]> {
  const response = await fetch(`${API_BASE}/transcripts`);

  if (!response.ok) {
    throw new Error("Failed to fetch transcripts");
  }

  return response.json();
}
