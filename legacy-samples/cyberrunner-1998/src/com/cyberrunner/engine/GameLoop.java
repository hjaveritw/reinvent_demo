package com.cyberrunner.engine;

import com.cyberrunner.net.Protocol;
import com.cyberrunner.server.GameServer;

/**
 * Fixed-step game loop. Ticks at ~60Hz using Thread.sleep(16).
 * All physics constants were tuned by hand in 1998 and are undocumented.
 */
public class GameLoop implements Runnable {
    public static final int TICK_MS = 16;            // ~60 Hz
    public static final double GRAVITY = 0.6;        // px/tick^2
    public static final double JUMP_VELOCITY = -11.0; // px/tick
    public static final double BASE_SPEED = 4.0;     // px/tick
    public static final double SPEED_RAMP = 0.001;   // px/tick added every tick
    public static final double MAX_SPEED = 14.0;
    public static final int OBSTACLE_EVERY = 90;     // ticks between spawns at base speed
    public static final int GROUND_Y = 300;

    public static World world = new World();
    public static long tick = 0;

    public void run() {
        while (GameServer.running) {
            synchronized (world) {
                step();
            }
            GameServer.broadcast(Protocol.encodeState(world, tick));
            try {
                Thread.sleep(TICK_MS);
            } catch (InterruptedException e) {
                // ignored
            }
        }
    }

    static void step() {
        tick++;
        world.speed = Math.min(MAX_SPEED, world.speed + SPEED_RAMP);
        for (int i = 0; i < world.players.size(); i++) {
            Player p = (Player) world.players.elementAt(i);
            if (p.state == Player.DEAD) continue;
            p.vy += GRAVITY;
            p.y += p.vy;
            if (p.y >= GROUND_Y) {
                p.y = GROUND_Y;
                p.vy = 0;
                if (p.state == Player.JUMPING) p.state = Player.RUNNING;
            }
            p.distance += world.speed;
            // score: 1 point per 10px travelled, x2 when speed > 8
            p.score = (int) (p.distance / 10) * (world.speed > 8 ? 2 : 1);
            if (world.collides(p)) {
                p.state = Player.DEAD;
            }
        }
        int spawnEvery = (int) (OBSTACLE_EVERY * BASE_SPEED / world.speed);
        if (tick % Math.max(30, spawnEvery) == 0) {
            world.spawnObstacle();
        }
        world.advanceObstacles();
    }
}
