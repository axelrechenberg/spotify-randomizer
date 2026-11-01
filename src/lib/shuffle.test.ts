import { describe, expect, it } from 'vitest'
import { shuffle } from './shuffle'

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
