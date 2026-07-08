import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names safely, resolving conflicts.
 * Standard shadcn/ui utility used throughout the component library.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a UTC timestamp into a human-readable date string.
 * Example: "Jul 8, 2026"
 */
export function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Returns a color class string based on match accuracy percentage.
 * Used for badge coloring on shot cards and the camera HUD.
 *   >= 95  → emerald (perfect match)
 *   >= 70  → amber   (good match)
 *   < 70   → zinc    (needs improvement)
 */
export function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 95) return 'text-emerald-400 border-emerald-500';
  if (accuracy >= 70) return 'text-amber-400 border-amber-500';
  return 'text-zinc-400 border-zinc-700';
}

/**
 * Converts a base64 data URL to a Blob for upload.
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const byteString = atob(base64.split(',')[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeType });
}

/**
 * Appends PinPic's standard mobile compression parameters to any Unsplash URL.
 * Prevents out-of-memory crashes on legacy Android WebViews.
 */
export function optimizeUnsplashUrl(url: string, width: number = 400): string {
  if (!url.includes('unsplash.com')) return url;
  const base = url.split('?')[0];
  return `${base}?w=${width}&q=70&auto=format`;
}

/**
 * Haversine formula — calculates distance in meters between two GPS coordinates.
 * Used as a client-side fallback before the PostGIS ST_DWithin query.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Throttle function — limits how frequently a callback fires.
 * Used to throttle watchPosition GPS updates to reduce battery drain.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return function (...args: Parameters<T>) {
    const now = Date.now();
    if (now - lastCall >= delayMs) {
      lastCall = now;
      fn(...args);
    }
  };
}
