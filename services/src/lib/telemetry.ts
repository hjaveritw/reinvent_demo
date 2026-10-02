/** Server-side mirror of the CyberRunner RESS rules used to validate client telemetry (fixes legacy CWE-602). */
export const RULES = { BASE_SPEED: 4.0, SPEED_RAMP: 0.001, MAX_SPEED: 14.0, DOUBLE_AT: 8.0 };

export interface Sample {
  tick: number;
  distance: number;
  speed: number;
  score: number;
  y?: number;
  state?: 'RUNNING' | 'JUMPING' | 'DEAD';
}

export const expectedSpeed = (tick: number) => Math.min(RULES.MAX_SPEED, RULES.BASE_SPEED + RULES.SPEED_RAMP * tick);
export const expectedScore = (distance: number, speed: number) => Math.floor(distance / 10) * (speed > RULES.DOUBLE_AT ? 2 : 1);

export interface ValidationResult {
  ok: boolean;
  reason?: string;
  lastTick: number;
  lastDistance: number;
  serverScore: number;
  finished: boolean;
}

/** Validates a batch against the previous accepted state. Distance must accumulate exactly the per-tick speed. */
export function validateBatch(prev: { lastTick: number; lastDistance: number }, samples: Sample[]): ValidationResult {
  let { lastTick, lastDistance } = prev;
  let serverScore = 0;
  let finished = false;
  for (const s of samples) {
    if (!Number.isInteger(s.tick) || s.tick <= lastTick) return { ok: false, reason: `non-monotonic tick ${s.tick}`, lastTick, lastDistance, serverScore, finished };
    if (Math.abs(s.speed - expectedSpeed(s.tick)) > 0.01) return { ok: false, reason: `speed ${s.speed} violates BR-05 at tick ${s.tick}`, lastTick, lastDistance, serverScore, finished };
    // Distance can grow by at most the sum of per-tick speeds over the elapsed ticks (dead players stop accruing).
    let maxGain = 0;
    for (let t = lastTick + 1; t <= s.tick; t++) maxGain += expectedSpeed(t);
    if (s.distance < lastDistance - 0.01 || s.distance - lastDistance > maxGain + 0.05) {
      return { ok: false, reason: `distance jump ${(s.distance - lastDistance).toFixed(2)} > ${maxGain.toFixed(2)} at tick ${s.tick}`, lastTick, lastDistance, serverScore, finished };
    }
    if (Math.abs(s.score - expectedScore(s.distance, s.speed)) > 2) return { ok: false, reason: `score ${s.score} violates BR-06 at tick ${s.tick}`, lastTick, lastDistance, serverScore, finished };
    lastTick = s.tick;
    lastDistance = s.distance;
    serverScore = expectedScore(s.distance, s.speed);
    if (s.state === 'DEAD') finished = true;
  }
  return { ok: true, lastTick, lastDistance, serverScore, finished };
}
