/** Uniformly random integer in [0, max), from the browser's cryptographic RNG. */
function randomInt(max: number): number {
  // Rejection sampling: drop values from the incomplete top range so every result is equally likely.
  const limit = Math.floor(0x1_0000_0000 / max) * max
  const buffer = new Uint32Array(1)
  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)
  return buffer[0] % max
}

/** Returns a shuffled copy using Fisher–Yates: every ordering is equally likely. */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/** Picks `count` items uniformly at random, returned in random order. */
export function sample<T>(items: readonly T[], count: number): T[] {
  return shuffle(items).slice(0, count)
}

/** `count` floats in (0, 1] from the cryptographic RNG, generated in bulk for speed. */
function randomUnitFloats(count: number): Float64Array {
  const result = new Float64Array(count)
  // getRandomValues fills at most 64 KiB per call.
  const chunk = new Uint32Array(16_384)
  for (let start = 0; start < count; start += chunk.length) {
    crypto.getRandomValues(chunk)
    const end = Math.min(count, start + chunk.length)
    for (let i = start; i < end; i++) result[i] = (chunk[i - start] + 1) / 0x1_0000_0000
  }
  return result
}

/**
 * Picks `count` items at random without replacement, where in every draw an item with weight 4
 * is four times as likely to be picked as an item with weight 1 (the Efraimidis–Spirakis method).
 * The result favours heavy items at the front, so shuffle it if order matters.
 */
export function weightedSample<T>(items: readonly T[], count: number, weight: (item: T) => number): T[] {
  // Each item gets the key u^(1/weight) for a random u; the `count` largest keys win.
  // log(u) / weight sorts the same way and doesn't underflow for large weights.
  const u = randomUnitFloats(items.length)
  return items
    .map((item, i) => ({ item, key: Math.log(u[i]) / weight(item) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, count)
    .map(({ item }) => item)
}
