// Ties it together: read a source, shuffle it, write it to that source's target playlist.

import { shuffle } from './shuffle'
import {
  createPlaylist,
  getLikedSongUris,
  getPlaylistUris,
  replacePlaylistItems,
  type Playlist,
  type ProgressCallback,
  type User,
} from './spotify'

export type Source = { kind: 'liked' } | { kind: 'playlist'; playlist: Playlist }

export type Progress = { phase: 'reading' | 'writing'; done: number; total: number }

function sourceKey(source: Source): string {
  return source.kind === 'liked' ? 'liked' : source.playlist.id
}

export function sourceName(source: Source): string {
  return source.kind === 'liked' ? 'Liked Songs' : source.playlist.name
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

export async function randomize(
  source: Source,
  playlists: Playlist[],
  user: User,
  onProgress: (progress: Progress) => void,
): Promise<Playlist> {
  const reading: ProgressCallback = (done, total) => onProgress({ phase: 'reading', done, total })
  const uris =
    source.kind === 'liked'
      ? await getLikedSongUris(reading)
      : await getPlaylistUris(source.playlist.id, reading)

  const marker = targetMarker(source)
  const target =
    playlists.find((p) => p.owner.id === user.id && p.description?.includes(marker)) ??
    (await createPlaylist(
      `🔀 ${sourceName(source)}`,
      `Shuffled copy of ${sourceName(source)}. Play in order with shuffle off. ${marker}`,
    ))

  await replacePlaylistItems(target.id, shuffle(uris), (done, total) =>
    onProgress({ phase: 'writing', done, total }),
  )
  return target
}
