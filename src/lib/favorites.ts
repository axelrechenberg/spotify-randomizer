// Favorite artists: shared across all playlists, stored in this browser per Spotify account.

import type { ArtistStats } from './bias'

function storageKey(userId: string): string {
  return `favorite-artists:${userId}`
}

/** Favorite artist IDs of the user. Empty if nothing is stored or storage is unavailable. */
export function loadFavorites(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveFavorites(userId: string, artistIds: Iterable<string>): void {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify([...artistIds]))
  } catch {
    // Storage full or blocked (e.g. private mode): favorites just won't persist.
  }
}

/**
 * Artists to suggest. Without a query: every favorite, then the artists with the most tracks until
 * there are `limit` suggestions. With a query: up to `limit` matching artists, favorites first.
 * Keeps the order of `artists` within favorites and non-favorites.
 */
export function suggestArtists(
  artists: ArtistStats[],
  favorites: ReadonlySet<string>,
  query: string,
  limit: number,
): ArtistStats[] {
  const q = query.trim().toLowerCase()
  const matching = q ? artists.filter((artist) => artist.name.toLowerCase().includes(q)) : artists
  const favored = matching.filter((artist) => favorites.has(artist.id))
  const others = matching.filter((artist) => !favorites.has(artist.id))
  if (q) return [...favored, ...others].slice(0, limit)
  return [...favored, ...others.slice(0, Math.max(0, limit - favored.length))]
}
