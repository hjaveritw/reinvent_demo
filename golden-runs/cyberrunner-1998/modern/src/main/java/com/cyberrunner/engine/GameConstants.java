package com.cyberrunner.engine;

/** Physics and timing constants recovered verbatim from legacy GameLoop/World (RESS rules BR-01..BR-09). */
public final class GameConstants {
    public static final long TICK_MS = 16;
    public static final double GRAVITY = 0.6;
    public static final double JUMP_VELOCITY = -11.0;
    public static final double BASE_SPEED = 4.0;
    public static final double SPEED_RAMP = 0.001;
    public static final double MAX_SPEED = 14.0;
    public static final int OBSTACLE_EVERY = 90;
    public static final int MIN_SPAWN_INTERVAL = 30;
    public static final int GROUND_Y = 300;
    public static final int PLAYER_X = 80;
    public static final int PLAYER_W = 24;
    public static final int SPAWN_X = 800;
    public static final double DOUBLE_SCORE_SPEED = 8.0;

    private GameConstants() {
    }
}
