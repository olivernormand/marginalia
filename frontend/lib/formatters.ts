/**
 * Shared formatting utilities used across the app.
 */

/**
 * Format duration in seconds to human readable string (e.g., "1h 30m" or "45 min")
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Format time in milliseconds to m:ss string (e.g., "3:45")
 */
export function formatTimeMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Format time in seconds to mm:ss or hh:mm:ss string (for audio player)
 */
export function formatTimeSeconds(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format duration in milliseconds to verbose string (e.g., "5m 30s")
 */
export function formatDurationVerbose(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

/**
 * Format ISO date string to readable format (e.g., "Jan 15, 2025")
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Strip HTML tags and decode entities from a string, truncated to maxLength
 */
export function stripHtml(html: string | null | undefined, maxLength = 300): string {
  if (!html) return "";
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, " ");
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#8212;/g, "—")
    .replace(/&#8211;/g, "–");
  // Collapse whitespace and trim
  text = text.replace(/\s+/g, " ").trim();
  return text.slice(0, maxLength);
}
