// Artist boosts: make some artists' tracks more likely to end up in a random subset.

import { sample, shuffle, weightedSample } from './shuffle'
import type { Artist, Track } from './spotify'

/** A weight multiplier, or 'all' to include every track by the artist. */
export type Boost = 2 | 4 | 8 | 'all'

/** Boost per artist ID. Artists without an entry have normal weight. */
export type Boosts = Record<string, Boost>

export const BOOST_LEVELS: { value: Boost; label: string }[] = [
  { value: 2, label: '×2' },
  { value: 4, label: '×4' },
  { value: 8, label: '×8' },
  { value: 'all', label: 'All tracks' },
]

export interface ArtistStats extends Artist {
  trackCount: number
}

/** Every artist in the tracks with their number of tracks, most tracks first. */
export function artistStats(tracks: Track[]): ArtistStats[] {
  const byId = new Map<string, ArtistStats>()
  for (const track of tracks) {
    for (const artist of track.artists) {
      const stats = byId.get(artist.id)
      if (stats) stats.trackCount++
      else byId.set(artist.id, { id: artist.id, name: artist.name, trackCount: 1 })
    }
  }
  return [...byId.values()].sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name))
}

function isIncludedInFull(track: Track, boosts: Boosts): boolean {
  return track.artists.some((artist) => boosts[artist.id] === 'all')
}

/** A track's weight is its highest artist boost, so collaborations of boosted artists don't multiply up. */
function weight(track: Track, boosts: Boosts): number {
  let result = 1
  for (const artist of track.artists) {
    const boost = boosts[artist.id]
    if (typeof boost === 'number' && boost > result) result = boost
  }
  return result
}

/** Number of tracks by artists boosted with 'all'. */
export function fullyIncludedCount(tracks: Track[], boosts: Boosts): number {
  return tracks.filter((track) => isIncludedInFull(track, boosts)).length
}

/** Picks `count` tracks, in no meaningful order. */
function select(tracks: Track[], count: number, boosts: Boosts): Track[] {
  const included: Track[] = []
  const rest: Track[] = []
  for (const track of tracks) (isIncludedInFull(track, boosts) ? included : rest).push(track)

  // More 'all' tracks than fit: take a random selection of them.
  if (included.length >= count) return sample(included, count)
  return [...included, ...weightedSample(rest, count - included.length, (track) => weight(track, boosts))]
}

/** Picks `count` tracks according to the boosts, in random order. */
export function pickTracks(tracks: Track[], count: number, boosts: Boosts): Track[] {
  return shuffle(select(tracks, count, boosts))
}

/**
 * Expected number of picked tracks per boosted artist, estimated by running the pick many times.
 * Fewer runs for big playlists keep it fast; the result is shown as an approximation anyway.
 */
export function previewBoosts(tracks: Track[], count: number, boosts: Boosts): Map<string, number> {
  const runs = Math.max(30, Math.min(300, Math.floor(300_000 / Math.max(tracks.length, 1))))
  const totals = new Map(Object.keys(boosts).map((id) => [id, 0]))
  for (let run = 0; run < runs; run++) {
    for (const track of select(tracks, count, boosts)) {
      for (const artist of track.artists) {
        const total = totals.get(artist.id)
        if (total !== undefined) totals.set(artist.id, total + 1)
      }
    }
  }
  for (const [id, total] of totals) totals.set(id, total / runs)
  return totals
}
