package com.cyberrunner.engine;

/** Mutable player state; only ever touched while the engine lock is held. */
public final class Player {
    private final int id;
    private final String name;
    double y = GameConstants.GROUND_Y;
    double vy;
    double distance;
    int score;
    PlayerState state = PlayerState.RUNNING;

    Player(int id, String name) {
        this.id = id;
        this.name = name;
    }

    /** BR-04: jumping is only allowed from the ground; no double jump. */
    void jump() {
        if (state == PlayerState.RUNNING && y >= GameConstants.GROUND_Y) {
            vy = GameConstants.JUMP_VELOCITY;
            state = PlayerState.JUMPING;
        }
    }

    public int id() {
        return id;
    }

    public String name() {
        return name;
    }

    public double y() {
        return y;
    }

    public double vy() {
        return vy;
    }

    public int score() {
        return score;
    }

    public PlayerState state() {
        return state;
    }

    PlayerSnapshot snapshot() {
        return new PlayerSnapshot(id, y, score, state);
    }
}
