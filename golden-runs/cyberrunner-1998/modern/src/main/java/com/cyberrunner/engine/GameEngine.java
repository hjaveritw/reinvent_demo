package com.cyberrunner.engine;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.locks.ReentrantLock;
import java.util.random.RandomGenerator;

import static com.cyberrunner.engine.GameConstants.*;

/**
 * Deterministic, single-writer game engine. Replaces the legacy global static World guarded by
 * {@code synchronized}; uses a ReentrantLock so virtual threads are never pinned.
 */
public final class GameEngine {
    private final ReentrantLock lock = new ReentrantLock();
    private final RandomGenerator random;
    private final AtomicInteger nextId = new AtomicInteger(1);
    private final List<Player> players = new ArrayList<>();
    private final List<Obstacle> obstacles = new ArrayList<>();
    private double speed = BASE_SPEED;
    private long tick;

    public GameEngine(RandomGenerator random) {
        this.random = random;
    }

    public Player join(String name) {
        lock.lock();
        try {
            Player p = new Player(nextId.getAndIncrement(), name);
            players.add(p);
            return p;
        } finally {
            lock.unlock();
        }
    }

    public void jump(int playerId) {
        lock.lock();
        try {
            find(playerId).ifPresent(Player::jump);
        } finally {
            lock.unlock();
        }
    }

    public Optional<PlayerSnapshot> snapshot(int playerId) {
        lock.lock();
        try {
            return find(playerId).map(Player::snapshot);
        } finally {
            lock.unlock();
        }
    }

    /** One fixed 16 ms step. Order of operations is identical to legacy GameLoop.step(). */
    public StateEvent step() {
        lock.lock();
        try {
            tick++;
            speed = Math.min(MAX_SPEED, speed + SPEED_RAMP);
            for (Player p : players) {
                if (p.state == PlayerState.DEAD) {
                    continue;
                }
                p.vy += GRAVITY;
                p.y += p.vy;
                if (p.y >= GROUND_Y) {
                    p.y = GROUND_Y;
                    p.vy = 0;
                    if (p.state == PlayerState.JUMPING) {
                        p.state = PlayerState.RUNNING;
                    }
                }
                p.distance += speed;
                p.score = scoreFor(p.distance, speed);
                if (collides(p)) {
                    p.state = PlayerState.DEAD;
                }
            }
            if (tick % spawnInterval(speed) == 0) {
                obstacles.add(new Obstacle(SPAWN_X, 16 + random.nextInt(24), 20 + random.nextInt(30)));
            }
            obstacles.forEach(o -> o.x -= (int) speed);
            obstacles.removeIf(o -> o.x + o.width < 0);
            return new StateEvent(tick, speed, players.stream().map(Player::snapshot).toList());
        } finally {
            lock.unlock();
        }
    }

    /** BR-06: 1 point per 10 px travelled, doubled while speed exceeds 8 px/tick. */
    public static int scoreFor(double distance, double speed) {
        return (int) (distance / 10) * (speed > DOUBLE_SCORE_SPEED ? 2 : 1);
    }

    /** BR-07: spawn interval shrinks with speed, floored at 30 ticks. */
    public static int spawnInterval(double speed) {
        return Math.max(MIN_SPAWN_INTERVAL, (int) (OBSTACLE_EVERY * BASE_SPEED / speed));
    }

    public double speed() {
        return speed;
    }

    public long tick() {
        return tick;
    }

    private boolean collides(Player p) {
        for (Obstacle o : obstacles) {
            boolean xHit = PLAYER_X + PLAYER_W > o.x && PLAYER_X < o.x + o.width;
            boolean yHit = p.y > GROUND_Y - o.height;
            if (xHit && yHit) {
                return true;
            }
        }
        return false;
    }

    private Optional<Player> find(int id) {
        return players.stream().filter(p -> p.id() == id).findFirst();
    }
}
