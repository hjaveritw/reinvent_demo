import { describe, expect, it } from 'vitest';
import { C, jump, newGame, rng, scoreFor, spawnInterval, step } from './engine';

describe('CyberRunner 2026 engine parity with RESS', () => {
  it('BR-02/03 jump then gravity in the same tick', () => {
    const g = newGame();
    jump(g);
    step(g, rng(1));
    expect(g.vy).toBeCloseTo(-10.4, 9);
    expect(g.y).toBeCloseTo(289.6, 9);
    expect(g.state).toBe('JUMPING');
  });

  it('BR-04 no double jump', () => {
    const g = newGame();
    jump(g);
    step(g, rng(1));
    const vy = g.vy;
    jump(g);
    step(g, rng(1));
    expect(g.vy).toBeCloseTo(vy + C.GRAVITY, 9);
  });

  it('BR-05 speed ramp and cap', () => {
    const g = newGame();
    step(g, rng(1));
    expect(g.speed).toBeCloseTo(4.001, 9);
    g.state = 'DEAD';
    for (let i = 0; i < 20_000; i++) step(g, rng(1));
    expect(g.speed).toBe(C.MAX_SPEED);
  });

  it('BR-06/07 scoring and spawn cadence', () => {
    expect(scoreFor(1000, 8)).toBe(100);
    expect(scoreFor(1000, 8.01)).toBe(200);
    expect(spawnInterval(4)).toBe(90);
    expect(spawnInterval(8)).toBe(45);
    expect(spawnInterval(14)).toBe(30);
  });

  it('BR-08 a run without jumping ends in collision', () => {
    const g = newGame();
    const r = rng(42);
    while (g.state !== 'DEAD' && g.tick < 5000) step(g, r);
    expect(g.state).toBe('DEAD');
    expect(g.score).toBeGreaterThan(0);
  });
});
