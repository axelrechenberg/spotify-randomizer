import { describe, expect, it } from 'vitest'
import { sample, shuffle, weightedSample } from './shuffle'

describe('shuffle', () => {
  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 1000 }, (_, i) => i)
    const shuffled = shuffle(items)
    expect(shuffled).toHaveLength(items.length)
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items)
  })

  it('does not modify the input', () => {
    const items = [1, 2, 3, 4, 5]
    shuffle(items)
    expect(items).toEqual([1, 2, 3, 4, 5])
  })

  it('handles empty and single-item lists', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['a'])).toEqual(['a'])
  })

  it('produces every ordering about equally often', () => {
    // 3 items have 6 orderings; with 60,000 runs each should appear ~10,000 times.
    const counts = new Map<string, number>()
    for (let i = 0; i < 60_000; i++) {
      const key = shuffle(['a', 'b', 'c']).join('')
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    expect(counts.size).toBe(6)
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(9_000)
      expect(count).toBeLessThan(11_000)
    }
  })
})

describe('sample', () => {
  it('picks the requested number of distinct items', () => {
    const items = Array.from({ length: 200 }, (_, i) => i)
    const picked = sample(items, 100)
    expect(picked).toHaveLength(100)
    expect(new Set(picked).size).toBe(100)
    for (const item of picked) expect(items).toContain(item)
  })

  it('returns everything when asked for more than there is', () => {
    expect(sample([1, 2, 3], 10).sort()).toEqual([1, 2, 3])
  })

  it('gives every item the same chance', () => {
    // Picking 1 of 4 items 40,000 times: each should be picked ~10,000 times.
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 40_000; i++) counts[sample([0, 1, 2, 3], 1)[0]]++
    for (const count of counts) {
      expect(count).toBeGreaterThan(9_000)
      expect(count).toBeLessThan(11_000)
    }
  })
})

describe('weightedSample', () => {
  it('picks the requested number of distinct items', () => {
    const items = Array.from({ length: 200 }, (_, i) => i)
    const picked = weightedSample(items, 50, (i) => (i % 2 ? 4 : 1))
    expect(picked).toHaveLength(50)
    expect(new Set(picked).size).toBe(50)
  })

  it('returns everything when asked for more than there is', () => {
    expect(weightedSample([1, 2, 3], 10, () => 1).sort()).toEqual([1, 2, 3])
  })

  it('picks items in proportion to their weight', () => {
    // Weights 1 and 3: picking one item, 'b' should win ~75% of 40,000 runs.
    let b = 0
    for (let i = 0; i < 40_000; i++) if (weightedSample(['a', 'b'], 1, (x) => (x === 'b' ? 3 : 1))[0] === 'b') b++
    expect(b).toBeGreaterThan(29_000)
    expect(b).toBeLessThan(31_000)
  })
})
