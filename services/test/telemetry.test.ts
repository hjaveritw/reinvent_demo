import { describe, expect, it } from 'vitest';
import { expectedScore, expectedSpeed, validateBatch } from '../src/lib/telemetry';

function simulate(ticks: number) {
  const out = [];
  let distance = 0;
  for (let t = 1; t <= ticks; t++) {
    const speed = expectedSpeed(t);
    distance += speed;
    out.push({ tick: t, distance, speed, score: expectedScore(distance, speed), state: 'RUNNING' as const });
  }
  return out;
}

describe('telemetry validation (server-authoritative scoring)', () => {
  it('accepts an honest run', () => {
    const s = simulate(120);
    const r = validateBatch({ lastTick: 0, lastDistance: 0 }, s);
    expect(r.ok).toBe(true);
    expect(r.serverScore).toBe(s.at(-1)!.score);
  });

  it('rejects injected scores (legacy CWE-602)', () => {
    const s = simulate(30);
    s[29] = { ...s[29], score: 999_999 };
    expect(validateBatch({ lastTick: 0, lastDistance: 0 }, s).ok).toBe(false);
  });

  it('rejects speed hacks and teleporting', () => {
    const s = simulate(30);
    expect(validateBatch({ lastTick: 0, lastDistance: 0 }, [{ ...s[0], speed: 10 }]).ok).toBe(false);
    expect(validateBatch({ lastTick: 0, lastDistance: 0 }, [{ ...s[5], distance: 5000, score: expectedScore(5000, s[5].speed) }]).ok).toBe(false);
  });

  it('rejects replayed ticks', () => {
    const s = simulate(10);
    expect(validateBatch({ lastTick: 10, lastDistance: s[9].distance }, s).ok).toBe(false);
  });
});
