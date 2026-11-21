// Biases for picking a random subset: boosted artists and recently added tracks are more likely.

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

/**
 * Recency bias: a track added at the same time as the playlist's newest track is `strength` times
 * as likely as an old one, and that extra weight halves every `halfLifeDays`. null: no recency bias.
 */
export type Recency = { halfLifeDays: 14 | 30 | 90; strength: 2 | 4 | 8 } | null

export const RECENCY_PERIODS: { value: Exclude<Recency, null>['halfLifeDays']; label: string }[] = [
  { value: 14, label: '2 weeks' },
  { value: 30, label: 'month' },
  { value: 90, label: '3 months' },
]

export const RECENCY_STRENGTHS: { value: Exclude<Recency, null>['strength']; label: string }[] = [
  { value: 2, label: 'slightly' },
  { value: 4, label: 'moderately' },
  { value: 8, label: 'strongly' },
]

const DAY_MS = 24 * 60 * 60 * 1000

/** When the most recently added track was added, in ms since 1970; 0 if no track has a date. */
export function newestAddedAt(tracks: Track[]): number {
  return tracks.reduce((newest, track) => Math.max(newest, track.addedAt), 0)
}

/**
 * Each track's recency weight: `strength` for the newest, fading towards 1 as the track gets older
 * than the newest one. Ages count from the newest track rather than today, so a playlist that hasn't
 * been added to in a while still prefers its latest additions. Tracks without a date weigh 1.
 */
export function recencyWeights(tracks: Track[], recency: Exclude<Recency, null>): number[] {
  const newest = newestAddedAt(tracks)
  return tracks.map((track) => {
    if (track.addedAt === 0) return 1
    const ageDays = (newest - track.addedAt) / DAY_MS
    return 1 + (recency.strength - 1) * 0.5 ** (ageDays / recency.halfLifeDays)
  })
}

function isIncludedInFull(track: Track, boosts: Boosts): boolean {
  return track.artists.some((artist) => boosts[artist.id] === 'all')
}

/** The track's highest numeric artist boost, so collaborations of boosted artists don't multiply up. */
function highestBoost(track: Track, boosts: Boosts): number | null {
  let result: number | null = null
  for (const artist of track.artists) {
    const boost = boosts[artist.id]
    if (typeof boost === 'number' && (result === null || boost > result)) result = boost
  }
  return result
}

interface Candidate {
  track: Track
  /** By an artist boosted with 'all'. */
  full: boolean
  weight: number
}

/**
 * Weights every track. Without boosts, a track's weight is its recency weight (1 without recency
 * bias). Boosted artists ignore recency: their
 * tracks get the boost times the average weight, so ×2 still means twice a typical track, and old
 * tracks aren't held back. A track whose recency weight is higher keeps that, so a boost never
 * makes a recently added track less likely.
 */
function candidates(tracks: Track[], boosts: Boosts, recency: Recency): Candidate[] {
  const byRecency = recency ? recencyWeights(tracks, recency) : tracks.map(() => 1)
  const average = byRecency.reduce((sum, weight) => sum + weight, 0) / Math.max(tracks.length, 1)
  return tracks.map((track, i) => {
    const boost = highestBoost(track, boosts)
    return {
      track,
      full: isIncludedInFull(track, boosts),
      weight: boost === null ? byRecency[i] : Math.max(boost * average, byRecency[i]),
    }
  })
}

/** Number of tracks by artists boosted with 'all'. */
export function fullyIncludedCount(tracks: Track[], boosts: Boosts): number {
  return tracks.filter((track) => isIncludedInFull(track, boosts)).length
}

/** Picks `count` tracks, in no meaningful order. */
function select(candidates: Candidate[], count: number): Track[] {
  const included: Track[] = []
  const rest: Candidate[] = []
  for (const candidate of candidates) {
    if (candidate.full) included.push(candidate.track)
    else rest.push(candidate)
  }

  // More 'all' tracks than fit: take a random selection of them.
  if (included.length >= count) return sample(included, count)
  const picked = weightedSample(rest, count - included.length, (candidate) => candidate.weight)
  return [...included, ...picked.map((candidate) => candidate.track)]
}

/** Picks `count` tracks according to the boosts and recency bias, in random order. */
export function pickTracks(tracks: Track[], count: number, boosts: Boosts, recency: Recency = null): Track[] {
  return shuffle(select(candidates(tracks, boosts, recency), count))
}

/**
 * Expected number of picked tracks per artist in `artistIds`, estimated by running the pick many
 * times. Fewer runs for big playlists keep it fast; the result is shown as an approximation anyway.
 */
export function previewPicks(
  tracks: Track[],
  count: number,
  boosts: Boosts,
  recency: Recency,
  artistIds: string[],
): Map<string, number> {
  const runs = Math.max(30, Math.min(300, Math.floor(300_000 / Math.max(tracks.length, 1))))
  const weighted = candidates(tracks, boosts, recency)
  const totals = new Map(artistIds.map((id) => [id, 0]))
  for (let run = 0; run < runs; run++) {
    for (const track of select(weighted, count)) {
      for (const artist of track.artists) {
        const total = totals.get(artist.id)
        if (total !== undefined) totals.set(artist.id, total + 1)
      }
    }
  }
  for (const [id, total] of totals) totals.set(id, total / runs)
  return totals
}
