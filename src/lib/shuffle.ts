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
