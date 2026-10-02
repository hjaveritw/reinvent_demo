/**
 * CyberRunner 2026 engine — a 1:1 port of the RESS rules recovered from CyberRunner 1998
 * (same constants and order of operations as the Java GameEngine). The server re-validates
 * telemetry against these rules, so they must not drift.
 */
export const C = {
  TICK_MS: 16,
  GRAVITY: 0.6,
  JUMP_VELOCITY: -11.0,
  BASE_SPEED: 4.0,
  SPEED_RAMP: 0.001,
  MAX_SPEED: 14.0,
  OBSTACLE_EVERY: 90,
  MIN_SPAWN_INTERVAL: 30,
  GROUND_Y: 300,
  PLAYER_X: 80,
  PLAYER_W: 24,
  PLAYER_H: 32,
  SPAWN_X: 800,
  DOUBLE_SCORE_SPEED: 8.0,
} as const;

export type PlayerState = 'RUNNING' | 'JUMPING' | 'DEAD';

export interface Obstacle { x: number; width: number; height: number }

export interface GameState {
  tick: number;
  speed: number;
  y: number;
  vy: number;
  distance: number;
  score: number;
  state: PlayerState;
  obstacles: Obstacle[];
}

/** Deterministic PRNG (mulberry32) so runs are reproducible in tests. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const scoreFor = (distance: number, speed: number) => Math.floor(distance / 10) * (speed > C.DOUBLE_SCORE_SPEED ? 2 : 1);
export const spawnInterval = (speed: number) => Math.max(C.MIN_SPAWN_INTERVAL, Math.floor((C.OBSTACLE_EVERY * C.BASE_SPEED) / speed));

export function newGame(): GameState {
  return { tick: 0, speed: C.BASE_SPEED, y: C.GROUND_Y, vy: 0, distance: 0, score: 0, state: 'RUNNING', obstacles: [] };
}

/** BR-04: jump only from the ground, no double jump. */
export function jump(g: GameState) {
  if (g.state === 'RUNNING' && g.y >= C.GROUND_Y) {
    g.vy = C.JUMP_VELOCITY;
    g.state = 'JUMPING';
  }
}

function collides(g: GameState) {
  for (const o of g.obstacles) {
    const xHit = C.PLAYER_X + C.PLAYER_W > o.x && C.PLAYER_X < o.x + o.width;
    const yHit = g.y > C.GROUND_Y - o.height;
    if (xHit && yHit) return true;
  }
  return false;
}

/** One fixed 16 ms step (BR-01..BR-08). */
export function step(g: GameState, random: () => number) {
  g.tick++;
  g.speed = Math.min(C.MAX_SPEED, g.speed + C.SPEED_RAMP);
  if (g.state !== 'DEAD') {
    g.vy += C.GRAVITY;
    g.y += g.vy;
    if (g.y >= C.GROUND_Y) {
      g.y = C.GROUND_Y;
      g.vy = 0;
      if (g.state === 'JUMPING') g.state = 'RUNNING';
    }
    g.distance += g.speed;
    g.score = scoreFor(g.distance, g.speed);
    if (collides(g)) g.state = 'DEAD';
  }
  if (g.tick % spawnInterval(g.speed) === 0) {
    g.obstacles.push({ x: C.SPAWN_X, width: 16 + Math.floor(random() * 24), height: 20 + Math.floor(random() * 30) });
  }
  for (const o of g.obstacles) o.x -= Math.trunc(g.speed);
  g.obstacles = g.obstacles.filter((o) => o.x + o.width >= 0);
}
