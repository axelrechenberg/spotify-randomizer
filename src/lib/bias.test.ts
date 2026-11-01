import { describe, expect, it } from 'vitest'
import { artistStats, fullyIncludedCount, pickTracks, previewBoosts } from './bias'
import type { Track } from './spotify'

// 100 tracks by "other", 10 by "a", 10 by "b", and one collaboration of "a" and "b".
function makeTracks(): Track[] {
  const track = (uri: string, ...artistIds: string[]): Track => ({
    uri,
    name: uri,
    artists: artistIds.map((id) => ({ id, name: id.toUpperCase() })),
  })
  return [
    ...Array.from({ length: 100 }, (_, i) => track(`other${i}`, 'other')),
    ...Array.from({ length: 10 }, (_, i) => track(`a${i}`, 'a')),
    ...Array.from({ length: 10 }, (_, i) => track(`b${i}`, 'b')),
    track('ab', 'a', 'b'),
  ]
}

describe('artistStats', () => {
  it('counts tracks per artist, collaborations included, most tracks first', () => {
    const stats = artistStats(makeTracks())
    expect(stats.map((s) => [s.id, s.trackCount])).toEqual([
      ['other', 100],
      ['a', 11],
      ['b', 11],
    ])
  })
})

describe('pickTracks', () => {
  it('picks the requested number of distinct tracks', () => {
    const picked = pickTracks(makeTracks(), 30, { a: 8 })
    expect(picked).toHaveLength(30)
    expect(new Set(picked.map((t) => t.uri)).size).toBe(30)
  })

  it("always includes every track of an 'all' artist", () => {
    const picked = pickTracks(makeTracks(), 20, { a: 'all' })
    const aTracks = picked.filter((t) => t.artists.some((artist) => artist.id === 'a'))
    expect(aTracks).toHaveLength(11)
  })

  it("takes a random part of the 'all' tracks when they don't fit", () => {
    const picked = pickTracks(makeTracks(), 5, { a: 'all' })
    expect(picked).toHaveLength(5)
    expect(picked.every((t) => t.artists.some((artist) => artist.id === 'a'))).toBe(true)
  })

  it('makes boosted artists more likely', () => {
    // Unboosted, "a" would get ~11 × 30/121 ≈ 2.7 of 30 picks. Boosted ×8 it should get clearly more.
    const preview = previewBoosts(makeTracks(), 30, { a: 8 })
    expect(preview.get('a')).toBeGreaterThan(6)
    expect(preview.get('a')).toBeLessThanOrEqual(11)
  })
})

describe('fullyIncludedCount', () => {
  it("counts tracks by 'all' artists, collaborations once", () => {
    expect(fullyIncludedCount(makeTracks(), { a: 'all', b: 'all' })).toBe(21)
    expect(fullyIncludedCount(makeTracks(), { a: 4 })).toBe(0)
  })
})
