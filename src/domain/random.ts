export function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}

export function nextRandom(state: number): { state: number; value: number } {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  next >>>= 0;
  return { state: next || 1, value: next / 4294967296 };
}

export function randomInt(state: number, min: number, max: number): { state: number; value: number } {
  const result = nextRandom(state);
  return {
    state: result.state,
    value: min + Math.floor(result.value * (max - min + 1)),
  };
}
