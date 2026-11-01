// Thin wrapper around the Spotify Web API.
// https://developer.spotify.com/documentation/web-api

import { getAccessToken } from './auth'

const API_URL = 'https://api.spotify.com/v1'

// Reads are paged at most 50 at a time; writes accept at most 100 URIs per request.
const PAGE_SIZE = 50
const WRITE_BATCH_SIZE = 100

export interface User {
  id: string
  display_name: string | null
}

export interface Playlist {
  id: string
  name: string
  description: string | null
  collaborative: boolean
  owner: { id: string }
  external_urls: { spotify: string }
  images: { url: string }[] | null
  // `items` replaced `tracks` in Feb 2026; read both in case a response still uses the old name.
  items?: { total: number }
  tracks?: { total: number }
}

interface Page<T> {
  items: T[]
  next: string | null
  total: number
}

interface PlaylistItem {
  is_local: boolean
  // `item` replaced `track` in Feb 2026. Null when the track was removed from Spotify.
  item?: { uri: string } | null
  track?: { uri: string } | null
}

interface SavedTrack {
  track: { uri: string } | null
}

export type ProgressCallback = (done: number, total: number) => void

/** Accepts either a path like "/me" or a full URL (as returned in a page's `next` field). */
async function api<T>(pathOrUrl: string, init: RequestInit = {}, retried = false): Promise<T> {
  const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${API_URL}${pathOrUrl}`
  const token = await getAccessToken(retried)
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })

  if (response.status === 401 && !retried) {
    // Token was rejected even though we thought it was valid; refresh and try once more.
    return api(pathOrUrl, init, true)
  }
  if (response.status === 429) {
    const waitSeconds = Number(response.headers.get('Retry-After') ?? '1')
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
    return api(pathOrUrl, init, retried)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(`Spotify API error ${response.status}: ${body.error?.message ?? response.statusText}`)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

function sendJson<T>(method: string, path: string, body: unknown): Promise<T> {
  return api(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Follows `next` links until every page has been fetched. */
async function getAllPages<T>(path: string, onProgress?: ProgressCallback): Promise<T[]> {
  const all: T[] = []
  let next: string | null = path
  while (next) {
    const page: Page<T> = await api(next)
    all.push(...page.items)
    onProgress?.(all.length, page.total)
    next = page.next
  }
  return all
}

export function getCurrentUser(): Promise<User> {
  return api('/me')
}

export function getMyPlaylists(): Promise<Playlist[]> {
  return getAllPages(`/me/playlists?limit=${PAGE_SIZE}`)
}

export function playlistSize(playlist: Playlist): number {
  return playlist.items?.total ?? playlist.tracks?.total ?? 0
}

/** Track URIs of a playlist the user owns or collaborates on. Local files are skipped. */
export async function getPlaylistUris(playlistId: string, onProgress?: ProgressCallback): Promise<string[]> {
  const items = await getAllPages<PlaylistItem>(`/playlists/${playlistId}/items?limit=${PAGE_SIZE}`, onProgress)
  return items
    .filter((entry) => !entry.is_local)
    .map((entry) => (entry.item ?? entry.track)?.uri)
    .filter((uri): uri is string => !!uri)
}

export async function getLikedSongUris(onProgress?: ProgressCallback): Promise<string[]> {
  const items = await getAllPages<SavedTrack>(`/me/tracks?limit=${PAGE_SIZE}`, onProgress)
  return items.map((entry) => entry.track?.uri).filter((uri): uri is string => !!uri)
}

export function createPlaylist(name: string, description: string): Promise<Playlist> {
  return sendJson('POST', '/me/playlists', { name, description, public: false })
}

/** Replaces the whole contents of a playlist, in batches of 100. */
export async function replacePlaylistItems(
  playlistId: string,
  uris: string[],
  onProgress?: ProgressCallback,
): Promise<void> {
  // PUT replaces everything with the first batch (or clears the playlist if there are no URIs),
  // then POST appends the rest in order.
  await sendJson('PUT', `/playlists/${playlistId}/items`, { uris: uris.slice(0, WRITE_BATCH_SIZE) })
  onProgress?.(Math.min(WRITE_BATCH_SIZE, uris.length), uris.length)
  for (let start = WRITE_BATCH_SIZE; start < uris.length; start += WRITE_BATCH_SIZE) {
    await sendJson('POST', `/playlists/${playlistId}/items`, { uris: uris.slice(start, start + WRITE_BATCH_SIZE) })
    onProgress?.(Math.min(start + WRITE_BATCH_SIZE, uris.length), uris.length)
  }
}
