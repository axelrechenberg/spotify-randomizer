// Sources and target playlists: which playlists can be shuffled, loading a source's tracks, and
// writing the picked tracks to that source's target playlist.

import {
  createPlaylist,
  getLikedSongs,
  getPlaylistTracks,
  replacePlaylistItems,
  type Playlist,
  type ProgressCallback,
  type Track,
  type User,
} from './spotify'

export type Source = { kind: 'liked' } | { kind: 'playlist'; playlist: Playlist }

function sourceKey(source: Source): string {
  return source.kind === 'liked' ? 'liked' : source.playlist.id
}

export function sourceName(source: Source): string {
  return source.kind === 'liked' ? 'Liked Songs' : source.playlist.name
}

export function sameSource(a: Source | null, b: Source | null): boolean {
  return !!a && !!b && sourceKey(a) === sourceKey(b)
}

// The target playlist is recognised by this marker in its description, so it is found again
// on any device and even after the user renames it.
function targetMarker(source: Source): string {
  return `(randomizer:${sourceKey(source)})`
}

export function isTargetPlaylist(playlist: Playlist): boolean {
  return playlist.description?.includes('(randomizer:') ?? false
}

/**
 * Playlists whose contents the API lets us read (owned or collaborative, excluding our own
 * targets), sorted alphabetically.
 */
export function selectableSources(playlists: Playlist[], user: User): Playlist[] {
  return playlists
    .filter((p) => (p.owner.id === user.id || p.collaborative) && !isTargetPlaylist(p))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
}

/** All tracks of a source, with duplicates (the same track added twice) removed. */
export async function loadTracks(source: Source, onProgress: ProgressCallback): Promise<Track[]> {
  const tracks =
    source.kind === 'liked'
      ? await getLikedSongs(onProgress)
      : await getPlaylistTracks(source.playlist.id, onProgress)

  const seen = new Set<string>()
  return tracks.filter((track) => !seen.has(track.uri) && seen.add(track.uri))
}

/** Replaces the contents of the source's target playlist with `tracks`, creating it if needed. */
export async function saveToTarget(
  source: Source,
  tracks: Track[],
  playlists: Playlist[],
  user: User,
  onProgress: ProgressCallback,
): Promise<Playlist> {
  const marker = targetMarker(source)
  const target =
    playlists.find((p) => p.owner.id === user.id && p.description?.includes(marker)) ??
    (await createPlaylist(
      `🔀 ${sourceName(source)}`,
      `Random picks from ${sourceName(source)}. Play in order with shuffle off. ${marker}`,
    ))

  await replacePlaylistItems(target.id, tracks.map((track) => track.uri), onProgress)
  return target
}
