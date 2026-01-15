import { API_BASE } from "./config";
import { Annotation, AnnotationCreate } from "./types";

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
