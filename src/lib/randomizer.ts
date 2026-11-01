// Ties it together: load a source's tracks, pick and shuffle them, write them to that source's
// target playlist.

import { sample } from './shuffle'
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

/** Playlists whose contents the API lets us read: owned or collaborative, excluding our own targets. */
export function selectableSources(playlists: Playlist[], user: User): Playlist[] {
  return playlists.filter(
    (p) => (p.owner.id === user.id || p.collaborative) && !isTargetPlaylist(p),
  )
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

/** Writes `count` randomly picked tracks, in random order, to the source's target playlist. */
export async function createRandomPlaylist(
  source: Source,
  tracks: Track[],
  count: number,
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

  const picked = sample(tracks, count)
  await replacePlaylistItems(target.id, picked.map((track) => track.uri), onProgress)
  return target
}
