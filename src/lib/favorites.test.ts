import { describe, expect, it } from 'vitest'
import type { ArtistStats } from './bias'
import { suggestArtists } from './favorites'

const artist = (id: string, name: string, trackCount: number): ArtistStats => ({ id, name, trackCount })

// Ordered most tracks first, as artistStats returns them.
const artists = [
  artist('a', 'Abba', 9),
  artist('b', 'Beatles', 8),
  artist('c', 'Cream', 7),
  artist('d', 'Doors', 6),
  artist('e', 'Eagles', 5),
]

const ids = (list: ArtistStats[]) => list.map((a) => a.id)

describe('suggestArtists', () => {
  it('without favorites, suggests the artists with the most tracks', () => {
    expect(ids(suggestArtists(artists, new Set(), '', 3))).toEqual(['a', 'b', 'c'])
  })

  it('puts favorites first and fills up to the limit', () => {
    expect(ids(suggestArtists(artists, new Set(['e', 'c']), '', 3))).toEqual(['c', 'e', 'a'])
  })

  it('shows every favorite even beyond the limit', () => {
    expect(ids(suggestArtists(artists, new Set(['b', 'd', 'e']), '', 2))).toEqual(['b', 'd', 'e'])
  })

  it('ignores favorites that are not in the playlist', () => {
    expect(ids(suggestArtists(artists, new Set(['zzz']), '', 2))).toEqual(['a', 'b'])
  })

  it('when searching, lists matching favorites first', () => {
    expect(ids(suggestArtists(artists, new Set(['e']), 'e', 10))).toEqual(['e', 'b', 'c'])
  })

  it('when searching, applies the limit to favorites too', () => {
    expect(ids(suggestArtists(artists, new Set(['c', 'e']), 'a', 1))).toEqual(['c'])
  })
})
