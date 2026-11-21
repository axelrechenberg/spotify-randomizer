import { describe, expect, it } from 'vitest'
import { artistStats, fullyIncludedCount, pickTracks, previewPicks, recencyWeights } from './bias'
import type { Track } from './spotify'

// 100 tracks by "other", 10 by "a", 10 by "b", and one collaboration of "a" and "b".
function makeTracks(): Track[] {
  const track = (uri: string, ...artistIds: string[]): Track => ({
    uri,
    name: uri,
    artists: artistIds.map((id) => ({ id, name: id.toUpperCase() })),
    addedAt: 0,
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
    const preview = previewPicks(makeTracks(), 30, { a: 8 }, null, ['a'])
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

const day = (n: number) => new Date(2026, 0, 1).getTime() + n * 24 * 60 * 60 * 1000

// 90 tracks by "old" bulk-added on day 0, then 10 by "new" added on days 90 to 99.
function makeDatedTracks(): Track[] {
  const track = (uri: string, artistId: string, addedAt: number): Track => ({
    uri,
    name: uri,
    artists: [{ id: artistId, name: artistId }],
    addedAt,
  })
  return [
    ...Array.from({ length: 90 }, (_, i) => track(`old${i}`, 'old', day(0) + i * 3000)),
    ...Array.from({ length: 10 }, (_, i) => track(`new${i}`, 'new', day(90 + i))),
  ]
}

describe('recencyWeights', () => {
  const at = (...addedAt: number[]): Track[] => addedAt.map((time, i) => ({ uri: `t${i}`, name: '', artists: [], addedAt: time }))

  it('halves the extra weight every half-life, counted from the newest track', () => {
    const weights = recencyWeights(at(day(100), day(70), day(40), day(10)), { halfLifeDays: 30, strength: 4 })
    expect(weights[0]).toBe(4)
    expect(weights[1]).toBeCloseTo(2.5)
    expect(weights[2]).toBeCloseTo(1.75)
    expect(weights[3]).toBeCloseTo(1.375)
  })

  it('gives tracks without a date weight 1', () => {
    expect(recencyWeights(at(day(5), 0), { halfLifeDays: 14, strength: 8 })).toEqual([8, 1])
  })

  it('treats a bulk import like any other tracks of that age', () => {
    const weights = recencyWeights(makeDatedTracks(), { halfLifeDays: 30, strength: 4 })
    const imported = weights.slice(0, 90)
    expect(Math.max(...imported) - Math.min(...imported)).toBeLessThan(0.01)
    expect(weights[90]).toBeCloseTo(1 + 3 * 0.5 ** 0.3)
  })
})

describe('recency bias', () => {
  const recency = { halfLifeDays: 14, strength: 8 } as const

  // Without bias, "new" gets 10 × 20/100 = 2 of 20 picks on average.
  it('makes recently added tracks more likely', () => {
    const preview = previewPicks(makeDatedTracks(), 20, {}, recency, ['new'])
    expect(preview.get('new')).toBeGreaterThan(5)
  })

  it('has no effect when switched off', () => {
    const preview = previewPicks(makeDatedTracks(), 20, {}, null, ['new'])
    expect(preview.get('new')).toBeGreaterThan(1)
    expect(preview.get('new')).toBeLessThan(3)
  })

  it('does not hold back boosted artists', () => {
    // The average weight is ≈ 1.6, so a ×8 boost weighs ≈ 13: more than any new track.
    const preview = previewPicks(makeDatedTracks(), 20, { old: 8 }, recency, ['old', 'new'])
    expect(preview.get('old')).toBeGreaterThan(preview.get('new')!)
  })
})
