// Deterministic, serialisable PRNG (mulberry32). The state lives in GameState.rng,
// so a reloaded save continues the exact same sequence: no reroll on Save/Load.

export class Rng {
  constructor(public state: number) {}

  next(): number {
    let t = (this.state = (this.state + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** inclusive integer range */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T | undefined {
    const total = items.reduce((a, [, w]) => a + Math.max(0, w), 0);
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const [v, w] of items) {
      if (w <= 0) continue;
      r -= w;
      if (r < 0) return v;
    }
    return items[items.length - 1][0];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  d20(): number {
    return this.int(1, 20);
  }

  /** round a fractional amount stochastically (2.3 -> 2 or 3 with 30% for 3) */
  round(x: number): number {
    const f = Math.floor(x);
    return f + (this.chance(x - f) ? 1 : 0);
  }
}

export function newSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
