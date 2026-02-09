import seedrandom from 'seedrandom';

let rng = seedrandom('mump2p-default');

export function setSeed(seed: string) {
  rng = seedrandom(seed);
}

/** Returns a random float in [0, 1) */
export function random(): number {
  return rng();
}

/** Returns a random integer in [min, max] inclusive */
export function randomInt(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Box-Muller transform for normal distribution, clamped to [min, max] */
export function randomNormal(
  mean: number,
  stdDev: number,
  min: number,
  max: number,
): number {
  let u1 = rng();
  let u2 = rng();
  // Avoid log(0)
  if (u1 === 0) u1 = 0.0001;
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const value = mean + z * stdDev;
  return Math.max(min, Math.min(max, value));
}

/** Shuffle an array in-place (Fisher-Yates) */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
